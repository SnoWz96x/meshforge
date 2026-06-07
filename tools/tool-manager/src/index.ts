#!/usr/bin/env tsx
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import type { InstalledTool, LockFile, ToolEntry } from "@meshforge/shared-types";
import { DEFAULT_MANIFEST } from "./manifest.js";
import {
  downloadFile,
  extractZip,
  git,
  latestGithubCommit,
  latestGithubRelease,
  sha256File,
} from "./util.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const AUX = join(REPO_ROOT, "auxiliary-tools");
const LOCK_PATH = join(AUX, "manifest.lock.json");
const DOWNLOADS = join(AUX, "downloads");

async function readLock(): Promise<LockFile> {
  if (!existsSync(LOCK_PATH)) {
    return { schemaVersion: 1, updatedAt: new Date().toISOString(), tools: {} };
  }
  return JSON.parse(await readFile(LOCK_PATH, "utf8")) as LockFile;
}

async function writeLock(lock: LockFile): Promise<void> {
  lock.updatedAt = new Date().toISOString();
  await mkdir(AUX, { recursive: true });
  await writeFile(LOCK_PATH, JSON.stringify(lock, null, 2) + "\n", "utf8");
}

async function installGit(
  name: string,
  entry: Extract<ToolEntry, { type: "git" }>,
): Promise<InstalledTool> {
  const target = join(AUX, name);
  if (!existsSync(join(target, ".git"))) {
    console.log(`  ↪ clonando ${entry.repo}`);
    await git(["clone", entry.repo, target]);
  } else {
    console.log(`  ↪ repo já existe, atualizando refs`);
    await git(["fetch", "--all", "--tags"], target);
  }
  const ref = entry.pinnedCommit || entry.trackRef;
  await git(["checkout", ref], target);
  const commit = await git(["rev-parse", "HEAD"], target);
  console.log(`  ✓ ${name} @ ${commit.slice(0, 10)}`);
  return {
    tool: name,
    type: "git",
    version: commit,
    commitHash: commit,
    installedAt: new Date().toISOString(),
    path: target,
  };
}

async function installRelease(
  name: string,
  entry: Extract<ToolEntry, { type: "release" }>,
): Promise<InstalledTool> {
  const fileName = `${name}-${entry.version}.zip`;
  const zipPath = join(DOWNLOADS, fileName);
  const target = join(AUX, name);
  if (!existsSync(zipPath)) {
    console.log(`  ↪ baixando ${entry.url}`);
    await downloadFile(entry.url, zipPath);
  }
  const sha = await sha256File(zipPath);
  if (entry.sha256 && entry.sha256 !== sha) {
    throw new Error(`SHA256 não confere para ${name}: esperado ${entry.sha256}, obtido ${sha}`);
  }
  console.log(`  ↪ extraindo para ${target}`);
  await extractZip(zipPath, target);
  console.log(`  ✓ ${name} v${entry.version} (sha256 ${sha.slice(0, 12)})`);
  return {
    tool: name,
    type: "release",
    version: entry.version,
    sha256: sha,
    installedAt: new Date().toISOString(),
    path: target,
  };
}

async function cmdInstall(): Promise<void> {
  console.log("📦 Instalando auxiliary-tools...\n");
  await mkdir(AUX, { recursive: true });
  const lock = await readLock();
  for (const [name, entry] of Object.entries(DEFAULT_MANIFEST)) {
    console.log(`▸ ${name}`);
    try {
      const installed =
        entry.type === "git" ? await installGit(name, entry) : await installRelease(name, entry);
      lock.tools[name] = installed;
      await writeLock(lock);
    } catch (err) {
      console.error(`  ✗ ${name}: ${(err as Error).message}`);
    }
    console.log("");
  }
  console.log(`✅ Lockfile atualizado: ${LOCK_PATH}`);
}

async function cmdCheck(): Promise<void> {
  console.log("🔎 Verificando atualizações (sem aplicar)...\n");
  const lock = await readLock();
  for (const [name, entry] of Object.entries(DEFAULT_MANIFEST)) {
    const current = lock.tools[name];
    try {
      if (entry.type === "git") {
        const latest = await latestGithubCommit(entry.repo, entry.trackRef);
        const up = current?.commitHash === latest;
        console.log(
          `▸ ${name}: instalado ${current?.commitHash?.slice(0, 10) ?? "—"} | ` +
            `${entry.trackRef} ${latest.slice(0, 10)} ${up ? "✓ atual" : "⬆ nova versão"}`,
        );
      } else if (entry.githubRepo) {
        const latest = await latestGithubRelease(entry.githubRepo);
        const up = latest === null || current?.version === latest;
        console.log(
          `▸ ${name}: instalado ${current?.version ?? "—"} | ` +
            `release ${latest ?? "?"} ${up ? "✓ atual" : "⬆ nova versão"}`,
        );
      }
    } catch (err) {
      console.error(`▸ ${name}: erro ao checar (${(err as Error).message})`);
    }
  }
}

async function cmdVerify(): Promise<void> {
  console.log("🔐 Verificando integridade dos artefatos instalados...\n");
  const lock = await readLock();
  let ok = true;
  for (const [name, installed] of Object.entries(lock.tools)) {
    if (!existsSync(installed.path)) {
      console.error(`▸ ${name}: ✗ caminho ausente (${installed.path})`);
      ok = false;
      continue;
    }
    if (installed.type === "git") {
      const head = await git(["rev-parse", "HEAD"], installed.path).catch(() => "?");
      const match = head === installed.commitHash;
      console.log(`▸ ${name}: HEAD ${head.slice(0, 10)} ${match ? "✓" : "✗ divergente"}`);
      ok &&= match;
    } else {
      const info = await stat(installed.path);
      console.log(`▸ ${name}: presente (${info.isDirectory() ? "dir" : "arquivo"}) ✓`);
    }
  }
  console.log(ok ? "\n✅ Integridade OK" : "\n⚠ Divergências encontradas");
  if (!ok) process.exitCode = 1;
}

/** Working tree com alterações locais? (protege patches como o do ZLUDA.) */
async function gitDirty(target: string): Promise<boolean> {
  const out = await git(["status", "--porcelain"], target).catch(() => "");
  return out.trim().length > 0;
}

/**
 * Atualiza ferramentas para a ponta do `trackRef` (git), com segurança:
 *  - simulação por padrão; só aplica com `--yes`/`-y`;
 *  - `update <tool>` limita a uma ferramenta;
 *  - não sobrescreve árvore suja (evita perder patches locais) — a não ser com `--force`;
 *  - rollback ao commit anterior se o checkout falhar;
 *  - lockfile só muda em caso de sucesso;
 *  - `release` (binários) não é auto-atualizado (fixado por versão no manifesto).
 */
async function cmdUpdate(): Promise<void> {
  const args = process.argv.slice(3);
  const apply = args.includes("--yes") || args.includes("-y");
  const force = args.includes("--force");
  const only = args.find((a) => !a.startsWith("-"));
  const entries = Object.entries(DEFAULT_MANIFEST).filter(([name]) => !only || name === only);
  if (only && entries.length === 0) {
    console.error(`Ferramenta desconhecida: ${only}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    apply
      ? "⬆ Atualizando ferramentas...\n"
      : "⬆ Atualização — simulação (use --yes para aplicar)...\n",
  );

  const lock = await readLock();
  let pending = 0;
  let changed = false;

  for (const [name, entry] of entries) {
    const current = lock.tools[name];
    try {
      if (entry.type !== "git") {
        const latest = entry.githubRepo ? await latestGithubRelease(entry.githubRepo) : null;
        const note =
          latest && latest !== `v${entry.version}` && latest !== entry.version
            ? ` (upstream ${latest})`
            : "";
        console.log(`▸ ${name}: release fixado em v${entry.version} no manifesto${note}`);
        console.log(
          "  ℹ binários 'release' não são auto-atualizados (segurança). Para mover de versão:" +
            " edite a URL/version/sha256 no manifesto e rode 'install'.",
        );
        continue;
      }

      const latest = await latestGithubCommit(entry.repo, entry.trackRef);
      if (current?.commitHash === latest) {
        console.log(`▸ ${name}: ✓ já atual (${latest.slice(0, 10)})`);
        continue;
      }
      pending++;
      console.log(
        `▸ ${name}: ${current?.commitHash?.slice(0, 10) ?? "—"} → ${latest.slice(0, 10)} (${entry.trackRef})`,
      );
      if (!apply) continue;

      const target = join(AUX, name);
      if (!existsSync(join(target, ".git"))) {
        console.error("  ✗ não instalado; rode 'install' primeiro");
        continue;
      }
      if (!force && (await gitDirty(target))) {
        console.error(
          "  ⚠ árvore de trabalho com alterações locais (ex.: patch ZLUDA) — pulado p/ não perder. Use --force para sobrescrever.",
        );
        continue;
      }
      const prev =
        current?.commitHash ?? (await git(["rev-parse", "HEAD"], target).catch(() => ""));
      await git(["fetch", "--all", "--tags"], target);
      try {
        await git(["checkout", latest], target);
        const head = await git(["rev-parse", "HEAD"], target);
        lock.tools[name] = {
          tool: name,
          type: "git",
          version: head,
          commitHash: head,
          installedAt: new Date().toISOString(),
          path: target,
        };
        await writeLock(lock);
        changed = true;
        console.log(`  ✓ atualizado para ${head.slice(0, 10)}`);
      } catch (err) {
        console.error(`  ✗ checkout falhou: ${(err as Error).message}`);
        if (prev) {
          await git(["checkout", prev], target).catch(() => undefined);
          console.error(`  ↩ rollback para ${prev.slice(0, 10)}`);
        }
      }
    } catch (err) {
      console.error(`▸ ${name}: erro (${(err as Error).message})`);
    }
  }

  if (!apply && pending > 0) {
    console.log(
      `\n${pending} atualização(ões) pendente(s). Rode 'update${only ? ` ${only}` : ""} --yes' para aplicar.`,
    );
  } else if (apply) {
    console.log(changed ? "\n✅ Lockfile atualizado." : "\nNada aplicado.");
  } else {
    console.log("\n✓ Tudo atual.");
  }
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  switch (cmd) {
    case "install":
      return cmdInstall();
    case "check":
      return cmdCheck();
    case "verify":
      return cmdVerify();
    case "update":
      return cmdUpdate();
    default:
      console.log(
        "Uso: meshforge-tools <comando>\n\n" +
          "  install          Clona/baixa e fixa as ferramentas (atualiza lockfile)\n" +
          "  check            Reporta versões mais novas disponíveis (não aplica)\n" +
          "  verify           Revalida integridade do que está instalado\n" +
          "  update [tool]     Atualiza git tools p/ a ponta do trackRef (simulação;\n" +
          "                    --yes aplica, --force ignora árvore suja). Rollback se falhar.\n",
      );
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

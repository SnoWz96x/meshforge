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
        entry.type === "git"
          ? await installGit(name, entry)
          : await installRelease(name, entry);
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

async function main(): Promise<void> {
  const cmd = process.argv[2];
  switch (cmd) {
    case "install":
      return cmdInstall();
    case "check":
      return cmdCheck();
    case "verify":
      return cmdVerify();
    default:
      console.log(
        "Uso: meshforge-tools <comando>\n\n" +
          "  install   Clona/baixa e fixa as ferramentas (atualiza lockfile)\n" +
          "  check     Reporta versões mais novas disponíveis (não aplica)\n" +
          "  verify    Revalida integridade do que está instalado\n",
      );
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

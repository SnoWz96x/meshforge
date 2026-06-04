import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

export function run(
  cmd: string,
  args: string[],
  cwd?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

export async function git(args: string[], cwd?: string): Promise<string> {
  const { code, stdout, stderr } = await run("git", args, cwd);
  if (code !== 0) {
    throw new Error(`git ${args.join(" ")} falhou (code ${code}): ${stderr.trim()}`);
  }
  return stdout.trim();
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

export async function downloadFile(url: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download falhou ${res.status} ${res.statusText}: ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(dest));
}

// Extrai .zip usando o tar nativo do Windows 10+/Linux (suporta zip).
export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const { code, stderr } = await run("tar", ["-xf", zipPath, "-C", destDir]);
  if (code !== 0) {
    throw new Error(`Falha ao extrair ${zipPath}: ${stderr.trim()}`);
  }
}

function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(0, i) : ".";
}

// Consulta o último commit de um branch via API do GitHub (sem auth).
export async function latestGithubCommit(repo: string, ref: string): Promise<string> {
  const m = repo.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!m) throw new Error(`Repo GitHub inválido: ${repo}`);
  const url = `https://api.github.com/repos/${m[1]}/${m[2]}/commits/${ref}`;
  const res = await fetch(url, { headers: { "User-Agent": "meshforge" } });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`);
  const json = (await res.json()) as { sha: string };
  return json.sha;
}

export async function latestGithubRelease(ownerRepo: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${ownerRepo}/releases/latest`;
  const res = await fetch(url, { headers: { "User-Agent": "meshforge" } });
  if (!res.ok) return null;
  const json = (await res.json()) as { tag_name?: string };
  return json.tag_name ?? null;
}

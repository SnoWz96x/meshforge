import { createReadStream, existsSync, type ReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

// URI no formato `local:<key>` onde key é um caminho relativo à raiz de storage.
// Ex.: local:projects/abc123/render.png
export const STORAGE_SCHEME = "local";

export interface StorageDriver {
  readonly root: string;
  put(key: string, data: Buffer | Uint8Array): Promise<string>;
  get(key: string): Promise<Buffer>;
  exists(key: string): boolean;
  size(key: string): Promise<number>;
  removeUnder(prefix: string): Promise<void>;
  localPath(key: string): string;
  stream(key: string): ReadStream;
  toUri(key: string): string;
  keyFromUri(uri: string): string;
}

export class LocalStorage implements StorageDriver {
  readonly root: string;

  constructor(root = process.env.STORAGE_LOCAL_PATH ?? "./storage") {
    this.root = resolve(root);
  }

  localPath(key: string): string {
    // Impede path traversal para fora da raiz.
    const p = resolve(this.root, key);
    if (!p.startsWith(this.root)) {
      throw new Error(`Chave de storage inválida (fora da raiz): ${key}`);
    }
    return p;
  }

  async put(key: string, data: Buffer | Uint8Array): Promise<string> {
    const p = this.localPath(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
    return this.toUri(key);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.localPath(key));
  }

  exists(key: string): boolean {
    return existsSync(this.localPath(key));
  }

  async size(key: string): Promise<number> {
    return (await stat(this.localPath(key))).size;
  }

  async removeUnder(prefix: string): Promise<void> {
    await rm(this.localPath(prefix), { recursive: true, force: true });
  }

  stream(key: string): ReadStream {
    return createReadStream(this.localPath(key));
  }

  toUri(key: string): string {
    return `${STORAGE_SCHEME}:${key.replace(/\\/g, "/")}`;
  }

  keyFromUri(uri: string): string {
    if (!uri.startsWith(`${STORAGE_SCHEME}:`)) {
      throw new Error(`URI de storage não suportada: ${uri}`);
    }
    return uri.slice(STORAGE_SCHEME.length + 1);
  }
}

// Convenção de chaves de assets.
export function assetKey(projectId: string, assetId: string, ext: string): string {
  return join("projects", projectId, `${assetId}.${ext}`).replace(/\\/g, "/");
}

// Driver default a partir do ambiente.
export function createStorage(): StorageDriver {
  // STORAGE_DRIVER=s3 será adicionado depois; por ora, local.
  return new LocalStorage();
}

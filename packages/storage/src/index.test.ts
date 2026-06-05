import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalStorage, STORAGE_SCHEME, assetKey } from "./index.js";

describe("LocalStorage", () => {
  let root: string;
  let storage: LocalStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mf-storage-"));
    storage = new LocalStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("put/get round-trip preserva os bytes", async () => {
    const data = Buffer.from("forge-heat");
    const uri = await storage.put("projects/p1/a.bin", data);
    expect(uri).toBe(`${STORAGE_SCHEME}:projects/p1/a.bin`);
    const back = await storage.get("projects/p1/a.bin");
    expect(back.equals(data)).toBe(true);
  });

  it("exists e size refletem o arquivo gravado", async () => {
    expect(storage.exists("x/y.bin")).toBe(false);
    await storage.put("x/y.bin", Buffer.from("abcd"));
    expect(storage.exists("x/y.bin")).toBe(true);
    expect(await storage.size("x/y.bin")).toBe(4);
  });

  it("removeUnder apaga uma subárvore inteira", async () => {
    await storage.put("projects/p2/a.bin", Buffer.from("a"));
    await storage.put("projects/p2/sub/b.bin", Buffer.from("b"));
    await storage.removeUnder("projects/p2");
    expect(storage.exists("projects/p2/a.bin")).toBe(false);
    expect(storage.exists("projects/p2/sub/b.bin")).toBe(false);
  });

  it("removeUnder é idempotente (prefixo inexistente não lança)", async () => {
    await expect(storage.removeUnder("projects/none")).resolves.toBeUndefined();
  });

  it("bloqueia path traversal para fora da raiz", () => {
    expect(() => storage.localPath("../../etc/passwd")).toThrow(/fora da raiz/);
  });

  it("toUri normaliza separadores e keyFromUri faz o inverso", () => {
    const uri = storage.toUri("projects\\p1\\a.png");
    expect(uri).toBe(`${STORAGE_SCHEME}:projects/p1/a.png`);
    expect(storage.keyFromUri(uri)).toBe("projects/p1/a.png");
  });

  it("keyFromUri rejeita esquema não suportado", () => {
    expect(() => storage.keyFromUri("s3:bucket/obj")).toThrow(/não suportada/);
  });
});

describe("assetKey", () => {
  it("monta a chave com forward slashes", () => {
    expect(assetKey("proj", "asset", "glb")).toBe("projects/proj/asset.glb");
  });
});

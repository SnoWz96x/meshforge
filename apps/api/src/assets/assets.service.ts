import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import AdmZip from "adm-zip";
import { AssetKind } from "@meshforge/shared-types";
import { assetKey } from "@meshforge/storage";
import { PrismaService } from "../prisma.service.js";
import { StorageService } from "../storage.service.js";

const execFileAsync = promisify(execFile);

// Formatos de exportação suportados (via Blender headless). Multi-arquivo (obj,
// gltf têm sidecars) são empacotados em .zip.
export const EXPORT_FORMATS = ["glb", "gltf", "obj", "fbx", "stl", "usdz", "ply"] as const;
const MULTIFILE = new Set(["obj", "gltf"]);

const BLENDER_PATH =
  process.env.BLENDER_PATH ??
  resolve(process.cwd(), "../../auxiliary-tools/blender/blender-4.2.3-windows-x64/blender.exe");
const EXPORT_SCRIPT =
  process.env.BLENDER_EXPORT_SCRIPT ??
  resolve(process.cwd(), "../../services/blender-service/export_mesh.py");

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  obj: "text/plain",
  fbx: "application/octet-stream",
  stl: "model/stl",
  usdz: "model/vnd.usdz+zip",
  ply: "application/octet-stream",
  zip: "application/zip",
};

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  mime(format: string): string {
    return MIME[format.toLowerCase()] ?? "application/octet-stream";
  }

  async uploadImage(projectId: string, data: Buffer, ext: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Projeto ${projectId} não encontrado`);

    const id = randomUUID();
    const format = ext.replace(/^\./, "").toLowerCase() || "png";
    const key = assetKey(projectId, id, format);
    const uri = await this.storage.driver.put(key, data);

    return this.prisma.asset.create({
      data: {
        id,
        projectId,
        kind: AssetKind.IMAGE,
        format,
        storageUri: uri,
        sizeBytes: BigInt(data.length),
      },
    });
  }

  /** Exporta uma malha (.glb) para outro formato via Blender headless. */
  async export(id: string, format: string) {
    const fmt = format.toLowerCase();
    if (!(EXPORT_FORMATS as readonly string[]).includes(fmt)) {
      throw new BadRequestException(`Formato não suportado: ${format}`);
    }
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException(`Asset ${id} não encontrado`);
    if (asset.format !== "glb") {
      throw new BadRequestException("A exportação parte de uma malha .glb");
    }
    const srcPath = this.storage.driver.localPath(this.storage.driver.keyFromUri(asset.storageUri));

    const dir = await mkdtemp(join(tmpdir(), "mf-export-"));
    try {
      const outFile = join(dir, `model.${fmt}`);
      await execFileAsync(
        BLENDER_PATH,
        [
          "--background",
          "--factory-startup",
          "--python",
          EXPORT_SCRIPT,
          "--",
          srcPath,
          outFile,
          fmt,
        ],
        { timeout: 180_000, maxBuffer: 1024 * 1024 * 64 },
      );

      const files = await readdir(dir);
      if (!files.length) throw new BadRequestException("Exportação não gerou arquivos");

      let data: Buffer;
      let outFormat: string;
      let meta: Record<string, unknown> = { source: id, exported: fmt };
      if (MULTIFILE.has(fmt) && files.length > 1) {
        const zip = new AdmZip();
        for (const f of files) zip.addLocalFile(join(dir, f));
        data = zip.toBuffer();
        outFormat = "zip";
        meta = { ...meta, archive: "zip" };
      } else {
        data = await readFile(join(dir, `model.${fmt}`));
        outFormat = fmt;
      }

      const newId = randomUUID();
      const key = assetKey(asset.projectId, newId, outFormat);
      const uri = await this.storage.driver.put(key, data);
      return this.prisma.asset.create({
        data: {
          id: newId,
          projectId: asset.projectId,
          kind: AssetKind.EXPORT,
          format: outFormat,
          storageUri: uri,
          sizeBytes: BigInt(data.length),
          meta: meta as object,
        },
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  async open(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException(`Asset ${id} não encontrado`);
    const key = this.storage.driver.keyFromUri(asset.storageUri);
    if (!this.storage.driver.exists(key)) {
      throw new NotFoundException(`Arquivo do asset ${id} ausente no storage`);
    }
    return { asset, stream: this.storage.driver.stream(key), mime: this.mime(asset.format) };
  }
}

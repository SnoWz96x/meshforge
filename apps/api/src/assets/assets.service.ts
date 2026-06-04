import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AssetKind } from "@meshforge/shared-types";
import { assetKey } from "@meshforge/storage";
import { PrismaService } from "../prisma.service.js";
import { StorageService } from "../storage.service.js";

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

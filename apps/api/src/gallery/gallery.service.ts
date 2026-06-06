import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AssetKind } from "@meshforge/shared-types";
import { assetKey } from "@meshforge/storage";
import { PrismaService } from "../prisma.service.js";
import { StorageService } from "../storage.service.js";

// Galeria de modelos 3D open-source (CC0). Fonte: registro ToxSam/open-source-3d-assets
// (991+ GLBs CC0, JSON no GitHub) — sem API key. Só importamos de domínios confiáveis.
const BASE =
  process.env.GALLERY_BASE ??
  "https://raw.githubusercontent.com/ToxSam/open-source-3d-assets/main/data";
const ALLOWED_HOST = "raw.githubusercontent.com";

export interface GalleryModel {
  id: string;
  name: string;
  thumb: string;
  url: string;
  license: string;
  creator: string;
  collection: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}

@Injectable()
export class GalleryService {
  private cache: { at: number; models: GalleryModel[] } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(search?: string, limit = 60): Promise<GalleryModel[]> {
    const all = await this.load();
    const q = search?.trim().toLowerCase();
    const filtered = q
      ? all.filter((m) => `${m.name} ${m.collection}`.toLowerCase().includes(q))
      : all;
    return filtered.slice(0, Math.min(200, Math.max(1, limit)));
  }

  private async load(): Promise<GalleryModel[]> {
    if (this.cache && Date.now() - this.cache.at < 3_600_000) return this.cache.models;

    type Project = {
      asset_data_file: string;
      is_public: boolean;
      license: string;
      creator_id: string;
      name: string;
    };
    type RawAsset = {
      id: string;
      name: string;
      format?: string;
      model_file_url?: string;
      thumbnail_url?: string;
    };

    const projects = await fetchJson<Project[]>(`${BASE}/projects.json`);
    const models: GalleryModel[] = [];
    await Promise.all(
      projects
        .filter((p) => p.is_public && p.asset_data_file)
        .map(async (p) => {
          try {
            const assets = await fetchJson<RawAsset[]>(`${BASE}/${p.asset_data_file}`);
            for (const a of assets) {
              if (a.format?.toUpperCase() === "GLB" && a.model_file_url) {
                models.push({
                  id: a.id,
                  name: a.name,
                  thumb: a.thumbnail_url ?? "",
                  url: a.model_file_url,
                  license: p.license,
                  creator: p.creator_id,
                  collection: p.name,
                });
              }
            }
          } catch {
            /* coleção indisponível — ignora */
          }
        }),
    );
    models.sort((a, b) => a.name.localeCompare(b.name));
    this.cache = { at: Date.now(), models };
    return models;
  }

  /** Importa um GLB da galeria para a biblioteca do projeto. */
  async import(projectId: string, url: string, name: string) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException("URL inválida");
    }
    if (parsed.protocol !== "https:" || parsed.host !== ALLOWED_HOST) {
      throw new BadRequestException("URL de modelo não permitida");
    }
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Projeto ${projectId} não encontrado`);

    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new BadRequestException(`Download falhou (${res.status})`);
    const data = Buffer.from(await res.arrayBuffer());

    const id = randomUUID();
    const key = assetKey(projectId, id, "glb");
    const uri = await this.storage.driver.put(key, data);
    return this.prisma.asset.create({
      data: {
        id,
        projectId,
        kind: AssetKind.MESH_RAW,
        format: "glb",
        storageUri: uri,
        sizeBytes: BigInt(data.length),
        meta: { source: "gallery", name, sourceUrl: url },
      },
    });
  }
}

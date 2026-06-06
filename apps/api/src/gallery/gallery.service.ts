import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { AssetKind } from "@meshforge/shared-types";
import { assetKey } from "@meshforge/storage";
import { PrismaService } from "../prisma.service.js";
import { StorageService } from "../storage.service.js";

const execFileAsync = promisify(execFile);

// ─── Fontes open-source de modelos 3D (todas livres, sem API key) ────────────
//  cc0      → ToxSam/open-source-3d-assets (991+ GLBs CC0)
//  khronos  → glTF Sample Assets (modelos showcase, CC0/CC-BY)
//  polyhaven→ Poly Haven (CC0, modelos realistas; baixados como glTF e
//             convertidos para GLB com o Blender headless)
const TOXSAM_BASE = "https://raw.githubusercontent.com/ToxSam/open-source-3d-assets/main/data";
const KHRONOS_BASE =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models";
const POLYHAVEN_API = "https://api.polyhaven.com";

const ALLOWED_HOSTS = new Set([
  "raw.githubusercontent.com",
  "dl.polyhaven.org",
  "api.polyhaven.com",
]);

const BLENDER_PATH =
  process.env.BLENDER_PATH ??
  resolve(process.cwd(), "../../auxiliary-tools/blender/blender-4.2.3-windows-x64/blender.exe");
const EXPORT_SCRIPT =
  process.env.BLENDER_EXPORT_SCRIPT ??
  resolve(process.cwd(), "../../services/blender-service/export_mesh.py");

export type GallerySource = "cc0" | "khronos" | "polyhaven";

export interface GalleryModel {
  id: string;
  name: string;
  thumb: string;
  url: string; // GLB direto (cc0/khronos) ou id do asset (polyhaven)
  license: string;
  creator: string;
  collection: string;
  source: GallerySource;
}

async function fetchJson<T>(url: string, ms = 15_000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
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

  async list(search?: string, limit = 60, source?: string): Promise<GalleryModel[]> {
    let all = await this.load();
    if (source) all = all.filter((m) => m.source === source);
    const q = search?.trim().toLowerCase();
    if (q)
      all = all.filter((m) => `${m.name} ${m.collection} ${m.creator}`.toLowerCase().includes(q));
    return all.slice(0, Math.min(300, Math.max(1, limit)));
  }

  async sources() {
    const all = await this.load();
    const count = (s: GallerySource) => all.filter((m) => m.source === s).length;
    return [
      { id: "cc0", label: "CC0 Registry", count: count("cc0") },
      { id: "khronos", label: "glTF Samples", count: count("khronos") },
      { id: "polyhaven", label: "Poly Haven", count: count("polyhaven") },
    ];
  }

  private async load(): Promise<GalleryModel[]> {
    if (this.cache && Date.now() - this.cache.at < 3_600_000) return this.cache.models;
    const results = await Promise.allSettled([
      this.loadToxsam(),
      this.loadKhronos(),
      this.loadPolyHaven(),
    ]);
    const models = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    models.sort((a, b) => a.name.localeCompare(b.name));
    this.cache = { at: Date.now(), models };
    return models;
  }

  // ─── ToxSam CC0 registry ───────────────────────────────────────────────────
  private async loadToxsam(): Promise<GalleryModel[]> {
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
    const projects = await fetchJson<Project[]>(`${TOXSAM_BASE}/projects.json`);
    const out: GalleryModel[] = [];
    await Promise.all(
      projects
        .filter((p) => p.is_public && p.asset_data_file)
        .map(async (p) => {
          try {
            const assets = await fetchJson<RawAsset[]>(`${TOXSAM_BASE}/${p.asset_data_file}`);
            for (const a of assets) {
              if (a.format?.toUpperCase() === "GLB" && a.model_file_url) {
                out.push({
                  id: `cc0:${a.id}`,
                  name: a.name,
                  thumb: a.thumbnail_url ?? "",
                  url: a.model_file_url,
                  license: p.license,
                  creator: p.creator_id,
                  collection: p.name,
                  source: "cc0",
                });
              }
            }
          } catch {
            /* ignora coleção indisponível */
          }
        }),
    );
    return out;
  }

  // ─── Khronos glTF Sample Assets ────────────────────────────────────────────
  private async loadKhronos(): Promise<GalleryModel[]> {
    type Model = {
      label: string;
      name: string;
      screenshot?: string;
      variants?: Record<string, string>;
    };
    const models = await fetchJson<Model[]>(`${KHRONOS_BASE}/model-index.json`);
    return models
      .filter((m) => m.variants?.["glTF-Binary"])
      .map((m) => ({
        id: `khronos:${m.name}`,
        name: m.label || m.name,
        thumb: m.screenshot ? `${KHRONOS_BASE}/${m.name}/${m.screenshot}` : "",
        url: `${KHRONOS_BASE}/${m.name}/glTF-Binary/${m.variants!["glTF-Binary"]}`,
        license: "CC0 / CC-BY",
        creator: "Khronos",
        collection: "glTF Sample Assets",
        source: "khronos" as const,
      }));
  }

  // ─── Poly Haven (CC0) ──────────────────────────────────────────────────────
  private async loadPolyHaven(): Promise<GalleryModel[]> {
    type Asset = {
      name: string;
      authors?: Record<string, string>;
      thumbnail_url?: string;
      categories?: string[];
    };
    const assets = await fetchJson<Record<string, Asset>>(`${POLYHAVEN_API}/assets?type=models`);
    return Object.entries(assets).map(([id, a]) => ({
      id: `polyhaven:${id}`,
      name: a.name ?? id,
      thumb: a.thumbnail_url ?? `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256`,
      url: id, // id do asset; o GLB é montado a partir do glTF na importação
      license: "CC0",
      creator: a.authors ? Object.keys(a.authors).join(", ") : "Poly Haven",
      collection: "Poly Haven",
      source: "polyhaven" as const,
    }));
  }

  // ─── Importar para a biblioteca ────────────────────────────────────────────
  async import(projectId: string, source: string, url: string, name: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Projeto ${projectId} não encontrado`);

    const data =
      source === "polyhaven" ? await this.fetchPolyHavenGlb(url) : await this.fetchDirectGlb(url);

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
        meta: { source: `gallery:${source}`, name },
      },
    });
  }

  private assertHost(url: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException("URL inválida");
    }
    if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.host)) {
      throw new BadRequestException("Origem do modelo não permitida");
    }
    return parsed;
  }

  private async fetchDirectGlb(url: string): Promise<Buffer> {
    this.assertHost(url);
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new BadRequestException(`Download falhou (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** Baixa o glTF bundle do Poly Haven (1k) e converte para GLB com o Blender. */
  private async fetchPolyHavenGlb(assetId: string): Promise<Buffer> {
    if (!/^[\w-]+$/.test(assetId)) throw new BadRequestException("id inválido");
    type Files = Record<
      string,
      Record<string, { gltf?: { url: string; include?: Record<string, { url: string }> } }>
    >;
    const files = await fetchJson<Files>(`${POLYHAVEN_API}/files/${assetId}`);
    const res = files.gltf?.["1k"]?.gltf ?? files.gltf?.["2k"]?.gltf;
    if (!res?.url) throw new BadRequestException("glTF não disponível para este modelo");

    const dir = await mkdtemp(join(tmpdir(), "mf-ph-"));
    try {
      const gltfPath = join(dir, `${assetId}.gltf`);
      await writeFile(gltfPath, await this.fetchDirectGlb(res.url));
      // sidecars (.bin + texturas) nos caminhos relativos que o glTF referencia
      for (const [rel, info] of Object.entries(res.include ?? {})) {
        const dest = join(dir, rel);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, await this.fetchDirectGlb(info.url));
      }
      const outGlb = join(dir, "out.glb");
      await execFileAsync(
        BLENDER_PATH,
        [
          "--background",
          "--factory-startup",
          "--python",
          EXPORT_SCRIPT,
          "--",
          gltfPath,
          outGlb,
          "glb",
        ],
        { timeout: 180_000, maxBuffer: 1024 * 1024 * 64 },
      );
      return await readFile(outGlb);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

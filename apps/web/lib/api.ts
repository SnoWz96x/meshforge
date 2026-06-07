// Cliente da API MeshForge. Sem mocks — tudo bate na API real (NestJS :3001).
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  thumbnailAssetId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { generations: number; assets: number };
}

export interface Asset {
  id: string;
  kind: string;
  format: string;
  storageUri: string;
  createdAt: string;
  meta?: Record<string, unknown> | null;
}

export interface Job {
  id: string;
  stage: string;
  status: JobStatus;
  progress: number;
  error: string | null;
  outputAssets?: Asset[];
}

export interface Generation {
  id: string;
  projectId: string;
  type: string;
  prompt: string | null;
  negativePrompt: string | null;
  status: JobStatus;
  createdAt: string;
  jobs: Job[];
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listProjects: () => req<Project[]>("/projects"),
  getProject: (id: string) =>
    req<Project & { generations: Generation[]; assets: Asset[] }>(`/projects/${id}`),
  createProject: (name: string, description?: string) =>
    req<Project>("/projects", { method: "POST", body: JSON.stringify({ name, description }) }),
  renameProject: (id: string, name: string, description?: string) =>
    req<Project>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name, description }),
    }),
  deleteProject: (id: string) => req<{ ok: boolean }>(`/projects/${id}`, { method: "DELETE" }),
  createGeneration: (input: {
    projectId: string;
    type: string;
    prompt?: string;
    negativePrompt?: string;
    inputAssetId?: string;
    inputAssetIds?: string[];
    params?: Record<string, unknown>;
  }) => req<Generation>("/generations", { method: "POST", body: JSON.stringify(input) }),
  getGeneration: (id: string) => req<Generation>(`/generations/${id}`),
  cancelGeneration: (id: string) =>
    req<Generation>(`/generations/${id}/cancel`, { method: "POST" }),
  exportAsset: (id: string, format: string) =>
    req<Asset>(`/assets/${id}/export`, { method: "POST", body: JSON.stringify({ format }) }),
  processAsset: (
    id: string,
    op: "cleanup" | "decimate" | "remesh" | "texfix",
    targetFaces?: number,
  ) =>
    req<Asset>(`/assets/${id}/process`, {
      method: "POST",
      body: JSON.stringify({ op, targetFaces }),
    }),
  galleryList: (search?: string, limit = 60, source?: string) =>
    req<GalleryModel[]>(
      `/gallery?limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}${
        source ? `&source=${source}` : ""
      }`,
    ),
  gallerySources: () => req<GallerySource[]>("/gallery/sources"),
  galleryImport: (projectId: string, m: GalleryModel) =>
    req<Asset>("/gallery/import", {
      method: "POST",
      body: JSON.stringify({ projectId, source: m.source, url: m.url, name: m.name }),
    }),
};

export interface GalleryModel {
  id: string;
  name: string;
  thumb: string;
  url: string;
  license: string;
  creator: string;
  collection: string;
  source: "cc0" | "khronos" | "polyhaven" | "polypizza";
}

export interface GallerySource {
  id: string;
  label: string;
  count: number;
}

// Upload multipart (não usa o helper req(): o browser define o boundary).
export async function uploadImage(projectId: string, file: File): Promise<Asset> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_URL}/projects/${projectId}/assets`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`Upload falhou (${res.status})`);
  return res.json() as Promise<Asset>;
}

export function assetUrl(id: string): string {
  return `${API_URL}/assets/${id}`;
}

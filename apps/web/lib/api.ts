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
  getProject: (id: string) => req<Project & { generations: Generation[]; assets: Asset[] }>(`/projects/${id}`),
  createProject: (name: string, description?: string) =>
    req<Project>("/projects", { method: "POST", body: JSON.stringify({ name, description }) }),
  createGeneration: (input: {
    projectId: string;
    type: string;
    prompt?: string;
    negativePrompt?: string;
    params?: Record<string, unknown>;
  }) => req<Generation>("/generations", { method: "POST", body: JSON.stringify(input) }),
  getGeneration: (id: string) => req<Generation>(`/generations/${id}`),
};

export function assetUrl(id: string): string {
  return `${API_URL}/assets/${id}`;
}

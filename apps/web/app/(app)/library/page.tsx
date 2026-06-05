"use client";

import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/shell/topbar";
import { AssetGallery } from "@/components/asset-gallery";
import { api, type Asset } from "@/lib/api";

async function loadAllAssets(): Promise<Asset[]> {
  const projects = await api.listProjects();
  const all = await Promise.all(projects.map((p) => api.getProject(p.id)));
  return all
    .flatMap((p) => p.assets ?? [])
    .filter((a) => a.kind === "IMAGE" || a.kind === "PREVIEW" || a.kind === "MESH_RAW")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export default function LibraryPage() {
  const { data, isLoading } = useQuery({ queryKey: ["assets"], queryFn: loadAllAssets });

  return (
    <>
      <Topbar title="Biblioteca" />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-surface-1" />
            ))}
          </div>
        ) : (
          <AssetGallery
            assets={data ?? []}
            emptyHint="As imagens e malhas que você gerar aparecem aqui."
          />
        )}
      </div>
    </>
  );
}

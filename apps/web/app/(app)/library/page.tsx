"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Images, X } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { MeshThumb } from "@/components/mesh-thumb";
import { MeshViewer } from "@/components/mesh-viewer";
import { ErrorBoundary } from "@/components/error-boundary";
import { api, assetUrl, type Asset } from "@/lib/api";

const isMesh = (a: Asset) => a.format === "glb";

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
  const [selected, setSelected] = useState<Asset | null>(null);

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
        ) : !data?.length ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Images size={30} className="text-content-muted" />
            <p className="mt-3 text-[14px] font-medium text-content">Sua biblioteca está vazia</p>
            <p className="mt-1 text-[12px] text-content-muted">
              As imagens e malhas que você gerar aparecem aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {data.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a)}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-1 text-left"
              >
                {isMesh(a) ? (
                  <MeshThumb url={assetUrl(a.id)} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={assetUrl(a.id)}
                    alt={a.id}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
                  />
                )}
                <span className="absolute left-2 top-2 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
                  {isMesh(a) ? "3D" : a.format}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur animate-fade-in"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-surface-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white/90 backdrop-blur transition-colors hover:bg-black/80"
              aria-label="Fechar"
            >
              <X size={15} />
            </button>
            <div className="relative aspect-[4/3] w-full">
              {isMesh(selected) ? (
                <ErrorBoundary compact label="Não foi possível abrir a malha 3D">
                  <MeshViewer url={assetUrl(selected.id)} />
                </ErrorBoundary>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetUrl(selected.id)} alt={selected.id} className="h-full w-full object-contain bg-base" />
              )}
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
              <span className="font-mono text-[11px] text-content-muted">{selected.format} · {selected.kind}</span>
              <a
                href={assetUrl(selected.id)}
                download
                className="rounded-sm border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-content-secondary transition-colors hover:text-content"
              >
                Baixar
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

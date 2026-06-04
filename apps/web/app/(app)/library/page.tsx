"use client";

import { useQuery } from "@tanstack/react-query";
import { Images } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { api, assetUrl, type Asset } from "@/lib/api";

async function loadAllAssets(): Promise<Asset[]> {
  const projects = await api.listProjects();
  const all = await Promise.all(projects.map((p) => api.getProject(p.id)));
  return all
    .flatMap((p) => p.assets ?? [])
    .filter((a) => a.kind === "IMAGE" || a.kind === "PREVIEW")
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
        ) : !data?.length ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Images size={30} className="text-content-muted" />
            <p className="mt-3 text-[14px] font-medium text-content">Sua biblioteca está vazia</p>
            <p className="mt-1 text-[12px] text-content-muted">
              As imagens que você gerar aparecem aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {data.map((a) => (
              <a
                key={a.id}
                href={assetUrl(a.id)}
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetUrl(a.id)}
                  alt={a.id}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
                />
                <span className="absolute left-2 top-2 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
                  {a.format}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

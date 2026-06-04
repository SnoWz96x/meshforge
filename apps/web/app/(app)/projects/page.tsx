"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderKanban } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { api } from "@/lib/api";

export default function ProjectsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });

  return (
    <>
      <Topbar title="Projetos" />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-surface-1" />
            ))}
          </div>
        ) : !data?.length ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <FolderKanban size={30} className="text-content-muted" />
            <p className="mt-3 text-[14px] font-medium text-content">Nenhum projeto ainda</p>
            <p className="mt-1 text-[12px] text-content-muted">
              Gere sua primeira imagem em “Gerar” — um projeto é criado automaticamente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-border bg-surface-1 p-4 transition-colors hover:border-border-strong"
              >
                <h3 className="text-[14px] font-semibold text-content">{p.name}</h3>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-[12px] text-content-secondary">{p.description}</p>
                )}
                <div className="mt-3 flex gap-4 text-[11px] text-content-muted">
                  <span>{p._count?.generations ?? 0} gerações</span>
                  <span>{p._count?.assets ?? 0} assets</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

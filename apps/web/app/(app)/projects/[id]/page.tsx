"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { AssetGallery } from "@/components/asset-gallery";
import { api, type Asset } from "@/lib/api";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["project", id],
    queryFn: () => api.getProject(id),
    enabled: !!id,
  });

  const assets: Asset[] = (data?.assets ?? [])
    .filter((a) => a.kind === "IMAGE" || a.kind === "PREVIEW" || a.kind === "MESH_RAW")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <>
      <Topbar title="Projeto" />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <Link
          href="/projects"
          className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-content-secondary transition-colors hover:text-content"
        >
          <ArrowLeft size={14} /> Projetos
        </Link>

        {isError ? (
          <p className="text-[13px] text-danger">Projeto não encontrado.</p>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-surface-1" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-5">
              <h2 className="text-[18px] font-semibold text-content">{data?.name}</h2>
              {data?.description && (
                <p className="mt-1 text-[13px] text-content-secondary">{data.description}</p>
              )}
              <p className="mt-1 text-[11px] text-content-muted">{assets.length} assets</p>
            </div>
            <AssetGallery assets={assets} emptyHint="Este projeto ainda não tem imagens ou malhas." />
          </>
        )}
      </div>
    </>
  );
}

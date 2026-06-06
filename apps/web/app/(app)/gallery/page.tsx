"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Download, Loader2, Boxes, Check } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { api, type GalleryModel } from "@/lib/api";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/utils";

async function ensureProject(): Promise<string> {
  const projects = await api.listProjects();
  if (projects.length) return projects[0].id;
  return (await api.createProject("Meu primeiro projeto")).id;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-accent bg-accent-soft text-content"
          : "border-border bg-surface-2 text-content-secondary hover:text-content",
      )}
    >
      {children}
    </button>
  );
}

export default function GalleryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<string>("");
  const [imported, setImported] = useState<Set<string>>(new Set());

  const { data: sources } = useQuery({
    queryKey: ["gallery-sources"],
    queryFn: api.gallerySources,
  });
  const { data: models, isLoading } = useQuery({
    queryKey: ["gallery", query, source],
    queryFn: () => api.galleryList(query || undefined, 90, source || undefined),
  });

  const importer = useMutation({
    mutationFn: async (m: GalleryModel) => {
      const projectId = await ensureProject();
      return api.galleryImport(projectId, m);
    },
    onSuccess: (_a, m) => {
      setImported((s) => new Set(s).add(m.id));
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["meshes"] });
      toast.success(`"${m.name}" importado para a biblioteca.`);
    },
    onError: (e) => toast.error(`Importação falhou: ${(e as Error).message}`),
  });

  return (
    <>
      <Topbar title="Galeria" />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mb-5 flex flex-col gap-2">
          <p className="text-[12px] text-content-secondary">
            <b className="text-content">1.500+ modelos 3D open-source</b> (CC0 / CC-BY) de várias
            fontes para importar — depois é só texturizar, otimizar ou exportar como qualquer malha
            sua.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search);
            }}
            className="flex items-center gap-2 rounded-sm border border-border bg-surface-2 px-3"
          >
            <Search size={15} className="text-content-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar (ex.: car, tree, robot)…"
              className="flex-1 bg-transparent py-2 text-[13px] text-content outline-none"
            />
            <button type="submit" className="text-[12px] font-medium text-accent">
              Buscar
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip active={source === ""} onClick={() => setSource("")}>
              Todas
            </Chip>
            {sources?.map((s) => (
              <Chip key={s.id} active={source === s.id} onClick={() => setSource(s.id)}>
                {s.label} <span className="text-content-muted">{s.count}</span>
              </Chip>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-surface-1" />
            ))}
          </div>
        ) : !models?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Boxes size={30} className="text-content-muted" />
            <p className="mt-3 text-[14px] font-medium text-content">Nada encontrado</p>
            <p className="mt-1 text-[12px] text-content-muted">Tente outra busca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {models.map((m) => {
              const done = imported.has(m.id);
              const busy = importer.isPending && importer.variables?.id === m.id;
              return (
                <div
                  key={m.id}
                  className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface-1"
                >
                  <div className="relative aspect-square bg-surface-2">
                    {m.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.thumb}
                        alt={m.name}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center">
                        <Boxes size={26} className="text-content-muted" />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
                      {m.license}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-medium text-content">
                        {m.name}
                      </span>
                      <span className="block truncate text-[10px] text-content-muted">
                        {m.creator}
                      </span>
                    </span>
                    <button
                      disabled={busy || done}
                      onClick={() => importer.mutate(m)}
                      title="Importar para a biblioteca"
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-sm border transition-colors",
                        done
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-border bg-surface-2 text-content-secondary hover:border-accent hover:text-accent",
                      )}
                    >
                      {busy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : done ? (
                        <Check size={14} />
                      ) : (
                        <Download size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Loader2, Box, PackageOpen } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { MeshThumb } from "@/components/mesh-thumb";
import { api, assetUrl, type Asset } from "@/lib/api";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/utils";

const FORMATS: { id: string; label: string; note: string }[] = [
  { id: "glb", label: "GLB", note: "binário, com textura" },
  { id: "gltf", label: "GLTF", note: "texto + .bin (zip)" },
  { id: "obj", label: "OBJ", note: "+ .mtl + textura (zip)" },
  { id: "fbx", label: "FBX", note: "texturas embutidas" },
  { id: "stl", label: "STL", note: "só geometria" },
  { id: "usdz", label: "USDZ", note: "AR / Apple" },
  { id: "ply", label: "PLY", note: "nuvem/pontos" },
];

async function loadMeshes(): Promise<Asset[]> {
  const projects = await api.listProjects();
  const all = await Promise.all(projects.map((p) => api.getProject(p.id)));
  return all
    .flatMap((p) => p.assets ?? [])
    .filter((a) => a.format === "glb" && a.kind === "MESH_RAW")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

async function downloadAsset(id: string, filename: string) {
  const res = await fetch(assetUrl(id));
  if (!res.ok) throw new Error(`Download falhou (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const { data: meshes, isLoading } = useQuery({ queryKey: ["meshes"], queryFn: loadMeshes });
  const [selected, setSelected] = useState<string | null>(null);
  const [busyFmt, setBusyFmt] = useState<string | null>(null);

  const selectedMesh = useMemo(
    () => meshes?.find((m) => m.id === selected) ?? null,
    [meshes, selected],
  );

  const exporter = useMutation({
    mutationFn: (format: string) => api.exportAsset(selected as string, format),
    onMutate: (format) => setBusyFmt(format),
    onSuccess: async (asset, format) => {
      const ext = asset.format === "zip" ? `${format}.zip` : asset.format;
      try {
        await downloadAsset(asset.id, `meshforge-${selected?.slice(0, 6)}.${ext}`);
        toast.success(`Exportado em ${format.toUpperCase()} e baixado.`);
      } catch (e) {
        toast.error(`Baixar falhou: ${(e as Error).message}`);
      }
    },
    onError: (e) => toast.error(`Exportação falhou: ${(e as Error).message}`),
    onSettled: () => setBusyFmt(null),
  });

  return (
    <>
      <Topbar title="Exportar" />
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* Malhas */}
        <div className="min-h-0 overflow-y-auto p-6">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-lg bg-surface-1" />
              ))}
            </div>
          ) : !meshes?.length ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Box size={30} className="text-content-muted" />
              <p className="mt-3 text-[14px] font-medium text-content">Nenhuma malha 3D ainda</p>
              <p className="mt-1 text-[12px] text-content-muted">
                Gere um modelo 3D para exportá-lo aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {meshes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-lg border bg-surface-1 transition-colors",
                    selected === m.id
                      ? "border-accent ring-1 ring-accent"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <MeshThumb url={assetUrl(m.id)} />
                  <span className="absolute left-2 top-2 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
                    3D
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Painel de exportação */}
        <div className="flex flex-col gap-4 border-t border-border p-5 lg:border-l lg:border-t-0">
          <div>
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-content">
              <PackageOpen size={15} className="text-accent" />
              Exportar formato
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-content-muted">
              {selectedMesh
                ? "Escolha um formato — converte via Blender e baixa."
                : "Selecione uma malha à esquerda."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                disabled={!selectedMesh || !!busyFmt}
                onClick={() => exporter.mutate(f.id)}
                className={cn(
                  "flex items-center justify-between rounded-sm border border-border bg-surface-2 px-3 py-2.5 text-left transition-colors",
                  !selectedMesh || busyFmt
                    ? "cursor-not-allowed opacity-50"
                    : "hover:border-accent hover:bg-accent-soft",
                )}
              >
                <span>
                  <span className="text-[13px] font-semibold text-content">{f.label}</span>
                  <span className="ml-2 text-[10px] text-content-muted">{f.note}</span>
                </span>
                {busyFmt === f.id ? (
                  <Loader2 size={15} className="animate-spin text-accent" />
                ) : (
                  <Download size={14} className="text-content-muted" />
                )}
              </button>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-content-muted">
            Exportação profissional via Blender 4.2 headless, preservando geometria, UV e textura.
          </p>
        </div>
      </div>
    </>
  );
}

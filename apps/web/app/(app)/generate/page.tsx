"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Loader2,
  ImageOff,
  Wand2,
  Box,
  Boxes,
  Images,
  Package,
  Type,
  Download,
  UploadCloud,
  X,
  Cpu,
  ChevronRight,
  Check,
} from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { MeshViewer } from "@/components/mesh-viewer";
import { ErrorBoundary } from "@/components/error-boundary";
import { api, assetUrl, uploadImage, type Asset, type Generation } from "@/lib/api";
import { useGenerationProgress } from "@/lib/use-progress";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/utils";

const SIZES = [
  { label: "1024 × 1024", w: 1024, h: 1024 },
  { label: "1024 × 768", w: 1024, h: 768 },
  { label: "768 × 1024", w: 768, h: 1024 },
];

type Mode =
  | "TEXT_TO_IMAGE"
  | "IMAGE_TO_IMAGE"
  | "IMAGE_TO_3D"
  | "MULTI_IMAGE_TO_3D"
  | "TEXT_TO_3D"
  | "FULL_PIPELINE";
const MODES: { id: Mode; label: string; icon: typeof Type; ready: boolean }[] = [
  { id: "TEXT_TO_IMAGE", label: "Texto → Imagem", icon: Type, ready: true },
  { id: "IMAGE_TO_IMAGE", label: "Imagem → Imagem", icon: Wand2, ready: true },
  { id: "IMAGE_TO_3D", label: "Imagem → 3D", icon: Box, ready: true },
  { id: "MULTI_IMAGE_TO_3D", label: "Multi-imagem → 3D", icon: Images, ready: true },
  { id: "TEXT_TO_3D", label: "Texto → 3D", icon: Boxes, ready: true },
  { id: "FULL_PIPELINE", label: "Pacote completo (1-clique)", icon: Package, ready: true },
];

// Formatos exportados no pacote completo (além do .glb principal).
const PACKAGE_FORMATS = ["fbx", "obj", "stl", "usdz", "gltf"] as const;

// Vistas do multiview (ordem canônica enviada à API).
const VIEWS = [
  { id: "front", label: "Frente" },
  { id: "left", label: "Esquerda" },
  { id: "right", label: "Direita" },
  { id: "back", label: "Trás" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

const isImageInputMode = (m: Mode) => m === "IMAGE_TO_IMAGE" || m === "IMAGE_TO_3D";
const is3DMode = (m: Mode) =>
  m === "IMAGE_TO_3D" ||
  m === "MULTI_IMAGE_TO_3D" ||
  m === "TEXT_TO_3D" ||
  m === "FULL_PIPELINE";

const isTerminal = (s?: string) => s === "SUCCEEDED" || s === "FAILED" || s === "CANCELED";

async function ensureProject(): Promise<string> {
  const projects = await api.listProjects();
  if (projects.length) return projects[0].id;
  return (await api.createProject("Meu primeiro projeto")).id;
}

export default function GeneratePage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("TEXT_TO_IMAGE");
  const [prompt, setPrompt] = useState("a red sports car on a mountain road at sunset, cinematic");
  const [negative, setNegative] = useState("blurry, low quality");
  const [size, setSize] = useState(SIZES[0]);
  const [steps, setSteps] = useState(20);
  const [cfg, setCfg] = useState(7);
  const [denoise, setDenoise] = useState(0.6);
  const [texture, setTexture] = useState(false);
  const [textureBackend, setTextureBackend] = useState<"cpu" | "gpu">("cpu");
  const [showEngine, setShowEngine] = useState(false);
  const [quality, setQuality] = useState<"balanced" | "high" | "max">("high");
  const [pkgFormats, setPkgFormats] = useState<string[]>([...PACKAGE_FORMATS]);
  const [input, setInput] = useState<Asset | null>(null);
  const [views, setViews] = useState<Record<ViewId, Asset | null>>({
    front: null,
    left: null,
    right: null,
    back: null,
  });
  const [uploadingView, setUploadingView] = useState<ViewId | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => uploadImage(await ensureProject(), file),
    onSuccess: (a) => setInput(a),
    onError: (e) => toast.error(`Falha no upload: ${(e as Error).message}`),
  });

  const uploadView = useMutation({
    mutationFn: async ({ view, file }: { view: ViewId; file: File }) => {
      setUploadingView(view);
      const a = await uploadImage(await ensureProject(), file);
      return { view, asset: a };
    },
    onSuccess: ({ view, asset }) => setViews((v) => ({ ...v, [view]: asset })),
    onError: (e) => toast.error(`Falha no upload: ${(e as Error).message}`),
    onSettled: () => setUploadingView(null),
  });

  const gen = useMutation({
    mutationFn: async () => {
      const projectId = await ensureProject();
      if (mode === "IMAGE_TO_3D") {
        return api.createGeneration({
          projectId,
          type: "IMAGE_TO_3D",
          inputAssetId: input!.id,
          params: { steps, texture, quality, texture_backend: textureBackend },
        });
      }
      if (mode === "MULTI_IMAGE_TO_3D") {
        const present = VIEWS.filter((v) => views[v.id]);
        return api.createGeneration({
          projectId,
          type: "MULTI_IMAGE_TO_3D",
          inputAssetIds: present.map((v) => views[v.id]!.id),
          params: {
            views: present.map((v) => v.id),
            steps,
            texture,
            quality,
            texture_backend: textureBackend,
          },
        });
      }
      if (mode === "IMAGE_TO_IMAGE") {
        return api.createGeneration({
          projectId,
          type: "IMAGE_TO_IMAGE",
          prompt,
          negativePrompt: negative,
          inputAssetId: input!.id,
          params: { steps, cfg, denoise },
        });
      }
      if (mode === "TEXT_TO_3D") {
        return api.createGeneration({
          projectId,
          type: "TEXT_TO_3D",
          prompt,
          negativePrompt: negative,
          params: {
            width: size.w,
            height: size.h,
            steps,
            cfg,
            texture,
            quality,
            texture_backend: textureBackend,
          },
        });
      }
      if (mode === "FULL_PIPELINE") {
        return api.createGeneration({
          projectId,
          type: "FULL_PIPELINE",
          prompt,
          negativePrompt: negative,
          params: {
            width: size.w,
            height: size.h,
            steps,
            cfg,
            quality,
            texture_backend: textureBackend,
            // Pacote completo: texturiza + ajuste auto de textura + otimiza + exporta.
            texture: true,
            texture_fix: true,
            package: true,
            optimize: true,
            optimize_faces: 20000,
            export_formats: pkgFormats,
          },
        });
      }
      return api.createGeneration({
        projectId,
        type: "TEXT_TO_IMAGE",
        prompt,
        negativePrompt: negative,
        params: { width: size.w, height: size.h, steps, cfg },
      });
    },
    onSuccess: (g) => setActiveId(g.id),
    onError: (e) => toast.error(`Não foi possível iniciar a geração: ${(e as Error).message}`),
  });

  const { data: active } = useQuery({
    queryKey: ["generation", activeId],
    queryFn: () => api.getGeneration(activeId as string),
    enabled: !!activeId,
    // WebSocket dá o tempo real; o polling fica como fallback mais lento.
    refetchInterval: (q) => (isTerminal(q.state.data?.status) ? false : 4000),
    refetchIntervalInBackground: true,
  });

  // Progresso em tempo real via WebSocket (additivo ao polling).
  const onTerminal = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["generation", activeId] });
  }, [qc, activeId]);
  const ws = useGenerationProgress(activeId, onTerminal);

  const cancel = useMutation({
    mutationFn: () => api.cancelGeneration(activeId as string),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["generation", activeId] });
      toast.info("Geração cancelada.");
    },
  });

  const toastedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !isTerminal(active.status)) return;
    if (toastedRef.current === active.id) return;
    toastedRef.current = active.id;
    qc.invalidateQueries({ queryKey: ["assets"] });
    const is3D = (active.jobs?.[0]?.stage ?? "").includes("3D");
    if (active.status === "SUCCEEDED") toast.success(is3D ? "Malha 3D gerada!" : "Imagem gerada!");
    else if (active.status === "FAILED")
      toast.error(`Falha na geração: ${active.jobs?.[0]?.error ?? "erro desconhecido"}`);
  }, [active, qc]);

  const busy = gen.isPending || (!!active && !isTerminal(active.status));
  const viewCount = VIEWS.filter((v) => views[v.id]).length;
  const needsImage =
    (isImageInputMode(mode) && !input) || (mode === "MULTI_IMAGE_TO_3D" && viewCount === 0);
  const noPromptNeeded = mode === "IMAGE_TO_3D" || mode === "MULTI_IMAGE_TO_3D";
  const canGenerate = !busy && !needsImage && (noPromptNeeded || !!prompt.trim());

  return (
    <>
      <Topbar title="Gerar" />
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-5 overflow-y-auto border-r border-border p-5">
          <ModeTabs mode={mode} onMode={setMode} />

          {isImageInputMode(mode) && (
            <Dropzone
              input={input}
              uploading={upload.isPending}
              onFile={(f) => upload.mutate(f)}
              onClear={() => setInput(null)}
            />
          )}
          {mode === "MULTI_IMAGE_TO_3D" && (
            <>
              <MultiViewGrid
                views={views}
                uploadingView={uploadingView}
                onFile={(view, file) => uploadView.mutate({ view, file })}
                onClear={(view) => setViews((v) => ({ ...v, [view]: null }))}
              />
              <p className="-mt-2 text-[11px] leading-relaxed text-content-muted">
                Envie de <b>1 a 4 vistas</b> (frente, esquerda, direita, trás) do mesmo objeto. O{" "}
                <b>Hunyuan3D multiview</b> reconstrói a malha combinando as vistas — quanto mais
                vistas, mais fiel. Usa o mesmo modelo do Imagem→3D (sem download extra).
              </p>
            </>
          )}
          {mode === "IMAGE_TO_3D" && (
            <p className="-mt-2 text-[11px] leading-relaxed text-content-muted">
              Gera a <b>malha 3D</b> (.glb) na sua GPU a partir da imagem. A 1ª pode levar alguns
              minutos (compilação). Marque <b>Texturizar</b> abaixo para cor PBR.
            </p>
          )}
          {mode === "TEXT_TO_3D" && (
            <p className="-mt-2 text-[11px] leading-relaxed text-content-muted">
              Pipeline em 2 etapas: <b>SDXL</b> cria a imagem do seu prompt e o <b>Hunyuan3D</b> a
              converte em <b>malha 3D</b> (.glb) — tudo numa geração só. Leva mais tempo (2
              modelos).
            </p>
          )}
          {mode === "FULL_PIPELINE" && (
            <div className="-mt-2 flex flex-col gap-3">
              <p className="text-[11px] leading-relaxed text-content-muted">
                <b className="text-content">Tudo num clique</b>, num job só: <b>SDXL</b> gera a
                imagem → <b>Hunyuan3D</b> a malha → <b>textura PBR</b> (Backend A/CPU) →{" "}
                <b>ajuste automático da textura</b> → malha <b>otimizada (~20k faces)</b> →{" "}
                <b>exportes</b> nos formatos abaixo. Roda no servidor: pode fechar a aba que o pacote
                continua. É o fluxo mais completo (e o mais demorado).
              </p>
              <Field label="Formatos no pacote">
                <div className="flex flex-wrap gap-1.5">
                  {PACKAGE_FORMATS.map((f) => {
                    const on = pkgFormats.includes(f);
                    return (
                      <button
                        key={f}
                        onClick={() =>
                          setPkgFormats((cur) =>
                            cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f],
                          )
                        }
                        className={cn(
                          "rounded-sm border px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors",
                          on
                            ? "border-accent bg-accent-soft text-content"
                            : "border-border bg-surface-2 text-content-muted hover:text-content",
                        )}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <p className="text-[10px] leading-relaxed text-content-muted">
                O <b>.glb texturizado</b> e a <b>versão otimizada</b> entram sempre. Os formatos
                acima são extras (OBJ/GLTF saem em .zip com texturas).
              </p>
            </div>
          )}
          {is3DMode(mode) && (
            <Field label="Qualidade 3D">
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["balanced", "Equilibrado"],
                    ["high", "Alta"],
                    ["max", "Máxima"],
                  ] as const
                ).map(([q, lbl]) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={cn(
                      "rounded-sm border px-2 py-2 text-[11px] font-medium transition-colors",
                      quality === q
                        ? "border-accent bg-accent-soft text-content"
                        : "border-border bg-surface-2 text-content-secondary hover:text-content",
                    )}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </Field>
          )}
          {is3DMode(mode) && mode !== "FULL_PIPELINE" && (
            <label className="-mt-1 flex cursor-pointer items-start gap-2.5 rounded-sm border border-border bg-surface-2 p-3">
              <input
                type="checkbox"
                checked={texture}
                onChange={(e) => setTexture(e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <span className="text-[12px] leading-relaxed text-content-secondary">
                <b className="text-content">Texturizar a malha</b>{" "}
                <span className="rounded-sm bg-accent-soft px-1 text-[9px] font-semibold uppercase text-accent">
                  beta
                </span>
                <br />
                Cor PBR premium na sua AMD (Hunyuan3D paint + delight + inpaint). Adiciona alguns
                minutos e usa mais VRAM.
              </span>
            </label>
          )}
          {(texture || mode === "FULL_PIPELINE") && is3DMode(mode) && (
            <button
              onClick={() => setShowEngine(true)}
              className="-mt-2 flex items-center justify-between rounded-sm border border-border bg-surface-2 px-3 py-2 text-left transition-colors hover:border-accent"
            >
              <span className="flex items-center gap-2 text-[12px] text-content-secondary">
                <Cpu size={14} className="text-accent" />
                Motor de textura
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-content">
                {textureBackend === "cpu" ? "CPU (recomendado)" : "GPU (experimental)"}
                <ChevronRight size={13} className="text-content-muted" />
              </span>
            </button>
          )}

          {mode !== "IMAGE_TO_3D" && mode !== "MULTI_IMAGE_TO_3D" && (
            <>
              <Field label="Prompt">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-sm border border-border bg-surface-2 px-3 py-2 text-[13px] text-content outline-none transition-colors focus:border-accent"
                  placeholder="Descreva o que quer gerar…"
                />
              </Field>
              <Field label="Prompt negativo">
                <input
                  value={negative}
                  onChange={(e) => setNegative(e.target.value)}
                  className="w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-[13px] text-content outline-none transition-colors focus:border-accent"
                />
              </Field>
            </>
          )}

          {mode === "TEXT_TO_IMAGE" && (
            <Field label="Resolução">
              <div className="grid grid-cols-3 gap-1.5">
                {SIZES.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setSize(s)}
                    className={cn(
                      "rounded-sm border px-2 py-2 text-[11px] font-medium transition-colors",
                      size.label === s.label
                        ? "border-accent bg-accent-soft text-content"
                        : "border-border bg-surface-2 text-content-secondary hover:text-content",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Slider label="Steps" value={steps} min={10} max={40} onChange={setSteps} />
            <Slider label="CFG" value={cfg} min={1} max={12} onChange={setCfg} />
          </div>
          {mode === "IMAGE_TO_IMAGE" && (
            <Slider
              label="Denoise"
              value={denoise}
              min={0.2}
              max={0.9}
              step={0.05}
              onChange={setDenoise}
            />
          )}

          <button
            disabled={!canGenerate}
            onClick={() => gen.mutate()}
            className={cn(
              "mt-1 flex items-center justify-center gap-2 rounded-sm bg-accent px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-150 ease-out",
              !canGenerate
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-accent-hover hover:shadow-glow",
            )}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {busy
              ? "Gerando…"
              : needsImage
                ? mode === "MULTI_IMAGE_TO_3D"
                  ? "Envie ao menos 1 vista"
                  : "Envie uma imagem"
                : mode === "IMAGE_TO_3D"
                  ? "Gerar malha 3D"
                  : mode === "MULTI_IMAGE_TO_3D"
                    ? `Gerar 3D de ${viewCount} vista${viewCount > 1 ? "s" : ""}`
                    : mode === "TEXT_TO_3D"
                      ? "Gerar 3D do texto"
                      : mode === "FULL_PIPELINE"
                        ? "Gerar pacote completo"
                        : "Gerar imagem"}
          </button>
          {busy && activeId && (
            <button
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
              className="flex items-center justify-center gap-2 rounded-sm border border-border bg-surface-2 px-4 py-2 text-[12px] font-medium text-content-secondary transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
            >
              {cancel.isPending ? "Cancelando…" : "Cancelar geração"}
            </button>
          )}
          <p className="text-[11px] leading-relaxed text-content-muted">
            Geração real via ComfyUI + SDXL na sua GPU (ZLUDA). A primeira pode levar mais tempo.
          </p>
        </div>

        <ResultPane
          active={active}
          pending={gen.isPending}
          wsProgress={ws.progress}
          error={gen.error?.message || upload.error?.message}
        />
      </div>

      {showEngine && (
        <EnginePopup
          current={textureBackend}
          onPick={(b) => {
            setTextureBackend(b);
            setShowEngine(false);
          }}
          onClose={() => setShowEngine(false)}
        />
      )}
    </>
  );
}

const ENGINES = [
  {
    id: "cpu" as const,
    name: "CPU",
    badge: "Recomendado",
    desc: "Rasterização na CPU (custom_rasterizer compilado) + pintura na GPU via ZLUDA. Estável e mais rápido — a rasterização não é o gargalo.",
  },
  {
    id: "gpu" as const,
    name: "GPU",
    badge: "Experimental",
    desc: "Rasterização nos kernels CUDA na GPU via ZLUDA. Funciona, mas ~3× mais lento aqui (overhead do ZLUDA). Use só para comparar.",
  },
];

function EnginePopup({
  current,
  onPick,
  onClose,
}: {
  current: "cpu" | "gpu";
  onPick: (b: "cpu" | "gpu") => void;
  onClose: () => void;
}) {
  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-surface-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-content">
            <Cpu size={15} className="text-accent" />
            Motor de textura (rasterização)
          </span>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-sm text-content-muted hover:bg-surface-2 hover:text-content"
            aria-label="Fechar"
          >
            <X size={15} />
          </button>
        </div>
        <div className="flex flex-col gap-2 p-3">
          {ENGINES.map((e) => (
            <button
              key={e.id}
              onClick={() => onPick(e.id)}
              className={cn(
                "flex items-start gap-3 rounded-sm border p-3 text-left transition-colors",
                current === e.id
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-surface-2 hover:border-border-strong",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                  current === e.id ? "border-accent bg-accent text-white" : "border-border-strong",
                )}
              >
                {current === e.id && <Check size={11} />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-content">{e.name}</span>
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                      e.id === "cpu"
                        ? "bg-accent-soft text-accent"
                        : "bg-surface-overlay text-content-muted",
                    )}
                  >
                    {e.badge}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-content-secondary">{e.desc}</p>
              </div>
            </button>
          ))}
          <p className="px-1 pt-1 text-[10px] leading-relaxed text-content-muted">
            Os dois rodam na sua AMD via ZLUDA. A escolha vale por geração — sem reiniciar nada.
          </p>
        </div>
      </div>
    </div>
  );
}

function ModeTabs({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {MODES.map(({ id, label, icon: Icon, ready }) => (
        <button
          key={id}
          disabled={!ready}
          onClick={() => ready && onMode(id)}
          title={ready ? undefined : "Disponível na Fase 3 (geração 3D)"}
          className={cn(
            "flex items-center gap-2 rounded-sm border px-2.5 py-2 text-[12px] font-medium transition-colors",
            !ready && "cursor-not-allowed opacity-40",
            mode === id && ready
              ? "border-accent bg-accent-soft text-content"
              : "border-border bg-surface-2 text-content-secondary hover:text-content",
          )}
        >
          <Icon size={14} />
          <span className="truncate">{label}</span>
          {!ready && (
            <span className="ml-auto text-[9px] uppercase text-content-muted">em breve</span>
          )}
        </button>
      ))}
    </div>
  );
}

function Dropzone({
  input,
  uploading,
  onFile,
  onClear,
}: {
  input: Asset | null;
  uploading: boolean;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  if (input) {
    return (
      <div className="relative overflow-hidden rounded-sm border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assetUrl(input.id)} alt="entrada" className="h-32 w-full object-cover" />
        <button
          onClick={onClear}
          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white/90 backdrop-blur transition-colors hover:bg-black/80"
          aria-label="Remover imagem"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border border-dashed px-4 py-7 text-center transition-colors",
        drag
          ? "border-accent bg-accent-soft"
          : "border-border-strong bg-surface-2 hover:border-accent",
      )}
    >
      {uploading ? (
        <Loader2 size={20} className="animate-spin text-accent" />
      ) : (
        <UploadCloud size={20} className="text-content-muted" />
      )}
      <span className="text-[12px] text-content-secondary">
        {uploading ? "Enviando…" : "Arraste uma imagem ou clique"}
      </span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}

// Grade 2×2 de slots para as 4 vistas do multiview (todas opcionais; ≥1 basta).
function MultiViewGrid({
  views,
  uploadingView,
  onFile,
  onClear,
}: {
  views: Record<ViewId, Asset | null>;
  uploadingView: ViewId | null;
  onFile: (view: ViewId, file: File) => void;
  onClear: (view: ViewId) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {VIEWS.map((v) => (
        <ViewSlot
          key={v.id}
          label={v.label}
          asset={views[v.id]}
          uploading={uploadingView === v.id}
          onFile={(f) => onFile(v.id, f)}
          onClear={() => onClear(v.id)}
        />
      ))}
    </div>
  );
}

function ViewSlot({
  label,
  asset,
  uploading,
  onFile,
  onClear,
}: {
  label: string;
  asset: Asset | null;
  uploading: boolean;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  if (asset) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-sm border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assetUrl(asset.id)} alt={label} className="h-full w-full object-cover" />
        <span className="absolute left-1.5 top-1.5 rounded-sm bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
          {label}
        </span>
        <button
          onClick={onClear}
          className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white/90 backdrop-blur transition-colors hover:bg-black/80"
          aria-label={`Remover ${label}`}
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-sm border border-dashed text-center transition-colors",
        drag ? "border-accent bg-accent-soft" : "border-border-strong bg-surface-2 hover:border-accent",
      )}
    >
      {uploading ? (
        <Loader2 size={16} className="animate-spin text-accent" />
      ) : (
        <UploadCloud size={16} className="text-content-muted" />
      )}
      <span className="text-[11px] font-medium text-content-secondary">{label}</span>
      <span className="text-[9px] text-content-muted">{uploading ? "Enviando…" : "opcional"}</span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}

function ResultPane({
  active,
  pending,
  wsProgress,
  error,
}: {
  active?: Generation;
  pending: boolean;
  wsProgress: number;
  error?: string;
}) {
  const job = active?.jobs?.[0];
  // No pipeline Texto→3D há 2 saídas (imagem + malha) — mostra a malha como
  // resultado principal; nos demais, a primeira saída.
  const assets = job?.outputAssets ?? [];
  const outAsset = assets.find((a) => a.format === "glb") ?? assets[0];
  const progress = useMemo(
    () => Math.max(job?.progress ?? 0, wsProgress, pending ? 2 : 0),
    [job, wsProgress, pending],
  );
  const status = active?.status;
  const isMesh = outAsset?.format === "glb";
  const is3D = (job?.stage ?? "").includes("3D");

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-base p-8">
      <div className="flex w-full max-w-[560px] flex-col items-center">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface-1">
          {status === "SUCCEEDED" && outAsset ? (
            isMesh ? (
              <ErrorBoundary compact label="Não foi possível abrir a malha 3D">
                <MeshViewer url={assetUrl(outAsset.id)} />
              </ErrorBoundary>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl(outAsset.id)}
                alt={active?.prompt ?? "resultado"}
                className="h-full w-full animate-fade-in object-cover"
              />
            )
          ) : status === "FAILED" ? (
            <Centered>
              <ImageOff size={28} className="text-danger" />
              <p className="mt-3 text-[13px] font-medium text-content">Falha na geração</p>
              <p className="mt-1 max-w-[80%] text-center text-[11px] text-content-muted">
                {job?.error ?? "Erro desconhecido"}
              </p>
            </Centered>
          ) : pending || (status && !isTerminal(status)) ? (
            <Centered>
              <Loader2 size={26} className="animate-spin text-accent" />
              <p className="mt-3 text-[13px] font-medium text-content">
                {status === "RUNNING"
                  ? is3D
                    ? "Gerando malha 3D na GPU…"
                    : "Renderizando na GPU…"
                  : "Na fila…"}
              </p>
              <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full bg-accent-grad transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(progress, 4)}%` }}
                />
              </div>
            </Centered>
          ) : status === "CANCELED" ? (
            <Centered>
              <ImageOff size={26} className="text-content-muted" />
              <p className="mt-3 text-[13px] font-medium text-content">Geração cancelada</p>
            </Centered>
          ) : (
            <Centered>
              <Sparkles size={26} className="text-content-muted" />
              <p className="mt-3 text-[13px] text-content-secondary">Seu resultado aparece aqui</p>
              <p className="mt-1 text-[11px] text-content-muted">
                Escreva um prompt e clique em Gerar
              </p>
            </Centered>
          )}
        </div>
        {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
        {status === "SUCCEEDED" &&
          outAsset &&
          (isMesh ? (
            <>
              <MeshActions assetId={outAsset.id} />
              <PackageDownloads assets={assets} />
            </>
          ) : (
            <a
              href={assetUrl(outAsset.id)}
              download
              className="mt-4 rounded-sm border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-content-secondary transition-colors hover:text-content"
            >
              Baixar PNG
            </a>
          ))}
      </div>
    </div>
  );
}

// Lista os artefatos pré-prontos do "pacote completo" (versão otimizada + exportes)
// como downloads diretos. Só aparece quando o job produziu esses extras.
function PackageDownloads({ assets }: { assets: Asset[] }) {
  const optimized = assets.filter((a) => a.kind === "MESH_RETOPO");
  const exports = assets.filter((a) => a.kind === "EXPORT");
  if (!optimized.length && !exports.length) return null;
  const label = (a: Asset) =>
    a.kind === "MESH_RETOPO"
      ? "Otimizada (~20k) · GLB"
      : `${(a.meta?.exported as string)?.toUpperCase() ?? a.format.toUpperCase()}${
          a.format === "zip" ? " · zip" : ""
        }`;
  const all = [...optimized, ...exports];
  return (
    <div className="mt-4 w-full rounded-sm border border-border bg-surface-1 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-content-muted">
        <Package size={13} className="text-accent" /> Pacote completo — {all.length} arquivo
        {all.length > 1 ? "s" : ""}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {all.map((a) => (
          <button
            key={a.id}
            onClick={() =>
              downloadAsset(a.id, `meshforge-${a.id.slice(0, 6)}.${a.format}`).catch((e) =>
                toast.error(`Baixar falhou: ${(e as Error).message}`),
              )
            }
            className="flex items-center gap-1.5 rounded-sm border border-border bg-surface-2 px-2.5 py-1.5 text-[11px] font-medium text-content-secondary transition-colors hover:border-accent hover:text-content"
          >
            <Download size={12} className="text-content-muted" />
            {label(a)}
          </button>
        ))}
      </div>
    </div>
  );
}

const EXPORT_FMTS = ["glb", "fbx", "stl", "obj", "usdz"] as const;

async function downloadAsset(id: string, filename: string) {
  const res = await fetch(assetUrl(id));
  if (!res.ok) throw new Error(`Download falhou (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Ações inline no resultado 3D: otimizar (decimate) + exportar em qualquer formato,
// sem sair da tela Gerar — fecha o ciclo prompt → modelo → otimizado → exportado.
function MeshActions({ assetId }: { assetId: string }) {
  const [id, setId] = useState(assetId);
  const [busyFmt, setBusyFmt] = useState<string | null>(null);

  useEffect(() => setId(assetId), [assetId]);

  const optimize = useMutation({
    mutationFn: () => api.processAsset(id, "decimate", 20000),
    onSuccess: (a) => {
      setId(a.id);
      toast.success("Malha otimizada (~20k faces) — pronta para tempo real.");
    },
    onError: (e) => toast.error(`Otimizar falhou: ${(e as Error).message}`),
  });

  const exporter = useMutation({
    mutationFn: (fmt: string) => api.exportAsset(id, fmt),
    onMutate: (fmt) => setBusyFmt(fmt),
    onSuccess: async (a, fmt) => {
      const ext = a.format === "zip" ? `${fmt}.zip` : a.format;
      try {
        await downloadAsset(a.id, `meshforge-${id.slice(0, 6)}.${ext}`);
        toast.success(`Exportado em ${fmt.toUpperCase()}.`);
      } catch (e) {
        toast.error(`Baixar falhou: ${(e as Error).message}`);
      }
    },
    onError: (e) => toast.error(`Exportação falhou: ${(e as Error).message}`),
    onSettled: () => setBusyFmt(null),
  });

  const busy = optimize.isPending || !!busyFmt;

  return (
    <div className="mt-4 flex w-full flex-col items-center gap-2">
      <button
        disabled={busy}
        onClick={() => optimize.mutate()}
        className={cn(
          "flex items-center gap-2 rounded-sm border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-content-secondary transition-colors",
          busy ? "cursor-not-allowed opacity-50" : "hover:border-accent hover:text-content",
        )}
      >
        {optimize.isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Wand2 size={13} className="text-accent" />
        )}
        Otimizar para tempo real (~20k faces)
      </button>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="text-[11px] text-content-muted">Exportar:</span>
        {EXPORT_FMTS.map((f) => (
          <button
            key={f}
            disabled={busy}
            onClick={() => exporter.mutate(f)}
            className={cn(
              "flex items-center gap-1 rounded-sm border border-border bg-surface-2 px-2 py-1 text-[11px] font-semibold uppercase text-content-secondary transition-colors",
              busy ? "cursor-not-allowed opacity-50" : "hover:border-accent hover:text-content",
            )}
          >
            {busyFmt === f ? <Loader2 size={11} className="animate-spin" /> : null}
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-content-muted">
        {label} <span className="font-mono text-content-secondary">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-accent"
      />
    </label>
  );
}

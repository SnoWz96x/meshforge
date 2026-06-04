"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, ImageOff, Wand2, Box, Type } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { api, assetUrl, type Generation } from "@/lib/api";
import { cn } from "@/lib/utils";

const SIZES = [
  { label: "1024 × 1024", w: 1024, h: 1024 },
  { label: "1024 × 768", w: 1024, h: 768 },
  { label: "768 × 1024", w: 768, h: 1024 },
];

const MODES = [
  { id: "TEXT_TO_IMAGE", label: "Texto → Imagem", icon: Type, ready: true },
  { id: "IMAGE_TO_IMAGE", label: "Imagem → Imagem", icon: Wand2, ready: false },
  { id: "IMAGE_TO_3D", label: "Imagem → 3D", icon: Box, ready: false },
  { id: "TEXT_TO_3D", label: "Texto → 3D", icon: Box, ready: false },
];

const isTerminal = (s?: string) => s === "SUCCEEDED" || s === "FAILED" || s === "CANCELED";

export default function GeneratePage() {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("a red sports car on a mountain road at sunset, cinematic");
  const [negative, setNegative] = useState("blurry, low quality");
  const [size, setSize] = useState(SIZES[0]);
  const [steps, setSteps] = useState(20);
  const [cfg, setCfg] = useState(7);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Garante um projeto (single-user) sem dados falsos: usa o 1º real ou cria um.
  async function ensureProject(): Promise<string> {
    const projects = await api.listProjects();
    if (projects.length) return projects[0].id;
    const p = await api.createProject("Meu primeiro projeto");
    return p.id;
  }

  const gen = useMutation({
    mutationFn: async () => {
      const projectId = await ensureProject();
      return api.createGeneration({
        projectId,
        type: "TEXT_TO_IMAGE",
        prompt,
        negativePrompt: negative,
        params: { width: size.w, height: size.h, steps, cfg },
      });
    },
    onSuccess: (g) => setActiveId(g.id),
  });

  const { data: active } = useQuery({
    queryKey: ["generation", activeId],
    queryFn: () => api.getGeneration(activeId as string),
    enabled: !!activeId,
    refetchInterval: (q) => (isTerminal(q.state.data?.status) ? false : 1500),
  });

  useEffect(() => {
    if (active && isTerminal(active.status)) qc.invalidateQueries({ queryKey: ["assets"] });
  }, [active, qc]);

  const busy = gen.isPending || (!!active && !isTerminal(active.status));

  return (
    <>
      <Topbar title="Gerar" />
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[380px_1fr]">
        {/* Painel de controles */}
        <div className="flex flex-col gap-5 overflow-y-auto border-r border-border p-5">
          <ModeTabs />
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
          <div className="grid grid-cols-2 gap-4">
            <Slider label="Steps" value={steps} min={10} max={40} onChange={setSteps} />
            <Slider label="CFG" value={cfg} min={1} max={12} onChange={setCfg} />
          </div>

          <button
            disabled={busy || !prompt.trim()}
            onClick={() => gen.mutate()}
            className={cn(
              "mt-1 flex items-center justify-center gap-2 rounded-sm bg-accent px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-150 ease-out",
              busy || !prompt.trim()
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-accent-hover hover:shadow-glow",
            )}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {busy ? "Gerando…" : "Gerar imagem"}
          </button>
          <p className="text-[11px] leading-relaxed text-content-muted">
            Geração real via ComfyUI + SDXL na sua GPU (ZLUDA). A primeira pode levar mais tempo.
          </p>
        </div>

        {/* Resultado */}
        <ResultPane active={active} pending={gen.isPending} error={gen.error?.message} />
      </div>
    </>
  );
}

function ModeTabs() {
  const [mode, setMode] = useState("TEXT_TO_IMAGE");
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {MODES.map(({ id, label, icon: Icon, ready }) => (
        <button
          key={id}
          disabled={!ready}
          onClick={() => ready && setMode(id)}
          title={ready ? undefined : "Disponível na Fase 3 (3D) / próxima iteração"}
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
          {!ready && <span className="ml-auto text-[9px] uppercase text-content-muted">em breve</span>}
        </button>
      ))}
    </div>
  );
}

function ResultPane({
  active,
  pending,
  error,
}: {
  active?: Generation;
  pending: boolean;
  error?: string;
}) {
  const job = active?.jobs?.[0];
  const outAsset = job?.outputAssets?.[0];
  const progress = useMemo(() => job?.progress ?? (pending ? 2 : 0), [job, pending]);
  const status = active?.status;

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-base p-8">
      <div className="flex w-full max-w-[560px] flex-col items-center">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface-1">
          {status === "SUCCEEDED" && outAsset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetUrl(outAsset.id)}
              alt={active?.prompt ?? "resultado"}
              className="h-full w-full animate-fade-in object-cover"
            />
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
                {status === "RUNNING" ? "Renderizando na GPU…" : "Na fila…"}
              </p>
              <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full bg-accent-grad transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(progress, 4)}%` }}
                />
              </div>
            </Centered>
          ) : (
            <Centered>
              <Sparkles size={26} className="text-content-muted" />
              <p className="mt-3 text-[13px] text-content-secondary">
                Seu resultado aparece aqui
              </p>
              <p className="mt-1 text-[11px] text-content-muted">
                Escreva um prompt e clique em Gerar
              </p>
            </Centered>
          )}
        </div>
        {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
        {status === "SUCCEEDED" && outAsset && (
          <a
            href={assetUrl(outAsset.id)}
            download
            className="mt-4 rounded-sm border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-content-secondary transition-colors hover:text-content"
          >
            Baixar PNG
          </a>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">{label}</span>
      {children}
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
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
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-accent"
      />
    </label>
  );
}

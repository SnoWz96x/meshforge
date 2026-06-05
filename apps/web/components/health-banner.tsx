"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { API_URL } from "@/lib/api";

interface Health {
  status: "ok" | "degraded";
  checks: Record<string, { ok: boolean }>;
}

const LABEL: Record<string, string> = { db: "banco", redis: "fila", comfyui: "ComfyUI (GPU)" };

export function HealthBanner() {
  const { data, isError } = useQuery({
    queryKey: ["health"],
    queryFn: async (): Promise<Health> => {
      const r = await fetch(`${API_URL}/health`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    refetchInterval: 15000,
    retry: false,
    staleTime: 10000,
  });

  if (isError) {
    return (
      <Banner>API offline ({API_URL}). Inicie a API (`pnpm --filter @meshforge/api dev`).</Banner>
    );
  }
  if (!data || data.status === "ok") return null;

  const down = Object.entries(data.checks)
    .filter(([, v]) => !v.ok)
    .map(([k]) => LABEL[k] ?? k);

  return <Banner>Serviços indisponíveis: {down.join(", ")}. Gerações podem falhar até voltarem.</Banner>;
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-5 py-1.5 text-[12px] font-medium text-warning">
      <AlertTriangle size={13} className="shrink-0" />
      {children}
    </div>
  );
}

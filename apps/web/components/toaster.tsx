"use client";

import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useToast, type ToastKind } from "@/lib/toast-store";
import { cn } from "@/lib/utils";

const ICON: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};
const COLOR: Record<ToastKind, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-info",
};

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-slide-up items-start gap-2.5 rounded-lg border border-border bg-surface-overlay px-3.5 py-3 shadow-overlay"
          >
            <Icon size={16} className={cn("mt-0.5 shrink-0", COLOR[t.kind])} />
            <p className="flex-1 text-[13px] leading-snug text-content">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-content-muted transition-colors hover:text-content"
              aria-label="Fechar"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

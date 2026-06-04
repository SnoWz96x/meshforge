import { Construction } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";

// Estado HONESTO para áreas ainda não implementadas (diretriz: nada de fingir).
export function ComingSoon({ title, phase, desc }: { title: string; phase: string; desc: string }) {
  return (
    <>
      <Topbar title={title} />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-lg border border-border bg-surface-1">
          <Construction size={22} className="text-accent" />
        </div>
        <p className="mt-4 text-[15px] font-semibold text-content">{title}</p>
        <span className="mt-2 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">
          {phase}
        </span>
        <p className="mt-3 max-w-sm text-[12px] leading-relaxed text-content-secondary">{desc}</p>
      </div>
    </>
  );
}

"use client";

import { Command } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function Topbar({ title }: { title?: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-1/60 px-5 backdrop-blur">
      <h1 className="text-[13px] font-semibold text-content-secondary">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-sm border border-border bg-surface-2 px-2 py-1 text-[12px] text-content-muted transition-colors duration-150 ease-out hover:border-border-strong hover:text-content-secondary"
          title="Command palette (em breve)"
        >
          <Command size={12} />
          <span className="font-mono">K</span>
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}

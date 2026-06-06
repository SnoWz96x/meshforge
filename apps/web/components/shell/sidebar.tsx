"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, FolderKanban, Images, Workflow, Package, Settings } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/brand";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/generate", label: "Gerar", icon: Sparkles },
  { href: "/projects", label: "Projetos", icon: FolderKanban },
  { href: "/library", label: "Biblioteca", icon: Images },
  { href: "/workflow", label: "Workflow", icon: Workflow, soon: true },
  { href: "/export", label: "Exportar", icon: Package },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-[224px] shrink-0 flex-col border-r border-border bg-surface-1">
      <div className="flex h-14 items-center gap-2 px-4">
        <BrandMark size={26} />
        <Wordmark />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon, soon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] font-medium transition-colors duration-150 ease-out",
                active
                  ? "bg-surface-2 text-content"
                  : "text-content-secondary hover:bg-surface-2/60 hover:text-content",
              )}
            >
              <Icon size={16} className={active ? "text-accent" : ""} />
              <span>{label}</span>
              {soon && (
                <span className="ml-auto rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
                  Fase 3+
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-3">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] font-medium text-content-secondary transition-colors duration-150 ease-out hover:bg-surface-2/60 hover:text-content"
        >
          <Settings size={16} />
          Configurações
        </Link>
      </div>
    </aside>
  );
}

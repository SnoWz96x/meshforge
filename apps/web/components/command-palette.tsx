"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Command } from "cmdk";
import { Sparkles, FolderKanban, Images, Workflow, Package, Moon, Sun } from "lucide-react";
import { useCommandStore } from "@/lib/command-store";

export function CommandPalette() {
  const { open, setOpen, toggle } = useCommandStore();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggle]);

  const go = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]"
    >
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-lg border border-border bg-surface-overlay shadow-overlay animate-slide-up">
        <Command.Input
          placeholder="Buscar ações…"
          className="w-full border-b border-border bg-transparent px-4 py-3.5 text-[14px] text-content outline-none placeholder:text-content-muted"
        />
        <Command.List className="max-h-[320px] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-[13px] text-content-muted">
            Nada encontrado.
          </Command.Empty>
          <Command.Group heading="Navegar" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-content-muted">
            <Item icon={Sparkles} label="Gerar" onSelect={() => go("/generate")} />
            <Item icon={FolderKanban} label="Projetos" onSelect={() => go("/projects")} />
            <Item icon={Images} label="Biblioteca" onSelect={() => go("/library")} />
            <Item icon={Workflow} label="Workflow" onSelect={() => go("/workflow")} />
            <Item icon={Package} label="Exportar" onSelect={() => go("/export")} />
          </Command.Group>
          <Command.Group heading="Ações" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-content-muted">
            <Item
              icon={theme === "light" ? Moon : Sun}
              label={theme === "light" ? "Tema escuro" : "Tema claro"}
              onSelect={() => {
                setTheme(theme === "light" ? "dark" : "light");
                setOpen(false);
              }}
            />
          </Command.Group>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}

function Item({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: typeof Sparkles;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] text-content-secondary aria-selected:bg-surface-2 aria-selected:text-content"
    >
      <Icon size={15} />
      {label}
    </Command.Item>
  );
}

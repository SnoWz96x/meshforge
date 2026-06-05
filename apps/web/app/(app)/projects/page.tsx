"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { api, type Project } from "@/lib/api";
import { toast } from "@/lib/toast-store";

export default function ProjectsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["projects"] });

  const create = useMutation({
    mutationFn: (name: string) => api.createProject(name),
    onSuccess: () => {
      setNewName("");
      invalidate();
      toast.success("Projeto criado.");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const rename = useMutation({
    mutationFn: (p: { id: string; name: string }) => api.renameProject(p.id, p.name),
    onSuccess: () => {
      setEditing(null);
      invalidate();
      toast.success("Projeto renomeado.");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      invalidate();
      toast.info("Projeto excluído.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <Topbar title="Projetos" />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {/* Criar projeto */}
        <div className="mb-5 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName.trim() && create.mutate(newName.trim())}
            placeholder="Nome do novo projeto…"
            className="max-w-xs flex-1 rounded-sm border border-border bg-surface-2 px-3 py-2 text-[13px] text-content outline-none transition-colors focus:border-accent"
          />
          <button
            disabled={!newName.trim() || create.isPending}
            onClick={() => create.mutate(newName.trim())}
            className="flex items-center gap-1.5 rounded-sm bg-accent px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            <Plus size={15} /> Criar
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-surface-1" />
            ))}
          </div>
        ) : !data?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderKanban size={30} className="text-content-muted" />
            <p className="mt-3 text-[14px] font-medium text-content">Nenhum projeto ainda</p>
            <p className="mt-1 text-[12px] text-content-muted">Crie um acima ou gere algo em “Gerar”.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                editing={editing?.id === p.id ? editing : null}
                onEditStart={() => setEditing({ id: p.id, name: p.name })}
                onEditChange={(name) => setEditing({ id: p.id, name })}
                onEditCancel={() => setEditing(null)}
                onEditSave={() => editing?.name.trim() && rename.mutate(editing)}
                onDelete={() => {
                  if (confirm(`Excluir "${p.name}" e tudo dentro dele? Não dá pra desfazer.`))
                    remove.mutate(p.id);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ProjectCard({
  project: p,
  editing,
  onEditStart,
  onEditChange,
  onEditCancel,
  onEditSave,
  onDelete,
}: {
  project: Project;
  editing: { id: string; name: string } | null;
  onEditStart: () => void;
  onEditChange: (name: string) => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative rounded-lg border border-border bg-surface-1 p-4 transition-colors hover:border-border-strong">
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={editing.name}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onEditSave();
              if (e.key === "Escape") onEditCancel();
            }}
            className="flex-1 rounded-sm border border-accent bg-surface-2 px-2 py-1 text-[14px] text-content outline-none"
          />
          <button onClick={onEditSave} className="text-success hover:opacity-80" aria-label="Salvar">
            <Check size={16} />
          </button>
          <button onClick={onEditCancel} className="text-content-muted hover:text-content" aria-label="Cancelar">
            <X size={16} />
          </button>
        </div>
      ) : (
        <>
          <Link href={`/projects/${p.id}`} className="block">
            <h3 className="pr-14 text-[14px] font-semibold text-content">{p.name}</h3>
            {p.description && (
              <p className="mt-1 line-clamp-2 text-[12px] text-content-secondary">{p.description}</p>
            )}
            <div className="mt-3 flex gap-4 text-[11px] text-content-muted">
              <span>{p._count?.generations ?? 0} gerações</span>
              <span>{p._count?.assets ?? 0} assets</span>
            </div>
          </Link>
          <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={onEditStart} className="grid h-7 w-7 place-items-center rounded-sm text-content-muted hover:bg-surface-2 hover:text-content" aria-label="Renomear">
              <Pencil size={13} />
            </button>
            <button onClick={onDelete} className="grid h-7 w-7 place-items-center rounded-sm text-content-muted hover:bg-surface-2 hover:text-danger" aria-label="Excluir">
              <Trash2 size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

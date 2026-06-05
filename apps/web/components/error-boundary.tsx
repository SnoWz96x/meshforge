"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Fallback compacto (ex.: dentro do viewer) ou completo. */
  compact?: boolean;
  label?: string;
}
interface State {
  error: Error | null;
}

// Error boundary (precisa ser class component) — evita white-screen quando
// algo no subtree falha (ex.: viewer 3D com um .glb inválido).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error);
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div
        className={
          "flex flex-col items-center justify-center gap-3 text-center " +
          (this.props.compact ? "absolute inset-0 p-4" : "min-h-[200px] p-8")
        }
      >
        <AlertTriangle size={this.props.compact ? 22 : 28} className="text-danger" />
        <div>
          <p className="text-[13px] font-medium text-content">
            {this.props.label ?? "Algo deu errado ao renderizar"}
          </p>
          <p className="mt-1 max-w-xs text-[11px] text-content-muted">
            {this.state.error.message?.slice(0, 140) || "Erro inesperado"}
          </p>
        </div>
        <button
          onClick={this.reset}
          className="flex items-center gap-1.5 rounded-sm border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-content-secondary transition-colors hover:text-content"
        >
          <RotateCcw size={13} /> Tentar de novo
        </button>
      </div>
    );
  }
}

import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";
export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: string) => void;
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Helper fora de componentes (ex.: callbacks de mutation).
export const toast = {
  success: (m: string) => useToast.getState().push("success", m),
  error: (m: string) => useToast.getState().push("error", m),
  info: (m: string) => useToast.getState().push("info", m),
};

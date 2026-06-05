"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";

export interface ProgressEvent {
  jobId: string;
  generationId: string;
  stage: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress: number;
  message?: string;
}

// Socket singleton (uma conexão por aba).
let socket: Socket | null = null;
function getSocket(): Socket {
  if (!socket) socket = io(API_URL, { transports: ["websocket", "polling"] });
  return socket;
}

const isTerminal = (s: string) => s === "SUCCEEDED" || s === "FAILED" || s === "CANCELED";

/**
 * Acompanha o progresso de uma geração em tempo real via WebSocket.
 * Aditivo ao polling: traz updates suaves (por step) e dispara `onTerminal`
 * (para buscar os outputs) assim que termina.
 */
export function useGenerationProgress(
  generationId: string | null,
  onTerminal: () => void,
): { progress: number; status: ProgressEvent["status"] | null } {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<ProgressEvent["status"] | null>(null);

  useEffect(() => {
    if (!generationId) {
      setProgress(0);
      setStatus(null);
      return;
    }
    const s = getSocket();
    const join = () => s.emit("subscribe", { generationId });
    join();
    s.on("connect", join);

    const onProgress = (ev: ProgressEvent) => {
      if (ev.generationId !== generationId) return;
      setProgress(ev.progress);
      setStatus(ev.status);
      if (isTerminal(ev.status)) onTerminal();
    };
    s.on("progress", onProgress);

    return () => {
      s.off("progress", onProgress);
      s.off("connect", join);
    };
  }, [generationId, onTerminal]);

  return { progress, status };
}

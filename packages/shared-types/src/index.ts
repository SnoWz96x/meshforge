export * from "./enums.js";
export * from "./contracts.js";
export * from "./tools.js";

// Nomes das filas BullMQ (uma por "família" de worker).
export const QUEUES = {
  COMFYUI: "comfyui",
  HUNYUAN3D: "hunyuan3d",
  BLENDER: "blender",
  EXPORT: "export",
  PIPELINE: "pipeline",
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// Canal Redis pub/sub de progresso.
export const PROGRESS_CHANNEL = "meshforge:progress";

import { z } from "zod";
import {
  AssetKind,
  ExportFormat,
  GenerationType,
  GpuBackend,
  JobStage,
  JobStatus,
} from "./enums.js";

// ------------------------------------------------------------
// Payload de job que trafega pela fila Redis (BullMQ -> workers).
// É o contrato entre o orchestrator (TS) e os workers (Python).
// ------------------------------------------------------------
export const jobPayloadSchema = z.object({
  jobId: z.string(),
  generationId: z.string(),
  projectId: z.string(),
  stage: z.nativeEnum(JobStage),
  gpuBackend: z.nativeEnum(GpuBackend),
  // URIs de storage dos assets de entrada (s3://... ou file://...)
  inputs: z.array(z.string()).default([]),
  // Parâmetros específicos da etapa (prompt, steps, cfg, target_faces, etc.)
  params: z.record(z.unknown()).default({}),
});
export type JobPayload = z.infer<typeof jobPayloadSchema>;

// Resultado que o worker devolve ao orchestrator.
export const jobResultSchema = z.object({
  jobId: z.string(),
  status: z.nativeEnum(JobStatus),
  outputs: z
    .array(
      z.object({
        kind: z.nativeEnum(AssetKind),
        format: z.string(),
        storageUri: z.string(),
        sizeBytes: z.number().int().nonnegative().default(0),
        meta: z.record(z.unknown()).default({}),
      }),
    )
    .default([]),
  error: z.string().optional(),
});
export type JobResult = z.infer<typeof jobResultSchema>;

// Evento de progresso publicado em Redis pub/sub -> WebSocket -> UI.
export const progressEventSchema = z.object({
  jobId: z.string(),
  generationId: z.string(),
  stage: z.nativeEnum(JobStage),
  status: z.nativeEnum(JobStatus),
  progress: z.number().int().min(0).max(100),
  message: z.string().optional(),
});
export type ProgressEvent = z.infer<typeof progressEventSchema>;

// ------------------------------------------------------------
// Requisições da API (criação de gerações)
// ------------------------------------------------------------
export const createGenerationSchema = z.object({
  projectId: z.string(),
  type: z.nativeEnum(GenerationType),
  prompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  inputAssetId: z.string().optional(),
  exportFormats: z.array(z.nativeEnum(ExportFormat)).optional(),
  params: z.record(z.unknown()).default({}),
});
export type CreateGenerationInput = z.infer<typeof createGenerationSchema>;

import { z } from "zod";

// ------------------------------------------------------------
// Manifesto das ferramentas externas (auxiliary-tools).
// Consumido pelo tool-manager para clonar/baixar/fixar versões.
// ------------------------------------------------------------
export const gitToolSchema = z.object({
  type: z.literal("git"),
  repo: z.string().url(),
  pinnedCommit: z.string(),
  // ref opcional (branch/tag) usado p/ verificar atualizações
  trackRef: z.string().default("main"),
});

export const releaseToolSchema = z.object({
  type: z.literal("release"),
  version: z.string(),
  // URL do binário/arquivo a baixar (pode conter ${version})
  url: z.string().url(),
  sha256: z.string().optional(),
  // repo GitHub p/ checar releases mais novas (owner/name)
  githubRepo: z.string().optional(),
});

export const toolEntrySchema = z.discriminatedUnion("type", [
  gitToolSchema,
  releaseToolSchema,
]);
export type ToolEntry = z.infer<typeof toolEntrySchema>;

export const toolManifestSchema = z.record(toolEntrySchema);
export type ToolManifest = z.infer<typeof toolManifestSchema>;

// Estado instalado, gravado em auxiliary-tools/manifest.lock.json
export const installedToolSchema = z.object({
  tool: z.string(),
  type: z.enum(["git", "release"]),
  version: z.string(),
  commitHash: z.string().optional(),
  sha256: z.string().optional(),
  installedAt: z.string(),
  path: z.string(),
});
export type InstalledTool = z.infer<typeof installedToolSchema>;

export const lockFileSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  tools: z.record(installedToolSchema),
});
export type LockFile = z.infer<typeof lockFileSchema>;

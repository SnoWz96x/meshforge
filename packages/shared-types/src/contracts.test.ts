import { describe, expect, it } from "vitest";
import { createGenerationSchema, jobResultSchema, progressEventSchema } from "./contracts.js";
import { AssetKind, GenerationType, JobStage, JobStatus } from "./enums.js";

describe("jobResultSchema", () => {
  it("aplica defaults (outputs=[]) quando ausentes", () => {
    const r = jobResultSchema.parse({ jobId: "j1", status: JobStatus.SUCCEEDED });
    expect(r.outputs).toEqual([]);
  });

  it("aplica defaults em output (sizeBytes=0, meta={})", () => {
    const r = jobResultSchema.parse({
      jobId: "j1",
      status: JobStatus.SUCCEEDED,
      outputs: [{ kind: AssetKind.MESH_RAW, format: "glb", storageUri: "local:a.glb" }],
    });
    expect(r.outputs[0]).toMatchObject({ sizeBytes: 0, meta: {} });
  });

  it("rejeita status inválido", () => {
    expect(jobResultSchema.safeParse({ jobId: "j1", status: "WAT" }).success).toBe(false);
  });

  it("rejeita sizeBytes negativo", () => {
    const bad = {
      jobId: "j1",
      status: JobStatus.SUCCEEDED,
      outputs: [{ kind: AssetKind.IMAGE, format: "png", storageUri: "local:a.png", sizeBytes: -1 }],
    };
    expect(jobResultSchema.safeParse(bad).success).toBe(false);
  });
});

describe("progressEventSchema", () => {
  it("aceita progress no intervalo 0..100", () => {
    const ev = progressEventSchema.parse({
      jobId: "j1",
      generationId: "g1",
      stage: JobStage.SDXL_TXT2IMG,
      status: JobStatus.RUNNING,
      progress: 50,
    });
    expect(ev.progress).toBe(50);
  });

  it("rejeita progress fora de 0..100", () => {
    const base = {
      jobId: "j1",
      generationId: "g1",
      stage: JobStage.SDXL_TXT2IMG,
      status: JobStatus.RUNNING,
    };
    expect(progressEventSchema.safeParse({ ...base, progress: 101 }).success).toBe(false);
    expect(progressEventSchema.safeParse({ ...base, progress: -1 }).success).toBe(false);
  });
});

describe("createGenerationSchema", () => {
  it("exige projectId e type", () => {
    expect(createGenerationSchema.safeParse({ prompt: "x" }).success).toBe(false);
  });

  it("aceita o mínimo e aplica params={}", () => {
    const r = createGenerationSchema.parse({
      projectId: "p1",
      type: GenerationType.TEXT_TO_IMAGE,
    });
    expect(r.params).toEqual({});
  });
});

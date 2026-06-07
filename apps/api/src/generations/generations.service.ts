import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  GenerationType,
  GpuBackend,
  JobStage,
  QUEUES,
  type CreateGenerationInput,
  type JobPayload,
} from "@meshforge/shared-types";
import { enqueue, removeJob } from "@meshforge/queue";
import { PrismaService } from "../prisma.service.js";

// Mapeia o tipo de geração para a etapa inicial. Fase 2 cobre 2D; 3D vem depois.
const STAGE_FOR_TYPE: Partial<Record<GenerationType, JobStage>> = {
  [GenerationType.TEXT_TO_IMAGE]: JobStage.SDXL_TXT2IMG,
  [GenerationType.IMAGE_TO_IMAGE]: JobStage.SDXL_IMG2IMG,
  [GenerationType.IMAGE_TO_3D]: JobStage.HUNYUAN3D_SHAPE,
  [GenerationType.MULTI_IMAGE_TO_3D]: JobStage.HUNYUAN3D_MULTIVIEW,
  // Pipeline encadeado num job só: txt2img -> shape (não exige imagem de entrada).
  [GenerationType.TEXT_TO_3D]: JobStage.TEXT_TO_3D,
};

// Tipos que exigem uma imagem de entrada.
const NEEDS_INPUT_IMAGE: GenerationType[] = [
  GenerationType.IMAGE_TO_IMAGE,
  GenerationType.IMAGE_TO_3D,
];

// Ordem canônica das vistas do multiview (paralela a inputAssetIds).
const MULTIVIEW_VIEWS = ["front", "left", "right", "back"] as const;

@Injectable()
export class GenerationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateGenerationInput) {
    const project = await this.prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new NotFoundException(`Projeto ${input.projectId} não encontrado`);

    const stage = STAGE_FOR_TYPE[input.type];
    if (!stage) {
      throw new BadRequestException(
        `Tipo ${input.type} ainda não suportado (geração 3D chega na Fase 3).`,
      );
    }

    // Resolve o(s) asset(s) de entrada (img2img / image→3D / multi-imagem→3D).
    const inputs: string[] = [];
    let viewOrder: string[] | undefined;
    if (input.type === GenerationType.MULTI_IMAGE_TO_3D) {
      const ids = input.inputAssetIds ?? [];
      if (!ids.length) {
        throw new BadRequestException(
          "MULTI_IMAGE_TO_3D requer inputAssetIds (1 a 4 imagens: front/left/right/back).",
        );
      }
      if (ids.length > MULTIVIEW_VIEWS.length) {
        throw new BadRequestException(`No máximo ${MULTIVIEW_VIEWS.length} vistas.`);
      }
      // Vistas explícitas via params.views (paralelas a ids) ou ordem canônica.
      const declared = Array.isArray(input.params?.views)
        ? (input.params.views as string[])
        : MULTIVIEW_VIEWS.slice(0, ids.length);
      viewOrder = [];
      for (let i = 0; i < ids.length; i++) {
        const assetId = ids[i] as string;
        const view = declared[i] as string;
        if (!MULTIVIEW_VIEWS.includes(view as (typeof MULTIVIEW_VIEWS)[number])) {
          throw new BadRequestException(`Vista inválida: ${view}`);
        }
        const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset) throw new NotFoundException(`Asset ${assetId} não encontrado`);
        inputs.push(asset.storageUri);
        viewOrder.push(view);
      }
    } else if (NEEDS_INPUT_IMAGE.includes(input.type)) {
      if (!input.inputAssetId) {
        throw new BadRequestException(`${input.type} requer inputAssetId (imagem de entrada).`);
      }
      const asset = await this.prisma.asset.findUnique({ where: { id: input.inputAssetId } });
      if (!asset) throw new NotFoundException(`Asset ${input.inputAssetId} não encontrado`);
      inputs.push(asset.storageUri);
    }

    const gpuBackend = (process.env.GPU_BACKEND?.toUpperCase() as GpuBackend) ?? GpuBackend.ZLUDA;

    // Cria geração + job atomicamente.
    const generation = await this.prisma.generation.create({
      data: {
        projectId: input.projectId,
        type: input.type,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        params: input.params as object,
        status: "QUEUED",
        jobs: {
          create: { stage, status: "QUEUED", gpuBackend },
        },
      },
      include: { jobs: true },
    });

    const job = generation.jobs[0]!;
    const payload: JobPayload = {
      jobId: job.id,
      generationId: generation.id,
      projectId: input.projectId,
      stage,
      gpuBackend,
      inputs,
      params: {
        prompt: input.prompt ?? "",
        negativePrompt: input.negativePrompt ?? "",
        ...input.params,
        // Vistas paralelas a `inputs` (multi-imagem→3D): worker mapeia view→imagem.
        ...(viewOrder ? { views: viewOrder } : {}),
      },
    };
    // Enfileira; se falhar (Redis fora do ar), marca FAILED para não deixar
    // geração órfã em QUEUED que nunca processa.
    try {
      await enqueue(QUEUES.COMFYUI, payload);
    } catch (err) {
      const reason = `Falha ao enfileirar: ${(err as Error).message}`;
      await this.prisma.job.update({
        where: { id: job.id },
        data: { status: "FAILED", error: reason, finishedAt: new Date() },
      });
      await this.prisma.generation.update({
        where: { id: generation.id },
        data: { status: "FAILED" },
      });
      throw new ServiceUnavailableException(
        "Não foi possível enfileirar a geração (fila indisponível). Tente novamente.",
      );
    }

    return generation;
  }

  async cancel(id: string) {
    const generation = await this.prisma.generation.findUnique({
      where: { id },
      include: { jobs: true },
    });
    if (!generation) throw new NotFoundException(`Geração ${id} não encontrada`);

    const job = generation.jobs[0];
    if (job && (job.status === "QUEUED" || job.status === "RUNNING")) {
      // Marca CANCELED primeiro (os handlers de evento respeitam esse estado).
      await this.prisma.job.update({
        where: { id: job.id },
        data: { status: "CANCELED", finishedAt: new Date() },
      });
      // Tenta tirar da fila; se não conseguir, é porque já está em execução
      // (concurrency=1 → é O job rodando) → interrompe a execução no ComfyUI.
      const removed = await removeJob(QUEUES.COMFYUI, job.id).catch(() => false);
      if (!removed) {
        const url = process.env.COMFYUI_URL ?? "http://localhost:8188";
        await fetch(`${url}/interrupt`, { method: "POST" }).catch(() => undefined);
      }
    }
    await this.prisma.generation.update({ where: { id }, data: { status: "CANCELED" } });
    return this.get(id);
  }

  async get(id: string) {
    const generation = await this.prisma.generation.findUnique({
      where: { id },
      include: {
        jobs: { orderBy: { createdAt: "asc" }, include: { outputAssets: true } },
      },
    });
    if (!generation) throw new NotFoundException(`Geração ${id} não encontrada`);
    return generation;
  }
}

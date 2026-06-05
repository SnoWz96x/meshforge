import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  GenerationType,
  GpuBackend,
  JobStage,
  QUEUES,
  type CreateGenerationInput,
  type JobPayload,
} from "@meshforge/shared-types";
import { enqueue } from "@meshforge/queue";
import { PrismaService } from "../prisma.service.js";

// Mapeia o tipo de geração para a etapa inicial. Fase 2 cobre 2D; 3D vem depois.
const STAGE_FOR_TYPE: Partial<Record<GenerationType, JobStage>> = {
  [GenerationType.TEXT_TO_IMAGE]: JobStage.SDXL_TXT2IMG,
  [GenerationType.IMAGE_TO_IMAGE]: JobStage.SDXL_IMG2IMG,
  [GenerationType.IMAGE_TO_3D]: JobStage.HUNYUAN3D_SHAPE,
};

// Tipos que exigem uma imagem de entrada.
const NEEDS_INPUT_IMAGE: GenerationType[] = [
  GenerationType.IMAGE_TO_IMAGE,
  GenerationType.IMAGE_TO_3D,
];

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

    // Resolve o asset de entrada (img2img / image→3D).
    const inputs: string[] = [];
    if (NEEDS_INPUT_IMAGE.includes(input.type)) {
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
      },
    };
    await enqueue(QUEUES.COMFYUI, payload);

    return generation;
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

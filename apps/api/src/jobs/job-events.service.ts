import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { QueueEvents, createConnection, publishProgress } from "@meshforge/queue";
import {
  JobStatus,
  QUEUES,
  jobResultSchema,
  type JobResult,
  type QueueName,
} from "@meshforge/shared-types";
import { PrismaService } from "../prisma.service.js";

// Escuta os eventos das filas e reflete no banco (Job/Asset/Generation).
// Os workers (Python) NUNCA escrevem no DB — só devolvem JobResult pela fila.
@Injectable()
export class JobEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobEventsService.name);
  private readonly listeners: QueueEvents[] = [];

  // Filas observadas (cresce a cada fase).
  private readonly queues: QueueName[] = [QUEUES.COMFYUI];

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    for (const name of this.queues) {
      const qe = new QueueEvents(name, { connection: createConnection() });
      qe.on("active", ({ jobId }) => void this.onActive(jobId));
      qe.on("completed", ({ jobId, returnvalue }) => void this.onCompleted(jobId, returnvalue));
      qe.on("failed", ({ jobId, failedReason }) => void this.onFailed(jobId, failedReason));
      this.listeners.push(qe);
      this.logger.log(`Observando fila "${name}"`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.listeners.map((qe) => qe.close()));
  }

  private async onActive(jobId: string): Promise<void> {
    const existing = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (existing?.status === "CANCELED") return; // não reativa job cancelado
    const job = await this.prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.RUNNING, startedAt: new Date(), progress: 1 },
    });
    await this.prisma.generation.update({
      where: { id: job.generationId },
      data: { status: JobStatus.RUNNING },
    });
    await publishProgress({
      jobId,
      generationId: job.generationId,
      stage: job.stage,
      status: JobStatus.RUNNING,
      progress: 1,
    });
    this.logger.log(`[job=${jobId} gen=${job.generationId} stage=${job.stage}] RUNNING`);
  }

  private async onCompleted(jobId: string, raw: string | object): Promise<void> {
    const parsed = this.parseResult(raw);
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;
    if (job.status === "CANCELED") return; // não ressuscita job cancelado

    // Persiste os assets de saída ligados a este job.
    for (const out of parsed?.outputs ?? []) {
      await this.prisma.asset.create({
        data: {
          projectId: job.generationId ? (await this.projectIdFor(job.generationId)) : "",
          kind: out.kind,
          format: out.format,
          storageUri: out.storageUri,
          sizeBytes: BigInt(out.sizeBytes ?? 0),
          meta: out.meta as object,
          outputOfJobs: { connect: { id: jobId } },
        },
      });
    }

    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.SUCCEEDED, progress: 100, finishedAt: new Date() },
    });
    await this.prisma.generation.update({
      where: { id: job.generationId },
      data: { status: JobStatus.SUCCEEDED },
    });
    await publishProgress({
      jobId,
      generationId: job.generationId,
      stage: job.stage,
      status: JobStatus.SUCCEEDED,
      progress: 100,
    });
    this.logger.log(
      `[job=${jobId} gen=${job.generationId} stage=${job.stage}] SUCCEEDED (${parsed?.outputs?.length ?? 0} output(s))`,
    );
  }

  private async onFailed(jobId: string, reason: string): Promise<void> {
    const existing = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (existing?.status === "CANCELED") return; // cancelado pelo usuário; ignora
    const job = await this.prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.FAILED, error: reason, finishedAt: new Date() },
    });
    await this.prisma.generation.update({
      where: { id: job.generationId },
      data: { status: JobStatus.FAILED },
    });
    await publishProgress({
      jobId,
      generationId: job.generationId,
      stage: job.stage,
      status: JobStatus.FAILED,
      progress: job.progress,
      message: reason,
    });
    this.logger.warn(`[job=${jobId} gen=${job.generationId} stage=${job.stage}] FAILED: ${reason}`);
  }

  private async projectIdFor(generationId: string): Promise<string> {
    const g = await this.prisma.generation.findUnique({ where: { id: generationId } });
    return g?.projectId ?? "";
  }

  private parseResult(raw: string | object): JobResult | null {
    try {
      const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      const result = jobResultSchema.safeParse(obj);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }
}

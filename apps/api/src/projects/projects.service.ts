import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import { StorageService } from "../storage.service.js";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Single-user: garante um usuário "owner" e devolve seu id.
  private async ownerId(): Promise<string> {
    const email = "owner@meshforge.local";
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, role: "OWNER" },
    });
    return user.id;
  }

  async create(name: string, description?: string) {
    return this.prisma.project.create({
      data: { name, description, userId: await this.ownerId() },
    });
  }

  async list() {
    return this.prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { generations: true, assets: true } } },
    });
  }

  async get(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        generations: { orderBy: { createdAt: "desc" }, take: 50 },
        assets: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    if (!project) throw new NotFoundException(`Projeto ${id} não encontrado`);
    return project;
  }

  async rename(id: string, name: string, description?: string) {
    await this.ensureExists(id);
    return this.prisma.project.update({ where: { id }, data: { name, description } });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    // Apaga o projeto (cascade: gerações + assets) e limpa os arquivos do storage.
    await this.prisma.project.delete({ where: { id } });
    await this.storage.driver.removeUnder(`projects/${id}`).catch(() => undefined);
    return { ok: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const p = await this.prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!p) throw new NotFoundException(`Projeto ${id} não encontrado`);
  }
}

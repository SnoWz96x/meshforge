import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

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
}

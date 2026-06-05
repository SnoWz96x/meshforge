import { Injectable } from "@nestjs/common";
import { createConnection } from "@meshforge/queue";
import { PrismaService } from "./prisma.service.js";

type Check = { ok: boolean; detail?: string };

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkDb(): Promise<Check> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (e) {
      return { ok: false, detail: (e as Error).message.slice(0, 120) };
    }
  }

  private async checkRedis(): Promise<Check> {
    const conn = createConnection();
    try {
      const pong = await conn.ping();
      return { ok: pong === "PONG" };
    } catch (e) {
      return { ok: false, detail: (e as Error).message.slice(0, 120) };
    } finally {
      conn.disconnect();
    }
  }

  private async checkComfyUI(): Promise<Check> {
    const url = process.env.COMFYUI_URL ?? "http://localhost:8188";
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${url}/system_stats`, { signal: ctrl.signal });
      clearTimeout(t);
      return { ok: res.ok };
    } catch (e) {
      return { ok: false, detail: (e as Error).message.slice(0, 120) };
    }
  }

  async status(): Promise<{
    status: "ok" | "degraded";
    service: string;
    time: string;
    checks: Record<string, Check>;
  }> {
    const [db, redis, comfyui] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
      this.checkComfyUI(),
    ]);
    const checks = { db, redis, comfyui };
    // DB e Redis são essenciais; ComfyUI off = degradado (não derruba a API).
    const status = db.ok && redis.ok ? "ok" : "degraded";
    return { status, service: "meshforge-api", time: new Date().toISOString(), checks };
  }
}

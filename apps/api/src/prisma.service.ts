import { Injectable, type OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@meshforge/db";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}

import { Module } from "@nestjs/common";
import { GenerationsController } from "./generations.controller.js";
import { GenerationsService } from "./generations.service.js";
import { PrismaService } from "../prisma.service.js";

@Module({
  controllers: [GenerationsController],
  providers: [GenerationsService, PrismaService],
})
export class GenerationsModule {}

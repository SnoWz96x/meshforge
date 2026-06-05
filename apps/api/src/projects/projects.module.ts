import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsService } from "./projects.service.js";
import { PrismaService } from "../prisma.service.js";
import { StorageService } from "../storage.service.js";

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, PrismaService, StorageService],
  exports: [ProjectsService, PrismaService],
})
export class ProjectsModule {}

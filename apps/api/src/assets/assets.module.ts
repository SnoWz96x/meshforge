import { Module } from "@nestjs/common";
import { AssetsController } from "./assets.controller.js";
import { AssetsService } from "./assets.service.js";
import { PrismaService } from "../prisma.service.js";
import { StorageService } from "../storage.service.js";

@Module({
  controllers: [AssetsController],
  providers: [AssetsService, PrismaService, StorageService],
  exports: [AssetsService, StorageService],
})
export class AssetsModule {}

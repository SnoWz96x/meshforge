import { Module } from "@nestjs/common";
import { GalleryController } from "./gallery.controller.js";
import { GalleryService } from "./gallery.service.js";
import { PrismaService } from "../prisma.service.js";
import { StorageService } from "../storage.service.js";

@Module({
  controllers: [GalleryController],
  providers: [GalleryService, PrismaService, StorageService],
})
export class GalleryModule {}

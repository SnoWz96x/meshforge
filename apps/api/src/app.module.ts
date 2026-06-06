import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";
import { PrismaService } from "./prisma.service.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { GenerationsModule } from "./generations/generations.module.js";
import { AssetsModule } from "./assets/assets.module.js";
import { ProgressModule } from "./progress/progress.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { GalleryModule } from "./gallery/gallery.module.js";

@Module({
  imports: [
    ProjectsModule,
    GenerationsModule,
    AssetsModule,
    ProgressModule,
    JobsModule,
    GalleryModule,
  ],
  controllers: [HealthController],
  providers: [HealthService, PrismaService],
})
export class AppModule {}

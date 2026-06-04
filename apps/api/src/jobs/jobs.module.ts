import { Module } from "@nestjs/common";
import { JobEventsService } from "./job-events.service.js";
import { PrismaService } from "../prisma.service.js";

@Module({
  providers: [JobEventsService, PrismaService],
})
export class JobsModule {}

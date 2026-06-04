import { Module } from "@nestjs/common";
import { ProgressGateway } from "./progress.gateway.js";

@Module({
  providers: [ProgressGateway],
})
export class ProgressModule {}

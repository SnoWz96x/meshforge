import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { validateEnv } from "./env.js";

validateEnv();

// Asset.sizeBytes é BigInt no Prisma; permite serializá-lo em JSON.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};

const PORT = Number(process.env.API_PORT ?? 3001);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(PORT);
  // eslint-disable-next-line no-console
  console.log(`🚀 MeshForge API on http://localhost:${PORT}`);
}

void bootstrap();

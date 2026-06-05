import { z } from "zod";

// Valida o ambiente no boot — falha cedo e claro em vez de erro profundo depois.
const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  API_PORT: z.coerce.number().default(3001),
  COMFYUI_URL: z.string().url().default("http://localhost:8188"),
  STORAGE_LOCAL_PATH: z.string().optional(),
});

export function validateEnv(): void {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Variáveis de ambiente inválidas/ausentes:");
    for (const issue of result.error.issues) {
      console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    }
    console.error("   Copie .env.example para .env e ajuste os valores.");
    process.exit(1);
  }
}

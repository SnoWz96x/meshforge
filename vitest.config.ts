import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Testes unitários dos packages (lógica pura: storage, contratos zod).
    include: ["packages/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});

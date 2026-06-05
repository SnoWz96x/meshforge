import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

// ESLint (flat config) para o backend/packages/tools em TypeScript.
// O app web (Next.js) é coberto pelo seu próprio `next lint` (script lint:pkgs).
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/build/**",
      "**/coverage/**",
      "**/.venv/**",
      "**/__pycache__/**",
      "auxiliary-tools/**",
      "storage/**",
      "apps/web/**",
      "packages/db/generated/**",
      "**/*.config.{js,mjs,cjs,ts}",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Pragmático para esta base: `any` é usado de forma consciente em pontos
      // de fronteira (payloads de fila, meta de assets).
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);

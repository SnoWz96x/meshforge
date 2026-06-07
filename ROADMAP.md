# Roadmap — MeshForge

Estado real por fase. Datas relativas; foco em "pronto quando validado", sem placeholders.

| Fase | Entrega | Status |
| :-- | :-- | :-- |
| **0 — Fundação** | Monorepo, Docker (pg/redis/minio), schema DB, shared-types, tool-manager | ✅ |
| **1 — Tool & Model Manager** | model-manager, download ComfyUI/Hunyuan3D/Blender + modelos | ✅ |
| **2 — Geração 2D** | API, fila, storage, worker ComfyUI, SDXL text2img **na GPU AMD via ZLUDA** | ✅ |
| **2.1 — img2img** | Image-to-image E2E (upload + denoise) | ✅ |
| **3 — Geração 3D** | Worker Hunyuan3D (img→3D, **multi-imagem→3D**, text→3D), viewer 3D | ✅ |
| **3.1 — Textura premium** | Paint + **delight** + **ESRGAN upscale** + inpaint na AMD/ZLUDA; níveis de qualidade; 2 backends de rasterização (CPU/GPU) com seletor | ✅ |
| **4 — Blender Pipeline** | Headless: **cleanup + decimate** ✅. Retopo quad / UV bake ⬜ | 🚧 |
| **5 — Orquestração** | Encadeamento Texto→3D num job ✅. Pipeline 1-clique completo (→ otimizar → exportar) | 🚧 |
| **6 — Export Manager** | GLB/GLTF/OBJ/FBX/STL/USDZ/PLY via Blender headless | ✅ |
| **7 — UI Premium** | Shell premium, gerar, biblioteca (malhas 3D), exportar, ⌘K, dark/light, drag&drop, seletor de motor | ✅ |
| **8 — Hardening & Docs** | Testes + CI, logger estruturado, supervisor ComfyUI, RUNBOOK ✅. Auth/observabilidade/k8s ⬜ | 🚧 |

> **Decisão tomada (2026-06-04):** produto **Híbrido** — Next.js web-first +
> shell Tauri depois. Identidade/UX em [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## 🔧 Foco ATUAL: Refinamento (estabilizar antes de novas features)

Decisão (2026-06-04): antes de novas funcionalidades, **estabilizar/polir/fortalecer**
a base. Detalhes e priorização em **[AUDIT.md](AUDIT.md)**.

| Etapa | Conteúdo | Status |
| :-- | :-- | :-- |
| **R1 — Estabilização** | error boundary, geração atômica, glb robusto (diff), health profundo, validação de env, cancelamento, **supervisor do ComfyUI (auto-restart)** | ✅ |
| **R2 — Polimento** | viewer 3D profissional, biblioteca com malhas+thumbnails, WebSocket de progresso, toasts, CRUD projetos | ✅ |
| **R3 — Fortalecimento** | ESLint/Prettier/CI, testes (Vitest+pytest), logger estruturado (jobId), RUNBOOK, otimização de disco | ✅ |

## Próximos candidatos imediatos
1. **Orquestração 1-clique** — prompt → 3D → textura → otimizar → exportar, num fluxo só.
2. ~~Galeria open-source~~ ✅ — explorar/importar modelos 3D CC0 (tela Galeria).
3. ~~**Avançado** — retopo quad + UV bake; multi-imagem → 3D~~ ✅ — remesh watertight
   com re-bake EMIT **e** multi-imagem→3D (1–4 vistas, `Hy3DGenerateMeshMultiView`) entregues.

Ver [FUTURE_AUTOMATION_ROADMAP.md](FUTURE_AUTOMATION_ROADMAP.md) para automações futuras (não no escopo atual).

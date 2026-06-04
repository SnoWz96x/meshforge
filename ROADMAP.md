# Roadmap — MeshForge

Estado real por fase. Datas relativas; foco em "pronto quando validado", sem placeholders.

| Fase | Entrega | Status |
| :-- | :-- | :-- |
| **0 — Fundação** | Monorepo, Docker (pg/redis/minio), schema DB, shared-types, tool-manager | ✅ |
| **1 — Tool & Model Manager** | model-manager, download ComfyUI/Hunyuan3D/Blender + modelos | ✅ |
| **2 — Geração 2D** | API, fila, storage, worker ComfyUI, SDXL text2img **na GPU AMD via ZLUDA** | ✅ |
| **2.1 — img2img** | Validar image-to-image E2E (upload + denoise) | 🚧 |
| **3 — Geração 3D** | Worker Hunyuan3D (img→3D, text→3D), viewer 3D | ⬜ |
| **4 — Blender Pipeline** | Headless: cleanup → retopo (Instant Meshes) → UV → bake → texturas | ⬜ |
| **5 — Orquestração** | State machine do pipeline completo, retries, lock de GPU | ⬜ |
| **6 — Export Manager** | GLB/GLTF/OBJ/FBX/STL/USDZ + previews turntable | ⬜ |
| **7 — UI Premium** | Front-end SaaS premium (galeria, projetos, viewer 3D, dark/light, drag&drop) | ⬜ |
| **8 — Hardening & Docs** | Auth, observabilidade, docs, k8s inicial | ⬜ |

> **Decisão tomada (2026-06-04):** produto **Híbrido** — Next.js web-first +
> shell Tauri depois. Identidade/UX em [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Próximos candidatos imediatos
1. **Fase 7 (UI)** — front-end premium (depende da decisão Web/Desktop/Híbrido).
2. **Fase 3 (3D)** — Hunyuan3D na GPU.
3. **Fase 2.1** — validar img2img.

Ver [FUTURE_AUTOMATION_ROADMAP.md](FUTURE_AUTOMATION_ROADMAP.md) para automações futuras (não no escopo atual).

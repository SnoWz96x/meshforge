# Arquitetura — MeshForge

Documento de referência da arquitetura definitiva. Plataforma pessoal,
self-hosted, de geração 3D por IA.

## 1. Princípios

- **Plano de controle (TS) vs. plano de computação (Python/GPU)** separados.
- Cada etapa do pipeline é um **Job idempotente e retomável**.
- Workers são **stateless**: leem input do storage, escrevem output no storage,
  atualizam estado no DB.
- **ComfyUI é o runtime único de GPU**: roda SDXL e Hunyuan3D como workflows,
  gerenciando VRAM (load/offload) — resolve o limite de 16 GB da RX 7800 XT.
- Ferramentas externas são **pinadas, verificadas e atualizadas sob confirmação**
  (nunca auto-update cego).

## 2. Hardware alvo (real)

- CPU AMD Ryzen 9 7900X3D · 32 GB RAM
- GPU **AMD Radeon RX 7800 XT (RDNA3/gfx1101, 16 GB VRAM)** — **não** é CUDA.
- GPU backend primário: **ZLUDA** (Windows). Fallback cirúrgico p/ o worker 3D:
  **ROCm via WSL2** (engatilhável por flag `GPU_BACKEND_3D`, não default).
- Abstração `gpu-backend: zluda | rocm | cuda | directml` por worker.

## 3. Diagrama

```
Frontend (Next.js) ──REST+WS── API (NestJS) ──┬── Postgres (estado)
                                              ├── Redis (BullMQ + pub/sub)
                                              └── Storage (FS local / MinIO)
                                                     │
                                Pipeline Orchestrator (state machine)
                                                     │  dispatch por fila
        ┌────────────────────────┬───────────────────┴───────────┐
   ComfyUI service          Hunyuan3D (via ComfyUI nodes)    Blender worker
   (SDXL txt2img/img2img)   (image/text -> malha)            (cleanup, Instant
                                                              Meshes, UV, bake,
                                                              texture, export)
        └──────────── tool-manager + model-manager (auxiliary-tools) ─────────┘
```

## 4. Pipeline

1. **SDXL/ComfyUI** — text2img / img2img (asset imagem).
2. **Hunyuan3D 2.0** — image→3D / text→3D (malha bruta + textura inicial).
3. **Blender (headless)** — cleanup → retopo (Instant Meshes) → UV → bake PBR →
   ajuste de textura.
4. **(opcional) ComfyUI** — upscale de textura.
5. **Preview** turntable → **Export** (GLB/GLTF/OBJ/FBX/STL/USDZ) → projeto salvo.

Cada caixa é um `Job` com estado persistido; falha numa etapa só repete aquela
etapa. Um **lock de GPU** impede SDXL e Hunyuan3D de disputarem a VRAM.

> Risco AMD conhecido: a textura nativa do Hunyuan3D usa kernels CUDA custom que
> podem não rodar via ZLUDA. Plano B (a decidir na Fase 3/4): gerar textura via
> ComfyUI (SDXL + ControlNet depth/normal projetada na malha).

## 5. Banco de dados

Entidades núcleo: `User`, `Project`, `Generation`, `Job`, `Asset`, `PipelineRun`,
`ToolVersion`, `ModelAsset`. Ver [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma).

`Job` é entidade de primeira classe (não só item de fila) → dá histórico,
retomada e observabilidade.

## 6. Filas

BullMQ sobre Redis, uma fila por família de worker: `comfyui`, `hunyuan3d`,
`blender`, `export`, `pipeline`. Workers Python consomem via o mesmo protocolo
de job (`JobPayload`/`JobResult` em `@meshforge/shared-types`). Progresso é
publicado em `meshforge:progress` (pub/sub) → WebSocket → UI.

## 7. Ferramentas externas (tool-manager)

`auxiliary-tools/` é reconstruída a partir de `manifest.lock.json`.
- **git** (ComfyUI, Hunyuan3D): clone + checkout de commit fixado.
- **release** (Blender, Instant Meshes): download + verificação de SHA256.
- `check` reporta novas versões; `update` aplica sob confirmação com smoke-test
  e rollback.

## 8. Modelos de IA (model-manager) — Fase 1

Catálogo declarativo, download resumível via `huggingface_hub`, verificação de
hash/revision, registro em `ModelAsset`, cache compartilhado em
`auxiliary-tools/cache`.

## 9. Roadmap por fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| **0 — Fundação** ✅ em andamento | monorepo, infra Docker, schema DB, shared-types, tool-manager | `infra:up` sobe; lockfile gerável |
| 1 — Tool & Model Manager | model-manager, bootstrap completo, smoke-tests | `install.ps1` baixa tudo e registra versões |
| 2 — Geração 2D | comfyui-service, SDXL txt2img/img2img, API de jobs, fila, storage | prompt → imagem via API |
| 3 — Geração 3D | hunyuan3d worker, viewer 3D | imagem → .glb no viewer |
| 4 — Blender Pipeline | cleanup→retopo→UV→bake→texturas | malha bruta → malha final texturizada |
| 5 — Orquestração | state machine, full pipeline, retries, GPU lock | prompt → modelo final, 1 clique |
| 6 — Export | GLB/GLTF/OBJ/FBX/STL/USDZ + previews | 6 formatos baixáveis |
| 7 — UI Premium | galeria, projetos, histórico, drag&drop, dark/light, realtime | UX nível comercial |
| 8 — Hardening & Docs | observabilidade, docs, k8s (futuro) | release-ready |

## 10. Decisões registradas

- Backend **NestJS + BullMQ**; workers **Python**.
- **ComfyUI** como runtime único de GPU (SDXL + Hunyuan3D via custom nodes).
- **Instant Meshes** como engine primária de retopologia.
- Storage **FS local** por padrão (abstração S3); MinIO opcional.
- **Single-user**; sem Kubernetes por enquanto.

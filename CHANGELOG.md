# Changelog — MeshForge

Formato baseado em [Keep a Changelog](https://keepachangelog.com/). Datas em ISO.

## [Unreleased]

### Audit
- **AUDIT.md**: auditoria completa fundamentada no código (bugs, arquitetura,
  performance, UX, deps mortas, fluxos incompletos) + roadmap de refinamento
  (R1 estabilização → R2 polimento → R3 fortalecimento). Foco antes de novas features.
- Corrigido drift de docs (README: `packages/ui`/serviços inexistentes).

### Added
- **Governança:** `REQUIREMENTS_TRACKING.md`, `ROADMAP.md`, `CHANGELOG.md`,
  `CONFORMANCE_CHECKLIST.md`, `FUTURE_AUTOMATION_ROADMAP.md`.
- Política "sem placeholders" e checklist de conformidade.

### Added — Fase 3 (geração 3D, shape)
- **Image→3D integrado no produto (E2E):** UI "Imagem→3D" (drag&drop) → API
  `IMAGE_TO_3D` → worker `HUNYUAN3D_SHAPE` → ComfyUI/ZLUDA → `.glb` no storage
  (asset MESH_RAW) → **viewer 3D** (`react-three-fiber`, orbit/auto-rotate).
  Validado via API e via navegador (~78s com kernels em cache).
- Worker: stage `HUNYUAN3D_SHAPE` + `hunyuan3d_workflows.build_image_to_3d`.
- API: `IMAGE_TO_3D` → `HUNYUAN3D_SHAPE`; assets MESH servidos como model/gltf-binary.

### In progress — Fase 3 (geração 3D)
- 🏆 **Image→3D (shape) VALIDADO na AMD RX 7800 XT / ZLUDA** — imagem (caneca) →
  malha `.glb` watertight (20k verts / 40k faces) via Hunyuan3D no ComfyUI.
  Pipeline: Hy3DModelLoader → GenerateMesh → VAEDecode → Postprocess → ExportMesh.
  Workflow validado versionado em `services/comfyui-service/hunyuan3d_workflows.py`.
- **Hunyuan3D integrado ao ComfyUI-Zluda** (36 nodes; numpy re-fixado 1.26.4;
  SDXL sem regressão).
- Pendente: integrar no worker (stage HUNYUAN3D_SHAPE), UI Image→3D, viewer 3D,
  textura (plano B — custom_rasterizer é CUDA-only).

### Added — Fase 7 UI (Milestone 2)
- **Imagem → Imagem** na UI: drag & drop de imagem (upload real) + slider denoise.
  **img2img validado E2E** (GPU) — passa de 🧪 para ✅ no tracking.
- **⌘K command palette** (cmdk): navegação entre áreas + alternar tema.

### Added — Fase 7 UI (Milestone 1)
- **`apps/web`** (Next.js 14): app shell premium (sidebar + topbar + dark/light
  via next-themes) com os tokens do `DESIGN_SYSTEM` ("forge heat", dark-first).
- Tela **Gerar** (2 painéis): prompt + params → cria geração **real** → progresso →
  imagem + "Baixar PNG". **Validado E2E no navegador** (imagem 1024px gerada na GPU).
- **Biblioteca** (`/library`) e **Projetos** (`/projects`): dados reais da API.
- Áreas Workflow/Exportar como estados **honestos** "em desenvolvimento" (sem fakes).

### Decided
- **Produto: Híbrido** — UI Next.js web-first, arquitetada para shell Tauri depois.
- **Design System** (`DESIGN_SYSTEM.md`): identidade "forge heat", dark-first,
  tokens (cor/tipo/espaço/motion), IA/layout e stack, a partir de pesquisa de
  referências (Meshy, Krea, Linear, Raycast, Spline/Sketchfab, etc.).

---

## 2026-06-04

### Added
- **Runtime GPU AMD via ZLUDA funcionando** — SDXL gera imagens reais na
  RX 7800 XT (~1.8 it/s, 1024², ~26 s/img). Launcher validado
  (`tools/bootstrap/comfyui-zluda-launch.bat`).
- **Fase 2 — Geração 2D:** `apps/api` (NestJS), `packages/queue` (BullMQ),
  `packages/storage` (FS local), `services/comfyui-service` (worker Python SDXL).
- **Fase 1 — Tool & Model Manager:** `tools/model-manager` (HuggingFace),
  download de ComfyUI/Hunyuan3D/Blender + modelos (SDXL, Hunyuan3D).
- **Fase 0 — Fundação:** monorepo pnpm, Docker (Postgres/Redis/MinIO),
  schema Prisma, `shared-types`, `tools/tool-manager`, logo + README + AGPL.

### Fixed (AMD/ZLUDA — lições)
- `HIP_VISIBLE_DEVICES=1` esconde a iGPU (gfx1036) que abortava o rocBLAS.
- `TORCH_BACKENDS_CUDNN_ENABLED=0` → conv2d via MIOpen (cuDNN do ZLUDA inutilizável).
- `ROCm\6.4\bin` no PATH (dependência do cublas patcheado).
- Worker trata `execution_error` do ComfyUI (não trava mais).
- Container Postgres em :5433 (conflito com Postgres nativo na :5432).
- Docker Desktop: socket `dockerInference` órfão removido (crash no boot).

### Infra/ambiente
- HIP SDK 6.4 instalado; Python 3.11; `pip-system-certs` (inspeção TLS na máquina).

# CLAUDE.md — memória do projeto MeshForge

> Arquivo lido automaticamente pelo Claude Code a cada sessão. Viaja com a pasta do
> repositório (mesmo se o projeto for movido). Mantém o contexto sem depender do
> histórico de chat (que é guardado por caminho em `~/.claude/projects/...`).
> **Responda ao usuário em português.**

## O que é
**MeshForge** — plataforma **self-hosted, privada, 100% open-source** de geração 3D por IA,
estilo Meshy: um prompt ou imagem vira uma **malha 3D texturizada**, pronta para otimizar e
exportar, **rodando na GPU local**. Repo privado: `github.com/SnoWz96x/meshforge` (conta gh
`SnoWz96x`, branch `main`). Single-user (sem auth). Licença AGPL-3.0.

## Hardware / runtime REAL (não é NVIDIA!)
- **AMD Radeon RX 7800 XT (RDNA3/gfx1101, 16 GB)** + Ryzen 9 7900X3D + 32 GB, Windows 11.
- GPU via **ZLUDA** (HIP/ROCm 6.x) — ComfyUI em `C:\ComfyUI-Zluda` (:8188). PyTorch 2.7+cu118 sob ZLUDA.
- **A textura nativa do Hunyuan3D (custom_rasterizer, CUDA-only) FOI compilada e RODA na AMD** —
  Backend A (rasterizador CPU + pintura GPU/ZLUDA, **padrão**) e Backend B (GPU nativo, experimental, mais lento).
- ZLUDA é frágil: cada carga nova de GPU pode revelar crash (rocBLAS/cuDNN/MIOpen) → testar incremental.

### Quirks do ambiente (importante)
- **Postgres**: existe um Postgres 18 nativo na **5432** (NÃO mexer). O nosso container usa **5433**.
  Prisma (`packages/db`) não tem `.env` próprio → passe `DATABASE_URL` no ambiente ao rodar migrate.
- **SSL**: a inspeção TLS da máquina quebra pip/HuggingFace → use `pip-system-certs` em todo venv.
- **`.ps1` com acentos**: salve em UTF-8 **com BOM** (`Out-File -Encoding utf8` no PS 5.1), senão
  os caminhos "Área/Programação" corrompem.
- Node 20+/24, pnpm 9, Python 3.10, Docker Desktop (Postgres/Redis/MinIO), Git.

## Arquitetura
Monorepo pnpm. **Control plane (TypeScript)**: `apps/web` (Next.js 14), `apps/api` (NestJS),
`packages/{shared-types,db(Prisma),queue(BullMQ),storage}`. **Compute plane (Python/GPU)**:
`services/comfyui-service` (worker único: SDXL · Hunyuan3D shape+multiview+texture · rembg · **finish
do pacote 1-clique via Blender**), `services/blender-service` (`export_mesh.py`, `process_mesh.py`).
`tools/{bootstrap,tool-manager,model-manager}`. `auxiliary-tools/` fora do git (reconstruída via
`manifest.lock.json`). Worker é **stateless** e nunca toca o DB — a API reflete eventos da fila no Postgres.

Fluxo: **Web → API → fila (Redis/BullMQ) → Worker Python → ComfyUI/GPU → storage → API (QueueEvents) → DB**;
progresso em tempo real por Redis pub/sub → WebSocket.

## O que JÁ funciona (validado E2E — sem placeholders)
- **Text→Image**, **Image→Image** (SDXL).
- **Image→3D** e **Text→3D** (encadeado num job: SDXL → rembg → Hunyuan3D → malha).
- **Multi-imagem→3D** (`Hy3DGenerateMeshMultiView`, 1–4 vistas, **reusa o checkpoint base, sem download extra**).
- **Pacote 1-clique** (`FULL_PIPELINE`): prompt → imagem → malha → textura → **texfix** → otimizar(~20k) →
  exportar (FBX/OBJ/STL/USDZ/GLTF), **tudo num job server-side**, fire-and-forget.
- **Textura PBR premium** na AMD: delight + paint + ESRGAN upscale + bake + inpaint (até 2048²). Tiers Balanced/High/Max.
- **Ajuste automático de textura** (`texfix`): níveis por razão de luminância + saturação, **preservando a matiz**
  (gray-world white-balance foi descartado — estragava cores fortes legítimas).
- **Blender headless**: cleanup, decimate, **remesh watertight (re-bake EMIT)**, texfix.
- **Export**: GLB/GLTF/OBJ/FBX/STL/USDZ/PLY (multi-arquivo → zip).
- **Galeria** open-source CC0 (ToxSam, Khronos, Poly Haven; Poly Pizza opt-in via `POLY_PIZZA_KEY`).
- **Viewer 3D** (r3f), WebSocket progress, fila, histórico, projetos, health, **supervisor do ComfyUI**,
  **`update` manager** seguro, testes (Vitest+pytest) + CI.

## Pendências (abertas)
Retopo **quad puro** (QuadriFlow instável nessas malhas → usamos voxel remesh), **Backend B** (GPU raster,
mais lento via ZLUDA), validar **bootstrap 1-comando** em máquina limpa, e infra futura (auth/observabilidade/
distribuído/k8s). Editor de nós da tela **Workflow** é futuro.

## Como rodar (resumo — ver RUNBOOK.md)
1. `pnpm infra:up` (Postgres/Redis/MinIO) · `pnpm db:generate && pnpm db:migrate`.
2. ComfyUI: `powershell -ExecutionPolicy Bypass -File tools/bootstrap/comfyui-supervisor.ps1` (:8188).
3. API: `pnpm --filter @meshforge/api dev` (:3001).
4. Worker: em `services/comfyui-service`, com `REDIS_URL`/`COMFYUI_URL`/`STORAGE_LOCAL_PATH`/`COMFYUI_OUTPUT_DIR`
   setados → `.venv/Scripts/python.exe worker.py`.
5. Web: `pnpm --filter @meshforge/web dev` (:3000).
- **Textura exige o ComfyUI iniciado com o launcher de textura (CPU)**. Geração multiview na 1ª vez ~20 min (kernels).
- Após mudar código TS: reinicie a API; após mudar `worker.py`: reinicie o worker (ele lê o código no boot).

## Regras de trabalho (acordo com o usuário) — SIGA À RISCA
- **Commit direto na `main`** (sem branch/PR). **Autorizado a rodar instalações** livremente.
- **Mudanças aditivas** — nunca quebrar/remover features existentes ("sem retirar e quebrar").
- **Zero placeholders/fakes** — valide TUDO E2E (rode de verdade, renderize, confira) antes de dizer que funciona.
- **Relato honesto** — se errou, diga; não invente sucesso. (Ex.: a 1ª versão do `texfix` virou ciano; foi corrigida.)
- **Antes de commitar/pushar**: rode `pnpm format:check` **E** `pnpm lint` **E** `pnpm -r typecheck` **E** `pnpm test`
  (o **CI cobra Prettier E ESLint** — passar só no lint não basta) + `pytest` em `services/comfyui-service`.
- **Push só quando o usuário pedir.** Mensagem de commit termina com:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Manter governança em dia: `REQUIREMENTS_TRACKING.md`, `ROADMAP.md`, `CHANGELOG.md`, `ARCHITECTURE.md`, `RUNBOOK.md`.

## Armadilhas conhecidas
- CI roda **format:check (Prettier) além do lint** — sempre formatar `.tsx/.ts` antes do push.
- `process()` (cleanup/decimate/remesh/texfix) roda Blender **direto na API**; o pacote 1-clique roda Blender
  **no worker** (mesmos scripts, CPU). Outputs do worker viram assets via `JobEventsService` (kind/format/storageUri/meta).
- Multiview: `front_name` é a vista "front" ou a 1ª enviada (referência da textura).
- `params` passa por `_apply_quality`; flags do pacote: `package`, `texture`, `texture_fix`, `optimize`, `optimize_faces`, `export_formats`.

## Sessão recente (jun/2026) — o que entregamos
Multi-imagem→3D · Pacote 1-clique (`FULL_PIPELINE`) · Ajuste de textura (`texfix`) · `update` manager seguro
(rollback + guarda de árvore suja) · passada de QA/regressão · correção de textos defasados · **README e docs
alinhados ao estado real**. Tudo commitado e no GitHub, CI verde.

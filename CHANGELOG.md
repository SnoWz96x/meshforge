# Changelog — MeshForge

Formato baseado em [Keep a Changelog](https://keepachangelog.com/). Datas em ISO.

## [Unreleased]

### Seletor de motor de textura (plug & play, por geração)
- **Popup "Motor de textura" na tela Gerar**: botão que abre um popup com os 2
  backends de rasterização — **CPU (recomendado)** e **GPU (experimental)** — com
  descrição e recomendação. A escolha vale **por geração, sem reiniciar** nada.
- Como o `.pyd` completo tem CPU+GPU, o mesmo ComfyUI roda os dois: patch no nó
  `Hy3DRenderMultiView` (input opcional `render_device` cpu|cuda → `MeshRender(device)`);
  `build_texture` passa o device a partir de `params.texture_backend`. Validado E2E
  (grafo com `render_device=cpu`, textura gerada). Patch versionado em
  `tools/custom-rasterizer-gpu`.

### Textura — Backend B (rasterizador na GPU via ZLUDA)
- **2ª frente de textura: kernels CUDA do `custom_rasterizer` rodando na AMD via
  ZLUDA.** Compilado o `rasterizer_gpu.cu` (com `thrust`) com o nvcc (CUDA Toolkit
  11.8), no MESMO pacote do build CPU → os dois backends coexistem; o dispatcher
  escolhe CPU/GPU pelo device do tensor. Seletor em runtime `HUNYUAN3D_TEXTURE_DEVICE`
  (`cpu`|`cuda`); launcher GPU em `tools/bootstrap/comfyui-zluda-launch-texture-gpu.bat`.
  Build/patches versionados em `tools/custom-rasterizer-gpu/`.
- **Validado**: rasterização GPU via ZLUDA dá o mesmo resultado da CPU (722 px) e o
  pipeline de textura completo roda em `device=cuda`.
- **Avaliação honesta**: o Backend B é **mais lento** que o A (~373s vs ~119s numa
  textura leve) — o overhead do ZLUDA nos kernels custom (+ JIT) supera o ganho, pois
  a rasterização **não é o gargalo** (a difusão é). Por isso o **Backend A (CPU)
  segue como padrão**; o B fica como opção/robustez (a "2ª frente" pedida). Backend A
  intacto (sem regressão — backup em `_mf_rasterizer_cpu_backup`).

### Refino de fidelidade 3D (níveis + upscale)
- **Níveis de qualidade** `params.quality` = balanced/high/max (UI: "Qualidade 3D",
  default Alta): escalam geometria (octree 256→384, max_facenum 40k→160k, passos) e
  textura (1024→2048, passos). Validado em 16 GB ("Alta" = 100k faces + textura 2048²).
- **Upscale da textura (ESRGAN 4x-UltraSharp)**: as vistas pintadas passam por upscale
  **antes do bake** → textura realmente mais **nítida** (não só maior). Roda na GPU via
  ZLUDA (validado, sem OOM). On por padrão em Alta/Máxima. **Validado**: textura do
  cogumelo ficou nitidamente mais detalhada (lamelas/linhas finas, bolinhas definidas).

### Texto→3D — sujeito único (shape consistente)
- **Reforço de prompt no Texto→3D**: o SDXL às vezes gerava um *padrão/colagem* de
  objetos (→ shape virava um "painel" plano). O worker agora injeta, só no fluxo 3D,
  termos de isolamento ("single object, centered, isolated on plain white background,
  product shot…") + negativos ("pattern, tiled, multiple, collage…") no txt2img.
  `params.isolate_subject` (default on). **Validado E2E**: prompt simples
  "a cute red mushroom" → **um** cogumelo foto-realista → shape correto → **textura
  premium** (render comprova ponta-a-ponta).

### Textura PREMIUM (delight + inpaint)
- **Salto de qualidade na textura** — pipeline premium: **delight** (modelo
  `hunyuan3d-delight-v2-0`, baixado no 1º uso) deixa a cor *lighting-invariant*
  (some o escuro/sombra → albedo limpo e vivo) + **inpaint de costuras** (vertice +
  CV2, ambos CPU → sem buracos/emendas) + texturas **1024²** e vistas a 384.
  **Validado**: cogumelo passou de cinza-escuro para **vermelho vibrante com
  bolinhas creme** (render comprova). `services/comfyui-service/hunyuan3d_texture.py`
  reescrito; defaults premium no worker (`params.delight`, default on).

### Qualidade 3D (shape + viewer)
- **Shape muito melhor — remoção de fundo antes do 3D**: o Hunyuan3D espera o objeto
  isolado; com o fundo da cena o shape degenerava num **cubo/bloco**. Agora o worker
  recorta o objeto (rembg/u2net, fundo branco) antes do shape em todos os fluxos 3D
  (`IMAGE_TO_3D` e `TEXT_TO_3D`); `params.remove_bg` (default on). **Validado**: o mesmo
  prompt que dava cubo passou a gerar a forma correta (cogumelo). Fallback p/ imagem
  original se o rembg falhar.
- **Viewer mostra a textura**: novo modo **"Original"** (default) usa o material PBR
  do próprio GLB → exibe a textura baked (antes o viewer sobrescrevia tudo com argila).
  Fix de bug: `MeshThumb` mutava materiais na **cena compartilhada** do `useGLTF`
  (apagava a textura p/ o viewer) → passa a **clonar antes de mutar**. Câmera: malhas
  normalizadas para ~1.6u (antes objetos ~2u enchiam o frame).

### Textura na AMD — Backend A (CPU) VALIDADO E2E 🏆
- **Textura PBR do Hunyuan3D rodando na AMD/ZLUDA** — fim a fim. Pipeline:
  `Hy3DLoadMesh → UVWrap → RenderMultiView (CPU) → SampleMultiView (pintura, GPU/ZLUDA)
  → BakeFromMultiview (CPU) → ApplyTexture → ExportMesh`. **Validado**: malha gerada →
  `.glb` texturizado com **PBRMaterial + textura 768×768 embutida + UVs** (~2min).
  Builder versionado em `services/comfyui-service/hunyuan3d_texture.py`.
- **Rasterizador destravado**: o `custom_rasterizer` é uma extensão CUDA (não compila
  na AMD). Descoberto que o `rasterizer.cpp` já tem caminho de **CPU**; compilado um
  build **CPU-only** (MSVC, sem nvcc) — render/bake na CPU (`tools/custom-rasterizer-cpu/`).
  `MeshRender` aceita `HUNYUAN3D_TEXTURE_DEVICE=cpu|gpu`; launcher de textura em
  `tools/bootstrap/comfyui-zluda-launch-texture.bat`.
- Aprendizado: a 512² com 6 vistas a pintura estoura os 16 GB (OOM) — **não é falha do
  ZLUDA**; com vistas a 256² roda. (Tamanhos serão expostos como parâmetro.)
- **Backend B (GPU via ZLUDA)** — pendente: exige instalar o CUDA Toolkit 11.8
  (`nvcc`) para compilar o `.cu` e deixar o ZLUDA traduzir os kernels em runtime
  (experimental). Os dois backends coexistirão no mesmo pacote (seletor em runtime).
- **Integrado no produto (E2E)**: textura virou **opção** nas gerações 3D
  (`params.texture`). Worker: helper `_texturize()` encadeia a textura após o shape
  nos fluxos `HUNYUAN3D_SHAPE` e `TEXT_TO_3D` (defaults seguros p/ 16 GB: vistas 256,
  render/textura 768). UI: checkbox **"Texturizar (beta)"** nos modos 3D. Validado
  via produto: API `TEXT_TO_3D {texture:true}` → asset `MESH_RAW` (`meta.textured`)
  com PBRMaterial + textura 768² salvo na biblioteca. Requer ComfyUI com o launcher
  de textura (`HUNYUAN3D_TEXTURE_DEVICE=cpu`).

### Added — Texto→3D (pipeline encadeado)
- **Texto → 3D (E2E)**: nova `GenerationType.TEXT_TO_3D` que encadeia, **numa
  geração só**, SDXL txt2img → Hunyuan3D shape. Um job (`JobStage.TEXT_TO_3D`,
  migração aditiva do enum) roda as 2 etapas sequenciais no worker, com progresso
  contínuo (0–48% imagem, 50–100% malha) e **2 saídas** (a imagem intermediária
  `IMAGE` + a malha `MESH_RAW`). UI: modo "Texto → 3D" habilitado (prompt → malha,
  viewer 3D mostra a malha como resultado principal). Sem entrada de imagem.

### Fortalecimento (R3)
- **Modelos Hunyuan3D enxutos (~14 GB recuperados)**: o repo da Tencent traz o
  modelo de forma em 5 arquivos (mesmos pesos em fp16/fp32 × safetensors/.ckpt).
  Removidos os 3 `.ckpt` (legado/pickle, redundantes). Mantidas as 2 variantes
  `.safetensors` (fp16 padrão + fp32), com **switch por env** `HUNYUAN3D_DIT_MODEL`
  (sem mexer no código). **Validado**: geração 3D real (novo `.glb`) após a limpeza.
- **Supervisor do ComfyUI** (`tools/bootstrap/comfyui-supervisor.ps1`): mantém o
  runtime de GPU vivo. Health-check em `:8188/system_stats`; após N falhas
  consecutivas, mata zumbis (`zluda.exe`/`python main.py`) e religa pelo launcher
  validado, com polling ativo até subir (período de graça). Tira o "religar à mão"
  do crash do ZLUDA (exit 139). **Validado ao vivo**: matei o ComfyUI e o supervisor
  detectou (1/2 → 2/2) e disparou o restart corretamente.
- **Logging estruturado (jobId)**: worker Python passa a usar `logging` com
  contexto `job=<id> stage=<stage>` em cada transição (início/OK/falha) e
  `LOG_LEVEL` configurável; API (`JobEventsService`) loga `RUNNING/SUCCEEDED/FAILED`
  com `job`/`gen`/`stage`. Permite seguir um job ponta-a-ponta nos dois lados.
- **RUNBOOK.md**: guia operacional (ordem de boot, supervisor, health checks,
  parada, troubleshooting dos incidentes ZLUDA/SSL/portas, rastreabilidade por jobId).
- **Testes**: Vitest (16 testes — `storage` round-trip/traversal/removeUnder e
  contratos zod `jobResult`/`progressEvent`/`createGeneration`) + pytest (8 testes
  dos construtores de workflow SDXL e Hunyuan3D: estrutura, ligações entre nós,
  defaults/overrides). `pnpm test` + `pytest`.
- **Qualidade de código**: Prettier (padrão único, base inteira formatada) +
  ESLint flat config (typescript-eslint) para backend/packages/tools — `pnpm lint`
  e `pnpm format` limpos. Web segue no `next lint`.
- **CI (GitHub Actions)** `.github/workflows/ci.yml`: em push/PR roda
  format:check + lint + typecheck + testes (Node) e os testes dos workflow builders
  (Python), com cache pnpm e cancelamento de execuções antigas.

### Polish (R2)
- **WebSocket de progresso**: `socket.io-client` ligado ao `ProgressGateway`
  (a dep "morta" agora é usada). Progresso em tempo real (por step) com o polling
  como fallback (4s). Validado com cliente real recebendo eventos ao vivo.
  *(Observação: durante o teste o ComfyUI segfaultou — reforça a necessidade de
  supervisão/auto-restart do ComfyUI, item R6 do AUDIT.)*
- **CRUD de projetos**: criar/renomear/excluir (API `PATCH`/`DELETE` + cascade no
  banco + limpeza dos arquivos no storage) com toasts; **página de detalhe**
  `/projects/[id]`. Galeria extraída em `AssetGallery` (reuso Biblioteca/detalhe).
  Fix: pipe Zod agora é por-parâmetro (`@Body(...)`) — `@UsePipes` quebrava o `@Param`.
- **Toasts globais** (sucesso/erro/info) via store leve (sem dep nova): geração
  concluída/falha/cancelada, erros de upload/início.
- **Banner de saúde**: avisa quando API/Redis/ComfyUI estão fora do ar (usa `/health`).
- **Biblioteca com malhas 3D**: thumbnails 3D leves (montam só quando visíveis,
  IntersectionObserver) + **lightbox** que abre o viewer 3D completo / imagem.
- **A11y do ⌘K**: removido o Radix Dialog (warning de DialogTitle); overlay próprio + Escape.
- **Viewer 3D profissional** (`MeshViewer`): toolbar flutuante (materiais studio/normais/
  argila, wireframe, grade, reset de câmera, tela cheia) + painel de stats (verts/faces).
  **Validado pelo usuário** (bule → malha 20k verts / 40k faces renderizada no navegador).

### Stabilization (R1)
- **Error boundary** no front (protege contra crash do viewer 3D / white-screen).
- **Geração atômica**: se o enqueue falhar (Redis off), marca FAILED (sem órfãs QUEUED).
- **Cancelamento de geração**: `POST /generations/:id/cancel` (remove da fila / `/interrupt`
  no ComfyUI) + botão "Cancelar" na UI; guards impedem ressurreição por eventos atrasados.
- **Health profundo**: `/health` checa DB + Redis + ComfyUI (status ok/degraded).
- **Validação de env** no boot da API (falha clara se faltar config).
- **Worker**: identifica o `.glb` novo por diff (robusto vs mtime/corrida).

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

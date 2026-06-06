# Requirements Tracking — MeshForge

Documento **permanente** de rastreabilidade. Nenhuma funcionalidade é considerada
concluída sem estar registrada aqui com status real. **Proibido marcar como
funcional algo que não esteja realmente implementado e validado.**

**Legenda:** ✅ feito & validado · 🚧 em desenvolvimento/parcial · ⬜ pendente · 🧪 código pronto, não validado E2E

> 🔍 **Auditoria completa em [AUDIT.md](AUDIT.md)** — foco atual é o roadmap de
> refinamento (R1 estabilização → R2 polimento → R3 fortalecimento) antes de novas features.

Última atualização: 2026-06-04

---

## 1. Componentes obrigatórios (todos no pipeline principal)

| Componente | Status | Evidência / Observação |
| :-- | :-- | :-- |
| **ComfyUI** | ✅ | Rodando em `C:\ComfyUI-Zluda` :8188 via ZLUDA; gera imagens reais |
| **Stable Diffusion XL** | ✅ | text2img validado (imagem real gerada na RX 7800 XT) |
| **Hunyuan3D 2.0** | ✅ (shape) | **Image→3D integrado no produto E2E**: API `IMAGE_TO_3D` → worker `HUNYUAN3D_SHAPE` → ComfyUI/ZLUDA → `.glb` no storage (asset MESH_RAW) → **viewer 3D na UI**. ~78s com kernels em cache. **Textura PBR funcionando na AMD** (Backend A: rasterizador CPU + pintura GPU/ZLUDA) — opção nos fluxos 3D. |
| **Blender** | 🚧 | 4.2.3 baixado e executa. Automação (retopo/UV/bake) NÃO implementada (Fase 4) |

## 2. Funcionalidades de geração

| Funcionalidade | Status | Observação |
| :-- | :-- | :-- |
| Text-to-Image | ✅ | E2E validado (API→fila→worker→ComfyUI→storage→DB) |
| Image-to-Image | ✅ | Validado E2E (upload → SDXL_IMG2IMG na GPU → variação gerada, via UI e API) |
| Image-to-3D (shape) | ✅ | **Integrado E2E** — UI Imagem→3D (drag&drop) → malha .glb na GPU → viewer 3D. Validado via API e navegador |
| Text-to-3D | ✅ | **Encadeado E2E** — `TEXT_TO_3D` roda SDXL txt2img → Hunyuan3D shape num job só (2 saídas: imagem + malha), UI "Texto → 3D". Validado prompt→malha .glb na GPU |
| Retopologia automática | ⬜ | Fase 4 (Blender + Instant Meshes) |
| Correção automática de malha | ⬜ | Fase 4 |
| Texturização (Hunyuan3D paint) | ✅ **premium** (Backend A) | **Textura PBR premium na AMD/ZLUDA**: delight (albedo limpo) + paint + bake + inpaint de costuras, texturas 1024². Validado E2E (cogumelo foto-realista). Backend B (GPU nativo) pendente |
| Ajuste automático de texturas | ⬜ | Fase 4 |
| Pipeline completo (prompt→modelo final) | ⬜ | Fase 5 (orquestrador) |
| Exportação GLB/GLTF/OBJ/FBX/STL/USDZ | ✅ | **Blender 4.2 headless** converte preservando UV/textura (+ PLY). API `POST /assets/:id/export` + tela Exportar. Validado E2E (FBX/OBJ/STL/USDZ) |

## 3. Plataforma / Backend

| Item | Status | Observação |
| :-- | :-- | :-- |
| API (NestJS) | ✅ | projects, generations, assets (upload/stream), health |
| Fila (BullMQ/Redis) | ✅ | enqueue + QueueEvents→DB |
| Storage (FS local, S3-like) | ✅ | driver local; MinIO opcional disponível |
| Banco (Postgres+Prisma) | ✅ | 8 entidades + 6 enums, migration aplicada |
| Sistema de projetos | ✅ | API (sem UI ainda) |
| Histórico de gerações | ✅ | DB/API (sem UI ainda) |
| Processamento local | ✅ | GPU local via ZLUDA |
| WebSocket de progresso | ✅ | R2 — `socket.io-client` ligado ao `ProgressGateway`; progresso em tempo real (validado: cliente recebeu eventos ao vivo). Polling mantido como fallback (4s) |
| Cancelamento de geração | ✅ | `POST /generations/:id/cancel` + botão UI (validado E2E) |
| Health check profundo | ✅ | `/health` checa DB/Redis/ComfyUI (R1) |
| Tratamento de erros (error boundary, geração atômica, validação env) | ✅ | R1 |
| Toasts globais (sucesso/erro/info) | ✅ | R2 — store leve; geração/upload/cancelamento (**validado pelo usuário**) |
| Estado "serviços fora do ar" | ✅ | R2 — banner via `/health` (db/redis/comfyui) |
| CRUD de projetos + página de detalhe | ✅ | R2 — criar/renomear/excluir (cascade + limpeza de storage, validado E2E) + `/projects/[id]`; galeria extraída em `AssetGallery` (reuso Biblioteca/detalhe) |
| Processamento distribuído | ⬜ | Futuro |

## 4. Tooling / Infra

| Item | Status | Observação |
| :-- | :-- | :-- |
| auxiliary-tools (download automático) | ✅ | tool-manager: clone/pin/verify (ComfyUI, Hunyuan3D, Blender) |
| Model manager | ✅ | download/verify via HuggingFace (SDXL, Hunyuan3D) |
| Version/Update manager | 🚧 | `check`/`verify` ok; `update` sob confirmação NÃO implementado |
| Bootstrap 1 comando (install.ps1/.sh) | 🚧 | Existe; não validado como fluxo único E2E em máquina limpa |
| Docker / Docker Compose | ✅ | Postgres/Redis/MinIO |
| Kubernetes | ⬜ | Futuro |
| Runtime GPU AMD (ZLUDA) | ✅ | Config validada e versionada (HIP_VISIBLE_DEVICES=1, cuDNN off) |
| Supervisor do ComfyUI (auto-restart) | ✅ | R3 — `tools/bootstrap/comfyui-supervisor.ps1`: health-check + religa após N falhas (mata zumbis + launcher + polling até subir). Detecção/restart validados ao vivo (ZLUDA exit 139) |
| Logging estruturado (jobId) | ✅ | R3 — worker (`logging` com `job=/stage=`, `LOG_LEVEL`) + API (`JobEventsService` loga RUNNING/SUCCEEDED/FAILED com job/gen/stage) |
| RUNBOOK operacional | ✅ | R3 — `RUNBOOK.md` (ordem de boot, supervisor, health, parada, troubleshooting ZLUDA/SSL/portas) |
| Testes automatizados | ✅ | R3 — Vitest (16: storage + contratos zod) + pytest (8: workflow builders SDXL/Hunyuan3D). `pnpm test` / `pytest` |
| ESLint + Prettier | ✅ | R3 — flat config typescript-eslint + Prettier (base formatada); `pnpm lint`/`format` limpos |
| CI (GitHub Actions) | ✅ | R3 — `.github/workflows/ci.yml`: format/lint/typecheck/test (Node) + pytest (Python) em push/PR |
| Otimização de armazenamento (modelos) | ✅ | R3 — removidos 3 `.ckpt` redundantes do Hunyuan3D dit (~14 GB); mantidas 2 variantes `.safetensors` (fp16/fp32) com switch `HUNYUAN3D_DIT_MODEL`. Validado com geração 3D real pós-limpeza |

## 5. Interface (UI premium) — **GRANDE LACUNA ATUAL**

| Item | Status | Observação |
| :-- | :-- | :-- |
| Definição do produto (Web/Desktop/Híbrido) | ✅ | **Decidido: Híbrido — Next.js web-first + shell Tauri depois** (aprovado 2026-06-04) |
| Design System (identidade premium) | ✅ | `DESIGN_SYSTEM.md` (pesquisa de mercado + identidade "forge heat") |
| Front-end premium — **Milestone 1** | ✅ | `apps/web` (Next.js): shell premium + tokens "forge heat", validado E2E no navegador (gerou imagem 1024px real) |
| Dark mode / Light mode | ✅ | next-themes, tokens dark-first + light; toggle funcional |
| Área de geração (text2img) | ✅ | Tela "Gerar" 2 painéis → cria geração real → progresso → imagem + download |
| Galeria / biblioteca (imagens **e malhas 3D**) | ✅ | `/library` mostra imagens + **malhas 3D** (thumbnail 3D leve via IntersectionObserver) + **lightbox** (abre o viewer 3D completo / imagem). `/projects` lista projetos. *(validação visual pelo usuário recomendada)* |
| Áreas Workflow / Exportar (na UI) | 🚧 | Telas presentes mas **honestamente marcadas "em desenvolvimento"** (Fase 5/6) — NÃO fingem funcionar |
| Visualização 3D em tempo real | ✅ | Viewer `MeshViewer` (r3f) com **toolbar pro** (wireframe, materiais studio/normais/argila, grade, reset, tela cheia) + stats verts/faces + grade. **Validado visualmente pelo usuário** (bule → malha renderizada, 20k verts/40k faces). |
| A11y do command palette (cmdk) | ✅ | Trocado Command.Dialog por overlay próprio + `Command` (sem Radix Dialog) → sem warning; Escape fecha |
| Drag & drop (upload img2img) | ✅ | Dropzone na tela Gerar; upload real → modo Imagem→Imagem |
| Command palette (⌘K) | ✅ | cmdk: navegação + alternar tema (validado no navegador) |

## 6. Governança (novas diretrizes)

| Item | Status |
| :-- | :-- |
| REQUIREMENTS_TRACKING.md | ✅ (este documento) |
| ROADMAP.md | ✅ |
| CHANGELOG.md | ✅ |
| CONFORMANCE_CHECKLIST.md | ✅ |
| FUTURE_AUTOMATION_ROADMAP.md | ✅ |
| Política "sem placeholders" | ✅ adotada |
| Atualização automática da documentação a cada mudança | 🚧 processo manual disciplinado (hook automático = futuro) |

---

## Riscos conhecidos

- **ZLUDA é frágil**: cada novo tipo de carga na GPU (Hunyuan3D, Blender Cycles) pode revelar novos crashes (rocBLAS/cuDNN/MIOpen). Mitigação: config validada documentada; testar incrementalmente.
- **Hunyuan3D textura/custom_rasterizer**: kernels CUDA custom podem não rodar via ZLUDA (plano B: textura via ComfyUI).
- **Driver AMD**: HIP SDK substituiu o Adrenalin; reinstalar o Adrenalin pode quebrar o ROCm (re-verificar).
- **Bootstrap 1-comando** ainda não testado em máquina limpa (muitos passos manuais foram necessários nesta máquina).
- **VRAM 16 GB**: SDXL + Hunyuan3D não cabem juntos; exige offload sequencial (lock de GPU — Fase 5).

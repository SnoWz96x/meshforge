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
| **Hunyuan3D 2.0** | ✅ (shape) | **Image→3D integrado no produto E2E**: API `IMAGE_TO_3D` → worker `HUNYUAN3D_SHAPE` → ComfyUI/ZLUDA → `.glb` no storage (asset MESH_RAW) → **viewer 3D na UI**. ~78s com kernels em cache. **Textura** ainda não (plano B; ver pesquisa: AMD/ROCm emergindo mas imaturo). |
| **Blender** | 🚧 | 4.2.3 baixado e executa. Automação (retopo/UV/bake) NÃO implementada (Fase 4) |

## 2. Funcionalidades de geração

| Funcionalidade | Status | Observação |
| :-- | :-- | :-- |
| Text-to-Image | ✅ | E2E validado (API→fila→worker→ComfyUI→storage→DB) |
| Image-to-Image | ✅ | Validado E2E (upload → SDXL_IMG2IMG na GPU → variação gerada, via UI e API) |
| Image-to-3D (shape) | ✅ | **Integrado E2E** — UI Imagem→3D (drag&drop) → malha .glb na GPU → viewer 3D. Validado via API e navegador |
| Text-to-3D | ⬜ | Fase 3 (text→image→3D — encadear SDXL + Hunyuan3D) |
| Retopologia automática | ⬜ | Fase 4 (Blender + Instant Meshes) |
| Correção automática de malha | ⬜ | Fase 4 |
| Ajuste automático de texturas | ⬜ | Fase 4 |
| Pipeline completo (prompt→modelo final) | ⬜ | Fase 5 (orquestrador) |
| Exportação GLB/GLTF/OBJ/FBX/STL/USDZ | ⬜ | Fase 6 |

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
| WebSocket de progresso | 🧪 | Gateway implementado; não exercitado por um cliente real ainda (R2) |
| Cancelamento de geração | ✅ | `POST /generations/:id/cancel` + botão UI (validado E2E) |
| Health check profundo | ✅ | `/health` checa DB/Redis/ComfyUI (R1) |
| Tratamento de erros (error boundary, geração atômica, validação env) | ✅ | R1 |
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

# Requirements Tracking — MeshForge

Documento **permanente** de rastreabilidade. Nenhuma funcionalidade é considerada
concluída sem estar registrada aqui com status real. **Proibido marcar como
funcional algo que não esteja realmente implementado e validado.**

**Legenda:** ✅ feito & validado · 🚧 em desenvolvimento/parcial · ⬜ pendente · 🧪 código pronto, não validado E2E

Última atualização: 2026-06-04

---

## 1. Componentes obrigatórios (todos no pipeline principal)

| Componente | Status | Evidência / Observação |
| :-- | :-- | :-- |
| **ComfyUI** | ✅ | Rodando em `C:\ComfyUI-Zluda` :8188 via ZLUDA; gera imagens reais |
| **Stable Diffusion XL** | ✅ | text2img validado (imagem real gerada na RX 7800 XT) |
| **Hunyuan3D 2.0** | 🚧 | **Shape (malha) VALIDADO na AMD/ZLUDA** — imagem→.glb watertight (20k verts, ~8min 1ª vez por compilação MIOpen). Falta: integrar no worker (stage HUNYUAN3D_SHAPE) + UI Image→3D + viewer 3D + **textura** (plano B, custom_rasterizer é CUDA-only). |
| **Blender** | 🚧 | 4.2.3 baixado e executa. Automação (retopo/UV/bake) NÃO implementada (Fase 4) |

## 2. Funcionalidades de geração

| Funcionalidade | Status | Observação |
| :-- | :-- | :-- |
| Text-to-Image | ✅ | E2E validado (API→fila→worker→ComfyUI→storage→DB) |
| Image-to-Image | ✅ | Validado E2E (upload → SDXL_IMG2IMG na GPU → variação gerada, via UI e API) |
| Image-to-3D (shape) | 🧪 | **Malha .glb validada via ComfyUI direto** (caneca → mesh watertight na RX 7800 XT). Falta plugar no worker/UI |
| Text-to-3D | ⬜ | Fase 3 (text→image→3D) |
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
| WebSocket de progresso | 🧪 | Gateway implementado; não exercitado por um cliente real ainda |
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
| Galeria / biblioteca (imagens) | ✅ | `/library` lista assets reais do banco; `/projects` lista projetos reais |
| Áreas Workflow / Exportar (na UI) | 🚧 | Telas presentes mas **honestamente marcadas "em desenvolvimento"** (Fase 5/6) — NÃO fingem funcionar |
| Visualização 3D em tempo real | ⬜ | Depende da Fase 3 (gerar 3D) |
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

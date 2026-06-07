# Auditoria do Projeto — MeshForge

Auditoria técnica completa, **fundamentada no código real** (não genérica).
Data: 2026-06-04. Foco: **estabilizar, polir e fortalecer a base** antes de novas features.

> Princípio: nada aqui é inventado — cada item foi verificado no código/repositório.
> O que está bom também é registrado, para não regredir.

> [!NOTE]
> **Snapshot histórico (2026-06-04).** Muitas lacunas abaixo já foram **resolvidas** desde
> então — refinamento R1→R3 (error boundary, geração atômica, WebSocket, testes/lint/CI,
> supervisor do ComfyUI, logs estruturados) **e** features: textura PBR na AMD, Text→3D,
> **Multi-imagem→3D**, **pipeline 1-clique (`FULL_PIPELINE`)**, **export multi-formato**,
> **remesh** + **ajuste auto de textura (`texfix`)**, **`update` manager** e **galeria
> open-source**. Para o **estado atual e validado**, ver
> [REQUIREMENTS_TRACKING.md](REQUIREMENTS_TRACKING.md) e [CHANGELOG.md](CHANGELOG.md).
> Os itens marcados como pendentes aqui devem ser lidos como "naquela data".

---

## 0. Resumo executivo

O sistema **funciona de verdade** (Text→Image, Image→Image, Image→3D na AMD/ZLUDA,
UI premium, viewer 3D). A base é sólida, **sem placeholders falsos**. Porém, para
virar "robusto, maduro e pronto para crescer", há lacunas reais de **robustez,
observabilidade, qualidade de engenharia e completude de fluxos**.

**Top riscos a atacar primeiro:** (1) sem error boundary no front (viewer pode
derrubar a página), (2) criação de geração não-atômica (gerações órfãs), (3) zero
testes/lint/CI, (4) fluxo de progresso por WebSocket inacabado, (5) Biblioteca não
mostra malhas 3D, (6) ComfyUI sem supervisão (cai → jobs falham até restart manual).

---

## 1. Problemas encontrados (priorizados)

Prioridade: 🔴 Crítica · 🟠 Alta · 🟡 Média · ⚪ Baixa
(Crítica = quebra/risco sério; Alta = afeta robustez/UX central; Média = importante p/ maturidade; Baixa = cosmético/futuro.)

### Robustez / Bugs
| ID | Problema | Prio | Impacto | Correção recomendada |
| :-- | :-- | :-- | :-- | :-- |
| R1 | **Sem React Error Boundary** no front. Um `.glb` inválido pode fazer o r3f/GLTFLoader lançar e **derrubar a página** (white screen). | 🟠 | UX central | `<ErrorBoundary>` ao redor do `MeshViewer` e do app; fallback amigável + "tentar de novo". |
| R2 | **Criação de Generation+Job e `enqueue` não são atômicos** (generations.service: `create` → `enqueue`). Se o Redis/enqueue falhar, fica geração **QUEUED órfã** (nunca processa). | 🟠 | Dados inconsistentes | `try/catch` no enqueue → marcar `FAILED` se falhar; ou outbox/transação. |
| R3 | **Worker `_newest_glb()`** pega o `.glb` mais novo por mtime do output do ComfyUI. Frágil (arquivos antigos, corrida, múltiplos exports). | 🟡 | Asset errado em edge cases | Obter o caminho exato do node `Hy3DExportMesh` via `/history`. |
| R4 | **Sem cancelamento de geração** pelo usuário (job 3D de minutos não pode ser abortado). | 🟡 | UX/recursos | Endpoint `cancel` → BullMQ remove + ComfyUI `/interrupt`. |
| R5 | **BullMQ: `attempts:3` em jobs 3D longos** → uma falha transitória re-executa um job de ~minutos até 3×. `removeOnFail:false` acumula jobs falhos no Redis para sempre. | 🟡 | Recursos/Redis | `attempts:1` (ou 2) para stages caras; TTL em failed. |
| R6 | **ComfyUI roda fora do orquestramento** (mf-run.bat manual). Se cair, jobs falham até restart **manual**. Sem supervisão/health/restart. | 🟠 | Operação | Supervisor (auto-restart) + health do ComfyUI; futuramente o shell Tauri orquestra. |

### Integrações incompletas / drift de arquitetura
| ID | Problema | Prio | Impacto | Correção |
| :-- | :-- | :-- | :-- | :-- |
| A1 | **WebSocket de progresso inacabado**: gateway (`ProgressGateway`) + pub/sub Redis existem no servidor, mas **nenhum cliente consome** (front usa polling). | 🟡 | Fluxo parcial + latência | Conectar o front via `socket.io-client` ao gateway (UX em tempo real) **ou** remover o gateway. Recomendo conectar. |
| A2 | **Filas `BLENDER`/`EXPORT`/`PIPELINE`/`HUNYUAN3D` definidas e não usadas** (só `COMFYUI`). | ⚪ | Drift | Manter só o que se usa; reintroduzir nas Fases 4–6. |
| A3 | **Worker lê imagem de entrada do FS local diretamente** (`_storage_path`) — acoplado ao storage local; quebra se virar S3/MinIO. | 🟡 | Escalabilidade | Abstração de storage também no worker (driver). |
| A4 | **Sem `pipeline-orchestrator` nem GPU lock** (Fase 5). Quando houver pipeline completo (SDXL→Hunyuan3D→Blender), faltará orquestração + lock de VRAM (16 GB não cabe tudo junto). | 🟡 | Risco futuro | Construir na Fase 5 (já previsto). |

### Performance / Escala
| ID | Problema | Prio | Impacto | Correção |
| :-- | :-- | :-- | :-- | :-- |
| P1 | **Biblioteca = N+1**: `listProjects` → `getProject` por projeto, e agrega no cliente. Não escala. | 🟠 | Lentidão ao crescer | Endpoint `/assets` paginado (server-side) + índices. |
| P2 | **Sem thumbnails** (imagens servidas full-res nos grids; malhas sem preview). | 🟠 | Perf + UX | Gerar thumbnails (sharp) e **preview turntable** das malhas. |
| P3 | **Polling 1.5s por geração** (sem WS) → muitas requisições com várias gerações. | 🟡 | Carga | Resolver via A1 (WebSocket). |
| P4 | **Assets sem cache headers**; `next images unoptimized`. | 🟡 | Banda/latência | Cache-Control nos assets; thumbnails. |
| P5 | **Hunyuan3D 34 GB com formatos redundantes** (~22 GB desperdiçados). | ⚪ | Disco | Manter só `model.fp16.safetensors`; estreitar `allowPatterns`. |
| P6 | **Storage cresce sem limite** (sem GC/limpeza de assets antigos). | ⚪ | Disco | Política de retenção/limpeza opcional. |

### Qualidade de engenharia (sustentabilidade)
| ID | Problema | Prio | Impacto | Correção |
| :-- | :-- | :-- | :-- | :-- |
| Q1 | **Zero testes** (nenhum `.test/.spec`). | 🟠 | Regressões | Testes mínimos: unit (workflow builders, storage, zod) + 1 e2e por fluxo. |
| Q2 | **Sem ESLint/Prettier configurados** (web tem script, sem config; api/packages/tools nada). | 🟠 | Consistência | ESLint + Prettier na raiz; `lint-staged` opcional. |
| Q3 | **Sem CI** (nada roda typecheck/lint/build automático). | 🟠 | Qualidade | GitHub Actions: typecheck + lint + build em cada push. |
| Q4 | **Dependências mortas**: `framer-motion` e `socket.io-client` no `apps/web` **não são usados**. | 🟡 | Peso/ruído | Remover (ou usar: framer-motion p/ motion, socket.io p/ A1). |
| Q5 | **Logging cru** (`console.log`/`print`), sem logger estruturado, sem correlação por `jobId`. | 🟡 | Diagnóstico | `pino` (API/TS) + `logging` (Python) com nível e jobId. |
| Q6 | **Health check raso** (`/health` não checa DB/Redis/ComfyUI/storage). | 🟡 | Observabilidade | `/health` profundo + `/ready`. |
| Q7 | **`.env` sem validação** no boot (se faltar `DATABASE_URL`, quebra fundo). | 🟡 | DX/robustez | Schema zod de env no boot da API/worker. |
| Q8 | **Sem monitoramento/métricas** (fila, tempos de geração, falhas). | 🟡 | Crescimento | BullMQ board (dev) + métricas básicas. |
| Q9 | **Pequena duplicação** worker 2D vs 3D (submit/wait/save). | ⚪ | Manutenção | Runner genérico parametrizado. |

### Segurança / Operação (contextual — hoje uso pessoal local)
| ID | Problema | Prio (local→exposto) | Correção |
| :-- | :-- | :-- | :-- |
| S1 | **Sem auth; CORS `*`; Postgres/MinIO com credenciais default.** | ⚪ → 🔴 | Auth (PIN single-user), restringir CORS/segredos antes de expor. |
| S2 | **Sem rate limiting** (flood de gerações ocupa a GPU). | ⚪ → 🟡 | Limite de fila por usuário. |
| S3 | **Sem backup** de storage/modelos/DB. | ⚪ | Estratégia de backup opcional. |

### Documentação
| ID | Problema | Prio | Correção |
| :-- | :-- | :-- | :-- |
| D1 | **README cita `packages/ui` inexistente** e serviços futuros (pipeline-orchestrator, blender-worker) como se existissem. | ⚪ | Alinhar ao real (hoje só `comfyui-service`). |
| D2 | **`tools/conformance/check.mjs`** referenciado no checklist mas não implementado. | 🟡 | Implementar o checker automático de conformidade. |
| D3 | **Falta doc consolidado "subir do zero"** (ordem real: Docker → migrate → API → worker → ComfyUI/ZLUDA via mf-run). O `install.ps1` não cobre ComfyUI/ZLUDA. | 🟡 | `docs/RUNBOOK.md`. |

---

## 2. Revisão detalhada do Viewer 3D (→ nível profissional)

**Estado atual** (`apps/web/components/mesh-viewer.tsx`): `Canvas` r3f + `OrbitControls`
(orbit, auto-rotate, zoom por scroll) + `Center` (foco automático básico) + material
"studio" único + luzes manuais. Funcional, mas minimalista.

**Proposta — toolbar flutuante + painel de stats:**

| Recurso pedido | Como implementar |
| :-- | :-- |
| **Wireframe** | toggle `material.wireframe` (ou modo sólido+wire sobreposto) |
| **Tela cheia** | Fullscreen API no container do canvas |
| **Zoom inteligente / fit** | drei `<Bounds>` + `useBounds().refresh().fit()` |
| **Reset de câmera** | botão → `controls.reset()` + re-fit |
| **Foco automático** | `<Bounds fit clip observe>` (melhora o `Center` atual) |
| **Estatísticas da malha** | parse do glb (vértices, faces, triângulos, bounds, watertight, tamanho) |
| **Polígonos/vértices** | exibir no painel de stats (já temos os números no backend trimesh) |
| **Alternância de materiais** | studio / normal / matcap / clay / wireframe (trocar material no traverse) |
| **Visualização de texturas** | quando houver textura (plano B), modo "texturizado" usando o material do glb |
| **Múltiplos modos de render** | sólido · wireframe · sólido+wire · normais · pontos |
| Extras pro | grid + eixos (drei `<Grid>`/`<GizmoHelper>`), fundo claro/escuro, screenshot do viewer, contagem de draw calls |

**Arquitetura sugerida:** evoluir `<MeshViewer>` + novo `<ViewerToolbar>` + `<MeshStatsPanel>`,
estado do viewer em um store leve (zustand). Stats da malha: expor no asset `meta`
(o worker já tem acesso ao trimesh — gravar verts/faces no `meta` do asset no momento da geração).

---

## 3. Biblioteca de Assets & Projetos

| Problema | Prio | Correção |
| :-- | :-- | :-- |
| **Biblioteca não mostra malhas 3D** (filtra só IMAGE/PREVIEW). As malhas geradas somem da galeria. | 🟠 | Mostrar `MESH_RAW` com **thumbnail/preview** + badge "3D"; clique abre o viewer. |
| **Sem preview de malha** (sem turntable/thumbnail). | 🟠 | Gerar PNG turntable no backend (já renderizamos via trimesh/pyglet) e salvar como asset `PREVIEW`. |
| **Sem página de detalhe de projeto** (`/projects/[id]`) nem CRUD (criar/renomear/excluir). | 🟡 | Página de detalhe + ações de projeto. |
| **Grid carrega full-res** (sem thumbnails). | 🟡 | Ver P2/P4. |

---

## 4. Requisitos esquecidos / parciais / fluxos incompletos

- **WebSocket de progresso** (previsto na arquitetura) — inacabado (A1).
- **Update Manager** (`tool-manager update <tool>` sob confirmação) — não implementado (só `check`/`verify`).
- **Export multi-formato** (GLB/GLTF/OBJ/FBX/STL/USDZ) — Fase 6, não iniciado. (Hoje só GLB sai como subproduto.)
- **Bootstrap 1-comando** não cobre ComfyUI/ZLUDA (passo manual).
- **Command palette** parcial (só navegação + tema; sem busca de assets/projetos nem "nova geração").
- **Sem toasts/notificações globais** de sucesso/erro.
- **Sem tela/indicador de saúde dos serviços** (ComfyUI/worker/Docker off → geração trava em QUEUED sem aviso).
- **Conformance checker automático** — documentado, não implementado (D2).

---

## 5. Tratamento de erros · Logs · Monitoramento · Docs (resumo)

- **Erros:** API tem `NotFound/BadRequest` por rota e `ZodValidationPipe`, mas **sem exception filter global**, sem error boundary no front (R1), e mensagens cruas em vários pontos (D3 UX).
- **Logs:** crus, não estruturados (Q5). Sem correlação por `jobId`/`generationId`.
- **Monitoramento:** inexistente (Q8). Sem métricas de fila/tempo/falha.
- **Docs:** boa governança (este repo tem ROADMAP/CHANGELOG/REQUIREMENTS/DESIGN_SYSTEM), mas com drift (D1) e faltando RUNBOOK (D3) e o checker (D2).

---

## 6. Roadmap de refinamento (estabilizar → polir → fortalecer)

### Fase R1 — Estabilização (robustez central) 🔴🟠
1. Error Boundary no front + fallback do viewer (R1).
2. Geração atômica: enqueue com rollback/FAILED (R2).
3. Worker: pegar `.glb` pelo path do history (R3) + abstração de storage (A3).
4. Supervisão do ComfyUI (auto-restart + health) + `/health` profundo (R6, Q6).
5. Validação de env (Q7). Cancelamento de geração (R4).

### Fase R2 — Polimento (UX/UI + viewer + biblioteca) 🟠🟡
6. **Viewer 3D profissional** (seção 2): toolbar, wireframe, fullscreen, fit/reset, stats, modos de render, materiais.
7. **Biblioteca mostra malhas** + thumbnails/turntable + badge 3D (seção 3).
8. WebSocket de progresso ligado ponta a ponta (A1) → remove polling/deps mortas (Q4).
9. Toasts globais, estados de "serviços fora do ar", mensagens de erro amigáveis.
10. Página de detalhe + CRUD de projetos.

### Fase R3 — Fortalecimento (sustentabilidade) 🟠🟡
11. ESLint + Prettier + CI (typecheck/lint/build) (Q1–Q3).
12. Testes mínimos (workflow builders, storage, zod, 1 e2e por fluxo).
13. Logger estruturado + correlação por jobId (Q5). Métricas básicas (Q8).
14. RUNBOOK + alinhar docs (D1, D3) + conformance checker (D2).
15. Otimizar disco Hunyuan3D (P5); thumbnails/cache (P2, P4); endpoint `/assets` paginado (P1).

### Pós-refino (só depois da base sólida)
- Textura (plano B), Text→3D, Export multi-formato (Fase 6), seed de galerias 3D (Poly Haven/Objaverse), auth (se for expor).

---

## 7. O que já está bom (não regredir)
- Geração 2D e 3D **reais** na AMD/ZLUDA (sem mocks).
- Separação control plane (TS) / compute plane (Python).
- `Job` como entidade de 1ª classe (histórico/retomada).
- UI premium consistente com o `DESIGN_SYSTEM`.
- Governança honesta (pendências marcadas, nada fingido).
- Config ZLUDA validada e versionada.

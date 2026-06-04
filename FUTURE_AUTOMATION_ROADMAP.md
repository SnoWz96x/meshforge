# Future Automation Roadmap — MeshForge

Funcionalidades **futuras** de automação. **NÃO** implementar agora (decisão do
produto). Registradas para guiar a arquitetura desde já, sem desviar o foco atual.

> Foco atual: arquitetura correta + UI premium + integração dos componentes
> obrigatórios + zero placeholders + documentação/rastreabilidade. As automações
> abaixo são pós-base sólida.

## 1. Adaptação automática de hardware
Detectar e ajustar dinamicamente:

| Detectar | Ajustar |
| :-- | :-- |
| CPU (núcleos/arch) | Nº de workers |
| GPU (modelo/arch: gfx/CUDA) | Backend (zluda/rocm/cuda/directml) |
| VRAM disponível | Modelos (full/mini), offload, resolução máx. |
| RAM | Tamanho de cache, batch |
| Disco livre | Quais modelos baixar, política de cache |

**Gancho atual já preparado:** enum `GpuBackend` por worker, `--reserve-vram`,
lock de GPU (Fase 5). Faltará um `hardware-profiler` + perfis de configuração.

## 2. Instalação universal (qualquer máquina)
Processo automatizado que:
- Detecta hardware (item 1).
- Baixa as dependências adequadas (ex.: torch CUDA vs ROCm vs DirectML).
- Configura ambiente, modelos e aceleração por GPU automaticamente.
- Valida com smoke-tests (ex.: gerar 1 imagem) antes de declarar pronto.

**Gancho atual:** `install.ps1/.sh`, `tool-manager`, `model-manager`. Falta o
detector de hardware e a seleção condicional de wheels/drivers.

## 3. Gerenciamento inteligente de modelos
- Download automático sob demanda (lazy) por tipo de geração.
- Atualizações automáticas com verificação de compatibilidade.
- Versionamento e rollback.
- Cache inteligente (LRU por espaço/uso) compartilhado entre componentes.

**Gancho atual:** `model-manager` (download/verify/registry), `HF_HOME` em
`auxiliary-tools/cache`. Falta resolução de compatibilidade + política de cache.

## 4. Seed da biblioteca com galerias 3D open source (pós-Fase 3)
Para a biblioteca não "nascer crua", importar coleções 3D open source via o
`model-manager`/storage existente (download → storage → registros `Asset` kind MESH/EXPORT).

| Fonte | Escala | Formatos | Licença | Uso |
| :-- | :-- | :-- | :-- | :-- |
| **Poly Haven** | curada (centenas) | glTF/GLB/FBX/USD, PBR 8K | **CC0** (comercial OK, sem atribuição) | Seed premium seguro |
| **Objaverse 1.0** | 800k objetos | GLB | ODC-By (coleção); por objeto varia | Escala (HuggingFace — pluga fácil) |
| **Objaverse-XL** | 10M+ | GLB | mista (filtrar) | Escala máxima |
| **Google Scanned Objects** | ~1k | GLB | CC-BY | Objetos limpos escaneados |
| **ABO (Amazon Berkeley)** | ~8k | glTF + PBR | CC-BY-NC | Não-comercial |

**Plano:** começar com **Poly Haven (CC0)** como seed seguro + opção de puxar
**Objaverse** (HuggingFace) sob filtro de licença. Reusa o pipeline do model-manager.
Requer: importador, normalização para GLB, geração de thumbnails, metadados de licença
por asset (e filtro comercial/não-comercial na UI).

## 5. Outros candidatos futuros
- Processamento distribuído (múltiplas máquinas/GPUs na fila).
- Auto-tuning de parâmetros (MIOpen/Triton) por GPU.
- Telemetria opcional de performance por hardware.
- Kubernetes / Helm para deploy multi-nó.

---

Cada item, quando entrar em escopo, deve: (1) ser movido para `ROADMAP.md` com
fase, (2) registrado em `REQUIREMENTS_TRACKING.md`, (3) passar pelo
`CONFORMANCE_CHECKLIST.md`.

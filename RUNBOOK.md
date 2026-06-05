# RUNBOOK — MeshForge (operação)

Guia prático para **subir, monitorar, parar e recuperar** o MeshForge nesta
máquina (Windows + AMD RX 7800 XT via ZLUDA). Foco em comandos reais e
recuperação de incidentes — não em arquitetura (ver `ARCHITECTURE.md`).

---

## 1. Componentes e portas

| Componente | Onde | Porta | Como sobe |
| :-- | :-- | :-- | :-- |
| Postgres | container Docker | **5433** (host) → 5432 | `pnpm infra:up` |
| Redis | container Docker | **6379** | `pnpm infra:up` |
| MinIO (opcional) | container Docker | 9000/9001 | `pnpm infra:up` |
| **ComfyUI (GPU/ZLUDA)** | nativo `C:\ComfyUI-Zluda` | **8188** | `mf-run.bat` (ou supervisor) |
| Worker (Python) | `services/comfyui-service` | — | `worker.py` |
| API (NestJS) | `apps/api` | **3001** | `pnpm --filter ... dev` |
| Web (Next.js) | `apps/web` | **3000** | `pnpm --filter ... dev` |

> Fluxo: **Web → API → fila (Redis/BullMQ) → Worker → ComfyUI (GPU) → storage →
> API (QueueEvents) → DB**; progresso em tempo real por Redis pub/sub → WebSocket.

---

## 2. Subir tudo (ordem do zero)

Faça **na ordem** — cada passo depende do anterior.

```powershell
# 0) na raiz do repo
cd "C:\Users\allan\OneDrive\Área de Trabalho\Nova pasta (5)"

# 1) Infra (Postgres/Redis/MinIO)
pnpm infra:up
# (primeira vez / após mudança de schema)
pnpm db:generate ; pnpm db:migrate

# 2) ComfyUI na GPU — PREFIRA o supervisor (auto-restart):
#    deixe esta janela aberta; ele sobe e mantém o ComfyUI vivo.
powershell -ExecutionPolicy Bypass -File tools\bootstrap\comfyui-supervisor.ps1
#    (alternativa manual, sem auto-restart: C:\ComfyUI-Zluda\mf-run.bat)

# 3) API (NestJS) — nova janela
pnpm --filter @meshforge/api dev          # :3001

# 4) Worker (Python) — nova janela
cd services\comfyui-service
$env:REDIS_URL="redis://localhost:6379"
$env:COMFYUI_URL="http://localhost:8188"
$env:STORAGE_LOCAL_PATH="C:\Users\allan\OneDrive\Área de Trabalho\Nova pasta (5)\storage"
$env:COMFYUI_OUTPUT_DIR="C:\ComfyUI-Zluda\output"
.venv\Scripts\python worker.py

# 5) Web (Next.js) — nova janela
pnpm --filter @meshforge/web dev          # :3000  → abrir http://localhost:3000
```

**Pronto quando:** `http://localhost:3000` abre, e o banner de saúde **não**
aparece (ou some). Confirme via health (seção 4).

---

## 3. Supervisor do ComfyUI (auto-restart)

O ZLUDA é frágil: sob carga repetida o ComfyUI pode cair com **segfault
(exit 139)**. O supervisor observa `:8188` e religa sozinho.

```powershell
# padrão (checa a cada 10s, religa após 3 falhas, 90s de graça no boot)
powershell -ExecutionPolicy Bypass -File tools\bootstrap\comfyui-supervisor.ps1

# mais agressivo + log em arquivo
.\tools\bootstrap\comfyui-supervisor.ps1 -IntervalSec 5 -FailThreshold 2 -LogFile C:\temp\comfy.log
```

- Rode em uma **janela de terminal normal** (não dentro de um job-object/parent
  gerenciado) — o `Start-Process` deixa o ComfyUI rodando independente do script.
- Ele mata zumbis (`zluda.exe` / `python main.py`) antes de religar.
- Pare com `Ctrl+C` (não derruba o ComfyUI já no ar).

---

## 4. Health checks (estou no ar?)

```powershell
# ComfyUI (GPU)
curl http://localhost:8188/system_stats          # HTTP 200 = ok

# API + dependências (db/redis/comfyui)  -> status: "ok" ou "degraded"
curl http://localhost:3001/health

# Fila Redis
docker exec meshforge-redis redis-cli ping        # PONG
```

Na UI, o **banner de saúde** (topo) acende quando API/Redis/ComfyUI caem
(consulta `/health` a cada 15s).

---

## 5. Parar tudo

```powershell
# Web / API / Worker: Ctrl+C nas janelas
# Supervisor: Ctrl+C (o ComfyUI segue no ar)

# Derrubar ComfyUI manualmente (zumbis):
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq 'zluda.exe' -or ($_.Name -eq 'python.exe' -and $_.CommandLine -like '*main.py*') } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# Infra:
pnpm infra:down
```

---

## 6. Troubleshooting (incidentes conhecidos)

### ComfyUI caiu / gerações falhando (exit 139, segfault)
1. Se o **supervisor** estiver rodando, ele religa sozinho (~5–60s). Aguarde.
2. Manual: mate os zumbis (seção 5) e rode `C:\ComfyUI-Zluda\mf-run.bat`.
3. Confirme `curl http://localhost:8188/system_stats` → 200.

### "No CUDA GPUs are available" / rocBLAS aborta em `gfx1036`
- `HIP_VISIBLE_DEVICES` precisa ser **`1`** (RX 7800 XT), escondendo a iGPU do
  Ryzen. Use `set "HIP_VISIBLE_DEVICES=1"` (sem espaço no fim). Já está no
  `mf-run.bat`.

### `WinError 126` ao carregar `cublas64_11.dll`
- Falta o ROCm no PATH: `set "PATH=C:\Program Files\AMD\ROCm\6.4\bin;%PATH%"`
  (já no `mf-run.bat`).

### `CUDNN_STATUS_EXECUTION_FAILED` em conv2d
- `set "TORCH_BACKENDS_CUDNN_ENABLED=0"` (usa MIOpen). Não troque o
  `cudnn64_9.dll` da NVIDIA pelo do ZLUDA. (já no `mf-run.bat`.)

### `pip` / HuggingFace quebram com erro de SSL/certificado
- A inspeção TLS da máquina quebra a cadeia. Instale `pip-system-certs` no venv:
  `python -m pip install pip-system-certs`.

### Porta 5432 ocupada (Postgres nativo) / API não conecta no banco
- O container expõe **5433** no host. Confirme a `DATABASE_URL` apontando para
  `localhost:5433`.

### Antivírus bloqueando ZLUDA/processos
- Adicione exceção para `C:\ComfyUI-Zluda` (o `zluda.exe` costuma ser sinalizado).

### `numpy` 2.x quebrando o wrapper Hunyuan3D
- Fixe `numpy==1.26.4` no venv do ComfyUI.

### Geração 3D não acha o `.glb`
- O worker procura o `.glb` mais novo em `COMFYUI_OUTPUT_DIR\3D`. Garanta que
  `COMFYUI_OUTPUT_DIR` aponte para `C:\ComfyUI-Zluda\output`.

---

## 7. Logs e rastreabilidade

- **Worker**: logging estruturado com `job=<id> stage=<stage>` em cada transição
  (início / OK / FALHOU). `LOG_LEVEL=DEBUG` para mais detalhe.
- **API**: `JobEventsService` loga `[job=… gen=… stage=…] RUNNING/SUCCEEDED/FAILED`.
- **ComfyUI**: stdout da própria janela (ou `-LogFile` do supervisor).

> Para seguir um job ponta-a-ponta, busque o mesmo `job=<id>` nos logs do worker
> e da API.

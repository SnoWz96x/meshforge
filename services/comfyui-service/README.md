# comfyui-service

Worker Python que executa **SDXL (text2img / img2img)** no ComfyUI. Consome a
fila BullMQ `comfyui`, roda o workflow, salva a imagem no storage e devolve um
`JobResult` (que a API persiste no banco). Workers **nunca** escrevem no Postgres.

```
fila BullMQ "comfyui"  ──▶  worker.py  ──▶  ComfyUI (HTTP :8188)
                                  │
                          storage (PNG)  +  progresso (Redis pub/sub)
                                  │
                            JobResult ──▶ API (QueueEvents) ──▶ DB
```

## Arquivos

| Arquivo | Papel |
| :-- | :-- |
| `worker.py` | loop do worker (BullMQ), dispatch por stage, save, progresso |
| `comfyui_client.py` | cliente HTTP/WS do ComfyUI (submit, wait, upload, view) |
| `workflows.py` | grafos SDXL txt2img / img2img (formato API do ComfyUI) |

## Rodar o worker

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
$env:REDIS_URL="redis://localhost:6379"
$env:COMFYUI_URL="http://localhost:8188"
$env:STORAGE_LOCAL_PATH="<repo>\storage"
.venv\Scripts\python worker.py
```

O worker já foi validado de ponta a ponta (consumo da fila, falha controlada,
atualização de status no banco via API). Para **gerar imagens de verdade**, é
preciso o ComfyUI rodando na GPU — ver abaixo.

## Pré-requisito: ComfyUI na AMD RX 7800 XT via ZLUDA

> A RX 7800 XT não usa CUDA. Rodamos o ComfyUI via **ZLUDA**, que precisa do
> **AMD HIP SDK**. Passos (alvo Windows):

1. **Instalar o AMD HIP SDK 6.x para Windows** (developer.amd.com → ROCm/HIP SDK).
   Define `HIP_PATH` e instala as libs ROCm/HIP (~3–4 GB).
2. **ZLUDA + ComfyUI**: a forma mais confiável é o fork
   [`patientx/ComfyUI-Zluda`](https://github.com/patientx/ComfyUI-Zluda), cujo
   `install.bat` baixa o ZLUDA e aplica o patch no PyTorch. (Trocaremos o entry
   `comfyui` do tool-manager para esse fork na configuração de runtime.)
3. **Modelos**: apontar o ComfyUI para `auxiliary-tools/models` via
   `extra_model_paths.yaml` (checkpoints → `models/sdxl/checkpoints`, vae →
   `models/sdxl/vae`), evitando duplicar os arquivos já baixados.
4. **Subir** o ComfyUI (`comfyui.bat` do fork) em `http://localhost:8188`.
5. Rodar este worker — agora `POST /generations` (text2img) produz um PNG real.

### ✅ Config ZLUDA validada (gera imagens na RX 7800 XT, ~1.8 it/s SDXL 1024)

Lições duramente aprendidas (ver `tools/bootstrap/comfyui-zluda-launch.bat`):

| Sintoma | Causa | Fix |
| :-- | :-- | :-- |
| `WinError 126` em `cublas64_11.dll` | ROCm não está no PATH | `set PATH=C:\Program Files\AMD\ROCm\6.4\bin;%PATH%` |
| `rocBLAS error ... TensileLibrary.dat for gfx1036` + abort | rocBLAS tenta inicializar a **iGPU** (gfx1036 do 7900X3D) | `set "HIP_VISIBLE_DEVICES=1"` (índice 1 = dGPU; **valor sem espaço**) |
| `cuDNN error: CUDNN_STATUS_EXECUTION_FAILED` no conv2d | cudnn não-funcional no ZLUDA | `set "TORCH_BACKENDS_CUDNN_ENABLED=0"` (usa MIOpen); manter `cudnn64_9.dll` NVIDIA original |
| Worker trava quando ComfyUI dá erro | `wait()` não tratava erro | trata `execution_error`/`execution_interrupted` no `comfyui_client.py` |

> Não patchear `cudnn64_9.dll` com o do ZLUDA (não carrega, dependências faltando).
> Se reinstalar o torch, reaplicar os patches ZLUDA (cublas/cusparse/nvrtc/cufft) — ver `mf-repatch` no ComfyUI-Zluda.

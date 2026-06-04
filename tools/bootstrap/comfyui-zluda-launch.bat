@echo off
REM ============================================================
REM Launcher do ComfyUI na AMD RX 7800 XT (gfx1101) via ZLUDA.
REM Config VALIDADA (gera imagens, ~1.8 it/s SDXL 1024).
REM Copie para C:\ComfyUI-Zluda\ e rode (ou via setup-comfyui-zluda.ps1).
REM
REM Por que cada linha existe (lições duramente aprendidas):
REM  - ROCm\6.4\bin no PATH: senao WinError 126 carregando cublas64_11.dll
REM    (o cublas do ZLUDA depende do amdhip64_6.dll do ROCm).
REM  - HIP_VISIBLE_DEVICES=1: indice 1 = RX 7800 XT. Esconde a iGPU
REM    (gfx1036 do Ryzen 7900X3D) que trava o rocBLAS:
REM    "Cannot read .../TensileLibrary.dat ... for gfx1036". USAR set "VAR=1"
REM    (sem espaco no final, senao vira indice invalido = "No CUDA GPUs").
REM  - TORCH_BACKENDS_CUDNN_ENABLED=0: a cudnn.dll do ZLUDA nao carrega
REM    (deps faltando); deixe o cudnn64_9.dll NVIDIA original (carrega no
REM    import) e desabilite o cuDNN -> conv2d vai pelo MIOpen (funciona).
REM ============================================================
cd /d C:\ComfyUI-Zluda
set "PATH=C:\Program Files\AMD\ROCm\6.4\bin;%PATH%"
set "HIP_PATH=C:\Program Files\AMD\ROCm\6.4\"
set "HIP_VISIBLE_DEVICES=1"
set "MIOPEN_FIND_MODE=2"
set "MIOPEN_LOG_LEVEL=3"
set "TORCH_BACKENDS_CUDNN_ENABLED=0"
"C:\ComfyUI-Zluda\zluda\zluda.exe" -- "C:\ComfyUI-Zluda\venv\Scripts\python.exe" main.py --use-quad-cross-attention --reserve-vram 0.9 --disable-async-offload --disable-pinned-memory

@echo off
REM Launcher do ComfyUI para TEXTURA na AMD - Backend B (render/bake na GPU via
REM ZLUDA usando o custom_rasterizer GPU). Igual ao mf-run.bat + device=cuda.
cd /d C:\ComfyUI-Zluda
set "PATH=C:\Program Files\AMD\ROCm\6.4\bin;%PATH%"
set "HIP_PATH=C:\Program Files\AMD\ROCm\6.4\"
set "HIP_VISIBLE_DEVICES=1"
set "MIOPEN_FIND_MODE=2"
set "MIOPEN_LOG_LEVEL=3"
set "TORCH_BACKENDS_CUDNN_ENABLED=0"
set "HUNYUAN3D_TEXTURE_DEVICE=cuda"
"C:\ComfyUI-Zluda\zluda\zluda.exe" -- "C:\ComfyUI-Zluda\venv\Scripts\python.exe" main.py --use-quad-cross-attention --reserve-vram 0.9 --disable-async-offload --disable-pinned-memory

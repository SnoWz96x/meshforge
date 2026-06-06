@echo off
REM Build COMPLETO (CPU+GPU) do custom_rasterizer. MSVC + CUDA 11.8 (nvcc) + ROCm
REM no PATH (para o torch importar). Backend B do MeshForge.
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
set "PATH=C:\Program Files\AMD\ROCm\6.4\bin;%PATH%"
set "HIP_PATH=C:\Program Files\AMD\ROCm\6.4\"
set "HIP_VISIBLE_DEVICES=1"
set "CUDA_HOME=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v11.8"
set "CUDA_PATH=%CUDA_HOME%"
set "PATH=%CUDA_HOME%\bin;%PATH%"
set "DISTUTILS_USE_SDK=1"
set "SETUPTOOLS_USE_DISTUTILS=stdlib"
set "TORCH_CUDA_ARCH_LIST=8.6+PTX"
cd /d "C:\ComfyUI-Zluda\custom_nodes\ComfyUI-Hunyuan3DWrapper\hy3dgen\texgen\custom_rasterizer"
echo === nvcc ===
nvcc --version | findstr release
echo === build/install ===
"C:\ComfyUI-Zluda\venv\Scripts\python.exe" setup_gpu.py install
echo === EXIT %ERRORLEVEL% ===

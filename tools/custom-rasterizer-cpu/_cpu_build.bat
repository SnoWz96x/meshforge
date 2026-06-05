@echo off
REM Build CPU-only do custom_rasterizer (MeshForge). Carrega o MSVC (vcvars) e o
REM PATH do ROCm (a build importa torch, que precisa do cublas patcheado).
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
set "PATH=C:\Program Files\AMD\ROCm\6.4\bin;%PATH%"
set "HIP_PATH=C:\Program Files\AMD\ROCm\6.4\"
set "HIP_VISIBLE_DEVICES=1"
set "DISTUTILS_USE_SDK=1"
set "SETUPTOOLS_USE_DISTUTILS=stdlib"
cd /d "C:\ComfyUI-Zluda\custom_nodes\ComfyUI-Hunyuan3DWrapper\hy3dgen\texgen\custom_rasterizer"
echo === cl.exe ===
where cl.exe
echo === build/install ===
"C:\ComfyUI-Zluda\venv\Scripts\python.exe" setup_cpu.py install
echo === EXIT %ERRORLEVEL% ===

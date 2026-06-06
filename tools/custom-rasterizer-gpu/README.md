# custom_rasterizer — build COMPLETO CPU+GPU (Backend B, textura na GPU via ZLUDA)

Backend **B** de textura: além do caminho CPU (Backend A, ver `../custom-rasterizer-cpu`),
compila os **kernels CUDA** (`rasterizer_gpu.cu`, com `thrust`) com o **nvcc** e os
roda na AMD **via ZLUDA**. Selecionável em runtime por `HUNYUAN3D_TEXTURE_DEVICE`.

> ⚠️ Sinceridade: o ganho é pequeno (~15s/geração — a rasterização não é o gargalo;
> a difusão é). Backend B é a 2ª frente "por completude/robustez". O **Backend A
> (CPU) continua o padrão**. Os dois coexistem no MESMO pacote (o dispatcher
> `rasterize_image` escolhe CPU/GPU pelo device do tensor).

## Pré-requisitos
- **MSVC** (VS 2022 Build Tools) — já usado no Backend A.
- **CUDA Toolkit 11.8** (precisa casar com o torch `cu118`): componentes
  `nvcc, cudart, thrust, cuda_profiler_api` **+ libs de math**
  `cublas/cusparse/cusolver/curand/cufft (+_dev)` (o header `ATen/cuda/CUDAContext.h`
  do torch puxa `cusparse.h` etc.). **NÃO instalar o driver** (conflita com a AMD).

## Como buildar
1. Instale o CUDA Toolkit 11.8 (elevado/admin), só os componentes acima.
2. Rode `_gpu_build.bat` (com o ComfyUI **parado** — senão o `.pyd` fica travado).
   Ele carrega MSVC + CUDA + ROCm-no-PATH e roda `setup_gpu.py install`.
3. Resultado: o `custom_rasterizer_kernel.pyd` passa a ter CPU **e** GPU.

## Validação (feita)
```text
CPU pixels: 722        # Backend A intacto
cuda disponivel: True
GPU pixels: 722  device: cuda:0   -> BACKEND B OK   # kernels CUDA via ZLUDA
```

## Selecionar o backend em runtime
- **A (CPU, padrão)**: ComfyUI com `HUNYUAN3D_TEXTURE_DEVICE=cpu`
  (`tools/bootstrap/comfyui-zluda-launch-texture.bat`).
- **B (GPU/ZLUDA)**: ComfyUI com `HUNYUAN3D_TEXTURE_DEVICE=cuda`
  (`tools/bootstrap/comfyui-zluda-launch-texture-gpu.bat`).
O `MeshRender` lê essa env e roda render/bake em CPU ou GPU.

## Muros do toolchain (duramente aprendidos)
- Wheels pip `nvidia-cuda-*-cu11` no Windows **não trazem `nvcc.exe`/`cudart.lib`**
  (são só runtime) → precisa do instalador completo do Toolkit.
- nvcc 11.8 rejeita MSVC novo (14.44) → `-allow-unsupported-compiler`.
- O STL do MSVC 14.44 exige CUDA≥12.4 (`STL1002`) → definir
  `_ALLOW_COMPILER_AND_STL_VERSION_MISMATCH` (cxx e `-Xcompiler`).
- `cpp_extension` recusa build no Windows se acha ROCm → importar torch antes e
  remover `ROCM_HOME/HIP_PATH` + ROCm do PATH (mantendo `CUDA_HOME`).
- `TORCH_CUDA_ARCH_LIST=8.6+PTX` embute PTX (o ZLUDA faz JIT do PTX).

## Backup / rollback
O build CPU-only original fica em `C:\ComfyUI-Zluda\_mf_rasterizer_cpu_backup`.
Se o build completo causar problema, restaure aqueles arquivos no
`venv/Lib/site-packages` (com o ComfyUI parado).

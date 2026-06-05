# custom_rasterizer — build CPU-only (textura Hunyuan3D na AMD)

A textura do Hunyuan3D precisa de um rasterizador. O `custom_rasterizer` oficial é
uma extensão **CUDA** (`.cu` + `nvcc`) → não compila na AMD/ZLUDA (sem CUDA Toolkit).

**Descoberta-chave:** o `rasterizer.cpp` do wrapper já tem uma implementação de
**CPU** (`rasterize_image_cpu`) e o dispatcher escolhe CPU vs GPU pelo *device* do
tensor. O `build_hierarchy` (usado no bake) também é C++ de CPU. Só o
`rasterize_image_gpu` mora no `.cu`.

Então dá pra compilar uma versão **CPU-only** (com MSVC, sem nvcc): a rasterização
roda na CPU e o **modelo de pintura roda na GPU via ZLUDA**. É o **Backend A** de
textura do MeshForge.

## Estratégia de 2 backends (selecionável em runtime)

O `MeshRender` despacha CPU/GPU pelo device do tensor. Logo, um seletor
`HUNYUAN3D_TEXTURE_BACKEND=cpu|gpu` só troca `device` no renderer:

| Backend | Rasterizador | Pré-requisito | Estado |
| :-- | :-- | :-- | :-- |
| **A — `cpu`** | `custom_rasterizer` CPU-only (este build) | VS Build Tools (MSVC) | ✅ build + rasterização validados |
| **B — `gpu`** | `custom_rasterizer` GPU (`.cu`) via ZLUDA | CUDA Toolkit 11.8 (`nvcc`) | ⏳ a fazer (instalar Toolkit + recompilar `.cu`) |

Como o caminho CPU já está no mesmo pacote, quando o Backend B for compilado
(build completo CPU+GPU), **os dois coexistem** e o seletor escolhe em runtime —
margem de segurança pra "de qualquer forma fazer funcionar".

## Conteúdo (fontes versionadas)

| Arquivo | Papel |
| :-- | :-- |
| `rasterizer.h` | header adaptado: sem `<ATen/cuda/CUDAContext.h>`; `__host__/__device__` neutralizados |
| `rasterizer_gpu_stub.cpp` | stub de `rasterize_image_gpu` (build CPU não tem o `.cu`); erra claro se chamado |
| `setup_cpu.py` | `CppExtension` (CPU); importa torch antes e **esconde o ROCm** do `cpp_extension` (senão ele recusa build no Windows) |
| `_cpu_build.bat` | carrega o MSVC (`vcvars64`) + PATH do ROCm e roda o `setup_cpu.py install` |

## Como buildar

1. Copie `rasterizer.h` e `rasterizer_gpu_stub.cpp` para uma pasta `_cpu/` dentro de
   `.../ComfyUI-Hunyuan3DWrapper/hy3dgen/texgen/custom_rasterizer/`, junto de cópias
   de `lib/custom_rasterizer_kernel/rasterizer.cpp` e `grid_neighbor.cpp`.
2. Copie `setup_cpu.py` e `_cpu_build.bat` para a raiz desse `custom_rasterizer/`.
3. Rode `_cpu_build.bat` (ajuste o caminho do `vcvars64.bat` se a edição do VS for
   outra). Resultado: `custom_rasterizer_kernel.*.pyd` + pacote `custom_rasterizer`
   instalados no venv do ComfyUI.

## Validação (feita)

```text
findices (64,64)  bary (64,64,3)  pixels_no_triangulo: 722  -> CPU RASTERIZE OK
```

## Notas duramente aprendidas

- `OSError: Building PyTorch extensions using ROCm and Windows is not supported.`
  → o `cpp_extension` detecta o ROCm (via `hipcc` no PATH) e recusa. Fix: importar
  `torch` primeiro (carrega o cublas patcheado) e **remover** `ROCM_HOME/HIP_PATH`
  do ambiente + tirar o bin do ROCm do PATH antes de importar `cpp_extension`.
- `AssertionError ... _distutils` com `DISTUTILS_USE_SDK=1` → setar
  `SETUPTOOLS_USE_DISTUTILS=stdlib`.

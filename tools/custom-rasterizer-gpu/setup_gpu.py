# Build COMPLETO (CPU + GPU) do custom_rasterizer (MeshForge / Backend B AMD-ZLUDA).
#
# Compila rasterizer.cpp + grid_neighbor.cpp (CPU) + rasterizer_gpu.cu (GPU, nvcc).
# Mantém o caminho CPU (Backend A) e ADICIONA o GPU (device='cuda' via ZLUDA).
# Requer CUDA Toolkit 11.8 (nvcc) + MSVC. Build via _gpu_build.bat.
import os

from setuptools import setup, find_packages

# Importa torch com o ROCm ainda no PATH (carrega o cublas patcheado do ZLUDA).
import torch  # noqa: F401

# Esconde o ROCm do cpp_extension (no Windows ele recusa "build ROCm"); mantém o
# CUDA_HOME (toolkit) para o nvcc. Tira só as entradas do ROCm do PATH.
for _k in ("ROCM_HOME", "ROCM_PATH", "HIP_PATH", "HIP_HOME"):
    os.environ.pop(_k, None)
os.environ["PATH"] = os.pathsep.join(
    p for p in os.environ.get("PATH", "").split(os.pathsep) if "ROCm" not in p
)

from torch.utils.cpp_extension import BuildExtension, CUDAExtension

# MSVC 14.44 + CUDA 11.8: o STL do MSVC exige CUDA>=12.4 (STL1002) e o nvcc rejeita
# o MSVC novo. Bypass: -allow-unsupported-compiler + _ALLOW_COMPILER_AND_STL_VERSION_MISMATCH.
_STL_BYPASS = "/D_ALLOW_COMPILER_AND_STL_VERSION_MISMATCH"
cxx_args = [_STL_BYPASS]
nvcc_args = ["-allow-unsupported-compiler"]
if os.name == "nt":
    nvcc_args += ["-Xcompiler", "/Zc:preprocessor", "-Xcompiler", _STL_BYPASS]

module = CUDAExtension(
    "custom_rasterizer_kernel",
    [
        "lib/custom_rasterizer_kernel/rasterizer.cpp",
        "lib/custom_rasterizer_kernel/grid_neighbor.cpp",
        "lib/custom_rasterizer_kernel/rasterizer_gpu.cu",
    ],
    extra_compile_args={"cxx": cxx_args, "nvcc": nvcc_args},
)

setup(
    name="custom_rasterizer",
    version="0.1.0+cu118",
    packages=find_packages(),
    package_dir={"": "."},
    include_package_data=True,
    ext_modules=[module],
    cmdclass={"build_ext": BuildExtension},
)

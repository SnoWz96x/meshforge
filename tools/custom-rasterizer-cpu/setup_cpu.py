# Build CPU-only do custom_rasterizer (MeshForge / AMD-ZLUDA).
#
# Compila SO os fontes C++ de CPU (sem o rasterizer_gpu.cu, que exige nvcc/CUDA
# Toolkit). Assim a textura do Hunyuan3D roda na AMD: rasterizacao na CPU e o
# modelo de pintura na GPU via ZLUDA.
#
# Build (com o ambiente do VS carregado / cl.exe no PATH):
#   python setup_cpu.py install
import os

from setuptools import setup, find_packages

# Importa o torch com o ROCm ainda no PATH (carrega o cublas patcheado do ZLUDA).
import torch  # noqa: F401

# Agora esconde o ROCm do cpp_extension: no Windows ele recusa "build ROCm".
# Como queremos build CPU/MSVC puro (CppExtension), removemos ROCM_HOME/HIP e
# tiramos o bin do ROCm do PATH (senao 'hipcc' e detectado).
for _k in ("ROCM_HOME", "ROCM_PATH", "HIP_PATH", "HIP_HOME"):
    os.environ.pop(_k, None)
os.environ["PATH"] = os.pathsep.join(
    p for p in os.environ.get("PATH", "").split(os.pathsep) if "ROCm" not in p
)

from torch.utils.cpp_extension import BuildExtension, CppExtension

module = CppExtension(
    "custom_rasterizer_kernel",
    [
        "_cpu/rasterizer.cpp",
        "_cpu/grid_neighbor.cpp",
        "_cpu/rasterizer_gpu_stub.cpp",
    ],
    extra_compile_args={"cxx": ["/O2"]},
)

setup(
    name="custom_rasterizer",
    version="0.1.0+cpu",
    packages=find_packages(),
    package_dir={"": "."},
    include_package_data=True,
    ext_modules=[module],
    cmdclass={"build_ext": BuildExtension},
)

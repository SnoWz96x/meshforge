// Stub do caminho GPU para o build CPU-only (sem nvcc/CUDA Toolkit).
// O dispatcher rasterize_image so chama isto quando os tensores estao na GPU;
// no backend "cpu" do MeshForge isso nunca acontece. Se chamado, erra claro.
#include "rasterizer.h"

std::vector<torch::Tensor> rasterize_image_gpu(torch::Tensor V, torch::Tensor F, torch::Tensor D,
    int width, int height, float occlusion_truncation, int use_depth_prior) {
    AT_ERROR("custom_rasterizer compilado CPU-only: caminho GPU indisponivel. "
             "Use o backend de textura 'cpu' (device='cpu') ou recompile com o CUDA Toolkit.");
}

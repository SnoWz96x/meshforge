"""Workflows do Hunyuan3D 2.0 (formato API do ComfyUI) — via ComfyUI-Hunyuan3DWrapper.

SHAPE (malha sem textura) VALIDADO na AMD RX 7800 XT / ZLUDA:
imagem → malha .glb watertight (~20k verts / 40k faces). Pipeline:
  Hy3DModelLoader → Hy3DGenerateMesh → Hy3DVAEDecode → Hy3DPostprocessMesh → Hy3DExportMesh

Textura nativa (custom_rasterizer) é CUDA-only → na AMD usaremos plano B
(projeção via ComfyUI/SDXL) — a ser implementado.
"""
from __future__ import annotations

import os
from typing import Any

# Modelo de forma (shape). Mantemos 2 variantes em disco e alternamos por env:
#   - model.fp16.safetensors  (padrão; metade da VRAM)
#   - model.safetensors       (fp32; mais preciso, dobro do peso)
# Trocar é só definir HUNYUAN3D_DIT_MODEL. Um `params["model"]` ainda sobrepõe
# por requisição. (Os formatos .ckpt foram removidos — eram redundantes.)
DEFAULT_DIT = os.environ.get("HUNYUAN3D_DIT_MODEL", "model.fp16.safetensors")


def build_image_to_3d(image_name: str, params: dict[str, Any]) -> dict:
    """Grafo image→3D (shape only). `image_name` deve estar no input do ComfyUI."""
    # shape_steps tem prioridade (níveis de qualidade); cai p/ steps por compat.
    steps = int(params.get("shape_steps", params.get("steps", 30)))
    guidance = float(params.get("guidance_scale", 5.5))
    seed = int(params.get("seed", 42))
    octree = int(params.get("octree_resolution", 256))
    max_faces = int(params.get("max_facenum", 40000))
    model = params.get("model", DEFAULT_DIT)
    return {
        "1": {"class_type": "LoadImage", "inputs": {"image": image_name}},
        "2": {"class_type": "Hy3DModelLoader", "inputs": {"model": model}},
        "3": {"class_type": "Hy3DGenerateMesh", "inputs": {
            "pipeline": ["2", 0], "image": ["1", 0],
            "guidance_scale": guidance, "steps": steps, "seed": seed}},
        "4": {"class_type": "Hy3DVAEDecode", "inputs": {
            "vae": ["2", 1], "latents": ["3", 0], "box_v": 1.01,
            "octree_resolution": octree, "num_chunks": 8000, "mc_level": 0.0, "mc_algo": "mc"}},
        "5": {"class_type": "Hy3DPostprocessMesh", "inputs": {
            "trimesh": ["4", 0], "remove_floaters": True, "remove_degenerate_faces": True,
            "reduce_faces": True, "max_facenum": max_faces, "smooth_normals": False}},
        "6": {"class_type": "Hy3DExportMesh", "inputs": {
            "trimesh": ["5", 0], "filename_prefix": "3D/MeshForge", "file_format": "glb"}},
    }


# Vistas canônicas aceitas pelo nó multiview (todas opcionais; basta ≥1).
MULTIVIEW_VIEWS = ("front", "left", "right", "back")


def build_multiview_to_3d(view_images: dict[str, str], params: dict[str, Any]) -> dict:
    """Grafo multi-imagem→3D (shape). `view_images` mapeia vista→nome do arquivo
    já presente no input do ComfyUI, ex.: {"front": "a.png", "left": "b.png"}.

    Usa `Hy3DGenerateMeshMultiView` com o MESMO modelo base (HY3DMODEL) do
    single-view — não exige download do checkpoint 2mv. Validado E2E na
    RX 7800 XT/ZLUDA (reconstrução de caneca a partir de 4 vistas).
    """
    views = {v: n for v, n in view_images.items() if v in MULTIVIEW_VIEWS and n}
    if not views:
        raise ValueError("multiview requer ao menos uma vista (front/left/right/back)")
    steps = int(params.get("shape_steps", params.get("steps", 30)))
    guidance = float(params.get("guidance_scale", 5.5))
    seed = int(params.get("seed", 42))
    octree = int(params.get("octree_resolution", 256))
    max_faces = int(params.get("max_facenum", 40000))
    model = params.get("model", DEFAULT_DIT)

    g: dict[str, Any] = {"2": {"class_type": "Hy3DModelLoader", "inputs": {"model": model}}}
    mv_inputs: dict[str, Any] = {
        "pipeline": ["2", 0], "guidance_scale": guidance, "steps": steps, "seed": seed}
    for view, name in views.items():
        node_id = f"L_{view}"
        g[node_id] = {"class_type": "LoadImage", "inputs": {"image": name}}
        mv_inputs[view] = [node_id, 0]
    g["3"] = {"class_type": "Hy3DGenerateMeshMultiView", "inputs": mv_inputs}
    g["4"] = {"class_type": "Hy3DVAEDecode", "inputs": {
        "vae": ["2", 1], "latents": ["3", 0], "box_v": 1.01,
        "octree_resolution": octree, "num_chunks": 8000, "mc_level": 0.0, "mc_algo": "mc"}}
    g["5"] = {"class_type": "Hy3DPostprocessMesh", "inputs": {
        "trimesh": ["4", 0], "remove_floaters": True, "remove_degenerate_faces": True,
        "reduce_faces": True, "max_facenum": max_faces, "smooth_normals": False}}
    g["6"] = {"class_type": "Hy3DExportMesh", "inputs": {
        "trimesh": ["5", 0], "filename_prefix": "3D/MeshForge", "file_format": "glb"}}
    return g

"""Workflow de TEXTURA do Hunyuan3D (formato API do ComfyUI) — Backend A (AMD).

Pipeline (render/bake na CPU via custom_rasterizer CPU-only; pintura na GPU/ZLUDA):
  Hy3DLoadMesh -> Hy3DMeshUVWrap -> Hy3DRenderMultiView (CPU) ->
  Hy3DSampleMultiView (paint, GPU) -> Hy3DBakeFromMultiview (CPU) ->
  Hy3DApplyTexture -> Hy3DExportMesh (glb texturizado)

Pré-requisitos no ComfyUI:
  - custom_rasterizer CPU-only instalado (tools/custom-rasterizer-cpu).
  - ComfyUI iniciado com HUNYUAN3D_TEXTURE_DEVICE=cpu (render/bake na CPU).
  - modelo de pintura `hunyuan3d-paint-v2-0` baixado.
"""
from __future__ import annotations

from typing import Any

PAINT_MODEL = "hunyuan3d-paint-v2-0"


def build_texture(mesh_glb_path: str, ref_image_name: str, params: dict[str, Any]) -> dict:
    """Grafo de texturização.

    mesh_glb_path: caminho de filesystem do .glb a texturizar (Hy3DLoadMesh).
    ref_image_name: nome da imagem de referência já no input do ComfyUI (LoadImage).
    """
    steps = int(params.get("texture_steps", 20))
    seed = int(params.get("seed", 0))
    view_size = int(params.get("view_size", 512))
    render_size = int(params.get("render_size", 1024))
    texture_size = int(params.get("texture_size", 1024))
    return {
        "1": {"class_type": "Hy3DLoadMesh", "inputs": {"glb_path": mesh_glb_path}},
        "2": {"class_type": "Hy3DMeshUVWrap", "inputs": {"trimesh": ["1", 0]}},
        "3": {"class_type": "Hy3DCameraConfig", "inputs": {
            "camera_azimuths": "0, 90, 180, 270, 0, 180",
            "camera_elevations": "0, 0, 0, 0, 90, -90",
            "view_weights": "1, 0.1, 0.5, 0.1, 0.05, 0.05",
            "camera_distance": 1.45, "ortho_scale": 1.2}},
        "4": {"class_type": "Hy3DRenderMultiView", "inputs": {
            "trimesh": ["2", 0], "render_size": render_size, "texture_size": texture_size,
            "camera_config": ["3", 0], "normal_space": "world"}},
        "5": {"class_type": "DownloadAndLoadHy3DPaintModel", "inputs": {"model": PAINT_MODEL}},
        "6": {"class_type": "LoadImage", "inputs": {"image": ref_image_name}},
        "7": {"class_type": "Hy3DSampleMultiView", "inputs": {
            "pipeline": ["5", 0], "ref_image": ["6", 0],
            "normal_maps": ["4", 0], "position_maps": ["4", 1],
            "view_size": view_size, "steps": steps, "seed": seed,
            "camera_config": ["3", 0]}},
        "8": {"class_type": "Hy3DBakeFromMultiview", "inputs": {
            "images": ["7", 0], "renderer": ["4", 2], "camera_config": ["3", 0]}},
        "9": {"class_type": "Hy3DApplyTexture", "inputs": {
            "texture": ["8", 0], "renderer": ["8", 2]}},
        "10": {"class_type": "Hy3DExportMesh", "inputs": {
            "trimesh": ["9", 0], "filename_prefix": "3D/MeshForgeTex", "file_format": "glb"}},
    }

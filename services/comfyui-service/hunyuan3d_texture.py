"""Workflow de TEXTURA do Hunyuan3D (formato API do ComfyUI) — Backend A (AMD).

Pipeline PREMIUM (render/bake na CPU via custom_rasterizer CPU-only; difusão na
GPU/ZLUDA):
  Hy3DLoadMesh -> Hy3DMeshUVWrap -> Hy3DRenderMultiView (CPU)
  ref -> Hy3DDelightImage (remove sombras -> albedo limpo, GPU)
      -> Hy3DSampleMultiView (paint, GPU)
      -> Hy3DBakeFromMultiview (CPU)
      -> Hy3DMeshVerticeInpaintTexture (CPU, preenche por vértice)
      -> CV2InpaintTexture (CPU, fecha costuras)
      -> Hy3DApplyTexture -> Hy3DExportMesh (glb texturizado)

Diferenciais "premium": delight (cor lighting-invariant) + inpaint de costuras
(sem buracos) + texturas/vistas maiores.

Pré-requisitos no ComfyUI:
  - custom_rasterizer CPU-only instalado (tools/custom-rasterizer-cpu).
  - ComfyUI com HUNYUAN3D_TEXTURE_DEVICE=cpu (render/bake na CPU).
  - modelos hunyuan3d-paint-v2-0 e hunyuan3d-delight-v2-0 (este baixa no 1º uso).
"""
from __future__ import annotations

from typing import Any

PAINT_MODEL = "hunyuan3d-paint-v2-0"
DELIGHT_MODEL = "hunyuan3d-delight-v2-0"
UPSCALE_MODEL = "4x-UltraSharp.pth"


def build_texture(mesh_glb_path: str, ref_image_name: str, params: dict[str, Any]) -> dict:
    """Grafo de texturização premium.

    mesh_glb_path: caminho de filesystem do .glb a texturizar (Hy3DLoadMesh).
    ref_image_name: nome da imagem de referência já no input do ComfyUI (LoadImage).
    """
    steps = int(params.get("texture_steps", 25))
    delight_steps = int(params.get("delight_steps", 40))
    seed = int(params.get("seed", 0))
    view_size = int(params.get("view_size", 384))
    render_size = int(params.get("render_size", 1024))
    texture_size = int(params.get("texture_size", 1024))
    delight = bool(params.get("delight", True))
    upscale = bool(params.get("upscale", True))
    # Backend de rasterização (render/bake): cpu (A, padrão) | cuda (B, via ZLUDA).
    render_device = "cuda" if params.get("texture_backend") == "gpu" else "cpu"

    graph: dict[str, Any] = {
        "1": {"class_type": "Hy3DLoadMesh", "inputs": {"glb_path": mesh_glb_path}},
        "2": {"class_type": "Hy3DMeshUVWrap", "inputs": {"trimesh": ["1", 0]}},
        "3": {"class_type": "Hy3DCameraConfig", "inputs": {
            "camera_azimuths": "0, 90, 180, 270, 0, 180",
            "camera_elevations": "0, 0, 0, 0, 90, -90",
            "view_weights": "1, 0.1, 0.5, 0.1, 0.05, 0.05",
            "camera_distance": 1.45, "ortho_scale": 1.2}},
        "4": {"class_type": "Hy3DRenderMultiView", "inputs": {
            "trimesh": ["2", 0], "render_size": render_size, "texture_size": texture_size,
            "camera_config": ["3", 0], "normal_space": "world", "render_device": render_device}},
        "5": {"class_type": "DownloadAndLoadHy3DPaintModel", "inputs": {"model": PAINT_MODEL}},
        "6": {"class_type": "LoadImage", "inputs": {"image": ref_image_name}},
    }

    # Referência: delight (albedo limpo) ou a imagem crua.
    if delight:
        graph["7"] = {"class_type": "DownloadAndLoadHy3DDelightModel",
                      "inputs": {"model": DELIGHT_MODEL}}
        graph["8"] = {"class_type": "Hy3DDelightImage", "inputs": {
            "delight_pipe": ["7", 0], "image": ["6", 0], "steps": delight_steps,
            "width": 512, "height": 512, "cfg_image": 1.5, "seed": seed}}
        ref = ["8", 0]
    else:
        ref = ["6", 0]

    # Paint multiview -> bake -> inpaint (vértice + cv2) -> aplica -> exporta.
    graph["10"] = {"class_type": "Hy3DSampleMultiView", "inputs": {
        "pipeline": ["5", 0], "ref_image": ref,
        "normal_maps": ["4", 0], "position_maps": ["4", 1],
        "view_size": view_size, "steps": steps, "seed": seed,
        "camera_config": ["3", 0]}}

    # Upscale opcional das vistas pintadas (ESRGAN) ANTES do bake -> textura
    # realmente mais nítida (não só maior). Default on.
    if upscale:
        graph["16"] = {"class_type": "UpscaleModelLoader", "inputs": {"model_name": UPSCALE_MODEL}}
        graph["17"] = {"class_type": "ImageUpscaleWithModel", "inputs": {
            "upscale_model": ["16", 0], "image": ["10", 0]}}
        bake_images = ["17", 0]
    else:
        bake_images = ["10", 0]

    graph["11"] = {"class_type": "Hy3DBakeFromMultiview", "inputs": {
        "images": bake_images, "renderer": ["4", 2], "camera_config": ["3", 0]}}
    graph["12"] = {"class_type": "Hy3DMeshVerticeInpaintTexture", "inputs": {
        "texture": ["11", 0], "mask": ["11", 1], "renderer": ["11", 2]}}
    graph["13"] = {"class_type": "CV2InpaintTexture", "inputs": {
        "texture": ["12", 0], "mask": ["12", 1], "inpaint_radius": 3, "inpaint_method": "ns"}}
    graph["14"] = {"class_type": "Hy3DApplyTexture", "inputs": {
        "texture": ["13", 0], "renderer": ["12", 2]}}
    graph["15"] = {"class_type": "Hy3DExportMesh", "inputs": {
        "trimesh": ["14", 0], "filename_prefix": "3D/MeshForgeTex", "file_format": "glb"}}
    return graph

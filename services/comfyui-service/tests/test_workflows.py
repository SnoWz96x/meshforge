"""Testes dos construtores de workflow (grafos formato API do ComfyUI).

São dicts puros (sem GPU/IO), então validamos estrutura, ligações entre nós e
overrides de parâmetros — o contrato que o ComfyUI espera receber.
"""
import sys
from pathlib import Path

# Garante que os módulos do worker sejam importáveis (pasta-pai).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from workflows import build_img2img, build_txt2img  # noqa: E402
from hunyuan3d_workflows import (  # noqa: E402
    DEFAULT_DIT,
    build_image_to_3d,
    build_multiview_to_3d,
)


def _class_types(graph: dict) -> set[str]:
    return {node["class_type"] for node in graph.values()}


# ── SDXL txt2img ─────────────────────────────────────────────────────────────
def test_txt2img_tem_nos_essenciais():
    g = build_txt2img({"prompt": "a cat"})
    assert _class_types(g) >= {
        "CheckpointLoaderSimple",
        "CLIPTextEncode",
        "KSampler",
        "VAEDecode",
        "SaveImage",
        "EmptyLatentImage",
    }


def test_txt2img_aplica_params():
    g = build_txt2img({"prompt": "x", "steps": 12, "cfg": 4.5, "width": 768, "height": 512})
    ks = g["3"]["inputs"]
    assert ks["steps"] == 12
    assert ks["cfg"] == 4.5
    assert ks["denoise"] == 1.0  # txt2img sempre denoise total
    assert g["5"]["inputs"]["width"] == 768
    assert g["5"]["inputs"]["height"] == 512


def test_txt2img_prompt_vai_para_o_clip_positivo():
    g = build_txt2img({"prompt": "forge heat"})
    assert g["6"]["inputs"]["text"] == "forge heat"


# ── SDXL img2img ─────────────────────────────────────────────────────────────
def test_img2img_usa_a_imagem_de_entrada_e_denoise():
    g = build_img2img({"prompt": "y", "denoise": 0.42}, "input.png")
    assert g["10"]["inputs"]["image"] == "input.png"
    assert g["3"]["inputs"]["denoise"] == 0.42
    # o latente do KSampler vem do VAEEncode (11), não de um latente vazio
    assert g["3"]["inputs"]["latent_image"] == ["11", 0]


def test_img2img_denoise_default():
    g = build_img2img({"prompt": "y"}, "input.png")
    assert g["3"]["inputs"]["denoise"] == 0.6


# ── Hunyuan3D image→3D (shape) ───────────────────────────────────────────────
def test_image_to_3d_pipeline_completo_e_ligado():
    g = build_image_to_3d("ref.png", {})
    assert _class_types(g) == {
        "LoadImage",
        "Hy3DModelLoader",
        "Hy3DGenerateMesh",
        "Hy3DVAEDecode",
        "Hy3DPostprocessMesh",
        "Hy3DExportMesh",
    }
    # ligações da cadeia: gera→decode→postprocess→export
    assert g["3"]["inputs"]["pipeline"] == ["2", 0]
    assert g["3"]["inputs"]["image"] == ["1", 0]
    assert g["4"]["inputs"]["latents"] == ["3", 0]
    assert g["5"]["inputs"]["trimesh"] == ["4", 0]
    assert g["6"]["inputs"]["trimesh"] == ["5", 0]


def test_image_to_3d_defaults_validados():
    g = build_image_to_3d("ref.png", {})
    assert g["2"]["inputs"]["model"] == DEFAULT_DIT
    assert g["3"]["inputs"]["steps"] == 30
    assert g["3"]["inputs"]["guidance_scale"] == 5.5
    assert g["4"]["inputs"]["octree_resolution"] == 256
    assert g["4"]["inputs"]["mc_algo"] == "mc"
    assert g["5"]["inputs"]["max_facenum"] == 40000
    assert g["6"]["inputs"]["file_format"] == "glb"


def test_image_to_3d_overrides():
    g = build_image_to_3d("ref.png", {"steps": 10, "max_facenum": 8000, "octree_resolution": 128})
    assert g["3"]["inputs"]["steps"] == 10
    assert g["5"]["inputs"]["max_facenum"] == 8000
    assert g["4"]["inputs"]["octree_resolution"] == 128


def test_multiview_quatro_vistas_ligadas():
    g = build_multiview_to_3d(
        {"front": "f.png", "left": "l.png", "right": "r.png", "back": "b.png"}, {}
    )
    assert g["3"]["class_type"] == "Hy3DGenerateMeshMultiView"
    # cada vista carrega sua imagem e liga ao nó multiview
    for v in ("front", "left", "right", "back"):
        assert g[f"L_{v}"]["inputs"]["image"] == f"{v[0]}.png"
        assert g["3"]["inputs"][v] == [f"L_{v}", 0]
    # mesma cadeia de decode/postprocess/export do single-view
    assert g["4"]["inputs"]["latents"] == ["3", 0]
    assert g["4"]["inputs"]["vae"] == ["2", 0 + 1]
    assert g["6"]["inputs"]["file_format"] == "glb"


def test_multiview_subconjunto_de_vistas():
    g = build_multiview_to_3d({"front": "f.png", "back": "b.png"}, {})
    assert g["3"]["inputs"]["front"] == ["L_front", 0]
    assert g["3"]["inputs"]["back"] == ["L_back", 0]
    assert "left" not in g["3"]["inputs"]
    assert "right" not in g["3"]["inputs"]
    assert "L_left" not in g and "L_right" not in g


def test_multiview_sem_vistas_falha():
    import pytest

    with pytest.raises(ValueError):
        build_multiview_to_3d({}, {})


def test_multiview_overrides():
    g = build_multiview_to_3d(
        {"front": "f.png"}, {"steps": 12, "max_facenum": 9000, "octree_resolution": 192}
    )
    assert g["3"]["inputs"]["steps"] == 12
    assert g["5"]["inputs"]["max_facenum"] == 9000
    assert g["4"]["inputs"]["octree_resolution"] == 192

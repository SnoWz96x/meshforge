"""Construtores de workflows do ComfyUI (formato API) para SDXL."""
from __future__ import annotations

import random
from typing import Any

DEFAULT_CKPT = "sd_xl_base_1.0.safetensors"


def _common(params: dict) -> dict:
    return {
        "ckpt": params.get("checkpoint", DEFAULT_CKPT),
        "prompt": params.get("prompt", ""),
        "negative": params.get("negativePrompt", ""),
        "steps": int(params.get("steps", 25)),
        "cfg": float(params.get("cfg", 7.0)),
        "sampler": params.get("sampler", "euler"),
        "scheduler": params.get("scheduler", "normal"),
        "seed": int(params.get("seed", random.randint(0, 2**32 - 1))),
        "width": int(params.get("width", 1024)),
        "height": int(params.get("height", 1024)),
    }


def build_txt2img(params: dict[str, Any]) -> dict:
    c = _common(params)
    return {
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": c["ckpt"]}},
        "5": {"class_type": "EmptyLatentImage",
              "inputs": {"width": c["width"], "height": c["height"], "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": c["prompt"], "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": c["negative"], "clip": ["4", 1]}},
        "3": {"class_type": "KSampler", "inputs": {
            "seed": c["seed"], "steps": c["steps"], "cfg": c["cfg"],
            "sampler_name": c["sampler"], "scheduler": c["scheduler"], "denoise": 1.0,
            "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "meshforge", "images": ["8", 0]}},
    }


def build_img2img(params: dict[str, Any], input_image_name: str) -> dict:
    c = _common(params)
    denoise = float(params.get("denoise", 0.6))
    return {
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": c["ckpt"]}},
        "10": {"class_type": "LoadImage", "inputs": {"image": input_image_name}},
        "11": {"class_type": "VAEEncode", "inputs": {"pixels": ["10", 0], "vae": ["4", 2]}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": c["prompt"], "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": c["negative"], "clip": ["4", 1]}},
        "3": {"class_type": "KSampler", "inputs": {
            "seed": c["seed"], "steps": c["steps"], "cfg": c["cfg"],
            "sampler_name": c["sampler"], "scheduler": c["scheduler"], "denoise": denoise,
            "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["11", 0]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "meshforge", "images": ["8", 0]}},
    }

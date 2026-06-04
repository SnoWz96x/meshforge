#!/usr/bin/env python3
"""MeshForge — ComfyUI worker.

Consome a fila BullMQ "comfyui", executa SDXL (text2img / img2img) no ComfyUI,
salva a imagem no storage e devolve um JobResult (que a API persiste no banco).

Os workers NUNCA escrevem no Postgres — só leem/escrevem no storage e devolvem
o resultado pela fila.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

import redis as redis_sync
from bullmq import Worker

from comfyui_client import ComfyUIClient
from workflows import build_img2img, build_txt2img

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
COMFYUI_URL = os.environ.get("COMFYUI_URL", "http://localhost:8188")
STORAGE_ROOT = Path(os.environ.get("STORAGE_LOCAL_PATH", "./storage"))
PROGRESS_CHANNEL = "meshforge:progress"

_rds = redis_sync.from_url(REDIS_URL)


def _publish_progress(payload: dict, progress: int, status: str = "RUNNING", message: str | None = None) -> None:
    ev = {
        "jobId": payload["jobId"],
        "generationId": payload["generationId"],
        "stage": payload["stage"],
        "status": status,
        "progress": progress,
    }
    if message:
        ev["message"] = message
    _rds.publish(PROGRESS_CHANNEL, json.dumps(ev))


def _storage_path(key: str) -> Path:
    return STORAGE_ROOT / key


def _save_image(project_id: str, data: bytes) -> tuple[str, int]:
    """Salva a imagem no storage e devolve (storageUri, sizeBytes)."""
    asset_id = uuid.uuid4().hex
    key = f"projects/{project_id}/{asset_id}.png"
    path = _storage_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return f"local:{key}", len(data)


def run_job(payload: dict) -> dict:
    """Trabalho bloqueante (roda em thread). Devolve um JobResult."""
    client = ComfyUIClient(COMFYUI_URL)
    stage = payload["stage"]
    params = payload.get("params", {})
    _publish_progress(payload, 5)

    if stage == "SDXL_IMG2IMG":
        if not payload.get("inputs"):
            raise ValueError("img2img sem imagem de entrada")
        src_key = payload["inputs"][0].split("local:", 1)[-1]
        src_bytes = _storage_path(src_key).read_bytes()
        input_name = client.upload_image(src_bytes, f"{uuid.uuid4().hex}.png")
        graph = build_img2img(params, input_name)
    else:  # SDXL_TXT2IMG
        graph = build_txt2img(params)

    prompt_id = client.submit(graph)
    _publish_progress(payload, 10)
    client.wait(prompt_id, on_progress=lambda p: _publish_progress(payload, max(10, min(95, p))))

    filename, subfolder, ftype = client.first_output_image(prompt_id)
    img = client.image_bytes(filename, subfolder, ftype)
    uri, size = _save_image(payload["projectId"], img)
    _publish_progress(payload, 100, status="SUCCEEDED")

    return {
        "jobId": payload["jobId"],
        "status": "SUCCEEDED",
        "outputs": [{
            "kind": "IMAGE",
            "format": "png",
            "storageUri": uri,
            "sizeBytes": size,
            "meta": {"width": params.get("width", 1024), "height": params.get("height", 1024)},
        }],
    }


async def process(job, _token):  # noqa: ANN001
    print(f"▸ job {job.id} stage={job.data.get('stage')}", flush=True)
    try:
        return await asyncio.to_thread(run_job, job.data)
    except Exception as err:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        print(f"✗ job {job.id} FAILED: {err!r}", flush=True)
        _publish_progress(job.data, 0, status="FAILED", message=str(err))
        raise


async def main() -> None:
    print(f"🎨 ComfyUI worker online — fila 'comfyui' @ {REDIS_URL}, ComfyUI @ {COMFYUI_URL}", flush=True)
    worker = Worker("comfyui", process, {"connection": REDIS_URL, "concurrency": 1})
    # Mantém vivo até Ctrl+C.
    try:
        await asyncio.Event().wait()
    finally:
        await worker.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("encerrando...", flush=True)

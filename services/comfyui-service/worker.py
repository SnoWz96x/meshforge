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
import logging
import os
import shutil
import sys
import uuid
from pathlib import Path

import redis as redis_sync
from bullmq import Worker

from comfyui_client import ComfyUIClient
from workflows import build_img2img, build_txt2img
from hunyuan3d_workflows import build_image_to_3d

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)-5s %(message)s",
    datefmt="%H:%M:%S",
)
_log = logging.getLogger("meshforge.worker")


def log(level: int, job_id: str | None, stage: str | None, msg: str) -> None:
    """Log estruturado: sempre carrega job/stage para rastreabilidade ponta-a-ponta."""
    ctx = f"job={job_id or '-'} stage={stage or '-'}"
    _log.log(level, "[%s] %s", ctx, msg)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
COMFYUI_URL = os.environ.get("COMFYUI_URL", "http://localhost:8188")
STORAGE_ROOT = Path(os.environ.get("STORAGE_LOCAL_PATH", "./storage"))
# Diretório de output do ComfyUI (onde o Hy3DExportMesh salva o .glb).
COMFYUI_OUTPUT_DIR = Path(os.environ.get("COMFYUI_OUTPUT_DIR", r"C:/ComfyUI-Zluda/output"))
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


def _save_mesh(project_id: str, src_glb: Path) -> tuple[str, int]:
    """Copia o .glb gerado para o storage e devolve (storageUri, sizeBytes)."""
    asset_id = uuid.uuid4().hex
    key = f"projects/{project_id}/{asset_id}.glb"
    path = _storage_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src_glb, path)
    return f"local:{key}", path.stat().st_size


def _newest_glb() -> Path:
    """Pega o .glb mais recente do output do ComfyUI (concurrency=1 → seguro)."""
    glbs = sorted((COMFYUI_OUTPUT_DIR / "3D").glob("*.glb"),
                  key=lambda p: p.stat().st_mtime, reverse=True)
    if not glbs:
        raise RuntimeError("Nenhum .glb encontrado no output do ComfyUI")
    return glbs[0]


def run_job(payload: dict) -> dict:
    """Trabalho bloqueante (roda em thread). Devolve um JobResult."""
    client = ComfyUIClient(COMFYUI_URL)
    stage = payload["stage"]
    params = payload.get("params", {})
    _publish_progress(payload, 5)

    # ---- Pipeline Texto→3D (SDXL txt2img -> Hunyuan3D shape) ----
    if stage == "TEXT_TO_3D":
        # Etapa 1/2: gera a imagem a partir do prompt.
        graph = build_txt2img(params)
        pid = client.submit(graph)
        _publish_progress(payload, 8)
        client.wait(pid, on_progress=lambda p: _publish_progress(payload, max(8, min(45, int(p * 0.45)))))
        filename, subfolder, ftype = client.first_output_image(pid)
        img = client.image_bytes(filename, subfolder, ftype)
        img_uri, img_size = _save_image(payload["projectId"], img)
        _publish_progress(payload, 48)

        # Etapa 2/2: usa a imagem gerada como entrada do shape (Hunyuan3D).
        input_name = client.upload_image(img, f"{uuid.uuid4().hex}.png")
        graph3d = build_image_to_3d(input_name, params)
        before = set((COMFYUI_OUTPUT_DIR / "3D").glob("*.glb"))
        pid3d = client.submit(graph3d)
        _publish_progress(payload, 52)
        client.wait(pid3d, on_progress=lambda p: _publish_progress(payload, max(52, min(95, 50 + int(p * 0.45)))))
        created = set((COMFYUI_OUTPUT_DIR / "3D").glob("*.glb")) - before
        glb = max(created, key=lambda p: p.stat().st_mtime) if created else _newest_glb()
        mesh_uri, mesh_size = _save_mesh(payload["projectId"], glb)
        _publish_progress(payload, 100, status="SUCCEEDED")
        return {
            "jobId": payload["jobId"],
            "status": "SUCCEEDED",
            "outputs": [
                {"kind": "IMAGE", "format": "png", "storageUri": img_uri, "sizeBytes": img_size,
                 "meta": {"width": params.get("width", 1024), "height": params.get("height", 1024),
                          "stage": "txt2img"}},
                {"kind": "MESH_RAW", "format": "glb", "storageUri": mesh_uri, "sizeBytes": mesh_size,
                 "meta": {"source": "hunyuan3d-2", "pipeline": "text-to-3d"}},
            ],
        }

    # ---- Geração 3D (Hunyuan3D shape) ----
    if stage == "HUNYUAN3D_SHAPE":
        if not payload.get("inputs"):
            raise ValueError("image→3D sem imagem de entrada")
        src_key = payload["inputs"][0].split("local:", 1)[-1]
        src_bytes = _storage_path(src_key).read_bytes()
        input_name = client.upload_image(src_bytes, f"{uuid.uuid4().hex}.png")
        graph = build_image_to_3d(input_name, params)
        # Snapshot dos .glb existentes p/ identificar o novo (robusto vs mtime/corrida).
        before = set((COMFYUI_OUTPUT_DIR / "3D").glob("*.glb"))
        prompt_id = client.submit(graph)
        _publish_progress(payload, 10)
        client.wait(prompt_id, on_progress=lambda p: _publish_progress(payload, max(10, min(95, p))))
        created = sorted((COMFYUI_OUTPUT_DIR / "3D").glob("*.glb")) and (
            set((COMFYUI_OUTPUT_DIR / "3D").glob("*.glb")) - before
        )
        glb = max(created, key=lambda p: p.stat().st_mtime) if created else _newest_glb()
        uri, size = _save_mesh(payload["projectId"], glb)
        _publish_progress(payload, 100, status="SUCCEEDED")
        return {
            "jobId": payload["jobId"],
            "status": "SUCCEEDED",
            "outputs": [{
                "kind": "MESH_RAW",
                "format": "glb",
                "storageUri": uri,
                "sizeBytes": size,
                "meta": {"source": "hunyuan3d-2"},
            }],
        }

    # ---- Geração 2D (SDXL) ----
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
    stage = job.data.get("stage")
    log(logging.INFO, job.id, stage, "iniciando")
    try:
        result = await asyncio.to_thread(run_job, job.data)
        log(logging.INFO, job.id, stage, f"OK status={result.get('status')}")
        return result
    except Exception as err:  # noqa: BLE001
        log(logging.ERROR, job.id, stage, f"FALHOU: {err!r}")
        _log.exception("traceback do job %s", job.id)
        _publish_progress(job.data, 0, status="FAILED", message=str(err))
        raise


async def main() -> None:
    _log.info("ComfyUI worker online - fila 'comfyui' @ %s, ComfyUI @ %s", REDIS_URL, COMFYUI_URL)
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
        _log.info("encerrando...")

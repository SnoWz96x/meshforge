"""Cliente HTTP/WebSocket mínimo para a API do ComfyUI."""
from __future__ import annotations

import json
import urllib.parse
import uuid
from typing import Callable

import requests
import websocket  # websocket-client


class ComfyUIClient:
    def __init__(self, base_url: str = "http://localhost:8188") -> None:
        self.base_url = base_url.rstrip("/")
        self.client_id = str(uuid.uuid4())

    def submit(self, graph: dict) -> str:
        """Enfileira um workflow (formato API) e devolve o prompt_id."""
        resp = requests.post(
            f"{self.base_url}/prompt",
            json={"prompt": graph, "client_id": self.client_id},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["prompt_id"]

    def wait(
        self,
        prompt_id: str,
        on_progress: Callable[[int], None] | None = None,
        timeout: int = 1800,
    ) -> None:
        """Acompanha a execução via WebSocket até o prompt terminar.

        Mapeia as mensagens 'progress' (steps do sampler) para 0-100.
        timeout maior cobre a 1ª geração 3D (compilação MIOpen ~8min).
        """
        ws_url = f"{self.base_url.replace('http', 'ws')}/ws?clientId={self.client_id}"
        ws = websocket.create_connection(ws_url, timeout=timeout)
        try:
            while True:
                raw = ws.recv()
                if not isinstance(raw, str):
                    continue
                msg = json.loads(raw)
                mtype = msg.get("type")
                data = msg.get("data", {})
                if mtype == "progress" and on_progress:
                    value, maximum = data.get("value", 0), data.get("max", 1) or 1
                    on_progress(int(value / maximum * 100))
                elif mtype == "execution_error" and data.get("prompt_id") == prompt_id:
                    raise RuntimeError(
                        f"ComfyUI execution_error: {data.get('exception_type')}: "
                        f"{data.get('exception_message')}"
                    )
                elif mtype == "execution_interrupted" and data.get("prompt_id") == prompt_id:
                    raise RuntimeError("ComfyUI execution_interrupted")
                elif mtype == "executing" and data.get("node") is None and data.get("prompt_id") == prompt_id:
                    return  # execução concluída
        finally:
            ws.close()

    def upload_image(self, data: bytes, filename: str) -> str:
        """Sobe uma imagem para o diretório de input do ComfyUI (img2img)."""
        resp = requests.post(
            f"{self.base_url}/upload/image",
            files={"image": (filename, data, "image/png")},
            data={"overwrite": "true"},
            timeout=60,
        )
        resp.raise_for_status()
        info = resp.json()
        name = info["name"]
        return f"{info['subfolder']}/{name}" if info.get("subfolder") else name

    def history(self, prompt_id: str) -> dict:
        resp = requests.get(f"{self.base_url}/history/{prompt_id}", timeout=30)
        resp.raise_for_status()
        return resp.json().get(prompt_id, {})

    def image_bytes(self, filename: str, subfolder: str, folder_type: str) -> bytes:
        params = urllib.parse.urlencode(
            {"filename": filename, "subfolder": subfolder, "type": folder_type}
        )
        resp = requests.get(f"{self.base_url}/view?{params}", timeout=60)
        resp.raise_for_status()
        return resp.content

    def first_output_image(self, prompt_id: str) -> tuple[str, str, str]:
        """Retorna (filename, subfolder, type) da primeira imagem de saída."""
        outputs = self.history(prompt_id).get("outputs", {})
        for node in outputs.values():
            for img in node.get("images", []):
                return img["filename"], img.get("subfolder", ""), img.get("type", "output")
        raise RuntimeError("Nenhuma imagem de saída encontrada no histórico do ComfyUI")

#!/usr/bin/env python3
"""MeshForge model-manager.

Baixa, verifica e registra os modelos de IA declarados em models.config.json,
usando o HuggingFace Hub. Mantém um registro local (registry.json) no mesmo
espírito do manifest.lock.json do tool-manager.

Uso:
    python model_manager.py list
    python model_manager.py status
    python model_manager.py download [--group sdxl|hunyuan3d] [--only NAME] [--required-only]
    python model_manager.py verify
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Caminhos -------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[2]
AUX = REPO_ROOT / "auxiliary-tools"
CONFIG_PATH = Path(__file__).resolve().parent / "models.config.json"
REGISTRY_PATH = AUX / "models" / "registry.json"

# Cache do HuggingFace dentro de auxiliary-tools (precisa vir antes do import).
os.environ.setdefault("HF_HOME", str(AUX / "cache"))

# Console do Windows costuma ser cp1252; força UTF-8 para os símbolos da saída.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass


def _hf():
    try:
        from huggingface_hub import hf_hub_download, snapshot_download
    except ImportError:
        sys.exit(
            "✗ huggingface_hub não instalado.\n"
            "  Instale as dependências: pip install -r requirements.txt"
        )
    return hf_hub_download, snapshot_download


# Utilidades -----------------------------------------------------------------
def load_catalog() -> list[dict]:
    data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return data["models"]


def load_registry() -> dict:
    if REGISTRY_PATH.exists():
        return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    return {"schemaVersion": 1, "updatedAt": None, "models": {}}


def save_registry(reg: dict) -> None:
    reg["updatedAt"] = datetime.now(timezone.utc).isoformat()
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY_PATH.write_text(json.dumps(reg, indent=2) + "\n", encoding="utf-8")


def dir_size(path: Path) -> int:
    if path.is_file():
        return path.stat().st_size
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


def fmt_gb(b: int) -> str:
    return f"{b / 1e9:.2f} GB"


def select(models: list[dict], group: str | None, only: str | None,
           required_only: bool) -> list[dict]:
    out = models
    if group:
        out = [m for m in out if m.get("group") == group]
    if only:
        out = [m for m in out if m["name"] == only]
    if required_only:
        out = [m for m in out if m.get("required")]
    return out


# Comandos -------------------------------------------------------------------
def cmd_list(_args) -> None:
    reg = load_registry()
    print("Modelos no catálogo:\n")
    total = 0.0
    for m in load_catalog():
        installed = "✓" if m["name"] in reg["models"] else " "
        req = "obrigatório" if m.get("required") else "opcional"
        total += m.get("approxSizeGB", 0) if m.get("required") else 0
        print(f"  [{installed}] {m['name']:<22} {m['group']:<10} ~{m.get('approxSizeGB', '?')} GB  ({req})")
        print(f"        {m['description']}")
    print(f"\nDownload obrigatório aproximado: ~{total:.1f} GB")


def cmd_status(_args) -> None:
    reg = load_registry()
    if not reg["models"]:
        print("Nenhum modelo instalado ainda. Rode: python model_manager.py download")
        return
    print(f"Registro: {REGISTRY_PATH}\n")
    for name, info in reg["models"].items():
        print(f"  ✓ {name:<22} {fmt_gb(info['sizeBytes'])}  @ {info['target']}  ({info['installedAt'][:10]})")


def cmd_download(args) -> None:
    hf_hub_download, snapshot_download = _hf()
    token = os.environ.get("HF_TOKEN") or None
    catalog = load_catalog()
    chosen = select(catalog, args.group, args.only, args.required_only)
    if not chosen:
        print("Nenhum modelo corresponde ao filtro.")
        return

    approx = sum(m.get("approxSizeGB", 0) for m in chosen)
    print(f"▸ {len(chosen)} modelo(s) selecionado(s), ~{approx:.1f} GB no total.\n")

    reg = load_registry()
    for m in chosen:
        target = AUX / m["target"]
        target.mkdir(parents=True, exist_ok=True)
        print(f"▸ {m['name']}  ({m['repoId']})  →  {m['target']}")
        try:
            if m.get("allowPatterns"):
                snapshot_download(
                    repo_id=m["repoId"],
                    revision=m.get("revision", "main"),
                    allow_patterns=m["allowPatterns"],
                    local_dir=str(target),
                    token=token,
                )
                files = m["allowPatterns"]
            else:
                for fname in m["files"]:
                    hf_hub_download(
                        repo_id=m["repoId"],
                        filename=fname,
                        revision=m.get("revision", "main"),
                        local_dir=str(target),
                        token=token,
                    )
                files = m["files"]
            size = dir_size(target)
            reg["models"][m["name"]] = {
                "repoId": m["repoId"],
                "revision": m.get("revision", "main"),
                "target": m["target"],
                "files": files,
                "sizeBytes": size,
                "installedAt": datetime.now(timezone.utc).isoformat(),
            }
            save_registry(reg)
            print(f"  ✓ {m['name']} pronto ({fmt_gb(size)})\n")
        except Exception as err:  # noqa: BLE001
            print(f"  ✗ {m['name']}: {err}\n", file=sys.stderr)

    print(f"✅ Registro atualizado: {REGISTRY_PATH}")


def cmd_verify(_args) -> None:
    reg = load_registry()
    ok = True
    for name, info in reg["models"].items():
        target = AUX / info["target"]
        if not target.exists():
            print(f"  ✗ {name}: caminho ausente ({info['target']})")
            ok = False
            continue
        size = dir_size(target)
        drift = abs(size - info["sizeBytes"]) > 1024 * 1024  # 1 MB de tolerância
        print(f"  {'✓' if not drift else '⚠'} {name}: {fmt_gb(size)}"
              f"{'' if not drift else ' (tamanho divergente do registro)'}")
        ok = ok and not drift
    print("\n✅ Integridade OK" if ok else "\n⚠ Divergências encontradas")
    sys.exit(0 if ok else 1)


def main() -> None:
    parser = argparse.ArgumentParser(prog="model-manager", description="Gerenciador de modelos de IA do MeshForge")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="Lista o catálogo de modelos").set_defaults(func=cmd_list)
    sub.add_parser("status", help="Mostra o que está instalado").set_defaults(func=cmd_status)

    dl = sub.add_parser("download", help="Baixa modelos")
    dl.add_argument("--group", choices=["sdxl", "hunyuan3d"], help="Filtra por grupo")
    dl.add_argument("--only", help="Baixa apenas o modelo com este nome")
    dl.add_argument("--required-only", action="store_true", help="Apenas modelos obrigatórios")
    dl.set_defaults(func=cmd_download)

    sub.add_parser("verify", help="Revalida integridade").set_defaults(func=cmd_verify)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

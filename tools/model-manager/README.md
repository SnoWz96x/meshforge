# model-manager

Gerencia os **modelos de IA** do MeshForge: baixa do HuggingFace, verifica e
registra. Análogo ao `tool-manager` (que cuida das *ferramentas*), mas para
*checkpoints*. Catálogo declarativo em [`models.config.json`](models.config.json).

## Uso

```bash
# venv (1ª vez)
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# .venv/bin/python  -m pip install -r requirements.txt    # Linux

# comandos
python model_manager.py list                 # catálogo + o que está instalado
python model_manager.py download             # baixa tudo (obrigatórios + opcionais)
python model_manager.py download --required-only
python model_manager.py download --group sdxl
python model_manager.py download --only sdxl-vae-fp16-fix
python model_manager.py status               # o que já está instalado
python model_manager.py verify               # revalida integridade
```

## Onde os modelos vão parar

Tudo dentro de `auxiliary-tools/` (fora do git):

```
auxiliary-tools/
├── models/
│   ├── sdxl/checkpoints/   sd_xl_base_1.0.safetensors
│   ├── sdxl/vae/           sdxl_vae.safetensors
│   ├── hunyuan3d/          hunyuan3d-dit/vae/paint
│   └── registry.json       ← registro do que foi baixado (VERSIONADO? não, é gerado)
└── cache/                  HF_HOME (cache do HuggingFace)
```

## Catálogo (resumo)

| Modelo | Grupo | ~Tamanho | Obrigatório |
| :-- | :-- | --: | :-: |
| `sdxl-base-1.0` | sdxl | 6.9 GB | ✅ |
| `sdxl-vae-fp16-fix` | sdxl | 0.3 GB | ✅ |
| `sdxl-refiner-1.0` | sdxl | 6.1 GB | — |
| `hunyuan3d-2` | hunyuan3d | 12 GB | ✅ |

> **Nota TLS/antivírus:** se o `pip`/download falhar com *self-signed certificate*,
> instale `pip-system-certs` no venv (faz o Python confiar na loja de certificados
> do Windows). O `install.ps1` já faz isso automaticamente.

## Token HuggingFace

Modelos *gated* exigem aceitar a licença no site e exportar `HF_TOKEN` no `.env`.

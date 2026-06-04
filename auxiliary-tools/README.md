# auxiliary-tools

Esta pasta é **gerenciada automaticamente** pelo `tool-manager`. Seu conteúdo
(exceto este README e o `manifest.lock.json`) **não é versionado no git**.

```
auxiliary-tools/
├── comfyui/            # git clone (pinned)  — runtime de GPU (SDXL + Hunyuan3D)
├── hunyuan3d/          # git clone (pinned)  — image/text -> 3D
├── blender/            # binário (release)   — retopo, UV, bake, export
├── instant-meshes/     # binário (release)   — retopologia
├── models/             # checkpoints de IA (model-manager)
│   ├── sdxl/
│   ├── hunyuan3d/
│   └── loras/
├── downloads/          # área temporária de download
├── cache/              # cache HuggingFace/torch (HF_HOME)
└── manifest.lock.json  # versões/commits/hashes instalados (VERSIONADO)
```

## Comandos

```bash
pnpm tools:install   # clona/baixa e fixa todas as ferramentas
pnpm tools:check     # reporta versões mais novas (não aplica)
pnpm tools:verify    # revalida integridade do que está instalado
```

A política é **pin + verify + update sob confirmação** — nunca auto-update cego.

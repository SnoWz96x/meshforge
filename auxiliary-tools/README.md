# auxiliary-tools

Esta pasta é **gerenciada automaticamente** pelo `tool-manager`. Seu conteúdo
(exceto este README e o `manifest.lock.json`) **não é versionado no git**.

```
auxiliary-tools/
├── comfyui/            # git clone (pinned)  — runtime de GPU (SDXL + Hunyuan3D)
├── hunyuan3d/          # git clone (pinned)  — image/multiview/text -> 3D
├── blender/            # binário (release)   — cleanup/decimate/remesh/texfix + export
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
pnpm tools:install            # clona/baixa e fixa todas as ferramentas
pnpm tools:check              # reporta versões mais novas (não aplica)
pnpm tools:verify             # revalida integridade do que está instalado
pnpm tools:update             # simulação (mostra o que mudaria; não aplica)
pnpm tools:update -- --yes              # aplica em todas as git tools
pnpm tools:update -- comfyui --yes      # aplica só numa (use --force p/ árvore suja)
```

A política é **pin + verify + update sob confirmação** — nunca auto-update cego. O `update`
atualiza git tools para a ponta do `trackRef` com **rollback** em falha e **não sobrescreve
árvore suja** (protege patches locais como o do ZLUDA). Binários *release* (Blender) ficam
fixados por versão no manifesto.

# Contributing to MeshForge

Thanks for your interest in MeshForge — a self-hosted, 100% open-source pipeline that turns a
prompt or image into a textured, production-ready 3D asset on your own GPU.

This document describes how we work on this repo. Please read it before opening an issue or a pull
request. It is short on purpose, but every rule here is enforced (by CI or by review).

> MeshForge is released under the **GNU AGPL-3.0**. By contributing, you agree that your
> contributions are licensed under the same terms. Note that the integrated models (SDXL, Hunyuan3D)
> carry their **own licenses** with usage restrictions — review them before any commercial use.

---

## Ground rules (non-negotiable)

These three principles are the spine of the project. A change that violates any of them will not be
merged, no matter how good it looks.

1. **Additive changes only.** Never break or remove an existing, working feature to add a new one.
   If a refactor is unavoidable, keep the existing behavior intact and call it out explicitly in the PR.
2. **Zero placeholders, zero fakes.** Do not submit mocked data, stubbed responses, or "it should
   work" code. Everything must be **validated end-to-end** — actually run it, render it, inspect the
   output — before you claim it works. This is an AI/3D pipeline; a green type-check is not proof.
3. **Honest reporting.** If something is half-done, flaky, or broken, say so in the PR. Do not invent
   success. A documented limitation is welcome; a hidden one is not.

---

## Prerequisites

You need a working GPU pipeline to validate non-trivial changes. See
[RUNBOOK.md](RUNBOOK.md) for the full setup and launchers.

- **Node 20+** and **pnpm 9** (`packageManager` pins `pnpm@9.12.0`).
- **Docker Desktop** (Postgres + Redis + MinIO via `infra/docker-compose.yml`).
- **Python 3.10/3.11** for the compute plane (`services/comfyui-service`, `services/blender-service`).
- A **GPU + runtime**: AMD via **HIP SDK + ZLUDA**, or NVIDIA via **CUDA**.
- **ComfyUI** (with the Hunyuan3D wrapper), **Blender** and the models are managed under
  `auxiliary-tools/` (git-ignored, rebuilt from `manifest.lock.json` via the tool/model managers).

### Bootstrap

```bash
pnpm install
pnpm infra:up                 # Postgres + Redis (+ MinIO)
pnpm db:generate && pnpm db:migrate
pnpm tools:verify             # check the managed tools/models
```

Bring the engine and app up in order (ComfyUI → API → Python worker → web) as documented in
[RUNBOOK.md](RUNBOOK.md).

---

## Architecture you must respect

MeshForge has a deliberate split — keep it.

- **Control plane (TypeScript):** `apps/web` (Next.js), `apps/api` (NestJS),
  `packages/{shared-types,db,queue,storage}`.
- **Compute plane (Python/GPU):** `services/comfyui-service` (SDXL · Hunyuan3D · texture · rembg),
  `services/blender-service` (`export_mesh.py`, `process_mesh.py`).

Hard rules:

- **The Python worker is stateless and must never touch the database.** It reads inputs from storage
  and writes outputs back. The **API** reflects queue events into Postgres — that is the only writer.
- Data flows **Web → API → queue (Redis/BullMQ) → Worker → ComfyUI/GPU → storage → API → DB**, with
  real-time progress over Redis pub/sub → WebSocket. Don't shortcut this path.
- Shared contracts live in `packages/shared-types`. Changing a type there can break both `api` and
  `web` — update all consumers in the same PR.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full picture.

---

## Before every commit / PR

Run the **full** local gate. The CI enforces **Prettier *and* ESLint** — passing lint alone is not
enough.

```bash
pnpm format:check     # Prettier — CI fails on unformatted .ts/.tsx
pnpm lint             # ESLint (flat config)
pnpm -r typecheck     # TypeScript across all packages
pnpm test             # Vitest
```

And for the compute plane, when you touched Python:

```bash
# in services/comfyui-service
pytest
```

If you only fixed formatting, use `pnpm format` to auto-fix, then re-run `format:check`.

---

## Commit conventions

We use **[Conventional Commits](https://www.conventionalcommits.org/)** with a scope. Match the
existing history.

```
<type>(<scope>): <imperative summary>
```

- **Types:** `feat`, `fix`, `docs`, `style`, `chore`, `refactor`, `test`, `perf`.
- **Common scopes:** `texture`, `3d`, `pipeline`, `blender`, `generate`, `gallery`, `ui`, `tools`,
  `export`, `quality`, `ops`, `db`.

Examples from the project:

```
feat(texture): automatic texture adjustment (texfix op, hue-preserving)
fix(polish): correct stale/incorrect texts after features (QA regression)
style: prettier on the generate screen (fixes CI format:check)
docs: align README and remaining docs to the real state
```

Other rules:

- Keep commits focused; one logical change per commit.
- If you used an AI assistant, credit it with a trailer, e.g.
  `Co-Authored-By: <Name> <email>` (this is the convention used in this repo's history).
- **Don't push to `main` on someone else's behalf.** The maintainer commits directly to `main`;
  external contributors should **fork and open a PR** against `main`.

---

## Pull requests

A good PR:

1. States **what** changed and **why**, and confirms it is **additive** (nothing existing broke).
2. Includes the **end-to-end validation** you ran (commands, what you observed, screenshots/renders
   for visual/3D changes — a textured render says more than a log line).
3. Passes the full local gate above (`format:check`, `lint`, `typecheck`, `test`, and `pytest` when
   relevant). CI must be green.
4. Updates the **governance docs** when behavior or scope changes:
   [REQUIREMENTS_TRACKING.md](REQUIREMENTS_TRACKING.md), [ROADMAP.md](ROADMAP.md),
   [CHANGELOG.md](CHANGELOG.md), [ARCHITECTURE.md](ARCHITECTURE.md), [RUNBOOK.md](RUNBOOK.md).
5. Touches secrets **never** — see below.

---

## Code style

- **TypeScript:** Prettier (`.prettierrc.json`) + ESLint flat config (`eslint.config.mjs`) are the
  source of truth. Don't hand-format against them; run `pnpm format`.
- **Python:** keep the worker code readable and tested with `pytest`; follow the patterns already in
  `services/comfyui-service`.
- **PowerShell (`tools/bootstrap`, launchers):** save `.ps1` files as **UTF-8 with BOM**. Without the
  BOM, accented paths (e.g. `Área`, `Programação`) corrupt under Windows PowerShell 5.1.

---

## Security & secrets

- **Never commit secrets, API keys, tokens, or `.env` files.** Use `.env.example`-style placeholders
  and document variable *names*, never values.
- Optional integrations are key-gated (e.g. `POLY_PIZZA_KEY`) — keep them opt-in and unset by default.
- If you find a vulnerability, please report it privately to the maintainer rather than opening a
  public issue.

---

## Environment gotchas (save yourself time)

These are real, repo-specific quirks documented in the project memory:

- **Postgres port:** a native Postgres may already own `5432`. Our container uses **`5433`**.
  `packages/db` has no own `.env` → pass `DATABASE_URL` in the environment when running migrations.
- **ZLUDA is fragile.** On AMD, each new GPU load can surface a crash (rocBLAS/cuDNN/MIOpen). Test
  incrementally; the first multiview generation can take ~20 min while kernels compile.
- **TLS/pip:** if your machine does TLS inspection, pip/HuggingFace downloads break — use
  `pip-system-certs` in each venv.
- **Restart after changes:** after editing TS, restart the API; after editing `worker.py`, restart the
  worker (it reads the code at boot).

---

## Reporting issues

- For **bugs**, include: hardware/GPU + runtime (AMD/ZLUDA or NVIDIA/CUDA), OS, the exact step in the
  pipeline, logs, and what you expected vs got.
- For **features**, check [ROADMAP.md](ROADMAP.md) first — some items are intentionally open (e.g. pure
  quad retopology, native GPU rasterizer Backend B) and others are out of scope for now.

---

<div align="center">
<sub>Forge meshes, not boilerplate. ⚙️🔥</sub>
</div>

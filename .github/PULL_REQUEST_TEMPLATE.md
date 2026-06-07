<!-- Read CONTRIBUTING.md before opening this PR. -->

## What & why

<!-- What does this change, and why? -->

## Type

- [ ] feat
- [ ] fix
- [ ] docs
- [ ] refactor / chore / style / perf / test

## Checklist

- [ ] **Additive** — no existing, working feature was broken or removed
- [ ] **No placeholders/fakes** — validated **end-to-end** (ran it, rendered it, inspected the output)
- [ ] `pnpm format:check` passes (CI enforces Prettier _and_ ESLint)
- [ ] `pnpm lint` passes
- [ ] `pnpm -r typecheck` passes
- [ ] `pnpm test` passes (+ `pytest` in `services/comfyui-service` if Python changed)
- [ ] Governance docs updated when behavior/scope changed (REQUIREMENTS_TRACKING / ROADMAP / CHANGELOG / ARCHITECTURE / RUNBOOK)
- [ ] No secrets, keys, or `.env` files committed

## End-to-end validation

<!-- The commands you ran and what you observed. For visual/3D changes, attach a render or screenshot. -->

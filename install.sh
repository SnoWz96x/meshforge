#!/usr/bin/env bash
# Bootstrap do MeshForge (Linux/WSL2/macOS). Equivalente ao install.ps1.
set -euo pipefail
cd "$(dirname "$0")"

SKIP_TOOLS=0
SKIP_MODELS=0
for arg in "$@"; do
  case "$arg" in
    --skip-tools) SKIP_TOOLS=1 ;;
    --skip-models) SKIP_MODELS=1 ;;
  esac
done

step() { printf '\n=== %s ===\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

step "1/6 Verificando pré-requisitos"
missing=()
for c in node pnpm docker git python3; do
  if have "$c"; then echo "  ✓ $c"; else echo "  ✗ $c (faltando)"; missing+=("$c"); fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "Pré-requisitos faltando: ${missing[*]}"; exit 1
fi

step "2/6 Configurando .env"
if [ ! -f .env ]; then cp .env.example .env; echo "  ✓ .env criado"; else echo "  ↪ .env já existe"; fi

step "3/6 Instalando dependências (pnpm)"
pnpm install

step "4/6 Subindo infraestrutura (Docker)"
docker compose -f infra/docker-compose.yml up -d
echo "  ↪ aguardando Postgres..."
for _ in $(seq 1 30); do
  if [ "$(docker inspect --format '{{.State.Health.Status}}' meshforge-postgres 2>/dev/null)" = "healthy" ]; then
    echo "  ✓ Postgres pronto"; break
  fi
  sleep 2
done

step "5/6 Preparando banco (Prisma)"
pnpm db:generate
pnpm --filter "@meshforge/db" exec prisma migrate deploy || echo "  ⚠ rode 'pnpm db:migrate' na 1ª vez"

step "6/6 Ferramentas externas e modelos"
if [ "$SKIP_TOOLS" -eq 1 ]; then echo "  ↪ pulando auxiliary-tools"; else pnpm tools:install; fi
if [ "$SKIP_MODELS" -eq 1 ]; then echo "  ↪ pulando modelos"; else echo "  ↪ model-manager (Fase 1)"; fi

echo -e "\n✅ Bootstrap concluído. Próximo: 'pnpm db:migrate' e 'pnpm dev'"

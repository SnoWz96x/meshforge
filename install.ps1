#Requires -Version 5.1
<#
.SYNOPSIS
  Bootstrap do MeshForge (Windows). Sobe infra, instala deps, prepara o banco.
.DESCRIPTION
  Etapas:
    1. Checa pré-requisitos (Node, pnpm, Docker, Git, Python)
    2. Cria .env a partir de .env.example
    3. Instala dependências do monorepo (pnpm)
    4. Sobe Postgres/Redis/MinIO (Docker)
    5. Gera o client Prisma e aplica migrations
    6. (opcional) Instala auxiliary-tools e baixa modelos
.PARAMETER SkipTools
  Não clona/baixa ComfyUI, Hunyuan3D, Blender (auxiliary-tools).
.PARAMETER SkipModels
  Não baixa checkpoints de IA (SDXL, Hunyuan3D).
#>
param(
  [switch]$SkipTools,
  [switch]$SkipModels
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Test-Cmd($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

Write-Step "1/6 Verificando pré-requisitos"
$missing = @()
foreach ($c in @("node", "pnpm", "docker", "git", "python")) {
  if (Test-Cmd $c) { Write-Host "  ✓ $c" -ForegroundColor Green }
  else { Write-Host "  ✗ $c (faltando)" -ForegroundColor Red; $missing += $c }
}
if ($missing.Count -gt 0) {
  throw "Pré-requisitos faltando: $($missing -join ', '). Instale-os e rode novamente."
}

Write-Step "2/6 Configurando .env"
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "  ✓ .env criado a partir de .env.example"
} else {
  Write-Host "  ↪ .env já existe, mantido"
}

Write-Step "3/6 Instalando dependências (pnpm)"
pnpm install
if ($LASTEXITCODE -ne 0) { throw "pnpm install falhou" }

Write-Step "4/6 Subindo infraestrutura (Docker)"
docker compose -f "infra/docker-compose.yml" up -d
if ($LASTEXITCODE -ne 0) { throw "docker compose up falhou (Docker Desktop está rodando?)" }
Write-Host "  ↪ aguardando Postgres ficar saudável..."
$tries = 0
do {
  Start-Sleep -Seconds 2
  $tries++
  $health = (docker inspect --format '{{.State.Health.Status}}' meshforge-postgres 2>$null)
} while ($health -ne "healthy" -and $tries -lt 30)
if ($health -ne "healthy") { Write-Host "  ⚠ Postgres não reportou healthy a tempo" -ForegroundColor Yellow }
else { Write-Host "  ✓ Postgres pronto" -ForegroundColor Green }

Write-Step "5/6 Preparando banco de dados (Prisma)"
pnpm db:generate
if ($LASTEXITCODE -ne 0) { throw "prisma generate falhou" }
pnpm --filter "@meshforge/db" exec prisma migrate deploy
if ($LASTEXITCODE -ne 0) { Write-Host "  ⚠ migrate deploy falhou (sem migrations ainda? rode 'pnpm db:migrate')" -ForegroundColor Yellow }

Write-Step "6/6 Ferramentas externas e modelos"
if ($SkipTools) {
  Write-Host "  ↪ --SkipTools: pulando auxiliary-tools"
} else {
  Write-Host "  ↪ instalando auxiliary-tools (ComfyUI, Hunyuan3D, Blender, Instant Meshes)..."
  pnpm tools:install
}
if ($SkipModels) {
  Write-Host "  ↪ --SkipModels: pulando download de checkpoints"
} else {
  Write-Host "  ↪ download de modelos será implementado pelo model-manager (Fase 1)" -ForegroundColor Yellow
}

Write-Host "`n✅ Bootstrap concluído." -ForegroundColor Green
Write-Host "   Infra:   Postgres :5432  Redis :6379  MinIO :9000 (console :9001)"
Write-Host "   Próximo: 'pnpm db:migrate' (1ª vez) e depois 'pnpm dev'"

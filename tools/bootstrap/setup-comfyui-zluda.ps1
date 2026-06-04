#Requires -Version 5.1
<#
.SYNOPSIS
  Configura o runtime do ComfyUI na AMD via ZLUDA (fork patientx/ComfyUI-Zluda).
.DESCRIPTION
  Para GPUs AMD (ex.: RX 7800 XT / gfx1101) que não têm CUDA. Pré-requisitos que
  este script NÃO instala (precisam ser feitos antes — ver README do service):
    - AMD HIP SDK 6.4.2  (RX 6800/7000/9000 → HIP_PATH_64 = ...\ROCm\6.4\)
    - Python 3.11.9+
    - VS Build Tools + VC++ Runtime

  O ComfyUI-Zluda DEVE ficar num caminho ASCII de raiz (sem acento/espaço/OneDrive),
  por isso o destino padrão é C:\ComfyUI-Zluda — fora do repositório.
.PARAMETER ComfyDir
  Onde instalar o ComfyUI-Zluda (padrão C:\ComfyUI-Zluda).
.PARAMETER ModelsPath
  Pasta de modelos do MeshForge (auxiliary-tools/models) a ser apontada via
  extra_model_paths.yaml.
#>
param(
  [string]$ComfyDir = "C:\ComfyUI-Zluda",
  [string]$ModelsPath = (Join-Path (Resolve-Path "$PSScriptRoot\..\..") "auxiliary-tools\models")
)

$ErrorActionPreference = "Stop"
function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }

Step "1/4 Checando pré-requisitos"
$py311 = (py -0p 2>$null | Select-String "3.11")
if (-not $py311) { throw "Python 3.11 não encontrado. Instale antes (python.org)." }
Write-Host "  ✓ Python 3.11"
if (-not $env:HIP_PATH) {
  Write-Host "  ⚠ HIP_PATH não definido — o HIP SDK 6.4.2 foi instalado e a máquina reiniciou?" -ForegroundColor Yellow
} else {
  Write-Host "  ✓ HIP_PATH = $env:HIP_PATH"
}

Step "2/4 Clonando ComfyUI-Zluda"
if (Test-Path (Join-Path $ComfyDir ".git")) {
  Write-Host "  ↪ já existe em $ComfyDir"
} else {
  git clone https://github.com/patientx/ComfyUI-Zluda $ComfyDir
}

Step "3/4 Apontando para os modelos do MeshForge"
$yaml = @"
# Gerado por setup-comfyui-zluda.ps1 — usa os modelos já baixados pelo model-manager.
meshforge:
    base_path: "$ModelsPath"
    checkpoints: sdxl/checkpoints
    vae: sdxl/vae
"@
Set-Content -Path (Join-Path $ComfyDir "extra_model_paths.yaml") -Value $yaml -Encoding UTF8
Write-Host "  ✓ extra_model_paths.yaml → $ModelsPath"

Step "4/4 Instalando (install-n.bat — baixa ZLUDA + PyTorch, vários GB)"
Push-Location $ComfyDir
try {
  & cmd /c "install-n.bat"
} finally {
  Pop-Location
}

Write-Host "`n✅ Setup do ComfyUI-Zluda concluído." -ForegroundColor Green
Write-Host "   Suba o ComfyUI:  cd $ComfyDir ; .\comfyui-n.bat"
Write-Host "   Depois rode o worker em services/comfyui-service e gere uma imagem."

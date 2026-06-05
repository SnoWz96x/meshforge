<#
.SYNOPSIS
  ComfyUI (AMD/ZLUDA) supervisor - keeps the GPU runtime alive.

.DESCRIPTION
  ZLUDA is fragile: under repeated load (Hunyuan3D, batches) ComfyUI may crash
  with a segfault (exit 139). Without supervision the user only finds out when a
  generation fails and has to relaunch by hand.

  This script:
    1. Ensures ComfyUI is up at boot (launches it if needed).
    2. Health-checks http://localhost:8188/system_stats every -IntervalSec.
    3. After -FailThreshold consecutive failures, kills zombie processes
       (zluda.exe / python main.py) and relaunches via the launcher.
    4. Respects a grace period (-GraceSec) after each start so the boot
       (loading kernels/models) is not interrupted mid-way.

  It changes nothing in the pipeline - it only observes and relaunches.

  NOTE: run this in a NORMAL terminal window (not nested under a job-object /
  managed parent). The relaunch uses Start-Process so ComfyUI keeps running
  independently of this script; if the supervisor's own parent gets reaped by a
  job object, the launched ComfyUI could be reaped with it.

.PARAMETER Launcher
  Path of the validated .bat that starts ComfyUI.
  Default: C:\ComfyUI-Zluda\mf-run.bat (same config versioned in
  tools/bootstrap/comfyui-zluda-launch.bat).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\bootstrap\comfyui-supervisor.ps1

.EXAMPLE
  # more aggressive (check every 5s, relaunch after 2 failures):
  .\comfyui-supervisor.ps1 -IntervalSec 5 -FailThreshold 2
#>
#Requires -Version 5.1
[CmdletBinding()]
param(
    # Default: launcher de TEXTURA (HUNYUAN3D_TEXTURE_DEVICE=cpu). A env e inofensiva
    # para gerações sem textura (SDXL/shape nao usam o MeshRender) e garante que a
    # texturização continue funcionando se o ComfyUI cair e o supervisor religar.
    # Para o launcher sem textura, passe -Launcher "C:\ComfyUI-Zluda\mf-run.bat".
    [string]$Launcher      = "C:\ComfyUI-Zluda\mf-run-tex.bat",
    [string]$Url           = "http://localhost:8188/system_stats",
    [int]   $IntervalSec   = 10,
    [int]   $FailThreshold = 3,
    [int]   $GraceSec      = 90,
    [string]$LogFile       = ""
)

$ErrorActionPreference = "Continue"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    switch ($Level) {
        "ERROR" { Write-Host $line -ForegroundColor Red }
        "WARN"  { Write-Host $line -ForegroundColor Yellow }
        "OK"    { Write-Host $line -ForegroundColor Green }
        default { Write-Host $line -ForegroundColor Gray }
    }
    if ($LogFile) { try { Add-Content -Path $LogFile -Value $line -Encoding utf8 } catch {} }
}

function Test-Comfy {
    try {
        $r = Invoke-WebRequest -Uri $Url -TimeoutSec 4 -UseBasicParsing
        return ($r.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Stop-ComfyZombies {
    $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -eq 'zluda.exe' -or
        ($_.Name -eq 'python.exe' -and $_.CommandLine -like '*main.py*')
    }
    foreach ($p in $procs) {
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
            Write-Log ("Killed PID {0} ({1})" -f $p.ProcessId, $p.Name) "WARN"
        } catch {}
    }
}

function Start-Comfy {
    if (-not (Test-Path $Launcher)) {
        Write-Log "Launcher not found: $Launcher" "ERROR"
        return $false
    }
    Stop-ComfyZombies
    Start-Sleep -Seconds 2
    $dir = Split-Path -Parent $Launcher
    $bat = Split-Path -Leaf  $Launcher
    Write-Log "Starting ComfyUI ($bat)..."
    Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $bat) -WorkingDirectory $dir -WindowStyle Minimized | Out-Null
    return $true
}

# Poll up to $GraceSec for ComfyUI to answer; returns when up or grace expires.
function Wait-ComfyUp {
    $deadline = (Get-Date).AddSeconds($GraceSec)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 3
        if (Test-Comfy) {
            $waited = [int]($GraceSec - ($deadline - (Get-Date)).TotalSeconds)
            Write-Log "ComfyUI is up (after ~${waited}s)." "OK"
            return $true
        }
    }
    Write-Log "ComfyUI still not answering after ${GraceSec}s grace." "WARN"
    return $false
}

# ===== Main loop =============================================================
Write-Log "ComfyUI supervisor started (interval ${IntervalSec}s, threshold ${FailThreshold}, grace ${GraceSec}s)." "OK"
Write-Log "Target: $Url  |  Launcher: $Launcher"

if (Test-Comfy) {
    Write-Log "ComfyUI already up." "OK"
} else {
    Write-Log "ComfyUI down - starting..." "WARN"
    if (Start-Comfy) { Wait-ComfyUp | Out-Null }
}

$fails = 0
while ($true) {
    Start-Sleep -Seconds $IntervalSec

    if (Test-Comfy) {
        if ($fails -gt 0) { Write-Log "ComfyUI responded again (recovered)." "OK" }
        $fails = 0
        continue
    }

    $fails++
    Write-Log "No response from ComfyUI ($fails/$FailThreshold)." "WARN"

    if ($fails -ge $FailThreshold) {
        Write-Log "Threshold reached - restarting ComfyUI." "ERROR"
        if (Start-Comfy) { Wait-ComfyUp | Out-Null }
        $fails = 0
    }
}

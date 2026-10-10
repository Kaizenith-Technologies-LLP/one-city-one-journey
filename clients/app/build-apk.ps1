<#
.SYNOPSIS
  Builds the One Journey release APK and copies it to <repo>\dist\.

.PARAMETER ApiBase
  API base URL baked into the APK, e.g. http://192.168.1.70:4000/api.
  If omitted, the PC's LAN IPv4 (physical Wi-Fi/Ethernet adapter with a default gateway) is detected.

.PARAMETER Emulator
  Build for the Android emulator: uses the app default (http://10.0.2.2:4000/api) and names the output one-journey-emulator.apk.

.PARAMETER Flutter
  Path to flutter.bat. Defaults to flutter on PATH, else C:\src\flutter\bin\flutter.bat.

.EXAMPLE
  .\build-apk.ps1
  .\build-apk.ps1 -ApiBase http://192.168.1.70:4000/api
  .\build-apk.ps1 -Emulator
#>
param(
    [string]$ApiBase,
    [switch]$Emulator,
    [string]$Flutter
)

$ErrorActionPreference = 'Stop'
$appDir = $PSScriptRoot
$distDir = Join-Path (Resolve-Path (Join-Path $appDir '..\..')) 'dist'

if (-not $Flutter) {
    $cmd = Get-Command flutter -ErrorAction SilentlyContinue
    $Flutter = if ($cmd) { $cmd.Source } else { 'C:\src\flutter\bin\flutter.bat' }
}
if (-not (Test-Path $Flutter)) { throw "Flutter not found at '$Flutter'. Pass -Flutter <path to flutter.bat>." }

function Get-LanIPv4 {
    $cfg = Get-NetIPConfiguration |
        Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' -and -not $_.NetAdapter.Virtual } |
        Where-Object { $_.IPv4Address.IPAddress -notlike '169.254.*' } |
        Select-Object -First 1
    if (-not $cfg) { throw 'Could not detect a LAN IPv4 address. Pass -ApiBase http://<ip>:4000/api.' }
    return $cfg.IPv4Address[0].IPAddress
}

$defines = @()
if ($Emulator) {
    $outName = 'one-journey-emulator.apk'
    $label = 'http://10.0.2.2:4000/api (app default)'
} else {
    if (-not $ApiBase) { $ApiBase = "http://$(Get-LanIPv4):4000/api" }
    $hostPart = ([uri]$ApiBase).Host
    $outName = "one-journey-lan-$hostPart.apk"
    $defines += "--dart-define=API_BASE=$ApiBase"
    $label = $ApiBase
}

Write-Host "Building release APK with API_BASE = $label" -ForegroundColor Cyan
Push-Location $appDir
try {
    & $Flutter build apk --release @defines
    if ($LASTEXITCODE -ne 0) { throw "flutter build apk failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

$apk = Join-Path $appDir 'build\app\outputs\flutter-apk\app-release.apk'
New-Item -ItemType Directory -Force $distDir | Out-Null
$dest = Join-Path $distDir $outName
Copy-Item $apk $dest -Force
$sizeMb = [math]::Round((Get-Item $dest).Length / 1MB, 1)
Write-Host "APK: $dest ($sizeMb MB)" -ForegroundColor Green
Write-Host "API_BASE: $label"

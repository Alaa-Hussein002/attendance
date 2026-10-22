# Bayt Al Mosawer — one-command installer (Windows / PowerShell)
param([string]$AppDir = "C:\baytalmosawer", [string]$Version = "latest")

$ErrorActionPreference = "Stop"
Write-Host "==> Installing Bayt Al Mosawer into $AppDir"
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
Set-Location $AppDir

if (-not (Test-Path docker-compose.yml)) {
  Write-Host "==> Downloading docker-compose.yml"
  Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/baytalmosawer/attendance/main/deploy/docker-compose.yml" -OutFile docker-compose.yml
}

if (-not (Test-Path .env)) {
  $db = -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
  $jwt = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
  @"
DB_PASSWORD=$db
JWT_SECRET=$jwt
APP_VERSION=$Version
PUBLIC_API_URL=http://localhost:3000
"@ | Set-Content .env
  Write-Host "   .env created. Add SMTP_* settings, then re-run."
}

Write-Host "==> Pulling images"
docker compose pull
Write-Host "==> Starting"
docker compose up -d

Write-Host ""
Write-Host "Bayt Al Mosawer is starting. Open http://localhost:3000 in a few seconds."

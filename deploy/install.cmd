@echo off
REM Bayt Al Mosawer - One-Click Installer (Windows)
REM Double-click this file. It does everything and opens the browser.
setlocal EnableDelayedExpansion
title Bayt Al Mosawer Installer

echo.
echo  ============================================
echo   Bayt Al Mosawer - One-Click Installer
echo  ============================================
echo.

REM --- 1. Check Docker ---
where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker is not installed.
  echo         Download Docker Desktop: https://www.docker.com/products/docker-desktop
  echo         Then re-run this installer.
  pause
  exit /b 1
)

REM --- 2. Prepare directory ---
set "APPDIR=%USERPROFILE%\BaytAlMosawer"
if not exist "%APPDIR%" mkdir "%APPDIR%"
cd /d "%APPDIR%"
echo [OK] Install directory: %APPDIR%

REM --- 3. Download docker-compose.yml if missing ---
if not exist "docker-compose.yml" (
  echo [..] Downloading docker-compose.yml ...
  powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/baytalmosawer/attendance/main/deploy/docker-compose.yml' -OutFile 'docker-compose.yml'" 2>nul
  if not exist "docker-compose.yml" (
    echo [ERROR] Could not download docker-compose.yml. Check your internet.
    pause
    exit /b 1
  )
)
echo [OK] docker-compose.yml ready

REM --- 4. Create .env if missing ---
if not exist ".env" (
  echo [..] Generating .env with random secrets ...
  for /f "delims=" %%a in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')"') do set "DBP=%%a"
  for /f "delims=" %%a in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')"') do set "JWTS=%%a"
  (
    echo DB_PASSWORD=!DBP!
    echo JWT_SECRET=!JWTS!
    echo APP_VERSION=latest
    echo PUBLIC_API_URL=http://localhost:3000
    echo VENDOR_URL=https://baytalmosawer.com
  ) > .env
  echo [OK] .env created with random secrets
  echo      Edit .env later to add SMTP_* and LICENSE_PUBLIC_KEY
) else (
  echo [OK] .env already exists
)

REM --- 5. Pull images ---
echo.
echo [..] Pulling Docker images (this may take a few minutes) ...
docker compose pull
if errorlevel 1 (
  echo [ERROR] Failed to pull images. Check Docker is running.
  pause
  exit /b 1
)
echo [OK] Images pulled

REM --- 6. Start services ---
echo.
echo [..] Starting services ...
docker compose up -d
if errorlevel 1 (
  echo [ERROR] Failed to start services.
  pause
  exit /b 1
)
echo [OK] Services started

REM --- 7. Wait for API to be ready ---
echo.
echo [..] Waiting for the system to be ready ...
set "READY=0"
for /l %%i in (1,1,30) do (
  if "!READY!"=="0" (
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/meta' -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" 2>nul
    if not errorlevel 1 set "READY=1"
    if "!READY!"=="0" timeout /t 2 /nobreak >nul
  )
)
if "!READY!"=="1" (
  echo [OK] System is ready!
) else (
  echo [WARN] System may still be starting. Opening browser anyway ...
)

REM --- 8. Open browser ---
echo.
echo [..] Opening browser ...
start "" "http://localhost:3000"

echo.
echo  ============================================
echo   Installation complete!
echo   Open http://localhost:3000 in your browser.
echo   Complete the setup wizard, then visit
echo   Subscription page for your installation ID.
echo  ============================================
echo.
echo Press any key to close this window ...
pause >nul

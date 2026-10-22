#!/usr/bin/env bash
# Bayt Al Mosawer - One-Click Installer (Linux / macOS)
# Usage: curl -fsSL https://raw.githubusercontent.com/baytalmosawer/attendance/main/deploy/install.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/baytalmosawer}"
VERSION="${VERSION:-latest}"

echo "============================================"
echo "  Bayt Al Mosawer - One-Click Installer"
echo "============================================"
echo

# --- 1. Check Docker ---
if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] Docker is not installed."
  echo "        Install Docker: https://docs.docker.com/get-docker/"
  echo "        Then re-run this installer."
  exit 1
fi
echo "[OK] Docker found"

# --- 2. Prepare directory ---
mkdir -p "$APP_DIR"
cd "$APP_DIR"
echo "[OK] Install directory: $APP_DIR"

# --- 3. Download docker-compose.yml if missing ---
if [ ! -f docker-compose.yml ]; then
  echo "[..] Downloading docker-compose.yml ..."
  curl -fsSL "https://raw.githubusercontent.com/baytalmosawer/attendance/main/deploy/docker-compose.yml" -o docker-compose.yml
fi
echo "[OK] docker-compose.yml ready"

# --- 4. Create .env if missing ---
if [ ! -f .env ]; then
  echo "[..] Generating .env with random secrets ..."
  DBP="$(openssl rand -hex 16)"
  JWTS="$(openssl rand -hex 32)$(openssl rand -hex 32)"
  cat > .env <<EOF
DB_PASSWORD=$DBP
JWT_SECRET=$JWTS
APP_VERSION=$VERSION
PUBLIC_API_URL=http://localhost:3000
EOF
  echo "[OK] .env created with random secrets"
  echo "     Edit .env later to add SMTP_* settings"
else
  echo "[OK] .env already exists"
fi

# --- 5. Pull images ---
echo
echo "[..] Pulling Docker images (this may take a few minutes) ..."
docker compose pull
echo "[OK] Images pulled"

# --- 6. Start services ---
echo
echo "[..] Starting services ..."
docker compose up -d
echo "[OK] Services started"

# --- 7. Wait for API to be ready ---
echo
echo "[..] Waiting for the system to be ready ..."
READY=0
for i in $(seq 1 30); do
  if [ "$READY" = "0" ]; then
    if curl -fsS http://localhost:3000/meta >/dev/null 2>&1; then
      READY=1
    else
      sleep 2
    fi
  fi
done
if [ "$READY" = "1" ]; then
  echo "[OK] System is ready!"
else
  echo "[WARN] System may still be starting. Opening browser anyway ..."
fi

# --- 8. Open browser ---
echo
echo "[..] Opening browser ..."
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:3000" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open "http://localhost:3000"
fi

echo
echo "============================================"
echo "  Installation complete!"
echo "  Open http://localhost:3000 in your browser."
echo "  Complete the setup wizard to start using"
echo "  the system."
echo "============================================"

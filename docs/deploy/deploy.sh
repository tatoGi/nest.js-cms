#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Enterprise Georgia (gedc) — Pull, build, migrate, and restart all services.
# Run as root or a user with sudo access to systemctl.
# Start order: backend → (10 s) → cms → (5 s) → website
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKEND_DIR="/opt/gedc/backend"
CMS_DIR="/opt/gedc/cms"
WEBSITE_DIR="/opt/gedc/website"
APP_USER="gedc"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

log() { echo "[${TIMESTAMP}] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# ── Pull latest code ──────────────────────────────────────────────────────────
log "Pulling backend..."
cd "${BACKEND_DIR}"
sudo -u "${APP_USER}" git fetch --all
sudo -u "${APP_USER}" git reset --hard origin/main

log "Pulling CMS..."
cd "${CMS_DIR}"
sudo -u "${APP_USER}" git fetch --all
sudo -u "${APP_USER}" git reset --hard origin/main

log "Pulling website..."
cd "${WEBSITE_DIR}"
sudo -u "${APP_USER}" git fetch --all
sudo -u "${APP_USER}" git reset --hard origin/main

# ── Build backend ─────────────────────────────────────────────────────────────
log "Installing backend dependencies..."
cd "${BACKEND_DIR}"
sudo -u "${APP_USER}" npm ci --omit=dev

log "Compiling backend (TypeScript → dist/)..."
sudo -u "${APP_USER}" npm run build

# ── Database migration ────────────────────────────────────────────────────────
log "Running Prisma migrations..."
cd "${BACKEND_DIR}"
sudo -u "${APP_USER}" npx prisma migrate deploy

# ── Build CMS ─────────────────────────────────────────────────────────────────
log "Installing CMS dependencies..."
cd "${CMS_DIR}"
sudo -u "${APP_USER}" npm ci

log "Building CMS (Next.js)..."
sudo -u "${APP_USER}" npm run build

# ── Build website ─────────────────────────────────────────────────────────────
log "Installing website dependencies..."
cd "${WEBSITE_DIR}"
sudo -u "${APP_USER}" npm ci

log "Building website (Next.js)..."
sudo -u "${APP_USER}" npm run build

# ── Restart services (ordered) ────────────────────────────────────────────────
log "Restarting gedc-backend..."
systemctl restart gedc-backend
log "Waiting 10 s for backend to initialise (Prisma, JWT, Socket.IO)..."
sleep 10

log "Restarting gedc-cms..."
systemctl restart gedc-cms
log "Waiting 5 s..."
sleep 5

log "Restarting gedc-website..."
systemctl restart gedc-website

# ── Health check ──────────────────────────────────────────────────────────────
sleep 3
log "Checking backend /health endpoint..."
if curl -sf http://127.0.0.1:4000/health > /dev/null; then
    log "Backend: OK"
else
    log "WARNING: backend health check failed — check: journalctl -u gedc-backend -n 50"
fi

log "Checking service states..."
systemctl is-active --quiet gedc-backend  && log "gedc-backend: running" || log "WARNING: gedc-backend not running"
systemctl is-active --quiet gedc-cms      && log "gedc-cms:     running" || log "WARNING: gedc-cms not running"
systemctl is-active --quiet gedc-website  && log "gedc-website: running" || log "WARNING: gedc-website not running"

log "Deployment complete."

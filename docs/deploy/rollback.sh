#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Enterprise Georgia (gedc) — Roll back all three services to HEAD~1.
# Rebuilds from the previous commit and restarts in order.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKEND_DIR="/opt/gedc/backend"
CMS_DIR="/opt/gedc/cms"
WEBSITE_DIR="/opt/gedc/website"
APP_USER="gedc"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# ── Capture current HEADs for the record ─────────────────────────────────────
for svc in backend cms website; do
    dir="/opt/gedc/${svc}"
    head=$(sudo -u "${APP_USER}" git -C "${dir}" rev-parse --short HEAD)
    log "${svc} current HEAD: ${head}"
done

# ── Reset each repo to HEAD~1 ─────────────────────────────────────────────────
for svc in backend cms website; do
    dir="/opt/gedc/${svc}"
    prev=$(sudo -u "${APP_USER}" git -C "${dir}" rev-parse HEAD~1)
    log "Rolling back ${svc} to ${prev}..."
    sudo -u "${APP_USER}" git -C "${dir}" reset --hard "${prev}"
done

# ── Rebuild backend ───────────────────────────────────────────────────────────
log "Rebuilding backend..."
cd "${BACKEND_DIR}"
sudo -u "${APP_USER}" npm ci --omit=dev
sudo -u "${APP_USER}" npm run build
log "Applying migrations for rolled-back schema..."
sudo -u "${APP_USER}" npx prisma migrate deploy

# ── Rebuild CMS ───────────────────────────────────────────────────────────────
log "Rebuilding CMS..."
cd "${CMS_DIR}"
sudo -u "${APP_USER}" npm ci
sudo -u "${APP_USER}" npm run build

# ── Rebuild website ───────────────────────────────────────────────────────────
log "Rebuilding website..."
cd "${WEBSITE_DIR}"
sudo -u "${APP_USER}" npm ci
sudo -u "${APP_USER}" npm run build

# ── Restart services ──────────────────────────────────────────────────────────
log "Restarting gedc-backend..."
systemctl restart gedc-backend
log "Waiting 10 s..."
sleep 10

log "Restarting gedc-cms..."
systemctl restart gedc-cms
sleep 5

log "Restarting gedc-website..."
systemctl restart gedc-website

sleep 3
curl -sf http://127.0.0.1:4000/health > /dev/null && log "Backend: OK" || log "WARNING: backend health check failed"

log "Rollback complete."

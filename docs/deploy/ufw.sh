#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Enterprise Georgia (gedc) — UFW firewall configuration
# Allows: SSH, HTTP (80), HTTPS (443)
# Denies externally: backend/cms/website ports — internal only, proxied by nginx
#
# Usage: sudo bash ufw.sh
# Reads port values from /opt/gedc/.env.server (see docs/deploy/.env.server.example).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ENV_FILE="/opt/gedc/.env.server"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy docs/deploy/.env.server.example and fill in values." >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$ENV_FILE"

SSH_PORT="${SSH_PORT:-22}"
BACKEND_PORT="${BACKEND_PORT:-4000}"
CMS_PORT="${CMS_PORT:-3001}"
WEBSITE_PORT="${WEBSITE_PORT:-3000}"

echo "Configuring UFW firewall..."

# Reset to a clean state
ufw --force reset

# Default policy
ufw default deny incoming
ufw default allow outgoing

# SSH — must be first to avoid lockout
ufw allow "${SSH_PORT}/tcp"  comment 'SSH'

# Public web — nginx handles routing to internal services
ufw allow 80/tcp   comment 'HTTP  (nginx)'
ufw allow 443/tcp  comment 'HTTPS (nginx + certbot)'

# Explicitly deny internal service ports from external access
ufw deny "${BACKEND_PORT}/tcp"  comment 'gedc-backend — internal only, proxied via nginx'
ufw deny "${CMS_PORT}/tcp"      comment 'gedc-cms     — internal only, proxied via nginx'
ufw deny "${WEBSITE_PORT}/tcp"  comment 'gedc-website — internal only, proxied via nginx'

# Enable firewall
ufw --force enable
ufw status verbose
echo ""
echo "Firewall active. Internal ports ${BACKEND_PORT}/${CMS_PORT}/${WEBSITE_PORT} are blocked from outside."

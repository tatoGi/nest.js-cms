#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Enterprise Georgia (gedc) — One-time server provisioning
# Run as root on a fresh Ubuntu 22.04 or 24.04 LTS instance.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_USER="gedc"
APP_DIR="/opt/gedc"
LOG_DIR="/var/log/gedc"
NODE_VERSION="24"
PG_VERSION="18"

# ── System update ─────────────────────────────────────────────────────────────
apt-get update
apt-get upgrade -y
apt-get install -y \
    curl git nginx ufw gnupg lsb-release \
    software-properties-common ca-certificates

# ── Node.js 24 LTS (NodeSource) ───────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs
node --version
npm --version

# ── PostgreSQL 18 ─────────────────────────────────────────────────────────────
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
apt-get update
apt-get install -y postgresql-${PG_VERSION}
systemctl enable postgresql
systemctl start postgresql

# Create application database and user.
# Edit PG_PASS before running, then record it in /opt/gedc/backend/.env
PG_DB="gedc_db"
PG_USER="gedc_user"
PG_PASS="CHANGE_ME_STRONG_PASSWORD"
sudo -u postgres psql -c "CREATE USER ${PG_USER} WITH PASSWORD '${PG_PASS}';"
sudo -u postgres psql -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};"
echo "PostgreSQL: database '${PG_DB}' and user '${PG_USER}' created."

# ── App user ──────────────────────────────────────────────────────────────────
id -u ${APP_USER} &>/dev/null || useradd -m -s /bin/bash ${APP_USER}
echo "App user '${APP_USER}' ready."

# ── Directory structure ───────────────────────────────────────────────────────
mkdir -p "${APP_DIR}"/{backend,cms,website}
mkdir -p "${APP_DIR}/backend/uploads"    # persistent — never deleted on redeploy
mkdir -p "${LOG_DIR}"
chown -R ${APP_USER}:${APP_USER} "${APP_DIR}"
chown -R ${APP_USER}:${APP_USER} "${LOG_DIR}"
echo "Directories created under ${APP_DIR} and ${LOG_DIR}."

# ── nginx ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "${SCRIPT_DIR}/nginx.conf" /etc/nginx/sites-available/gedc
ln -sf /etc/nginx/sites-available/gedc /etc/nginx/sites-enabled/gedc
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx
echo "nginx configured from ${SCRIPT_DIR}/nginx.conf."

# ── systemd units ─────────────────────────────────────────────────────────────
cp "${SCRIPT_DIR}/systemd/gedc-backend.service" /etc/systemd/system/
cp "${SCRIPT_DIR}/systemd/gedc-cms.service"     /etc/systemd/system/
cp "${SCRIPT_DIR}/systemd/gedc-website.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable gedc-backend gedc-cms gedc-website
echo "systemd units installed and enabled."

# ── Log rotation ──────────────────────────────────────────────────────────────
cat > /etc/logrotate.d/gedc << 'EOF'
/var/log/gedc/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 gedc gedc
}
EOF
echo "logrotate configured for /var/log/gedc/"

# ── UFW firewall ──────────────────────────────────────────────────────────────
bash "${SCRIPT_DIR}/ufw.sh"

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Setup complete. Required next steps:"
echo ""
echo "  1. Clone each repo into the correct app directory:"
echo "       /opt/gedc/backend/   ← Enterprise_Georgia_Backend"
echo "       /opt/gedc/cms/       ← Enterprise_CMS"
echo "       /opt/gedc/website/   ← Enterprise-georgia-NFront"
echo ""
echo "  2. Copy env files and fill real values:"
echo "       cp docs/deploy/.env.backend.example /opt/gedc/backend/.env"
echo "       cp docs/deploy/.env.cms.example     /opt/gedc/cms/.env"
echo "       cp docs/deploy/.env.website.example /opt/gedc/website/.env"
echo ""
echo "  3. Run the first deployment:"
echo "       bash docs/deploy/deploy.sh"
echo ""
echo "  4. Add SSL once DNS records are configured:"
echo "       bash docs/deploy/certbot.sh"
echo "═══════════════════════════════════════════════════════════"

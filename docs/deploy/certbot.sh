#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Enterprise Georgia (gedc) — Let's Encrypt SSL provisioning
#
# Current routing: single server block, path-based (/cms/ for CMS admin).
# SSL adds HTTPS to that same single server block.
#
# Prerequisites:
#   1. DNS A records must already point to this server IP.
#   2. nginx must be running (setup.sh completed).
#
# Usage:
#   DOMAIN=example.ge ADMIN_EMAIL=admin@example.ge bash certbot.sh
#
# Optional — if you want www. to also be covered:
#   DOMAIN=example.ge WWW=true ADMIN_EMAIL=admin@example.ge bash certbot.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${DOMAIN:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
WWW="${WWW:-false}"

if [[ -z "${DOMAIN}" || -z "${ADMIN_EMAIL}" ]]; then
    echo "ERROR: Set required environment variables before running:"
    echo "  DOMAIN=example.ge"
    echo "  ADMIN_EMAIL=admin@example.ge"
    echo "  WWW=true   (optional — also covers www.example.ge)"
    exit 1
fi

echo "Provisioning SSL for ${DOMAIN}..."

# ── Install certbot ───────────────────────────────────────────────────────────
apt-get install -y certbot python3-certbot-nginx

# ── Patch server_name in nginx.conf ──────────────────────────────────────────
if [[ "${WWW}" == "true" ]]; then
    CERTBOT_DOMAINS="-d ${DOMAIN} -d www.${DOMAIN}"
    SERVER_NAME="${DOMAIN} www.${DOMAIN}"
else
    CERTBOT_DOMAINS="-d ${DOMAIN}"
    SERVER_NAME="${DOMAIN}"
fi

sed -i "s/server_name _;/server_name ${SERVER_NAME};/" /etc/nginx/sites-available/gedc
nginx -t
nginx -s reload
echo "nginx server_name set to: ${SERVER_NAME}"

# ── Provision certificate ─────────────────────────────────────────────────────
certbot --nginx \
    ${CERTBOT_DOMAINS} \
    --email "${ADMIN_EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --redirect

# ── Verify auto-renewal timer ─────────────────────────────────────────────────
systemctl enable --now certbot.timer 2>/dev/null || true
echo "Certificate provisioned and auto-renewal enabled."

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "SSL active. Post-SSL checklist:"
echo ""
echo "  1. Set COOKIE_SECURE=true in /opt/gedc/backend/.env"
echo "  2. Update CORS_ORIGIN=https://${DOMAIN} in /opt/gedc/backend/.env"
echo "  3. Update /opt/gedc/website/.env:"
echo "       NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN}/api/site"
echo "       NEXT_PUBLIC_ASSETS_URL=https://${DOMAIN}"
echo "  4. Restart all services:"
echo "       systemctl restart gedc-backend gedc-cms gedc-website"
echo ""
echo "  CMS will be available at: https://${DOMAIN}/cms/"
echo ""
echo "  Optional future step — split CMS to its own domain (cms.${DOMAIN}):"
echo "    See the FUTURE comment block at the bottom of nginx.conf."

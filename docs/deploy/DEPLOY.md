# Enterprise Georgia — Deployment Manual

Target: Ubuntu 22.04 / 24.04 LTS, single server  
Runtime: Node.js 24 LTS, PostgreSQL 18, nginx  
Services: `gedc-backend` (port 4000) · `gedc-cms` (port 3001) · `gedc-website` (port 3000)  
External: ports 80/443 only (nginx) — internal ports blocked by UFW

---

## Important: CMS next.config.js basePath requirement

> **Before the first deployment**, the CMS repo (`Enterprise_CMS`) must have
> `basePath: '/cms'` set in its `next.config.js` (or `next.config.ts`).
>
> The nginx config routes all traffic starting with `/cms/` to the CMS service.
> Next.js needs `basePath: '/cms'` so that page routes, `/_next/` static assets,
> and client-side navigation all resolve under that prefix.
>
> ```js
> // Enterprise_CMS/next.config.js (or .ts)
> const nextConfig = {
>   basePath: '/cms',
>   // ... rest of config
> };
> module.exports = nextConfig;
> ```
>
> After this change: rebuild CMS (`npm run build`) before starting the service.

---

## Routing overview

nginx uses a single server block with path-based dispatch:

| Path prefix   | Service        | Notes                                                 |
| ------------- | -------------- | ----------------------------------------------------- |
| `/api/`       | backend (4000) | NestJS REST API — all admin + public endpoints        |
| `/uploads/`   | backend (4000) | Static files uploaded through the CMS                 |
| `/socket.io/` | backend (4000) | Socket.IO: visitor chat + operator DMs                |
| `/cms/`       | cms (3001)     | Next.js admin dashboard (requires `basePath: '/cms'`) |
| `/`           | website (3000) | Next.js public website (catch-all)                    |

CMS is accessible at `http://SERVER_IP/cms/` from day one — no domain required,
no SSH tunnel needed.

---

## Prerequisites

- Fresh Ubuntu 22.04 or 24.04 LTS server
- Root SSH access
- All three git repos accessible from the server (SSH keys or HTTPS)
- CMS repo has `basePath: '/cms'` in `next.config.js` (see above)

Repo targets on server:
| Repo | Server path |
|------|------------|
| `Enterprise_Georgia_Backend` | `/opt/gedc/backend` |
| `Enterprise_CMS` | `/opt/gedc/cms` |
| `Enterprise-georgia-NFront` | `/opt/gedc/website` |

---

## Part 1 — First-time provisioning

### Step 1 — Clone the backend repo to the server

```bash
ssh root@SERVER_IP
git clone <BACKEND_REPO_URL> /opt/gedc/backend
```

### Step 2 — Edit setup.sh before running

Open `docs/deploy/setup.sh` and change the database password on the `PG_PASS` line:

```bash
nano /opt/gedc/backend/docs/deploy/setup.sh
# Change: PG_PASS="CHANGE_ME_STRONG_PASSWORD"
```

### Step 3 — Run setup.sh

```bash
cd /opt/gedc/backend
bash docs/deploy/setup.sh
```

Installs: Node.js 24 LTS, PostgreSQL 18, nginx, UFW, `gedc` user, directories,
systemd units (enabled but not started yet), and the firewall.

### Step 4 — Clone the CMS and website repos

```bash
sudo -u gedc git clone <CMS_REPO_URL>     /opt/gedc/cms
sudo -u gedc git clone <WEBSITE_REPO_URL> /opt/gedc/website
```

### Step 5 — Create environment files

```bash
cp /opt/gedc/backend/docs/deploy/.env.backend.example /opt/gedc/backend/.env
cp /opt/gedc/backend/docs/deploy/.env.cms.example     /opt/gedc/cms/.env
cp /opt/gedc/backend/docs/deploy/.env.website.example /opt/gedc/website/.env
```

Edit each file:

```bash
nano /opt/gedc/backend/.env
nano /opt/gedc/cms/.env
nano /opt/gedc/website/.env
```

**Required replacements:**

| File           | Key                        | Replace with                                                               |
| -------------- | -------------------------- | -------------------------------------------------------------------------- |
| backend `.env` | `DATABASE_URL`             | Use PG_PASS set in Step 2                                                  |
| backend `.env` | `JWT_SECRET`               | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| backend `.env` | `JWT_REFRESH_SECRET`       | Same command, generate a different value                                   |
| backend `.env` | `CORS_ORIGIN`              | `http://SERVER_IP`                                                         |
| website `.env` | `NEXT_PUBLIC_API_BASE_URL` | `http://SERVER_IP/api/site`                                                |
| website `.env` | `NEXT_PUBLIC_ASSETS_URL`   | `http://SERVER_IP`                                                         |

### Step 6 — Fix file ownership and permissions

```bash
chown gedc:gedc /opt/gedc/backend/.env /opt/gedc/cms/.env /opt/gedc/website/.env
chmod 600 /opt/gedc/backend/.env /opt/gedc/cms/.env /opt/gedc/website/.env
```

### Step 7 — First deployment

```bash
bash /opt/gedc/backend/docs/deploy/deploy.sh
```

Pulls latest code, installs dependencies, compiles all three apps, runs
Prisma migrations, then starts services in order:
`gedc-backend` → (10 s) → `gedc-cms` → (5 s) → `gedc-website`

### Step 8 — Verify

```bash
# Service states
systemctl status gedc-backend gedc-cms gedc-website

# Backend health
curl http://127.0.0.1:4000/health

# Website
curl -I http://SERVER_IP/

# CMS (should return 200 or redirect to /cms/signin)
curl -I http://SERVER_IP/cms/
```

The public website is at `http://SERVER_IP/`.  
The CMS admin is at `http://SERVER_IP/cms/`.

---

## Part 2 — Routine deployment (updates)

```bash
ssh root@SERVER_IP
bash /opt/gedc/backend/docs/deploy/deploy.sh
```

The script pulls, builds, migrates, and restarts in the correct order.

---

## Part 3 — Rollback

Roll all three services back to the previous git commit:

```bash
bash /opt/gedc/backend/docs/deploy/rollback.sh
```

To roll back a single service:

```bash
cd /opt/gedc/backend     # or /cms or /website
sudo -u gedc git reset --hard HEAD~1
# then rebuild and restart that service only
```

---

## Part 4 — Adding a domain and SSL

### Step 1 — Point DNS to the server

| Record           | Value                |
| ---------------- | -------------------- |
| `example.ge`     | SERVER_IP            |
| `www.example.ge` | SERVER_IP (optional) |

Verify propagation:

```bash
dig +short example.ge     # must return SERVER_IP
```

### Step 2 — Run certbot.sh

```bash
DOMAIN=example.ge ADMIN_EMAIL=admin@example.ge bash /opt/gedc/backend/docs/deploy/certbot.sh
# With www: WWW=true DOMAIN=example.ge ...
```

The script patches `server_name` in nginx.conf, runs `certbot --nginx`, and
enables auto-renewal.

### Step 3 — Update env files after SSL

```bash
nano /opt/gedc/backend/.env
# Set: COOKIE_SECURE=true
# Set: CORS_ORIGIN=https://example.ge

nano /opt/gedc/website/.env
# Set: NEXT_PUBLIC_API_BASE_URL=https://example.ge/api/site
# Set: NEXT_PUBLIC_ASSETS_URL=https://example.ge

systemctl restart gedc-backend gedc-cms gedc-website
```

CMS will be at `https://example.ge/cms/`.

### Optional future step — give CMS its own domain

When you're ready to move the CMS to `cms.example.ge`:

1. Add DNS A record `cms.example.ge → SERVER_IP`
2. Replace the single server block in nginx.conf with the two-block structure
   shown in the `FUTURE — split by domain` comment at the bottom of nginx.conf
3. Remove `basePath: '/cms'` from the CMS `next.config.js`
4. Run `certbot.sh` for both domains

---

## Service management

```bash
# Status
systemctl status gedc-backend
systemctl status gedc-cms
systemctl status gedc-website

# Restart
systemctl restart gedc-backend
systemctl restart gedc-cms
systemctl restart gedc-website

# Logs — backend (NestJS structured logs via journal)
journalctl -u gedc-backend -f -n 100

# Logs — Next.js apps (stdout → files)
tail -f /var/log/gedc/cms.log
tail -f /var/log/gedc/website.log

# Logs — nginx (per-service access logs)
tail -f /var/log/nginx/website-access.log
tail -f /var/log/nginx/cms-access.log
tail -f /var/log/nginx/backend-access.log
tail -f /var/log/nginx/gedc-error.log
```

---

## Troubleshooting

| Symptom                          | Where to look                                       | Likely cause                                                             |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| `502 Bad Gateway` on `/`         | `journalctl -u gedc-website -n 50`                  | Website service not running or still starting                            |
| `502 Bad Gateway` on `/api/`     | `journalctl -u gedc-backend -n 50`                  | Backend not running; check DB connection in `.env`                       |
| `502 Bad Gateway` on `/cms/`     | `tail -f /var/log/gedc/cms.log`                     | CMS service not running; or missing `basePath: '/cms'` in next.config.js |
| CMS loads but routes 404         | CMS `next.config.js`                                | `basePath: '/cms'` not set — rebuild CMS after adding it                 |
| CMS `/_next/` assets 404         | nginx.conf `location /cms/` block                   | Confirm location is `/cms/` not `/cms` (trailing slash matters)          |
| Backend starts then crashes      | `journalctl -u gedc-backend -n 100`                 | Missing `.env` value; `DATABASE_URL` wrong; migrations not run           |
| Prisma migration fails           | `cd /opt/gedc/backend && npx prisma migrate status` | DB credentials wrong; or connectivity to PostgreSQL                      |
| WebSocket drops immediately      | `tail -f /var/log/nginx/backend-access.log`         | `proxy_read_timeout` too low — should be 3600 in nginx.conf              |
| `uploads/` images not loading    | `curl -I http://SERVER_IP/uploads/test.jpg`         | Backend not serving `/uploads/`; check `gedc-backend` service            |
| SSL cert renewal fails           | `systemctl status certbot.timer`                    | Timer disabled; run `systemctl enable --now certbot.timer`               |
| nginx fails to start             | `nginx -t`                                          | Syntax error in `/etc/nginx/sites-available/gedc`                        |
| Services not starting on reboot  | `systemctl is-enabled gedc-backend`                 | Run `systemctl enable gedc-backend gedc-cms gedc-website`                |
| `403 Forbidden` on `/cms/signin` | CMS `.env` and next.config.js                       | `basePath` mismatch between nginx and Next.js config                     |

---

## Directory reference

```
/opt/gedc/
├── backend/           ← Enterprise_Georgia_Backend  (NestJS, port 4000)
│   ├── .env           ← from .env.backend.example
│   ├── dist/          ← compiled TypeScript (npm run build)
│   └── uploads/       ← persistent media (never delete on redeploy)
├── cms/               ← Enterprise_CMS              (Next.js, port 3001)
│   ├── .env
│   └── .next/
└── website/           ← Enterprise-georgia-NFront   (Next.js, port 3000)
    ├── .env
    └── .next/

/var/log/gedc/
├── cms.log            ← CMS Next.js stdout/stderr
└── website.log        ← website Next.js stdout/stderr

/var/log/nginx/
├── website-access.log ← traffic hitting /  (website)
├── cms-access.log     ← traffic hitting /cms/
├── backend-access.log ← traffic hitting /api/ /uploads/ /socket.io/
└── gedc-error.log     ← nginx errors (all services — nginx limitation)
```

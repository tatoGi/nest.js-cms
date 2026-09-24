# Enterprise Georgia — Backend

NestJS REST + WebSocket API for the Enterprise Georgia CMS platform. Serves two frontends: the admin CMS and the public website, plus a live visitor-chat widget.

## Stack

| Layer        | Technology                                                |
| ------------ | ---------------------------------------------------------- |
| Framework    | NestJS 11, TypeScript 5.3                                 |
| ORM          | Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL 15            |
| Auth         | JWT (httpOnly cookies) + Passport                          |
| WebSocket    | Socket.IO — visitor live chat (`/chat` namespace)          |
| Queue/state  | Redis (`ioredis`) — chat operator round-robin assignment   |
| Mail         | Nodemailer (SMTP) + SendGrid, multi-connection, env-driven |
| File storage | Sharp (image processing), local `/uploads`                |
| Logging      | Winston (`nest-winston`), daily rotate file                |
| Docs         | Swagger at `/api/docs`                                     |

## Requirements

- Node.js 22 (matches CI — see `.github/workflows/ci.yml`)
- PostgreSQL 15 (or `docker compose up -d`)
- Redis 7 (only needed for chat operator rotation — `npm run chat-redis:up`)

## Quick Start

```bash
npm install
cp .env.example .env       # fill in DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
docker compose up -d       # postgres + pgadmin
npm run chat-redis:up      # redis, only if you're working on chat
npm run prisma:migrate
npm run prisma:generate
npm run prisma:seed
npm run start:dev          # http://localhost:4000
```

## Environment Variables

### Core

| Variable                 | Required | Default          | Description                                    |
| ------------------------ | -------- | ---------------- | ----------------------------------------------- |
| `DATABASE_URL`           | ✓        | —                 | PostgreSQL connection string                    |
| `JWT_SECRET`              | ✓        | —                 | Access token signing secret                     |
| `JWT_EXPIRES_IN`          | ✓        | —                 | Access token TTL (e.g. `1d`)                    |
| `JWT_REFRESH_SECRET`      | ✓        | —                 | Refresh token signing secret                    |
| `JWT_REFRESH_EXPIRES_IN`  |          | —                 | Refresh token TTL (e.g. `30d`)                  |
| `PORT`                   |          | `4000`            | Server port                                     |
| `NODE_ENV`               |          | `development`     | `production` disables verbose error responses   |
| `CORS_ORIGIN`             |          | localhost:3000/3001 | Comma-separated allowed origins               |
| `COOKIE_SECURE`           |          | `false`           | Set `true` in production (HTTPS-only cookies)   |
| `API_PREFIX`, `API_VERSION` |       | —                 | Present in `.env.example`; not yet wired into `main.ts` (global prefix is hardcoded `api`) |

### Uploads & logging

| Variable            | Default    | Description                          |
| ------------------- | ---------- | ------------------------------------- |
| `UPLOAD_DIR`         | `./uploads` | Local media storage path              |
| `UPLOAD_URL_PREFIX`  | `/uploads`  | Public URL prefix for served uploads  |
| `LOG_DIR`            | `logs`      | Winston daily-rotate log directory    |

### Chat (Redis + business hours)

| Variable                    | Default          | Description                                              |
| --------------------------- | ---------------- | --------------------------------------------------------- |
| `REDIS_URL`                  | —                 | Backs the operator round-robin queue — see `docs/chat.md` |
| `BUSINESS_HOURS_TIMEZONE`    | `Asia/Tbilisi`    | Georgia has no DST since 2004, so this is a fixed offset  |
| `BUSINESS_HOURS_START`       | `9`               | Business hours start (24h)                                |
| `BUSINESS_HOURS_END`         | `18`              | Business hours end (24h)                                  |
| `BUSINESS_HOURS_DAYS`        | `1,2,3,4,5`       | Working weekdays (0 = Sunday)                              |
| `MAIL_CONTACT_TO`            | `info@gedc.ge`    | Recipient for the chat "leave contact info" form           |
| `CHAT_MAIL_CONNECTION`       | default mail conn | Named mail connection chat contact emails send through     |

### Mail (`src/common/mail`)

The mail service is a connection registry, fully env-driven — there's no code change to add a new sender. The **default** connection reads unprefixed vars; a **named** connection (e.g. `marketing`) reads the same keys prefixed with its uppercased name.

| Variable                                  | Description                                              |
| ------------------------------------------ | --------------------------------------------------------- |
| `SMTP_HOST` / `SMTP_<NAME>_HOST`            | SMTP host — presence of this key is what enables a connection |
| `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` (or `_<NAME>_` variants) | Standard nodemailer transport options |
| `MAIL_FROM` / `MAIL_<NAME>_FROM`            | Default "from" address (falls back to `no-reply@gedc.ge`) |
| `MAIL_PROVIDER` / `MAIL_<NAME>_PROVIDER`    | `smtp` (default) or `sendgrid`                             |
| `SENDGRID_API_KEY` / `SENDGRID_<NAME>_API_KEY` | Required when provider is `sendgrid`                    |
| `MAIL_RETRY_ATTEMPTS` / `MAIL_<NAME>_RETRY_ATTEMPTS` | Send retry count (default `1` = no retry)          |
| `APP_URL`                                   | Used to resolve absolute media URLs in the public site API |

None of the mail/chat-extras variables ship in `.env.example` by default — the app runs without them, mail sends simply fail/log a warning until a connection is configured.

## Docker Services

```bash
docker compose up -d                              # postgres (5432) + pgadmin (5050)
npm run chat-redis:up                             # redis (6379), separate compose file
```

`docker-compose.redis.yml` is split out from `docker-compose.yml` deliberately so the `chat-redis:*` scripts never touch the Postgres/pgAdmin containers.

## API Overview

### Admin endpoints (JWT cookie required)

| Method | Path                                           | Permission     | Description                                                    |
| ------ | ----------------------------------------------- | -------------- | ---------------------------------------------------------------- |
| POST   | `/api/admin/auth/login`                         | public         | Login — issues `accessToken` + `refreshToken` httpOnly cookies  |
| POST   | `/api/admin/auth/refresh`                       | public         | Refresh access token using refresh cookie                       |
| POST   | `/api/admin/auth/logout`                        | public         | Clear both auth cookies                                         |
| GET    | `/api/admin/auth/me`                            | JWT            | Current user with roles + permissions                           |
| POST   | `/api/admin/auth/heartbeat`                     | JWT            | Update `lastSeen`                                                |
| GET/POST/PATCH/DELETE | `/api/admin/posts`               | `posts.*`      | Post CRUD, versions, trash, bulk actions                         |
| GET/POST/PATCH/DELETE | `/api/admin/pages`               | JWT / perm     | Page CRUD with translations + content blocks                    |
| GET/POST/PATCH/DELETE | `/api/admin/post-categories`     | JWT / perm     | Post categories                                                 |
| GET/POST/PATCH/DELETE | `/api/admin/page-templates`      | JWT / perm     | Page template definitions                                       |
| GET/POST/PATCH/DELETE | `/api/admin/block-types`         | JWT / perm     | CMS block type definitions                                      |
| GET/POST/PATCH/DELETE | `/api/admin/menus`               | JWT / perm     | Navigation menu management                                      |
| GET/POST/PATCH/DELETE | `/api/admin/media`, `/api/admin/media-folders` | JWT / perm | Media library + folder management                     |
| GET/POST/PATCH/DELETE | `/api/admin/languages`           | JWT / perm     | Language management                                              |
| GET/POST/PATCH/DELETE | `/api/admin/users`               | permission     | User management                                                  |
| GET                    | `/api/managed-users`             | JWT            | Restricted user listing (non-admin-scoped)                      |
| GET/POST/PATCH/DELETE | `/api/admin/roles`, `/api/admin/permissions`, `/api/admin/role-management` | permission | Role + permission management |
| GET    | `/api/admin/audit-logs`                         | JWT            | Append-only audit log                                            |
| GET/PATCH | `/api/admin/settings`                        | JWT            | Localized site settings                                          |
| GET    | `/api/admin/notifications`                      | JWT            | In-app notifications                                             |
| *(50+ routes)* | `/api/chat/*`                            | JWT            | Chat sessions, operators, dashboards, programs, regions, canned responses, DM threads — see `docs/chat.md` |

### Public site endpoints (no auth)

| Method | Path                                       | Cache   | Description                                    |
| ------ | ------------------------------------------- | ------- | ------------------------------------------------ |
| GET    | `/api/site/init`                            | —       | Active languages + default language              |
| GET    | `/api/site/languages`                       | —       | Language list                                    |
| GET    | `/api/site/:lang/layout`                    | 1h ISR  | Header/footer menus + settings                    |
| GET    | `/api/site/:lang/home`                      | —       | Homepage bundle                                   |
| GET    | `/api/site/:lang/page/:slug`                | 60s ISR | Full page bundle (blocks + template + posts)      |
| GET    | `/api/site/:lang/post/:slug`                | 60s ISR | Post detail bundle                                |
| GET    | `/api/site/:lang/:pageSlug/post/:postSlug`  | 60s ISR | Page template + post in one call                  |
| GET    | `/api/site/:lang/posts`                     | —       | Paginated posts (`?type=news&page=2&limit=12`)    |
| GET    | `/api/site/:lang/search`                    | —       | Post search (`?q=export`)                         |
| GET    | `/api/site/switch/:lang/:type/:slug`        | —       | Translated slug for language switch               |
| POST   | `/api/chat/sessions`                        | —       | Visitor starts a chat session (also see WebSocket)|

### WebSocket

Namespace `/chat` (`src/modules/chat/chat.gateway.ts`) — visitor live chat with operator assignment, DMs, and typing indicators. Event names are centralized in `chat-events.constants.ts`: `visitor:start`, `visitor:message`, `operator:join`, `operator:message`, `dm:open`, etc. Operator assignment uses a Redis-backed round-robin queue — design notes in `docs/chat.md`.

## Auth Flow

1. `POST /api/admin/auth/login` — validates email/password, sets `accessToken` and `refreshToken` as httpOnly cookies. Refresh token is bcrypt-hashed before storage.
2. `POST /api/admin/auth/refresh` — reads `refreshToken` cookie, verifies against stored hash, issues a new `accessToken` cookie.
3. `POST /api/admin/auth/logout` — nulls stored refresh token, clears both cookies.

## Permission System

Permissions are computed per-request as: **role permissions + direct grants − direct revokes**, with a `*` wildcard that grants everything.

```typescript
// Attach to any controller method:
@RequirePermissions('posts.create')
@Post()
async create() {}
```

The global `PermissionsGuard` (`src/common/guards/permissions.guard.ts`) reads `@RequirePermissions` metadata and checks `req.user.permissions[]`. Routes with no metadata pass through; users holding `*` pass every check.

## Module Structure

```
src/modules/
├── auth/           — login, refresh, logout, heartbeat, /me
├── users/          — user CRUD, per-user permission overrides
├── managed-users/  — restricted, non-admin-scoped user listing
├── roles/          — roles, permissions, role-management controllers
├── audit/          — append-only audit log (actor, action, before/after, ip)
├── langueges/      — language CRUD (note: folder typo, kept for git-history stability)
├── block-types/    — CMS block type definitions
├── pages/          — page CRUD with translations + content blocks
├── template/        — page template definitions (public + admin)
├── posts/          — post CRUD, versions, trash, bulk actions
├── post-category/  — post categories
├── menu/           — navigation menu management (routes under /admin/menus)
├── media/          — media library + folder management
├── settings/       — localized site settings
├── site/           — public-facing API (/api/site/*)
├── notifications/  — in-app notifications
└── chat/           — Socket.IO visitor chat + admin chat console (largest module — sessions, operators, programs, regions, canned responses, reports, DMs)
```

Each module follows the pattern: `api/controllers/` → `application/*.service.ts` → `infrastructure/prisma-*.repository.ts` → `domain/` (interfaces).

## Testing & CI

```bash
npm run test          # unit tests (Jest)
npm run test:cov      # with coverage
npm run test:e2e      # e2e (jest-e2e config)
npm run validate      # lint + format:check + typecheck
```

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`/`dev`: **typecheck → lint → format** in parallel, then **build**, all on Node 22. `prisma generate` runs before typecheck/lint/build since Prisma 7 no longer generates the client on `npm install`. A separate `chat-redis.yml` workflow covers the Redis-backed chat tests.

## Scripts

```bash
npm run start:dev              # development (watch mode)
npm run build                  # TypeScript compile
npm run start:prod             # production

npm run prisma:generate        # regenerate Prisma client after schema changes
npm run prisma:migrate         # run pending migrations (dev)
npm run prisma:migrate:deploy  # apply migrations (production)
npm run prisma:seed            # seed initial data (languages, roles, permissions)
npm run prisma:seed:chat:dev   # seed chat demo data (categories, dev users, sample sessions)
npm run prisma:studio          # open Prisma Studio
npm run prisma:db:push-seed    # push schema + regenerate + seed + validate (fast local iteration)

npm run chat-redis:up          # start the chat Redis container
npm run chat-redis:down        # stop it
npm run chat-redis:status      # check container status

npm run lint                   # eslint --fix
npm run format                 # prettier --write
npm run ci                     # full CI pipeline locally (install, generate, typecheck, lint, test, build)
```

See `package.json` for the complete list, including media import/cleanup and JSON export/seed utilities under `prisma:*`.

## Swagger

Available at `http://localhost:4000/api/docs`.

## Further Docs

- `docs/chat.md` — Redis-backed operator round-robin assignment design
- `docs/plan.md` — in-progress feature planning notes
- `docs/deploy/` — nginx config, systemd units, and deploy/rollback/certbot scripts for the production VPS

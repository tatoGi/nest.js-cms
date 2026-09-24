# Enterprise Georgia — Backend

NestJS REST API for the Enterprise Georgia CMS platform. Serves two frontends: the admin CMS (port 3001) and the public website (port 3000).

## Stack

| Layer        | Technology                                 |
| ------------ | ------------------------------------------ |
| Framework    | NestJS 11, TypeScript 5.3                  |
| ORM          | Prisma 5 + PostgreSQL                      |
| Auth         | JWT (httpOnly cookies) + Passport          |
| WebSocket    | Socket.IO (visitor live chat)              |
| File storage | Sharp (image processing), local `/uploads` |
| Docs         | Swagger at `/api/docs`                     |

## Quick Start

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
npm run prisma:migrate
npm run prisma:generate
npm run prisma:seed
npm run start:dev      # http://localhost:4000
```

## Environment Variables

| Variable                 | Required | Description                              |
| ------------------------ | -------- | ---------------------------------------- |
| `DATABASE_URL`           | ✓        | PostgreSQL connection string             |
| `JWT_SECRET`             | ✓        | Access token signing secret              |
| `JWT_EXPIRES_IN`         | ✓        | Access token TTL (e.g. `1d`)             |
| `JWT_REFRESH_SECRET`     | ✓        | Refresh token signing secret             |
| `JWT_REFRESH_EXPIRES_IN` | ✓        | Refresh token TTL (e.g. `30d`)           |
| `PORT`                   |          | Server port (default `4000`)             |
| `CORS_ORIGIN`            |          | Comma-separated allowed origins          |
| `UPLOAD_DIR`             |          | Upload folder path (default `./uploads`) |
| `COOKIE_SECURE`          |          | Set `true` in production                 |

## API Overview

### Admin endpoints (JWT cookie required)

| Method | Path                                           | Permission     | Description                                                    |
| ------ | ---------------------------------------------- | -------------- | -------------------------------------------------------------- |
| POST   | `/api/admin/auth/login`                        | public         | Login — issues `accessToken` + `refreshToken` httpOnly cookies |
| POST   | `/api/admin/auth/refresh`                      | public         | Refresh access token using refresh cookie                      |
| POST   | `/api/admin/auth/logout`                       | public         | Clear both auth cookies                                        |
| GET    | `/api/admin/auth/me`                           | JWT            | Current user with roles + permissions                          |
| POST   | `/api/admin/auth/heartbeat`                    | JWT            | Update `lastSeen`                                              |
| GET    | `/api/admin/posts`                             | `posts.view`   | List posts                                                     |
| POST   | `/api/admin/posts`                             | `posts.create` | Create post                                                    |
| PATCH  | `/api/admin/posts/:id`                         | `posts.update` | Update post (creates version snapshot)                         |
| DELETE | `/api/admin/posts/:id`                         | `posts.delete` | Move to trash                                                  |
| PATCH  | `/api/admin/posts/:id/restore`                 | `posts.delete` | Restore from trash                                             |
| DELETE | `/api/admin/posts/:id/hard`                    | `posts.delete` | Permanently delete                                             |
| POST   | `/api/admin/posts/bulk-action`                 | varies         | Bulk publish / unpublish / delete                              |
| GET    | `/api/admin/posts/:id/versions`                | `posts.view`   | Version history                                                |
| PATCH  | `/api/admin/posts/versions/:versionId/restore` | `posts.update` | Restore a version                                              |
| GET    | `/api/admin/pages`                             | JWT            | List pages                                                     |
| GET    | `/api/admin/media`                             | JWT            | Media library                                                  |
| GET    | `/api/admin/menus`                             | JWT            | Navigation menus                                               |
| GET    | `/api/admin/languages`                         | JWT            | Languages                                                      |
| GET    | `/api/admin/block-types`                       | JWT            | Block type definitions                                         |
| GET    | `/api/admin/users`                             | permission     | User management                                                |
| GET    | `/api/admin/roles`                             | permission     | Role management                                                |
| GET    | `/api/admin/audit-logs`                        | JWT            | Audit log                                                      |
| GET    | `/api/admin/settings`                          | JWT            | Site settings                                                  |
| GET    | `/api/admin/notifications`                     | JWT            | In-app notifications                                           |

### Public site endpoints (no auth)

| Method | Path                                       | Cache   | Description                                    |
| ------ | ------------------------------------------ | ------- | ---------------------------------------------- |
| GET    | `/api/site/init`                           | —       | Active languages + default language            |
| GET    | `/api/site/:lang/layout`                   | 1h ISR  | Header/footer menus + settings                 |
| GET    | `/api/site/:lang/page/:slug`               | 60s ISR | Full page bundle (blocks + template + posts)   |
| GET    | `/api/site/:lang/post/:slug`               | 60s ISR | Post detail bundle                             |
| GET    | `/api/site/:lang/:pageSlug/post/:postSlug` | 60s ISR | Page template + post in one call               |
| GET    | `/api/site/:lang/posts`                    | —       | Paginated posts (`?type=news&page=2&limit=12`) |
| GET    | `/api/site/:lang/search`                   | —       | Post search (`?q=export`)                      |
| GET    | `/api/site/switch/:lang/:type/:slug`       | —       | Get translated slug for language switch        |

### WebSocket

Namespace `/chat` — visitor live chat. Events: `chat:start`, `chat:message`, `chat:typing`, `chat:session_started`, `chat:closed`.

## Auth Flow

1. `POST /api/admin/auth/login` — validates email/password, sets `accessToken` (1d) and `refreshToken` (30d) as httpOnly cookies. Refresh token is bcrypt-hashed before storage.
2. `POST /api/admin/auth/refresh` — reads `refreshToken` cookie, verifies against stored hash, issues a new `accessToken` cookie.
3. `POST /api/admin/auth/logout` — nulls stored refresh token, clears both cookies.

## Permission System

Permissions are computed per-request as: **role permissions + direct grants − direct revokes**.

```typescript
// Attach to any controller method:
@RequirePermissions('posts.create')
@Post()
async create() {}
```

The global `PermissionsGuard` reads `@RequirePermissions` metadata and checks `req.user.permissions[]`. Routes with no metadata pass through.

**Known limitation:** Users with the `*` wildcard permission currently fail `@RequirePermissions` checks — the guard does not handle the wildcard. See BACKLOG.md for the fix.

## Module Structure

```
src/modules/
├── auth/           — login, refresh, logout, heartbeat, /me
├── users/          — user CRUD, per-user permission overrides
├── roles/          — role + permission management
├── audit/          — append-only audit log (actor, action, before/after, ip)
├── langueges/      — language CRUD (note: folder typo)
├── block-types/    — CMS block type definitions
├── pages/          — page CRUD with translations + content blocks
├── template/       — page template definitions
├── posts/          — post CRUD, versions, trash, bulk actions
├── post-category/  — post categories
├── menus/          — navigation menu management
├── media/          — media library + folder management
├── settings/       — localized site settings
├── site/           — public-facing API (/api/site/*)
├── notifications/  — in-app notifications
└── chat/           — Socket.IO visitor chat gateway
```

Each module follows the pattern: `api/controllers/` → `application/service.ts` → `infrastructure/prisma-*.repository.ts` → `domain/` (interfaces).

## Scripts

```bash
npm run start:dev       # development (watch mode)
npm run build           # TypeScript compile
npm run start:prod      # production
npm run prisma:generate # regenerate Prisma client after schema changes
npm run prisma:migrate  # run pending migrations
npm run prisma:seed     # seed initial data (languages, roles, permissions)
npm run prisma:studio   # open Prisma Studio
npm run lint
npm run format
```

## Swagger

Available at `http://localhost:4000/api/docs` when running in development.
#   n e s t . j s - c m s  
 
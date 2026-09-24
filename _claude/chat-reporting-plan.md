# Chat reporting & admin dashboard — Behavior & Plan

## Requirement (from spec)

Admin needs reporting/statistics:

- chats handled per operator
- average first-response time
- average chat duration
- completed vs. abandoned chat counts
- average visitor rating per operator
- operator workload stats
- region & program report

Plus a live admin dashboard:

- online operator count
- active chat count
- waiting-queue count
- daily chat stats
- average rating

## Current state (as-is)

- No reporting code exists at all in `src/modules/chat` — verified: no stats/report
  routes in `chat.controller.ts`, no aggregation queries in `chat.service.ts`.
- `ChatSession` (schema.prisma:772-807) has `startedAt`/`closedAt` (duration is
  derivable) and `visitorRating` (rating is derivable), but:
  - **no `region` or `program` field** — the closing form only has `resolutionTag`
    - `closureSummary` (free text), so this data isn't captured at all today.
  - **no first-response timestamp** — nothing marks when an operator sent their
    first reply, so "avg first response time" can't be computed from stored data
    (would need a live per-message scan, which doesn't scale for reporting).
  - **no completed/abandoned distinction** — every closed session just has
    `status: closed`; there's no field saying whether it was resolved or the
    visitor left without being helped.
- Online operator presence and active-chat counts only exist in-memory in
  `ChatGateway.onlineOperators` (a `Map`) — there's no REST-reachable snapshot of
  that state for a dashboard endpoint to read.
- A `Program` concept (from the region/program report and from "admin can add
  programs") doesn't exist as a model anywhere.

## Target behavior (to-be)

### 1. Schema additions (prisma/schema.prisma)

- `ChatSession.region String?` — captured on the closing form.
- `ChatSession.programId String?` + relation to new `Program` model — captured on
  the closing form; admin manages the list of programs (add/edit/delete), matching
  the "მართვის სისტემა — პროგრამების დამატება" requirement.
- `ChatSession.firstResponseAt DateTime?` — set once, the first time an operator
  message is saved for that session.
- `ChatSession.outcome` — reuse the existing `resolutionTag`/`ChatTag` mechanism
  rather than a new enum: reserve one `ChatTag` of `type: "resolution"` value
  (e.g. `"abandoned"`) that operators/timeout-jobs apply, everything else counts as
  "completed". Avoids a schema enum that has to track business-defined resolution
  labels which already live in `ChatTag`.
- New `Program` model: `id`, `name`, `isActive`, timestamps — simple admin-managed
  lookup table.

### 2. Capture points (chat.service.ts)

- `saveMessage(...)`: when `role === 'operator'` and the session's
  `firstResponseAt` is still null, set it to `now()` in the same update — needs a
  read-before-write (`session.firstResponseAt == null`) or a conditional update
  (`updateMany` with `where: { firstResponseAt: null }`) to only set it once.
- `closeSessionWithResolution(...)`: accept `region` and `programId` in the DTO and
  persist them alongside `resolutionTag`/`closureSummary`.

### 3. New reporting service — `src/modules/chat/application/chat-reports.service.ts`

- `getOperatorStats(from: Date, to: Date)` — one row per operator over the closed
  sessions in range:
  - `sessionsHandled` = count where `operatorId = X`
  - `avgFirstResponseSeconds` = avg(`firstResponseAt - startedAt`) — Prisma can't
    diff two DateTime columns directly, so this needs a raw SQL aggregate
    (`$queryRaw`) or computing in JS after fetching the two timestamps per session
    (fine at moderate volume; raw SQL preferred once volume grows).
  - `avgDurationSeconds` = avg(`closedAt - startedAt`), same approach.
  - `completedCount` / `abandonedCount` = count grouped by whether `resolutionTag`
    equals the reserved "abandoned" tag.
  - `avgRating` = avg(`visitorRating`) where not null.
- `getOverviewStats(from, to)` — same metrics aggregated across all operators.
- `getRegionProgramReport(from, to)` — group by `region` and `programId`: count +
  avg rating.
- `getWorkloadSnapshot()` — for each operator: current active (`status: open`)
  session count (this is the same query the auto-assign feature in
  [[chat-auto-assign-plan]] needs — share `getActiveCountsByOperators`).

### 4. Dashboard snapshot

Needs both DB data and gateway in-memory state, so it should live in
`ChatGateway` or a small shared service both can reach:

- `onlineOperatorCount` — `this.onlineOperators.size` from `ChatGateway`. Requires
  exposing this via a method (`ChatGateway.getOnlineOperatorIds()`) injected into
  a `ChatDashboardService`, since the controller can't reach the gateway's private
  Map directly.
- `activeChatCount` — `chatSession.count({ where: { status: 'open' } })`.
- `queuedCount` — `chatSession.count({ where: { status: 'open', operatorId: null } })`.
- `todayStats` — sessions started today: count, avg rating, avg duration (only for
  ones closed today).

### 5. New endpoints — `chat.controller.ts` (or split into `chat-reports.controller.ts`)

All gated behind a permission distinct from `chat.view`/`chat.close`, e.g.
`chat.reports` (admin-only), since front-line operators shouldn't see cross-operator
performance data:

- `GET /chat/reports/operators?from=&to=`
- `GET /chat/reports/overview?from=&to=`
- `GET /chat/reports/regions-programs?from=&to=`
- `GET /chat/dashboard` — live snapshot, no date range

### 6. Programs admin CRUD

- `GET/POST/PATCH/DELETE /chat/programs` mirroring the existing `CannedResponse`
  CRUD pattern (see `chat.service.ts:238-253`).

## Tasks

- [ ] Add `Program` model to `schema.prisma` (id, name, isActive, timestamps)
- [ ] Add `region`, `programId`, `firstResponseAt` fields to `ChatSession` in `schema.prisma`
- [ ] Run Prisma migration
- [ ] Reserve an `"abandoned"` `ChatTag` (`type: "resolution"`) value for the abandoned/completed split
- [ ] Update `saveMessage()` in `chat.service.ts` to set `firstResponseAt` on first operator reply
- [ ] Update `CloseSessionWithResolutionDto` + `closeSessionWithResolution()` to accept/persist `region` + `programId`
- [ ] Add closing-form UI inputs for region + program (frontend, out of this repo's scope but needed for data to populate)
- [ ] Create `chat-reports.service.ts` with `getOperatorStats`, `getOverviewStats`, `getRegionProgramReport`, `getWorkloadSnapshot`
- [ ] Create `chat-dashboard.service.ts` (or method on `ChatGateway`) exposing `getOnlineOperatorIds()`
- [ ] Add `chat.reports` permission
- [ ] Add `GET /chat/reports/operators`, `/overview`, `/regions-programs` endpoints
- [ ] Add `GET /chat/dashboard` endpoint
- [ ] Add `Program` CRUD endpoints (`GET/POST/PATCH/DELETE /chat/programs`)
- [ ] Manual test: operator stats match manually-computed numbers for a seeded date range
- [ ] Manual test: dashboard counts update live as sessions open/close and operators go online/offline

## Dependencies / sequencing

1. Schema migration (region, programId, firstResponseAt, Program model) must land
   before any reporting query can return real region/program/first-response data —
   until then those fields would just be null for all historical sessions.
2. The closing-form UI needs the region/program inputs wired in parallel with the
   backend DTO change, otherwise the fields stay empty going forward too.
3. `getActiveCountsByOperators` is shared with [[chat-auto-assign-plan]] — worth
   implementing that one first since reporting's workload snapshot reuses it.

## Open questions

- "Abandoned" definition: is it purely a manual tag an operator applies on close,
  or should a session auto-flip to abandoned if the visitor disconnects without
  ever being assigned/replied to (ties into the inactivity auto-close requirement,
  not yet designed)? Affects whether `abandonedCount` needs a background job or is
  purely operator-driven.
- Historical sessions won't have `region`/`programId`/`firstResponseAt` — reports
  for date ranges before the migration will show partial/null data for those
  columns; worth deciding whether to backfill or just document the cutover date.
- Should `avgFirstResponseSeconds` count internal notes (`isInternal: true`) as a
  "response"? Current plan excludes them (only visitor-facing operator messages
  count), matching what visitors actually experience.

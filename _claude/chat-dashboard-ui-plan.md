# Admin dashboard — live chat metrics — Behavior & Plan

Companion to `chat-reporting-plan.md` (which defines the backend `GET /chat/dashboard`
endpoint and its data sources) — this doc is the CMS-side visual plan for the
same requirement, using this session's convention of one plan doc per concern.

## Requirement

Admin panel should visually show:

1. Online operator count
2. Active chat count
3. Waiting-queue count
4. Daily chat statistics
5. Average visitor rating

## What already exists (verified in Enterprise_CMS)

- Main dashboard: `src/app/(dashboard)/dashboard/page.tsx` (server component,
  fetches `dashboardService.getDashboardData()`) → renders
  `src/components/features/dashboard/CMSDashboard.client.tsx`, which lays cards
  out in a `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` grid, each card gated
  by `hasPermission(...)`.
- Reusable card: `src/components/ui/cards/StatCard.tsx` — props `label`, `value`,
  `icon` (inline SVG), optional `href`, `subtitle`, `trend`. This is the exact
  component to reuse for metrics 1-3 and 5 (simple numbers), no new component
  needed for those.
- Live data plumbing: `useChatSocket.ts` (`src/components/features/chat/hooks/`)
  already connects to the `/chat` namespace and already receives
  `operators:online_list`/`operator:online`/`operator:offline` — the online-operator
  count is _already flowing through the client_ today, just not surfaced outside
  the chat page. React Query (`QueryProvider`) is used elsewhere in the CMS for
  polling-refetch (`refetchInterval`) as an alternative to sockets.
- **Gap**: dashboard numbers today are fetched once on page load (server-side),
  no live refresh, and `ChartTab.tsx` is an unwired template leftover — no chart
  is actually rendered anywhere in Enterprise_CMS today.
- **Resolved by porting from the sibling GrowthHub CRM project**
  (`F:\DEVELOPMENT\Growthhub_Crm\growthhub_crm\src\components\crm\analytics\`):
  that codebase already solved exactly this with `react-apexcharts` +
  `dynamic(..., { ssr: false })`, wrapped in reusable, dark-mode-aware components:
  - `charts/KpiCard.tsx` — label + value + icon + `accent` (`default/success/warning/info`),
    same shape as Enterprise_CMS's `StatCard` but with accent-driven color instead
    of a trend pill. Either reuse `StatCard` as already planned, or adopt this
    accent variant — functionally equivalent, pick one convention.
  - `charts/ChartCard.tsx` — thin title-wrapper around the CMS's own `Card`/`CardHeader`/`CardBody`.
  - `charts/BarChart.tsx` / `charts/DonutChart.tsx` — fully styled ApexCharts wrappers
    (gradient fill, rotated/split labels, custom tooltip/grid) driven by shared
    constants in `charts/config.ts` (`CHART_ANIMATIONS`, `CHART_LABEL_STYLE`,
    `CHART_TOOLTIP`, `CHART_GRID`, `CHART_STATES`).
  - Barrel export `charts/index.ts` re-exports all four — clean copy/adapt target.
  - This is a straight port, not a new dependency decision: add `apexcharts` +
    `react-apexcharts` to Enterprise_CMS (same as GrowthHub already depends on),
    copy the four `charts/*` files adjusting only the import paths (`Card` from
    Enterprise_CMS's own `ui/card`, `cn` util if it exists or inline the classnames).
  - Note: GrowthHub's own live-chat feature (`src/components/crm/live-chat/`) is
    internal team messaging (Slack-style), not a support/ticket queue — nothing
    to reuse from there for auto-assign/capacity/queue; only the `analytics/charts/`
    folder is relevant to this dashboard plan.

## Planned UI changes (Enterprise_CMS, not yet applied)

### 1. New dashboard section: "Live Chat"

Add a `ChatDashboardSection` component to `CMSDashboard.client.tsx` (own grid row,
gated on `chat.view` or a new `chat.reports` permission per `chat-reporting-plan.md`),
using four `StatCard`s:

- "Online Operators" — count, icon = headset/person SVG
- "Active Chats" — count
- "Waiting in Queue" — count, `trend`/color emphasis if > 0 (e.g. amber subtitle
  "visitors waiting") since this is the actionable one
- "Avg Rating (today)" — number formatted to 1 decimal, e.g. `4.6★`

### 2. Data source

- On page load: call the new `GET /chat/dashboard` REST endpoint (from
  `chat-reporting-plan.md`) for the initial snapshot — same pattern as
  `dashboardService.getDashboardData()`.
- For live updates without a full page refetch, two options:
  - **Reuse the socket** (recommended, no new library): extend `useChatSocket`
    or add a small `useChatDashboardSocket` hook that listens for
    `operator:online`/`operator:offline`/`session:updated`/`session:closed`/
    `operator:new_session` events (already emitted by the gateway) and
    increments/decrements local counters instead of a full refetch.
  - **Poll via React Query** `refetchInterval` (e.g. every 15-30s) hitting
    `GET /chat/dashboard` — simpler, consistent with existing CMS patterns
    elsewhere, slightly less "live" than sockets.
  - Recommendation: poll (simpler, matches existing conventions, "admin glances
    at a panel" doesn't need sub-second accuracy) rather than adding socket
    plumbing outside the chat page just for this.

### 3. "Daily chat stats"

Now that a real chart pattern is available to port (see above), this can go
beyond a same-day stat row if wanted:

- Minimum viable: "Chats Today", "Avg Duration Today", "Completed / Abandoned
  Today" as plain `StatCard`/`KpiCard`s — no chart needed for single-day numbers.
- If a trend view is wanted ("chats per day, last 7/30 days"): use the ported
  `BarChart` (categories = dates, data = daily counts) inside a `ChartCard`,
  fed by a new backend endpoint returning a daily-bucketed series (extends
  `chat-reporting-plan.md`'s `getOverviewStats` to accept a `groupBy: 'day'` mode,
  or a dedicated `getDailySeries(from, to)` method).
- `DonutChart` is a good fit for "Completed vs Abandoned Today" as a 2-slice
  breakdown instead of two separate numbers, matching how GrowthHub uses it for
  categorical breakdowns in its analytics tabs.

## Tasks

- [ ] Backend: implement `GET /chat/dashboard` (from `chat-reporting-plan.md` tasks)
- [ ] Add `apexcharts` + `react-apexcharts` deps to Enterprise_CMS
- [ ] Port `charts/config.ts`, `ChartCard.tsx`, `BarChart.tsx`, `DonutChart.tsx` from
      `Growthhub_Crm/growthhub_crm/src/components/crm/analytics/charts/` into
      Enterprise_CMS (adjust `Card`/`cn` imports to CMS equivalents)
- [ ] Decide: reuse existing `StatCard` or adopt GrowthHub's `KpiCard` accent variant for the 4 top-line numbers — pick one, don't run both conventions
- [ ] `dashboardService` (CMS `src/lib/api` or equivalent): add `getChatDashboard()` call
- [ ] New component `ChatDashboardSection.tsx` using the chosen stat-card component
- [ ] Wire `ChatDashboardSection` into `CMSDashboard.client.tsx` grid, permission-gated
- [ ] Decide polling vs. socket for live refresh (recommend polling via React Query `refetchInterval`)
- [ ] Add "Chats Today / Avg Duration / Completed vs Abandoned" mini stat-row (KpiCard/StatCard, no chart needed for single-day numbers)
- [ ] If trend view wanted: add `getDailySeries(from, to)` backend method + `BarChart` panel
- [ ] Manual test: numbers match backend counts at a known point in time
- [ ] Manual test: queue count updates within one refresh cycle after a new visitor waits / gets assigned

## Open questions

- Is a real historical trend chart ("daily chats over last 30 days") actually
  wanted, or is "today's numbers" sufficient? No longer blocked by "no chart
  library" (GrowthHub's ApexCharts setup is a direct port), so this is now purely
  a product-priority call, not a technical one.
- Refresh cadence for polling — 15s vs 30s vs 60s — trade-off between freshness
  and backend load; no strong requirement given in the spec, defaulting to 30s
  unless told otherwise.
- Should the ported chart components live under a shared `components/ui/charts/`
  in Enterprise_CMS (reusable beyond chat) rather than a chat-specific folder,
  given they're generic ApexCharts wrappers with no chat-specific logic?

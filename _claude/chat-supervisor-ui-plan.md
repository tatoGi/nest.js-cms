# Supervisor visibility & assignment UI — Behavior & Plan

Repo note: the CMS UI lives in `f:\DEVELOPMENT\Enterprise_CMS`, not this backend repo.
This doc plans the CMS-side changes; capacity enforcement itself is backend
(`chat-auto-assign-plan.md`), reporting is `chat-reporting-plan.md`.

## Requirement

1. An operator should only ever have 3 active chats with visitors.
2. A supervisor should see all chats (not just their own).
3. A supervisor should be able to add/update the operator assigned to a chat.

## What already exists (verified in Enterprise_CMS)

- Permission constants: `src/lib/config/constants/permissions.ts` — `CHAT_VIEW`,
  `CHAT_REPLY`, `CHAT_JOIN`, `CHAT_CLOSE`. No dedicated "supervisor" permission —
  the codebase already treats **`chat.close` as the supervisor flag**:
  - Backend `isOperatorSupervisor()` (`chat.service.ts:275-300`) checks `chat.close`.
  - Backend `PATCH /chat/sessions/:id/assign` (`chat.controller.ts:105-109`)
    requires `chat.close`.
  - Frontend `VisitorInfoPanel.tsx:69` — `usePermission("chat.close")` — when true,
    renders an editable `<select>` of operators for reassignment (lines 146-164)
    that calls `chatApi.assignSession(sessionId, operatorId)`; when false, renders
    a read-only "Assigned to" row.
- **Requirement 3 is fully implemented already** — no new UI work needed, just
  confirm supervisor accounts actually have the `chat.close` permission granted.
- **Requirement 1** is a backend-only concern — see `chat-auto-assign-plan.md`
  (auto-assign + capacity cap). No CMS UI change required for the cap itself,
  though a workload indicator (below) makes it visible.

## Gap found: requirement 2 is not permission-gated

`ChatSessionList.tsx` (lines 54-64, 109-129) has a "Mine / All" toggle button that
any operator can click — `myFilter` state, no permission check. Today, any
operator with `chat.view` can flip to "All" and see every open session, not just
supervisors. This doesn't match "supervisor should see all chats" as an exclusive
capability.

## Planned UI changes (Enterprise_CMS, not yet applied)

### 1. Gate the "All" toggle to supervisors

`ChatSessionList.tsx`:

- Accept an `isSupervisor: boolean` prop (computed by the parent `ChatClient.tsx`
  via `usePermission("chat.close")`, same hook already used in `VisitorInfoPanel`).
- Non-supervisors: force `myFilter = true`, hide the Mine/All toggle button
  entirely (they only ever see their own assigned sessions + the unassigned queue —
  see next point).
- Supervisors: keep the toggle, default to "All" so they land on the full picture.

### 2. Regular operators should still see the waiting queue

Even with `myFilter` forced on, operators need to see visitors waiting for _any_
operator (session `operatorId: null`) so they can manually pick one up if idle.
Change the "mine" predicate in the non-supervisor case from
`s.operatorId === currentUserId` to `s.operatorId === currentUserId || s.operatorId === null`,
so their "Active" tab = "my chats + the queue", not literally only their own.

### 3. Workload badge (visibility for the 3-chat cap)

- In the "Team" tab (`ChatSessionList.tsx` lines 234-282), next to each operator's
  name, add a small badge showing their current active count, e.g. `2/3`.
  - Turns amber/red at `3/3` (at cap) so supervisors can see load at a glance.
  - Data source: extend `useOperatorPresence` (or add a small poll/socket event)
    to carry `{ operatorId, activeCount }[]` — cheapest source is the
    `getWorkloadSnapshot()` method already planned in `chat-reporting-plan.md`
    (share it rather than building a second endpoint).
- Optional: also show the same `2/3` badge on the currently-open chat's
  `VisitorInfoPanel` next to "Assigned to", so a supervisor reassigning a chat can
  see at a glance which operators still have room before picking one from the
  dropdown.

### 4. Supervisor assign dropdown — minor enhancement

`VisitorInfoPanel.tsx`'s existing `<select>` (lines 151-163) lists every operator
regardless of load. Once the workload badge data is available, disable/mark
operators already at `3/3` in the `<option>` list (e.g. `Name (3/3 - full)`,
`disabled`) so a supervisor doesn't manually push someone over the cap — mirrors
the backend guard planned in `chat-auto-assign-plan.md` for the manual claim paths.

## Tasks

- [ ] `ChatClient.tsx`: compute `isSupervisor = usePermission("chat.close")`, pass to `ChatSessionList`
- [ ] `ChatSessionList.tsx`: hide Mine/All toggle and force `myFilter=true` for non-supervisors
- [ ] `ChatSessionList.tsx`: non-supervisor "mine" predicate includes unassigned (queued) sessions
- [ ] Backend: expose workload snapshot (reuse `getWorkloadSnapshot()` from `chat-reporting-plan.md`) via REST or socket event
- [ ] `ChatSessionList.tsx` Team tab: add `X/3` workload badge per operator
- [ ] `VisitorInfoPanel.tsx`: show workload badge near "Assigned to"
- [ ] `VisitorInfoPanel.tsx`: mark/disable at-capacity operators in the assign `<select>`
- [ ] Confirm supervisor role(s) in prod actually have `chat.close` granted (no new permission key needed)
- [ ] Manual test: operator account without `chat.close` never sees the All toggle, only own+queue
- [ ] Manual test: supervisor sees all sessions by default and can reassign via dropdown
- [ ] Manual test: workload badge updates live as sessions are assigned/closed

## Open question

Should the "queue visible to any operator" behavior (point 2) stay, or should
queued visitors be _only_ visible to supervisors too, with regular operators
strictly limited to their own 3 assigned chats and nothing else? The spec doesn't
say explicitly; current recommendation keeps the queue visible to everyone so an
idle operator can self-serve a waiting visitor instead of waiting for auto-assign,
but this is a product call, not a technical constraint.

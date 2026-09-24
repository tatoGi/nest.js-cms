# Auto-assign waiting visitors to available operators — Behavior & Plan

## Requirement

From the chat system spec: an operator may hold **max 3 active chats at once**.
When a visitor is waiting and an operator becomes available with **fewer than 3 active
chats**, that visitor should be assigned to them automatically.

## Current behavior (as-is)

- `chat.gateway.ts` `visitor:start` creates the session and broadcasts it to **all**
  online operators (`operator:new_session`). No assignment happens yet.
- The session gets `operatorId` only when an operator either:
  - manually opens it (`operator:join_session`), or
  - sends the first reply (`operator:message`, "first operator to reply claims it").
- There is **no concurrency limit check anywhere** — an operator can claim and hold
  unlimited simultaneous sessions.
- There is **no waiting queue** — every open, unassigned session is visible to every
  operator at once; it's a race, not a queue.
- Nothing runs when an operator closes a chat or comes online, so a freed-up slot
  never automatically pulls in a waiting visitor.

## Target behavior (to-be)

1. **On visitor:start** — after creating the session, immediately look at all online
   operators, compute each one's current active (`status: open`) session count, and
   pick the one with the lowest count that is still `< 3`.
   - If found → assign immediately, notify that operator (`operator:assigned`) and
     the session room (`session:updated`); still broadcast `operator:new_session` to
     the operators list for UI visibility.
   - If none found (all online operators at/over the limit, or no one online) → leave
     `operatorId` null. The visitor is now "in queue" (an open session with no operator).
2. **Draining the queue** — whenever operator capacity potentially opens up, re-check
   for waiting visitors and assign them:
   - When an operator closes a session (`operator:close_session`) → one slot frees up.
   - When an operator comes online (`operator:join`) → new capacity appears.
   - In both cases: repeatedly pick the oldest queued session (`operatorId: null`,
     ordered by `startedAt asc`) and the least-loaded eligible operator, assign, notify,
     and repeat until either no queued sessions remain or no operator has free capacity.
3. **Manual claim paths keep the same limit** — `operator:join_session` and the
   "first reply claims it" branch of `operator:message` should also refuse to assign
   if that operator is already at 3 active chats (emit a `chat:permission_error`-style
   message instead), so an operator can't bypass the cap by manually grabbing a chat.
4. Supervisor override (`isOperatorSupervisor`) is unaffected — it already only applies
   to _reassigning_ a session already owned by someone else, not to the capacity check.

## Data needed

- **Active chat count per operator**: `chatSession.groupBy({ by: ['operatorId'], where: { status: 'open', operatorId: { in: onlineIds } } })` — no schema change required, `ChatSession.status` + `operatorId` already exist.
- **Next queued session**: `chatSession.findFirst({ where: { status: 'open', operatorId: null }, orderBy: { startedAt: 'asc' } })`.
- **Online operators**: already tracked in-memory in `ChatGateway.onlineOperators` (Map<operatorId, socketId>). No new state needed for a single-instance deployment; note this map is process-local and won't be correct if the gateway ever runs on multiple instances/pods (would need to move presence to Redis/DB in that case).

## Planned code changes (not yet applied)

### `src/modules/chat/application/chat.service.ts`

- `getActiveCountsByOperators(operatorIds: number[]): Promise<Map<number, number>>`
- `getActiveSessionCount(operatorId: number): Promise<number>`
- `getNextQueuedSession()`

### `src/modules/chat/chat.gateway.ts`

- `private static readonly MAX_ACTIVE_CHATS = 3`
- `pickAvailableOperator()` — least-loaded online operator under the cap, or `null`
- `tryAssignSession(sessionId)` — assign via `pickAvailableOperator`, return operatorId or `null`
- `notifyAssignment(session, operatorId)` — emit `session:updated` to session room + operators room, and `operator:assigned` to the specific operator's socket
- `drainQueue()` — loop: next queued session + available operator, assign, repeat until either is exhausted
- Wire `drainQueue()` into `operator:join` (after registering online) and `operator:close_session` (after closing)
- Wire `tryAssignSession()` into `visitor:start`
- Add the same `< 3` guard to `operator:join_session` and the auto-claim branch inside `operator:message`

## Tasks

- [ ] Add `getActiveCountsByOperators(operatorIds)` to `chat.service.ts`
- [ ] Add `getActiveSessionCount(operatorId)` to `chat.service.ts`
- [ ] Add `getNextQueuedSession()` to `chat.service.ts`
- [ ] Add `MAX_ACTIVE_CHATS = 3` constant to `chat.gateway.ts`
- [ ] Add `pickAvailableOperator()` to `chat.gateway.ts`
- [ ] Add `tryAssignSession(sessionId)` to `chat.gateway.ts`
- [ ] Add `notifyAssignment(session, operatorId)` to `chat.gateway.ts`
- [ ] Add `drainQueue()` to `chat.gateway.ts`
- [ ] Wire `tryAssignSession()` into `visitor:start` handler
- [ ] Wire `drainQueue()` into `operator:join` handler (after registering online)
- [ ] Wire `drainQueue()` into `operator:close_session` handler (after closing)
- [ ] Add `< 3` capacity guard to `operator:join_session` handler
- [ ] Add `< 3` capacity guard to the auto-claim branch in `operator:message` handler
- [ ] Manual test: 4th visitor while all operators at 3 chats stays queued
- [ ] Manual test: closing a chat auto-pulls the oldest queued visitor to the freed operator
- [ ] Manual test: operator coming online auto-pulls a queued visitor if under cap

## Open questions / follow-ups (not in this pass)

- Spec also wants operator statuses **Away/Busy** reflected in real time, with **Busy**
  set automatically at the 3-chat cap. Current online/offline tracking is binary — a
  separate change would add a persisted/broadcast status enum and flip to `Busy`
  when an operator hits the cap, back to `Online` when a slot frees.
- No admin-configurable limit yet (hardcoded `3`); could later move to a config value
  if the business wants to tune it without a deploy.
- Race conditions: two visitors starting at once could both target the same
  "least loaded" operator before either assignment commits (no locking). Low risk at
  current traffic; would need a transaction/row lock if this becomes a problem.

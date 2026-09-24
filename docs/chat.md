# Round-Robin Operator Assignment

## Context

Client spec: incoming chats should rotate evenly among active operators — a real turn-based queue, not just "whoever's least busy." Most of the supporting rules already existed in `pickAvailableOperator()` (`src/modules/chat/chat.gateway.ts`): only active/non-away/non-busy/non-supervisor operators are eligible, and there's a hard cap of `maxActiveChats` (3) before a chat queues instead of assigning. The one real gap, and the actual client complaint: assignment picked the _least-loaded_ operator, tie-broken by connection order — the same operator could win every tie indefinitely, which is the "one operator shouldn't get several new chats in a row" problem being reported.

**Decision**: replace the least-loaded heuristic outright with a genuine rotating queue, backed by Redis so the rotation state is durable across restarts and consistent if this backend ever scales to multiple instances (not needed today — this repo runs single-instance — but the atomic list operations make that a non-issue later rather than a redesign).

**Why a rotating List instead of an INCR-and-modulo counter**: a counter indexed via `count % activeOperators.length` only gives correct "next after last-assigned" behavior when the operator array's membership is stable between calls. Here it isn't — operators go away/busy/back constantly — so a changing array length can make the modulo skip or repeat operators relative to who actually went last, and it has no built-in way to skip someone at the capacity cap. A Redis List where the queue order _is_ the state avoids both problems: rotating past an ineligible/at-capacity operator is just "keep popping," with no derived-index arithmetic to get subtly wrong.

## Design

### Infra

- `ioredis` as the Redis client.
- `docker-compose.redis.yml` — a `redis` service (`redis:7-alpine`), split out from the main `docker-compose.yml` (`postgres`/`pgadmin`) so `npm run chat-redis:*` never touches the DB containers. Run via `npm run chat-redis:up` / `chat-redis:down` / `chat-redis:status`.
- `REDIS_URL` env var (`redis://localhost:6379` in dev).

### `OperatorRotationService`

`src/modules/chat/application/operator-rotation.service.ts`. Redis key: a single List, `chat:operator_rotation` — the queue itself IS the rotation state.

Core operation — `pickNext(eligibleIds, underCapacityIds)`:

1. **Sync membership**: diff the list against `eligibleIds` — insert any newly-eligible operator not already in the list at the front (stakeholder requirement: an operator coming online — first time or reactivating — gets the very next chat, ahead of whoever's already waiting), remove any id no longer eligible (went away/offline/became a supervisor).
2. **Rotate and pick**: pop the head, push it to the tail, check if that operator is under capacity. First one that is → return it. If the whole list is exhausted with nobody eligible → return `null` (same as today's "stays queued" behavior).

### `ChatGateway`

`pickAvailableOperator()` keeps its existing eligibility filtering (online/away/busy/supervisor) unchanged, then delegates the actual pick to `OperatorRotationService.pickNext(eligibleIds, underCapacityIds)` instead of the old least-loaded loop. `drainQueue()` is unaffected — it always targets one specific, already-known operator (the one who just freed up capacity), not a candidate pool, so rotation doesn't apply there.

## Behavior walkthrough

Redis List `chat:operator_rotation` — front of list = next in line. Example with 3 operators (A, B, C), cap = 3 active chats each:

```
START — all 3 come online, appended in order they connected
Queue: [A, B, C]

Chat #1 arrives
  → pop A, A has 0/3 → capacity OK → ASSIGN to A → push A to back
  Queue becomes: [B, C, A]                    A now has 1 active chat

Chat #2 arrives
  → pop B, 0/3 OK → ASSIGN to B → push to back
  Queue becomes: [C, A, B]                    B now has 1 active chat

Chat #3 arrives
  → pop C, 0/3 OK → ASSIGN to C → push to back
  Queue becomes: [A, B, C]                    C now has 1 active chat
  (one full lap — everyone got exactly one, in order)

Chat #4 arrives
  → pop A, A has 1/3 → still OK → ASSIGN to A → push to back
  Queue becomes: [B, C, A]                    A now has 2 active chats
  (A does NOT get chat #5 too — B is next, guaranteed)

──────────────────────────────────────────────────────────────
  B goes "away" mid-rotation
──────────────────────────────────────────────────────────────
  Queue: [B, C, A]  →  B is removed on the next pick's sync step
  Queue becomes: [C, A]

Chat #5 arrives
  → pop C, 1/3 OK → ASSIGN to C → push to back
  Queue becomes: [A, C]

──────────────────────────────────────────────────────────────
  B comes back online
──────────────────────────────────────────────────────────────
  B is inserted at the FRONT — gets the very next chat
  Queue becomes: [B, A, C]

Chat #6 arrives
  → pop B, under cap → ASSIGN to B → push to back
  Queue becomes: [A, C, B]

──────────────────────────────────────────────────────────────
  CAPACITY SKIP — say A is now at 3/3 (maxed out)
──────────────────────────────────────────────────────────────
Chat #7 arrives
  → pop A → at 3/3, NOT eligible → rotate anyway, push A to back, keep going
  → pop C → under cap → ASSIGN to C → push to back
  Queue becomes: [B, A, C]
  (A got skipped for THIS pick, but is still in line for next time
   they free up capacity — not stuck at the front forever)

──────────────────────────────────────────────────────────────
  EVERYONE at capacity
──────────────────────────────────────────────────────────────
Chat #8 arrives, all 3 at 3/3
  → rotate through the whole list, nobody eligible → return null
  → chat stays queued (same "stays queued" behavior as before)
```

The key property: nobody gets a _second_ new chat until everyone ahead of them in line has had a turn (or was skipped for being at capacity/away) — exactly "no operator gets several new chats in a row while others are free," self-healing around operators leaving, rejoining, or hitting capacity.

## Testing

- `operator-rotation.service.spec.ts` covers the rotation algorithm in isolation: newly-eligible operators are inserted at the front; a departed operator is removed mid-list without disrupting the rest's order; basic rotation distributes one chat per operator per lap; an at-capacity operator is skipped but stays queued; everyone-at-capacity returns `null`; a reactivated operator rejoins at the front.
- `chat.gateway.spec.ts`'s `pickAvailableOperator` tests mock `OperatorRotationService.pickNext` directly — that describe block verifies eligibility/capacity wiring, not rotation math (which the rotation-service spec owns).

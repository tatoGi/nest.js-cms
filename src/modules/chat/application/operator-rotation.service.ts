import { Injectable, Optional, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

// The Redis List IS the rotation state — front of the list is next in line.
// A single key is enough (no per-tenant/region split needed at this system's
// scope). See docs/chat.md for the full design rationale and a step-by-step
// walkthrough of the rotation behavior.
const ROTATION_KEY = 'chat:operator_rotation';

function createClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is not set — cannot initialise OperatorRotationService');
  }
  return new Redis(url);
}

@Injectable()
export class OperatorRotationService implements OnModuleDestroy {
  private readonly redis: Redis;

  // redis is only ever passed explicitly in tests (an ioredis-mock
  // instance) — real construction (via ChatModule's providers) always calls
  // this with zero args, falling back to createClient(). @Optional() is
  // required here, not just TS's `?` — without it Nest reflects the Redis
  // type and tries to auto-inject a matching provider, throwing
  // UnknownDependenciesException since none is registered.
  constructor(@Optional() redis?: Redis) {
    this.redis = redis ?? createClient();
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  // Picks the next eligible operator in rotation order, or null if nobody in
  // eligibleIds currently has capacity (matches pickAvailableOperator's old
  // "stays queued" behavior). eligibleIds is the already-filtered
  // online/non-away/non-busy/non-supervisor set from ChatGateway;
  // underCapacityIds is the subset of those also under maxActiveChats.
  async pickNext(eligibleIds: number[], underCapacityIds: Set<number>): Promise<number | null> {
    if (eligibleIds.length === 0) return null;

    await this.sync(eligibleIds);

    // Rotate at most once per current list entry — if nobody in that many
    // pops is under capacity, nobody is, so stop rather than spinning
    // forever on a list that never shrinks during this loop (every pop is
    // immediately pushed back).
    const listLength = await this.redis.llen(ROTATION_KEY);
    for (let i = 0; i < listLength; i++) {
      const nextId = await this.rotateOnce();
      if (nextId === null) return null; // list emptied out from under us — race with a concurrent sync
      if (underCapacityIds.has(nextId)) return nextId;
    }
    return null;
  }

  // Public so ChatGateway can sync membership on its own — outside of an
  // actual pickNext call — right when an operator's eligibility changes
  // (join/status change/disconnect), so getQueueOrder() reflects it
  // immediately for the supervisor queue view rather than waiting for the
  // next assignment. Inserts newly-eligible operators at the front
  // (stakeholder requirement: an operator coming online — first time or
  // reactivating — gets the very next chat, ahead of whoever's already
  // waiting — see docs/chat.md) and removes anyone no longer eligible (went
  // away/offline/became a supervisor), without disturbing the relative
  // order of everyone else.
  async sync(eligibleIds: number[]): Promise<void> {
    const current = await this.redis.lrange(ROTATION_KEY, 0, -1);
    const currentIds = new Set(current.map((id) => Number(id)));
    const eligibleSet = new Set(eligibleIds);

    const toRemove = current.filter((id) => !eligibleSet.has(Number(id)));
    const toAdd = eligibleIds.filter((id) => !currentIds.has(id));

    if (toRemove.length > 0 || toAdd.length > 0) {
      const multi = this.redis.multi();
      for (const id of toRemove) {
        multi.lrem(ROTATION_KEY, 0, id);
      }
      // LPUSHing one at a time reverses toAdd's own order among itself (each
      // push lands left of the previous one) — iterate in reverse so, once
      // all pushes land, the batch's original relative order is preserved
      // at the front instead of being flipped.
      for (const id of [...toAdd].reverse()) {
        // The read (lrange) above and this write aren't one atomic op, so two
        // sync() calls racing on the same newly-eligible id (e.g. an
        // operator:join firing right as an assignment's broadcastQueue also
        // runs) can both decide it's missing and both push it, duplicating
        // the entry. LREM-then-LPUSH inside the same multi makes the add
        // idempotent regardless: whichever call's multi executes second just
        // removes the first call's copy before re-adding its own.
        multi.lrem(ROTATION_KEY, 0, String(id));
        multi.lpush(ROTATION_KEY, String(id));
      }
      await multi.exec();
    }
  }

  // Read-only snapshot of the current rotation order (front = next in line)
  // — backs the supervisor-facing live queue view (operator:queue_updated).
  // Doesn't sync first; callers that need an up-to-date view after an
  // eligibility change should call sync() themselves beforehand.
  async getQueueOrder(): Promise<number[]> {
    const ids = await this.redis.lrange(ROTATION_KEY, 0, -1);
    return ids.map(Number);
  }

  // Atomically moves the head of the list to the tail and returns it — one
  // hop of the rotation. Returns null if the list is empty.
  private async rotateOnce(): Promise<number | null> {
    const moved = await this.redis.lmove(ROTATION_KEY, ROTATION_KEY, 'LEFT', 'RIGHT');
    return moved === null ? null : Number(moved);
  }
}

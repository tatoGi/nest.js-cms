import RedisMock from 'ioredis-mock';
import { OperatorRotationService } from './operator-rotation.service';

// Plain unit tests, no Nest TestingModule — this service has no other
// injected dependencies, so constructing it directly with an ioredis-mock
// client (see the constructor's redis? param) is simplest. See docs/chat.md
// for the rotation algorithm this is testing.
//
// ioredis-mock instances share one global in-memory store by default (it
// simulates connecting to the same fake server, the way real ioredis
// clients pointed at the same host:port would) — flush before creating each
// test's client so tests can't see each other's leftover rotation state.
async function createService(): Promise<OperatorRotationService> {
  const client = new RedisMock();
  await client.flushall();
  return new OperatorRotationService(client as never);
}

describe('OperatorRotationService', () => {
  it('assigns operators one per lap, in join order, when all are equally free', async () => {
    const service = await createService();
    const capacity = new Set([1, 2, 3]);

    const first = await service.pickNext([1, 2, 3], capacity);
    const second = await service.pickNext([1, 2, 3], capacity);
    const third = await service.pickNext([1, 2, 3], capacity);
    const fourth = await service.pickNext([1, 2, 3], capacity);

    expect([first, second, third]).toEqual([1, 2, 3]);
    // A full lap completed — the 4th pick starts a new lap from operator 1.
    expect(fourth).toBe(1);
  });

  it('does not give the same operator two picks in a row while others are free', async () => {
    const service = await createService();
    const capacity = new Set([1, 2]);

    const picks = [
      await service.pickNext([1, 2], capacity),
      await service.pickNext([1, 2], capacity),
    ];

    expect(new Set(picks).size).toBe(2);
  });

  it('a newly-eligible operator joins at the front, ahead of whoever is already waiting', async () => {
    const service = await createService();

    // Operators 1 and 2 already in rotation and have each taken a turn.
    await service.pickNext([1, 2], new Set([1, 2]));
    await service.pickNext([1, 2], new Set([1, 2]));

    // Operator 3 comes online for the first time.
    const next = await service.pickNext([1, 2, 3], new Set([1, 2, 3]));

    // Stakeholder requirement: a newly-online operator gets the very next
    // chat, ahead of 1 (who's waited longest) and 2.
    expect(next).toBe(3);
  });

  it('skips an at-capacity operator without removing them from the queue', async () => {
    const service = await createService();

    // Operator 1 is eligible but at capacity; only 2 is under capacity.
    const next = await service.pickNext([1, 2], new Set([2]));

    expect(next).toBe(2);
  });

  it('returns null when every eligible operator is at capacity', async () => {
    const service = await createService();

    const next = await service.pickNext([1, 2], new Set());

    expect(next).toBeNull();
  });

  it('returns null when there are no eligible operators at all', async () => {
    const service = await createService();

    const next = await service.pickNext([], new Set());

    expect(next).toBeNull();
  });

  it('removes a departed operator without disrupting the order of the rest', async () => {
    const service = await createService();
    const capacity = new Set([1, 2, 3]);

    // Full lap: 1, 2, 3 all get a turn.
    await service.pickNext([1, 2, 3], capacity);
    await service.pickNext([1, 2, 3], capacity);
    await service.pickNext([1, 2, 3], capacity);

    // Operator 2 goes away — no longer eligible.
    const afterDeparture = await service.pickNext([1, 3], new Set([1, 3]));

    // Next lap should continue 1, then 3 — 2's absence doesn't reorder them.
    expect(afterDeparture).toBe(1);
    const following = await service.pickNext([1, 3], new Set([1, 3]));
    expect(following).toBe(3);
  });

  it('a reactivated operator rejoins at the front, getting the next chat', async () => {
    const service = await createService();

    // 1 and 2 both take a turn.
    await service.pickNext([1, 2], new Set([1, 2]));
    await service.pickNext([1, 2], new Set([1, 2]));

    // 2 goes away mid-rotation.
    await service.pickNext([1], new Set([1])); // 1 takes another turn while 2 is away

    // 2 comes back — stakeholder requirement: rejoins at the front, ahead of
    // 1, rather than waiting for the rotation to come back around.
    const next = await service.pickNext([1, 2], new Set([1, 2]));
    expect(next).toBe(2);
  });

  it('never duplicates an operator when two sync() calls race on the same newly-eligible id', async () => {
    const service = await createService();

    // sync()'s read-then-write isn't one atomic op, so two concurrent calls
    // (e.g. operator:join firing right as an assignment's broadcastQueue
    // also runs — see chat.gateway.ts) can both see id 1 as missing and both
    // try to add it. The LREM-before-LPUSH in sync() must make this
    // idempotent rather than producing two "1" entries.
    await Promise.all([service.sync([1]), service.sync([1])]);

    const queue = await service.getQueueOrder();
    expect(queue).toEqual([1]);
  });
});

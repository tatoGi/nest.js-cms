/**
 * Fixed-capacity sliding-window rate limiter keyed by an arbitrary id
 * (a socket id, an IP, a user id).
 *
 * Extracted so the "keep an array of timestamps, filter out the expired ones,
 * compare against a cap" logic exists once instead of being re-derived at each
 * call site — that hand-rolled version is easy to get subtly wrong (forgetting
 * to persist the filtered array leaks memory; filtering after the length check
 * lets bursts through).
 *
 * Single-process only: state is in-memory, so it does not hold across
 * instances behind a load balancer — same caveat as the rest of the chat
 * module's in-memory state.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxHits: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Records an attempt for `key` and reports whether it is allowed.
   * Returns false once `maxHits` attempts have already occurred inside the
   * trailing `windowMs`; the rejected attempt is deliberately not recorded,
   * so a caller that keeps hammering doesn't extend its own lockout.
   */
  tryConsume(key: string): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs);

    if (recent.length >= this.maxHits) {
      this.hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Drops a key's history — call on disconnect so the map doesn't grow. */
  forget(key: string): void {
    this.hits.delete(key);
  }

  reset(): void {
    this.hits.clear();
  }
}

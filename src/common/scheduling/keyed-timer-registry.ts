/**
 * A set of named, cancellable timers keyed by an arbitrary id (a chat session
 * id, a user id, …). Replaces the hand-rolled `Map<string, NodeJS.Timeout>`
 * pattern that otherwise gets duplicated for every kind of deferred work,
 * each copy re-implementing the same arm/cancel/clear-on-replace bookkeeping
 * and each one able to leak a timer in a slightly different way.
 *
 * Deliberately not a Nest provider: it holds per-use-case state, so an owner
 * creates one instance per concern (`new KeyedTimerRegistry('inactivity')`)
 * rather than sharing a single injected one. Single-process only, same
 * caveat as every other in-memory map in the chat module.
 */
export class KeyedTimerRegistry {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  /** `name` is only used for diagnostics (see `size`/`activeKeys`). */
  constructor(private readonly name = 'timers') {}

  /**
   * Schedules `task` to run after `delayMs`, replacing any timer already
   * armed for `key`. The entry removes itself before `task` runs, so a task
   * that re-arms the same key (a rescheduled countdown) doesn't have its new
   * timer immediately cancelled by its own cleanup.
   */
  arm(key: string, delayMs: number, task: () => void): void {
    this.cancel(key);
    const timer = setTimeout(() => {
      this.timers.delete(key);
      task();
    }, delayMs);
    this.timers.set(key, timer);
  }

  /** No-op when nothing is armed for `key`. */
  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (!timer) return;
    clearTimeout(timer);
    this.timers.delete(key);
  }

  has(key: string): boolean {
    return this.timers.has(key);
  }

  /** Cancels everything — intended for shutdown/teardown. */
  cancelAll(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  get size(): number {
    return this.timers.size;
  }

  get registryName(): string {
    return this.name;
  }
}

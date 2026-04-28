// In-memory, per-process TTL cache with single-flight de-duplication.
//
// Why this lives here and not in `lib/`:
//   - Only the API server's hot read endpoints need it; the worker doesn't
//     serve HTTP and the web bundle has no use for it.
//   - Per-process is intentional. Each Fly machine keeps its own copy and
//     each one independently warms on first hit. With 1–2 machines on a
//     small fleet and TTLs in the 5–10s range, the cross-machine consistency
//     drift is negligible compared to the win of avoiding round-trips to
//     Neon (~Mumbai → Singapore is ~25–35ms RTT).
//
// Single-flight: when N concurrent requests arrive for a cold key, only the
// first one runs `compute()`; the rest await the same in-flight promise and
// share the result. This is the property that prevents the "thundering herd"
// that would otherwise hit Neon every time a cache entry expired under load.
//
// All entries from the same `cached:true` outcome (whether the value came
// from the store OR from a piggyback on an in-flight compute) are reported
// with `X-Cache: HIT` so dashboards / curl checks see a single bit. The
// distinction "cold-MISS-that-spawned-the-compute vs MISS-that-piggybacked"
// is intentionally hidden — it's an implementation detail of single-flight,
// not something operators need to reason about.

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class TTLCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private hits = 0;
  private misses = 0;

  constructor(private readonly ttlMs: number) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error(`TTLCache requires a positive ttlMs, got ${ttlMs}`);
    }
  }

  /** Return cached value if present and unexpired, else undefined. */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Replace any existing value with a fresh TTL window. */
  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /**
   * Single-flight cached compute.
   *
   * Returns `{ value, cached }` where `cached === false` means this caller
   * triggered the underlying compute, and `cached === true` means it was
   * served either from the store or by piggybacking on an in-flight compute.
   *
   * Throws whatever `compute()` throws — failures are NOT cached, so the
   * next request retries. This is intentional: caching a failure for 5–10s
   * would amplify a transient blip into a sustained outage. The negative
   * cost is one extra DB hit per error; that's acceptable.
   */
  async getOrCompute(
    key: string,
    compute: () => Promise<T>,
  ): Promise<{ value: T; cached: boolean }> {
    const fresh = this.get(key);
    if (fresh !== undefined) {
      this.hits++;
      return { value: fresh, cached: true };
    }
    const existing = this.inFlight.get(key);
    if (existing) {
      // A peer is already computing this key — piggyback. Counts as a hit
      // because we did not trigger any extra backend work.
      this.hits++;
      return { value: await existing, cached: true };
    }
    this.misses++;
    const promise = (async () => {
      try {
        const value = await compute();
        this.set(key, value);
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, promise);
    return { value: await promise, cached: false };
  }

  /** Drop a single key (e.g. after an admin write that should propagate now). */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Drop everything. Mainly used in tests. */
  clear(): void {
    this.store.clear();
    this.inFlight.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /** Observability: { size, hits, misses, hitRate }. */
  stats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }
}

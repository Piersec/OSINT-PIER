import type { CheckResult } from '@osint-pier/contracts';

export type CacheStatus = 'HIT' | 'MISS' | 'COALESCED' | 'BYPASS';

interface CacheEntry {
  expiresAt: number;
  result: CheckResult;
}

export class CheckResultCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #inFlight = new Map<string, Promise<CheckResult>>();
  readonly #ttlMs: number;
  readonly #maxEntries: number;
  readonly #now: () => number;
  #generation = 0;

  constructor(options: {
    ttlMs: number;
    maxEntries: number;
    now?: () => number;
  }) {
    this.#ttlMs = options.ttlMs;
    this.#maxEntries = options.maxEntries;
    this.#now = options.now ?? Date.now;
  }

  clear(): void {
    this.#generation += 1;
    this.#entries.clear();
    this.#inFlight.clear();
  }

  async execute(
    key: string,
    producer: () => Promise<CheckResult>,
  ): Promise<{ result: CheckResult; cacheStatus: CacheStatus }> {
    if (this.#ttlMs === 0) {
      return { result: await producer(), cacheStatus: 'BYPASS' };
    }

    const cached = this.#get(key);
    if (cached) return { result: cached, cacheStatus: 'HIT' };

    const pending = this.#inFlight.get(key);
    if (pending) {
      return { result: await pending, cacheStatus: 'COALESCED' };
    }

    const generation = this.#generation;
    const execution = producer();
    this.#inFlight.set(key, execution);
    try {
      const result = await execution;
      if (result.status === 'success' && generation === this.#generation) {
        this.#set(key, result);
      }
      return { result, cacheStatus: 'MISS' };
    } finally {
      if (this.#inFlight.get(key) === execution) this.#inFlight.delete(key);
    }
  }

  #get(key: string): CheckResult | undefined {
    this.#pruneExpired();
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.result;
  }

  #set(key: string, result: CheckResult): void {
    this.#pruneExpired();
    this.#entries.delete(key);
    while (this.#entries.size >= this.#maxEntries) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.#entries.delete(oldest);
    }
    this.#entries.set(key, {
      expiresAt: this.#now() + this.#ttlMs,
      result,
    });
  }

  #pruneExpired(): void {
    const now = this.#now();
    for (const [key, entry] of this.#entries) {
      if (entry.expiresAt <= now) this.#entries.delete(key);
    }
  }
}

/** Fixed-window rate limiting. Pure logic here; the counter store is injected (Postgres in the app, memory in tests). */

export interface RateRule {
  /** Short name used in the key, e.g. "ask". */
  name: string;
  limit: number;
  windowMs: number;
}

export const RULES = {
  /** Protects the free Gemini quota: one question is one generation + one embedding call. */
  ask: { name: "ask", limit: 20, windowMs: 60 * 60 * 1000 },
  upload: { name: "upload", limit: 30, windowMs: 24 * 60 * 60 * 1000 },
  login: { name: "login", limit: 10, windowMs: 15 * 60 * 1000 },
  signup: { name: "signup", limit: 5, windowMs: 60 * 60 * 1000 },
} satisfies Record<string, RateRule>;

export interface CounterStore {
  /** Atomically add 1 to the counter for (key, windowStart) and return the new count. */
  increment(key: string, windowStart: Date): Promise<number>;
  /** Read the counter without changing it. */
  peek(key: string, windowStart: Date): Promise<number>;
}

export interface RateDecision {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
  resetAt: Date;
}

export function windowStart(now: number, windowMs: number): Date {
  return new Date(Math.floor(now / windowMs) * windowMs);
}

export function decide(count: number, rule: RateRule, now: number): RateDecision {
  const start = windowStart(now, rule.windowMs).getTime();
  const resetAt = new Date(start + rule.windowMs);
  const allowed = count <= rule.limit;
  return {
    allowed,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - count),
    resetAt,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
  };
}

/** Count one attempt against the rule and say whether it is allowed. */
export async function consume(store: CounterStore, rule: RateRule, subject: string, now = Date.now()): Promise<RateDecision> {
  const count = await store.increment(`${rule.name}:${subject}`, windowStart(now, rule.windowMs));
  return decide(count, rule, now);
}

/** How much is left, without using any of it (for "17 of 20 questions left"). */
export async function peekRemaining(store: CounterStore, rule: RateRule, subject: string, now = Date.now()): Promise<RateDecision> {
  const count = await store.peek(`${rule.name}:${subject}`, windowStart(now, rule.windowMs));
  return { ...decide(count, rule, now), allowed: count < rule.limit };
}

export class MemoryCounterStore implements CounterStore {
  private counts = new Map<string, number>();
  async increment(key: string, start: Date): Promise<number> {
    const k = `${key}@${start.getTime()}`;
    const next = (this.counts.get(k) ?? 0) + 1;
    this.counts.set(k, next);
    return next;
  }
  async peek(key: string, start: Date): Promise<number> {
    return this.counts.get(`${key}@${start.getTime()}`) ?? 0;
  }
}

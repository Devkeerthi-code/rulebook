import { consume, peekRemaining, type CounterStore, type RateDecision, type RateRule } from "@/lib/rate-limit";
import { db } from "./db";

/** Postgres-backed counters: one atomic upsert per attempt, so limits hold across serverless instances. */
export const postgresCounterStore: CounterStore = {
  async increment(key, windowStart) {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimitBucket" ("key", "windowStart", "count") VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
      RETURNING "count"`;
    // Prune expired windows now and then instead of running a cron job.
    if (Math.random() < 0.02) {
      await db.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 24 * 3600 * 1000) } } });
    }
    return rows[0]?.count ?? 1;
  },
  async peek(key, windowStart) {
    const row = await db.rateLimitBucket.findUnique({ where: { key_windowStart: { key, windowStart } } });
    return row?.count ?? 0;
  },
};

export function limit(rule: RateRule, subject: string): Promise<RateDecision> {
  return consume(postgresCounterStore, rule, subject);
}

export function remaining(rule: RateRule, subject: string): Promise<RateDecision> {
  return peekRemaining(postgresCounterStore, rule, subject);
}

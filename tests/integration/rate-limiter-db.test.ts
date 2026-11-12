import { afterAll, describe, expect, it } from "vitest";
import { consume, type RateRule } from "@/lib/rate-limit";
import { postgresCounterStore } from "@/server/rate-limiter";
import { cleanup, TEST_TAG } from "../helpers/db-fixtures";

afterAll(cleanup);

describe("Postgres-backed rate limiter", () => {
  it("counts atomically under concurrent requests and blocks past the limit", async () => {
    const rule: RateRule = { name: `ask-${TEST_TAG}`, limit: 5, windowMs: 60 * 60 * 1000 };
    const now = Date.now();
    const results = await Promise.all(Array.from({ length: 8 }, () => consume(postgresCounterStore, rule, "user-x", now)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect(results.filter((r) => !r.allowed)).toHaveLength(3);
    expect(results.find((r) => !r.allowed)?.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps separate users separate", async () => {
    const rule: RateRule = { name: `ask2-${TEST_TAG}`, limit: 1, windowMs: 60_000 };
    expect((await consume(postgresCounterStore, rule, "a")).allowed).toBe(true);
    expect((await consume(postgresCounterStore, rule, "b")).allowed).toBe(true);
    expect((await consume(postgresCounterStore, rule, "a")).allowed).toBe(false);
  });
});

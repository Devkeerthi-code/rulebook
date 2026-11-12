import { describe, expect, it } from "vitest";
import { consume, decide, MemoryCounterStore, peekRemaining, windowStart, type RateRule } from "./rate-limit";

const rule: RateRule = { name: "ask", limit: 3, windowMs: 60_000 };
const t0 = Date.UTC(2025, 8, 1, 10, 0, 0);

describe("rate limiter", () => {
  it("allows up to the limit, then blocks with a retry-after", async () => {
    const store = new MemoryCounterStore();
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consume(store, rule, "user1", t0 + 1000));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    expect(results[3]!.retryAfterSeconds).toBe(59);
  });

  it("counts each user separately", async () => {
    const store = new MemoryCounterStore();
    for (let i = 0; i < 3; i++) await consume(store, rule, "user1", t0);
    expect((await consume(store, rule, "user2", t0)).allowed).toBe(true);
    expect((await consume(store, rule, "user1", t0)).allowed).toBe(false);
  });

  it("resets in the next window", async () => {
    const store = new MemoryCounterStore();
    for (let i = 0; i < 4; i++) await consume(store, rule, "user1", t0);
    expect((await consume(store, rule, "user1", t0 + 60_000)).allowed).toBe(true);
  });

  it("peeking does not use up the allowance", async () => {
    const store = new MemoryCounterStore();
    await consume(store, rule, "u", t0);
    expect((await peekRemaining(store, rule, "u", t0)).remaining).toBe(2);
    expect((await peekRemaining(store, rule, "u", t0)).remaining).toBe(2);
  });

  it("aligns windows to fixed boundaries", () => {
    expect(windowStart(t0 + 59_999, 60_000).getTime()).toBe(t0);
    expect(decide(3, rule, t0).allowed).toBe(true);
    expect(decide(4, rule, t0).allowed).toBe(false);
  });
});

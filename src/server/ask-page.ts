import "server-only";
import type { ThreadItem } from "@/components/ask/types";
import { RULES } from "@/lib/rate-limit";
import { remaining } from "./rate-limiter";
import { db } from "./db";
import { suggestedQuestions, type StoredMessage } from "./space-data";

/** Everything the ask screen needs on first render. */
export async function askPageData(spaceId: string, userId: string) {
  const [starters, rate, readyDocs] = await Promise.all([
    suggestedQuestions(spaceId, 6),
    remaining(RULES.ask, userId),
    db.document.count({ where: { spaceId, status: "READY" } }),
  ]);
  return { starters, remaining: rate.remaining, limit: rate.limit, hasDocuments: readyDocs > 0 };
}

/** Saved messages -> thread items, so a reopened conversation looks exactly like it did live. */
export function toThreadItems(messages: StoredMessage[]): ThreadItem[] {
  return messages.map((m) =>
    m.role === "USER"
      ? { kind: "question", key: m.id, text: m.content }
      : {
          kind: "answer",
          key: m.id,
          id: m.outcome === "ERROR" ? null : m.id,
          status: m.outcome === "ERROR" ? "error" : "done",
          error: m.outcome === "ERROR" ? "This answer didn't finish. Ask again." : undefined,
          text: m.content,
          sources: m.outcome === "ANSWERED" ? m.sources : [],
          closest: m.outcome === "NOT_FOUND" ? m.sources : [],
          notFound: m.outcome === "NOT_FOUND",
          conflict: m.conflict,
          followups: [],
          rating: m.rating,
        },
  );
}

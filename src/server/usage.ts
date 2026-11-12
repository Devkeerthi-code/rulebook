import type { UsageType } from "@/generated/prisma/client";
import { db } from "./db";

/** Record a usage event. Never stores question text or personal data; never blocks or fails the caller. */
export async function track(type: UsageType, ids: { userId?: string | null; spaceId?: string | null } = {}): Promise<void> {
  try {
    await db.usageEvent.create({ data: { type, userId: ids.userId ?? null, spaceId: ids.spaceId ?? null } });
  } catch (err) {
    console.error("usage tracking failed", err);
  }
}

export interface PublicStats {
  people: number;
  colleges: number;
  questions: number;
}

/** Honest numbers for the landing page: real signups and spaces, the demo space excluded. */
export async function publicStats(): Promise<PublicStats> {
  const [people, colleges, questions] = await Promise.all([
    db.user.count(),
    db.space.count({ where: { isDemo: false } }),
    db.usageEvent.count({ where: { type: "QUESTION_ASKED" } }),
  ]);
  return { people, colleges, questions };
}

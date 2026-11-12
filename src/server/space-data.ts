/**
 * Every read and write of space content goes through here, and every query is scoped by spaceId
 * (and by userId for a member's own conversations). Callers must have checked membership first
 * (src/server/access.ts); these functions are the second wall.
 */
import type { AnswerSource, ConflictNote } from "@/lib/answer-types";
import { queryTerms, stem } from "@/lib/text";
import type { FeedbackReason, Rating } from "@/generated/prisma/client";
import { db } from "./db";

export async function listDocuments(spaceId: string) {
  return db.document.findMany({
    where: { spaceId },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      type: true,
      effectiveDate: true,
      version: true,
      status: true,
      progress: true,
      errorMessage: true,
      pageCount: true,
      ocrPageCount: true,
      fileName: true,
      fileSize: true,
      createdAt: true,
      readyAt: true,
    },
  });
}

export type ShelfDocument = Awaited<ReturnType<typeof listDocuments>>[number];

export async function getDocument(spaceId: string, documentId: string) {
  return db.document.findFirst({ where: { id: documentId, spaceId } });
}

export async function getDocumentFile(spaceId: string, documentId: string) {
  return db.documentFile.findFirst({
    where: { documentId, document: { spaceId } },
    select: { bytes: true, mimeType: true, document: { select: { fileName: true, version: true } } },
  });
}

/** Text of one page (used to show the cited passage next to a scanned page that has no text layer). */
export async function getPageText(spaceId: string, documentId: string, pageNumber: number) {
  return db.documentPage.findFirst({
    where: { documentId, pageNumber, document: { spaceId } },
    select: { text: true, ocr: true },
  });
}

export async function listConversations(spaceId: string, userId: string, take = 20) {
  return db.conversation.findMany({
    where: { spaceId, userId },
    orderBy: { updatedAt: "desc" },
    take,
    select: { id: true, title: true, updatedAt: true },
  });
}

export interface StoredMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  outcome: "ANSWERED" | "NOT_FOUND" | "ERROR" | null;
  sources: AnswerSource[];
  conflict: ConflictNote | null;
  rating: Rating | null;
  createdAt: Date;
}

export async function getConversation(spaceId: string, userId: string, conversationId: string) {
  const convo = await db.conversation.findFirst({
    where: { id: conversationId, spaceId, userId },
    select: {
      id: true,
      title: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, outcome: true, sources: true, conflict: true, createdAt: true, feedback: { select: { rating: true } } },
      },
    },
  });
  if (!convo) return null;
  const messages: StoredMessage[] = convo.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    outcome: m.outcome,
    sources: (m.sources as AnswerSource[] | null) ?? [],
    conflict: (m.conflict as ConflictNote | null) ?? null,
    rating: m.feedback?.rating ?? null,
    createdAt: m.createdAt,
  }));
  return { id: convo.id, title: convo.title, messages };
}

/** Last few answered turns, for follow-up context. */
export async function recentTurns(spaceId: string, userId: string, conversationId: string, take = 3) {
  const messages = await db.message.findMany({
    where: { conversationId, spaceId, conversation: { userId } },
    orderBy: { createdAt: "desc" },
    take: take * 2,
    select: { role: true, content: true },
  });
  const ordered = messages.reverse();
  const turns: { question: string; answer: string }[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    const q = ordered[i]!;
    const a = ordered[i + 1]!;
    if (q.role === "USER" && a.role === "ASSISTANT") turns.push({ question: q.content, answer: a.content || "(not in the documents)" });
  }
  return turns.slice(-take);
}

export async function suggestedQuestions(spaceId: string, take = 6): Promise<string[]> {
  const rows = await db.suggestedQuestion.findMany({
    where: { spaceId, document: { status: "READY" } },
    orderBy: { createdAt: "asc" },
    select: { text: true, documentId: true },
  });
  // Round-robin across documents so the starters cover more than one PDF.
  const byDoc = new Map<string, string[]>();
  for (const r of rows) byDoc.set(r.documentId, [...(byDoc.get(r.documentId) ?? []), r.text]);
  const lists = [...byDoc.values()];
  const out: string[] = [];
  for (let i = 0; out.length < take && lists.some((l) => l[i]); i++) {
    for (const l of lists) if (l[i] && out.length < take) out.push(l[i]!);
  }
  return out;
}

/**
 * Save thumbs up/down. Only the person who asked can rate an answer, and only inside its space.
 * Returns false (and changes nothing) otherwise.
 */
export async function saveFeedback(input: {
  spaceId: string;
  userId: string;
  messageId: string;
  rating: Rating;
  reason?: FeedbackReason;
  note?: string;
}): Promise<boolean> {
  const message = await db.message.findFirst({
    where: { id: input.messageId, spaceId: input.spaceId, role: "ASSISTANT", conversation: { userId: input.userId } },
    select: { id: true },
  });
  if (!message) return false;
  const data = { rating: input.rating, reason: input.rating === "DOWN" ? (input.reason ?? null) : null, note: input.note || null };
  await db.feedback.upsert({
    where: { messageId: message.id },
    create: { messageId: message.id, spaceId: input.spaceId, userId: input.userId, ...data },
    update: data,
  });
  return true;
}

export interface GapRow {
  messageId: string;
  question: string;
  status: "NOT_FOUND" | "DOWNVOTED";
  reason: FeedbackReason | null;
  note: string | null;
  askedAt: Date;
  closestTitles: string[];
}

/** Admin view: questions the shelf couldn't answer, or that students downvoted. */
export async function gapsReport(spaceId: string, take = 50) {
  const answers = await db.message.findMany({
    where: {
      spaceId,
      role: "ASSISTANT",
      OR: [{ outcome: "NOT_FOUND" }, { feedback: { rating: "DOWN" } }],
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      outcome: true,
      sources: true,
      createdAt: true,
      conversationId: true,
      feedback: { select: { rating: true, reason: true, note: true } },
    },
  });
  // The question is the user message just before each answer in the same conversation.
  const questions = await db.message.findMany({
    where: { spaceId, role: "USER", conversationId: { in: [...new Set(answers.map((a) => a.conversationId))] } },
    orderBy: { createdAt: "asc" },
    select: { conversationId: true, content: true, createdAt: true },
  });
  const rows: GapRow[] = answers.map((a) => {
    const q = questions.filter((m) => m.conversationId === a.conversationId && m.createdAt <= a.createdAt).at(-1);
    const titles = [...new Set(((a.sources as AnswerSource[] | null) ?? []).map((s) => s.title))].slice(0, 2);
    return {
      messageId: a.id,
      question: q?.content ?? "(question not found)",
      status: a.outcome === "NOT_FOUND" ? "NOT_FOUND" : "DOWNVOTED",
      reason: a.feedback?.reason ?? null,
      note: a.feedback?.note ?? null,
      askedAt: a.createdAt,
      closestTitles: titles,
    };
  });

  const [asked, answered, notFound, down] = await Promise.all([
    db.message.count({ where: { spaceId, role: "USER" } }),
    db.message.count({ where: { spaceId, role: "ASSISTANT", outcome: "ANSWERED" } }),
    db.message.count({ where: { spaceId, role: "ASSISTANT", outcome: "NOT_FOUND" } }),
    db.feedback.count({ where: { spaceId, rating: "DOWN" } }),
  ]);

  return { rows, stats: { asked, answered, notFound, down }, topics: missingTopics(rows.filter((r) => r.status === "NOT_FOUND").map((r) => r.question)) };
}

/** Words that keep coming up in unanswered questions: a hint about which document is missing. */
export function missingTopics(questions: string[], take = 6): { term: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const q of questions) {
    for (const term of new Set(queryTerms(q).map(stem).filter((t) => t.length > 3 && !/^\d+$/.test(t)))) {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }
  return [...counts]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, take)
    .map(([term, count]) => ({ term, count }));
}

export async function listMembers(spaceId: string) {
  return db.membership.findMany({
    where: { spaceId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
  });
}

export async function spaceCounts(spaceId: string) {
  const [members, documents, pages] = await Promise.all([
    db.membership.count({ where: { spaceId } }),
    db.document.count({ where: { spaceId, status: "READY" } }),
    db.document.aggregate({ where: { spaceId, status: "READY" }, _sum: { pageCount: true } }),
  ]);
  return { members, documents, pages: pages._sum.pageCount ?? 0 };
}

import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { AiQuotaError } from "@/lib/ai-types";
import { runAnswerPipeline, type PipelineResult } from "@/lib/answer-pipeline";
import type { StreamEvent } from "@/lib/answer-types";
import { db } from "./db";
import { geminiAnswerModel, geminiEmbedder } from "./gemini";
import { retrieve } from "./retrieval";
import { recentTurns } from "./space-data";
import { track } from "./usage";

/** A question asked again within this window, before the first one finished, is treated as a duplicate submit. */
const DUPLICATE_WINDOW_MS = 30_000;

export class AskError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Find (or start) the conversation and record the question. Rejects duplicate in-flight submits. */
export async function startTurn(spaceId: string, userId: string, question: string, conversationId?: string) {
  let convo;
  if (conversationId) {
    convo = await db.conversation.findFirst({ where: { id: conversationId, spaceId, userId }, select: { id: true } });
    if (!convo) throw new AskError("That conversation doesn't exist.", 404);
    const last = await db.message.findFirst({ where: { conversationId }, orderBy: { createdAt: "desc" }, select: { role: true, createdAt: true } });
    if (last?.role === "USER" && Date.now() - last.createdAt.getTime() < DUPLICATE_WINDOW_MS) {
      throw new AskError("Still answering your last question. Give it a few seconds.", 409);
    }
  } else {
    convo = await db.conversation.create({ data: { spaceId, userId, title: question.slice(0, 90) }, select: { id: true } });
  }
  const history = await recentTurns(spaceId, userId, convo.id);
  const questionMessage = await db.message.create({
    data: { conversationId: convo.id, spaceId, role: "USER", content: question },
    select: { id: true },
  });
  await track("QUESTION_ASKED", { userId, spaceId });
  return { conversationId: convo.id, questionId: questionMessage.id, history };
}

async function saveAnswer(spaceId: string, conversationId: string, result: PipelineResult | null, startedAt: number) {
  const base = { conversationId, spaceId, role: "ASSISTANT" as const, latencyMs: Date.now() - startedAt };
  const data: Prisma.MessageUncheckedCreateInput = !result
    ? { ...base, content: "", outcome: "ERROR" }
    : result.outcome === "ANSWERED"
      ? {
          ...base,
          content: result.text,
          outcome: "ANSWERED",
          sources: result.sources as unknown as Prisma.InputJsonValue,
          conflict: (result.conflict ?? undefined) as Prisma.InputJsonValue | undefined,
        }
      : { ...base, content: "", outcome: "NOT_FOUND", sources: result.closest as unknown as Prisma.InputJsonValue };
  const [message] = await db.$transaction([
    db.message.create({ data, select: { id: true } }),
    db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);
  return message.id;
}

function errorMessage(err: unknown): string {
  if (err instanceof AiQuotaError) return "Rulebook's free AI quota is used up for the moment. Try again in a minute.";
  return "Something went wrong while answering. Your question is saved; try asking again.";
}

/** Runs the pipeline and returns an NDJSON stream of StreamEvents. Persists the answer whatever happens. */
export function answerStream(input: {
  spaceId: string;
  userId: string;
  question: string;
  conversationId: string;
  questionId: string;
  history: { question: string; answer: string }[];
  signal: AbortSignal;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  return new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Client went away; keep going so the answer is still saved.
        }
      };
      send({ type: "start", conversationId: input.conversationId, questionId: input.questionId });
      let result: PipelineResult | null = null;
      try {
        const pipeline = runAnswerPipeline(
          { question: input.question, history: input.history },
          {
            retrieve: (query) => retrieve(input.spaceId, query, geminiEmbedder),
            model: geminiAnswerModel,
            signal: input.signal,
          },
        );
        let step = await pipeline.next();
        while (!step.done) {
          send(step.value);
          step = await pipeline.next();
        }
        result = step.value;
        const messageId = await saveAnswer(input.spaceId, input.conversationId, result, startedAt);
        if (result.outcome === "NOT_FOUND") await track("ANSWER_NOT_FOUND", { userId: input.userId, spaceId: input.spaceId });
        send({
          type: "done",
          messageId,
          outcome: result.outcome,
          cited: result.outcome === "ANSWERED" ? result.cited : [],
          followups: result.followups,
          content: result.outcome === "ANSWERED" ? result.text : "",
        });
      } catch (err) {
        console.error("answer failed", err);
        await saveAnswer(input.spaceId, input.conversationId, null, startedAt).catch(() => undefined);
        send({ type: "error", message: errorMessage(err) });
      } finally {
        controller.close();
      }
    },
  });
}

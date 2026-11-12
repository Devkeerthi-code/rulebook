import type { AnswerSource, ConflictNote, StreamEvent } from "@/lib/answer-types";

export interface QuestionItem {
  kind: "question";
  key: string;
  text: string;
}

export interface AnswerItem {
  kind: "answer";
  key: string;
  /** Message id once saved; feedback needs it. */
  id: string | null;
  status: "thinking" | "streaming" | "done" | "error";
  text: string;
  sources: AnswerSource[];
  closest: AnswerSource[];
  notFound: boolean;
  conflict: ConflictNote | null;
  followups: string[];
  rating: "UP" | "DOWN" | null;
  error?: string;
  elapsedMs?: number;
}

export type ThreadItem = QuestionItem | AnswerItem;

export class AskFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** POST a question and yield the server's NDJSON events as they arrive. */
export async function* askStream(spaceId: string, question: string, conversationId: string | null, signal: AbortSignal, onRemaining: (n: number) => void) {
  let res: Response;
  try {
    res = await fetch(`/api/spaces/${spaceId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, conversationId: conversationId ?? undefined }),
      signal,
    });
  } catch {
    throw new AskFailure("Couldn't reach Rulebook. Check your connection and ask again.", 0);
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AskFailure(body.error ?? "Something went wrong. Try again in a moment.", res.status);
  }
  const remaining = Number(res.headers.get("X-RateLimit-Remaining"));
  if (Number.isFinite(remaining)) onRemaining(remaining);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as StreamEvent;
      newline = buffer.indexOf("\n");
    }
  }
}

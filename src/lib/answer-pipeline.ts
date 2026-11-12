import type { AnswerModel } from "./ai-types";
import type { AnswerSource, ConflictNote, RankedChunk, StreamEvent } from "./answer-types";
import { AnswerStreamParser } from "./answer-protocol";
import { finalizeAnswer, parseConflict } from "./citations";
import { buildUserPrompt, retrievalQuery, SYSTEM_INSTRUCTION, type HistoryTurn } from "./prompt";

export interface Retrieval {
  top: RankedChunk[];
  ranked: RankedChunk[];
  unanswerable: boolean;
}

export interface PipelineInput {
  question: string;
  history: HistoryTurn[];
}

export interface PipelineDeps {
  retrieve(query: string): Promise<Retrieval>;
  model: AnswerModel;
  signal: AbortSignal;
}

export type PipelineResult =
  | { outcome: "ANSWERED"; text: string; cited: number[]; sources: AnswerSource[]; conflict: ConflictNote | null; followups: string[] }
  | { outcome: "NOT_FOUND"; closest: AnswerSource[]; followups: string[] };

export type PipelineEvent = Extract<StreamEvent, { type: "sources" | "delta" | "conflict" | "not_found" }>;

export function toSources(chunks: RankedChunk[]): AnswerSource[] {
  return chunks.map((c, i) => ({
    n: i + 1,
    chunkId: c.id,
    documentId: c.documentId,
    title: c.documentTitle,
    type: c.documentType,
    page: c.pageNumber,
    effectiveDate: c.effectiveDate,
    heading: c.heading,
    text: c.text,
  }));
}

/** Closest passages shown with "not in your documents": the best few, at most one per page. */
function closestPassages(ranked: RankedChunk[]): AnswerSource[] {
  const seen = new Set<string>();
  const picked = ranked.filter((c) => {
    const key = `${c.documentId}:${c.pageNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return toSources(picked.slice(0, 3));
}

/**
 * Retrieve -> prompt -> stream -> verify.
 * The model only ever sees retrieved text as quoted data, and its output is checked afterwards:
 * no valid citation means no answer, whatever the model wrote.
 */
export async function* runAnswerPipeline(input: PipelineInput, deps: PipelineDeps): AsyncGenerator<PipelineEvent, PipelineResult> {
  const retrieval = await deps.retrieve(retrievalQuery(input.question, input.history));
  const closest = closestPassages(retrieval.ranked);

  if (retrieval.unanswerable || retrieval.top.length === 0) {
    yield { type: "not_found", closest };
    return { outcome: "NOT_FOUND", closest, followups: [] };
  }

  const sources = toSources(retrieval.top);
  yield { type: "sources", sources };

  const parser = new AnswerStreamParser();
  const prompt = buildUserPrompt(input.question, sources, input.history);
  for await (const chunk of deps.model.stream(SYSTEM_INSTRUCTION, prompt, deps.signal)) {
    const visible = parser.push(chunk);
    if (visible) yield { type: "delta", text: visible };
  }
  const parsed = parser.finish();
  const final = finalizeAnswer(parsed.text, sources);

  if (parsed.notFound || final.uncited) {
    yield { type: "not_found", closest };
    return { outcome: "NOT_FOUND", closest, followups: parsed.followups };
  }

  const conflict = parseConflict(parsed.conflictLine, sources);
  if (conflict) yield { type: "conflict", conflict };
  return { outcome: "ANSWERED", text: final.text, cited: final.cited, sources, conflict, followups: parsed.followups };
}

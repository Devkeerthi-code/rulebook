import { EMBEDDING_DIMENSIONS, l2normalize, type AnswerModel, type Embedder } from "@/lib/ai-types";
import type { RankedChunk } from "@/lib/answer-types";
import { queryTerms, stem } from "@/lib/text";

function hash(term: string): number {
  let h = 2166136261;
  for (let i = 0; i < term.length; i++) h = Math.imul(h ^ term.charCodeAt(i), 16777619);
  return Math.abs(h);
}

/**
 * Deterministic bag-of-stems embedder (feature hashing). It stands in for Gemini in tests so retrieval
 * runs against real pgvector + full-text SQL without network calls. Real quality is measured by `npm run eval`.
 */
export const hashEmbedder: Embedder = {
  // No shared stems gives ~0 similarity with feature hashing; any real overlap scores well above this.
  relevanceFloor: 0.12,
  async embedDocuments(texts) {
    return texts.map(embedOne);
  },
  async embedQuery(text) {
    return embedOne(text);
  },
};

function embedOne(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const term of queryTerms(text).map(stem)) {
    const h = hash(term);
    v[h % EMBEDDING_DIMENSIONS]! += h % 2 === 0 ? 1 : -1;
  }
  return l2normalize(v);
}

/** A model that replays a fixed script and records the prompt it was given. */
export function scriptedModel(chunks: string[]): AnswerModel & { lastPrompt: string; lastSystem: string; calls: number } {
  const model = {
    lastPrompt: "",
    lastSystem: "",
    calls: 0,
    async *stream(system: string, prompt: string) {
      model.calls++;
      model.lastSystem = system;
      model.lastPrompt = prompt;
      for (const c of chunks) yield c;
    },
  };
  return model;
}

export function rankedChunk(over: Partial<RankedChunk> & { id: string; text: string }): RankedChunk {
  return {
    documentId: "doc-handbook",
    documentTitle: "Student Handbook 2025-26",
    documentType: "HANDBOOK",
    effectiveDate: "2025-07-01",
    version: 1,
    pageNumber: 5,
    heading: "",
    vectorScore: 0.8,
    keywordScore: 0.1,
    vectorRank: 1,
    keywordRank: 1,
    score: 1,
    termCoverage: 0.8,
    ...over,
  };
}

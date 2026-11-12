/** Seams between the pipeline and Gemini, so tests can swap in deterministic fakes. */

export const EMBEDDING_DIMENSIONS = 768;

export interface Embedder {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
  /**
   * Best-match cosine similarity below which nothing on the shelf is about the question.
   * Embedder-specific: Gemini scores unrelated text around 0.45-0.65 (see scripts/calibrate.ts).
   */
  relevanceFloor: number;
}

export interface AnswerModel {
  /** Streams raw text. Must throw (not hang) on failure; honours the abort signal. */
  stream(system: string, prompt: string, signal: AbortSignal): AsyncIterable<string>;
}

/** Thrown when Gemini says we've hit the quota, so the UI can say "try again in a minute". */
export class AiQuotaError extends Error {
  constructor(message = "The AI quota is used up for the moment.") {
    super(message);
    this.name = "AiQuotaError";
  }
}

export function l2normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

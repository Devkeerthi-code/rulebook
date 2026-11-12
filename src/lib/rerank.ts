import type { RankedChunk, RetrievedChunk } from "./answer-types";
import { queryTerms, stem } from "./text";

/** Standard RRF constant: dampens the gap between rank 1 and rank 2 so neither list dominates. */
export const RRF_K = 60;

/** Strong keyword evidence overrides a weak vector match (the question uses the document's own words). */
export const STRONG_TERM_COVERAGE = 0.67;

/** Merge vector and keyword hits by id; a chunk found by both keeps both ranks. */
export function mergeCandidates(vector: RetrievedChunk[], keyword: RetrievedChunk[]): RetrievedChunk[] {
  const byId = new Map<string, RetrievedChunk>();
  for (const c of vector) byId.set(c.id, { ...c });
  for (const c of keyword) {
    const existing = byId.get(c.id);
    if (existing) {
      existing.keywordScore = c.keywordScore;
      existing.keywordRank = c.keywordRank;
    } else {
      byId.set(c.id, { ...c });
    }
  }
  return [...byId.values()];
}

/** Fraction of the question's meaningful terms that appear in the chunk (stemmed). */
export function termCoverage(question: string, chunk: Pick<RetrievedChunk, "heading" | "text">): number {
  const terms = queryTerms(question).map(stem);
  if (terms.length === 0) return 0;
  const words = new Set(queryTerms(`${chunk.heading} ${chunk.text}`).map(stem));
  return terms.filter((t) => words.has(t)).length / terms.length;
}

function rrf(rank: number | null): number {
  return rank === null ? 0 : 1 / (RRF_K + rank);
}

/**
 * Re-rank merged candidates:
 *   70% reciprocal-rank fusion of the two lists (normalised to the best candidate),
 *   30% lexical coverage of the question terms (rewards chunks that mention what was asked),
 *   newer effective date only breaks ties.
 */
export function rerank(question: string, candidates: RetrievedChunk[]): RankedChunk[] {
  const fused = candidates.map((c) => ({ c, f: rrf(c.vectorRank) + rrf(c.keywordRank) }));
  const best = Math.max(...fused.map((x) => x.f), Number.EPSILON);
  return fused
    .map(({ c, f }) => {
      const coverage = termCoverage(question, c);
      return { ...c, termCoverage: coverage, score: 0.7 * (f / best) + 0.3 * coverage };
    })
    .sort((a, b) => b.score - a.score || b.effectiveDate.localeCompare(a.effectiveDate));
}

/** Take the top chunks, at most `perPage` from any single page, so sources aren't one page repeated. */
export function selectTop(ranked: RankedChunk[], limit: number, perPage = 2): RankedChunk[] {
  const perPageCount = new Map<string, number>();
  const out: RankedChunk[] = [];
  for (const c of ranked) {
    const key = `${c.documentId}:${c.pageNumber}`;
    const n = perPageCount.get(key) ?? 0;
    if (n >= perPage) continue;
    perPageCount.set(key, n + 1);
    out.push(c);
    if (out.length === limit) break;
  }
  return out;
}

/**
 * True when retrieval found nothing that plausibly answers the question, so we can say
 * "not in your documents" without spending a generation call. Deliberately conservative:
 * borderline questions still go to the model, which can answer NOT_FOUND itself.
 */
export function isClearlyUnanswerable(ranked: RankedChunk[], relevanceFloor: number): boolean {
  if (ranked.length === 0) return true;
  const bestVector = Math.max(...ranked.map((c) => c.vectorScore ?? 0));
  const bestCoverage = Math.max(...ranked.map((c) => c.termCoverage));
  return bestVector < relevanceFloor && bestCoverage < STRONG_TERM_COVERAGE;
}

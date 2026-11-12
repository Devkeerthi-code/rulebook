import type { RankedChunk, RetrievedChunk, DocTypeName } from "@/lib/answer-types";
import type { Embedder } from "@/lib/ai-types";
import { isClearlyUnanswerable, mergeCandidates, rerank, selectTop } from "@/lib/rerank";
import { queryTerms } from "@/lib/text";
import { db } from "./db";

const CANDIDATES_PER_LIST = 20;

interface Row {
  id: string;
  documentId: string;
  documentTitle: string;
  documentType: DocTypeName;
  effectiveDate: string;
  version: number;
  pageNumber: number;
  heading: string;
  text: string;
  score: number;
}

export function toVectorLiteral(vector: number[]): string {
  return `[${vector.map((v) => (Number.isFinite(v) ? v.toFixed(7) : "0")).join(",")}]`;
}

/** OR-query of the question's terms. Only [a-z0-9] reach to_tsquery, so user input can't break its syntax. */
export function toTsQuery(question: string): string | null {
  const terms = queryTerms(question)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 2)
    .slice(0, 16);
  return terms.length ? terms.join(" | ") : null;
}

/** Nearest neighbours by cosine distance, restricted to one space's READY documents. */
export async function vectorSearch(spaceId: string, queryVector: number[], limit = CANDIDATES_PER_LIST): Promise<RetrievedChunk[]> {
  const vector = toVectorLiteral(queryVector);
  const rows = await db.$transaction(async (tx) => {
    // Filtered HNSW scans can return too few rows; iterative scan keeps going until `limit` matches are found.
    await tx.$executeRawUnsafe("SET LOCAL hnsw.ef_search = 100");
    await tx.$executeRawUnsafe("SET LOCAL hnsw.iterative_scan = relaxed_order");
    return tx.$queryRaw<Row[]>`
      SELECT c."id", c."documentId", d."title" AS "documentTitle", d."type"::text AS "documentType",
             to_char(d."effectiveDate", 'YYYY-MM-DD') AS "effectiveDate", d."version",
             c."pageNumber", c."heading", c."text",
             (1 - (c."embedding" <=> ${vector}::vector))::float8 AS "score"
      FROM "Chunk" c
      JOIN "Document" d ON d."id" = c."documentId" AND d."spaceId" = c."spaceId"
      WHERE c."spaceId" = ${spaceId} AND d."status" = 'READY' AND c."embedding" IS NOT NULL
      ORDER BY c."embedding" <=> ${vector}::vector
      LIMIT ${limit}`;
  });
  return rows
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, vectorScore: r.score, keywordScore: null, vectorRank: i + 1, keywordRank: null }));
}

/** Postgres full-text search (headings weighted above body text), restricted to one space. */
export async function keywordSearch(spaceId: string, question: string, limit = CANDIDATES_PER_LIST): Promise<RetrievedChunk[]> {
  const tsquery = toTsQuery(question);
  if (!tsquery) return [];
  const rows = await db.$queryRaw<Row[]>`
    SELECT c."id", c."documentId", d."title" AS "documentTitle", d."type"::text AS "documentType",
           to_char(d."effectiveDate", 'YYYY-MM-DD') AS "effectiveDate", d."version",
           c."pageNumber", c."heading", c."text",
           ts_rank_cd(c."tsv", q.query, 32)::float8 AS "score"
    FROM "Chunk" c
    JOIN "Document" d ON d."id" = c."documentId" AND d."spaceId" = c."spaceId",
         to_tsquery('english', ${tsquery}) AS q(query)
    WHERE c."spaceId" = ${spaceId} AND d."status" = 'READY' AND c."tsv" @@ q.query
    ORDER BY "score" DESC
    LIMIT ${limit}`;
  return rows.map((r, i) => ({ ...r, vectorScore: null, keywordScore: r.score, vectorRank: null, keywordRank: i + 1 }));
}

export interface RetrievalResult {
  top: RankedChunk[];
  /** Everything re-ranked, for "closest passages" when the answer isn't in the documents. */
  ranked: RankedChunk[];
  unanswerable: boolean;
}

/** Hybrid retrieval: both searches in parallel, merged by RRF, re-ranked with term coverage. */
export async function retrieve(spaceId: string, question: string, embedder: Embedder, topK = 8): Promise<RetrievalResult> {
  const queryVector = await embedder.embedQuery(question);
  const [vector, keyword] = await Promise.all([vectorSearch(spaceId, queryVector), keywordSearch(spaceId, question)]);
  const ranked = rerank(question, mergeCandidates(vector, keyword));
  return { top: selectTop(ranked, topK), ranked, unanswerable: isClearlyUnanswerable(ranked, embedder.relevanceFloor) };
}

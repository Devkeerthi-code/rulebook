/** Shapes shared by retrieval, the answer pipeline, the stream protocol and the UI. */

export type DocTypeName = "HANDBOOK" | "REGULATIONS" | "SYLLABUS" | "POLICY" | "CIRCULAR" | "RULES" | "OTHER";

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  documentType: DocTypeName;
  /** YYYY-MM-DD */
  effectiveDate: string;
  version: number;
  pageNumber: number;
  heading: string;
  text: string;
  /** Cosine similarity (1 = identical); null if the chunk came only from keyword search. */
  vectorScore: number | null;
  /** ts_rank_cd score; null if the chunk came only from vector search. */
  keywordScore: number | null;
  vectorRank: number | null;
  keywordRank: number | null;
}

export interface RankedChunk extends RetrievedChunk {
  score: number;
  termCoverage: number;
}

/** A numbered source as shown to the model ([S1]...) and stored with the answer. */
export interface AnswerSource {
  n: number;
  chunkId: string;
  documentId: string;
  title: string;
  type: DocTypeName;
  page: number;
  effectiveDate: string;
  heading: string;
  text: string;
}

export interface ConflictNote {
  /** Source number of the newer document that wins. */
  newer: number;
  older: number;
  note: string;
}

export type StreamEvent =
  | { type: "start"; conversationId: string; questionId: string }
  | { type: "sources"; sources: AnswerSource[] }
  | { type: "delta"; text: string }
  | { type: "conflict"; conflict: ConflictNote }
  | { type: "not_found"; closest: AnswerSource[] }
  | { type: "done"; messageId: string; outcome: "ANSWERED" | "NOT_FOUND"; cited: number[]; followups: string[]; content: string }
  | { type: "error"; message: string; retryAfterSeconds?: number };

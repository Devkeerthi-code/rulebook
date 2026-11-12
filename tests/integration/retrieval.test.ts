import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_DOCUMENTS, pageTexts } from "../../prisma/demo/corpus";
import { retrieve } from "@/server/retrieval";
import { addDocument, cleanup, createSpace } from "../helpers/db-fixtures";
import { hashEmbedder } from "../helpers/fakes";

/**
 * Fixture corpus = the fictional demo documents. Real SQL (pgvector HNSW + full-text) with a
 * deterministic embedder, so the test is offline and repeatable. Gemini quality is measured by `npm run eval`.
 */
let spaceId: string;
const docIds = new Map<string, string>();

beforeAll(async () => {
  const space = await createSpace("retrieval");
  spaceId = space.id;
  for (const doc of DEMO_DOCUMENTS) {
    const created = await addDocument(spaceId, { title: doc.title, type: doc.type, effectiveDate: doc.effectiveDate, pages: pageTexts(doc) });
    docIds.set(doc.key, created.id);
  }
}, 120_000);

afterAll(cleanup);

const cases: { q: string; doc: string; page: number }[] = [
  { q: "What is the minimum attendance needed to write end semester exams?", doc: "handbook", page: 5 },
  { q: "How many backlogs are allowed to register for placements?", doc: "placement", page: 2 },
  { q: "What is the fee for re-evaluation of an answer script?", doc: "handbook", page: 8 },
  { q: "Can I change my hostel room in the middle of the semester?", doc: "hostel", page: 2 },
  { q: "What is the condonation fee per course?", doc: "circular", page: 1 },
  { q: "When are supplementary examinations held?", doc: "handbook", page: 9 },
  { q: "What time do I need to be back in the hostel at night?", doc: "hostel", page: 1 },
];

describe("hybrid retrieval on the fixture corpus", () => {
  it.each(cases)("$q -> $doc p.$page in top 5", async ({ q, doc, page }) => {
    const { top } = await retrieve(spaceId, q, hashEmbedder);
    const top5 = top.slice(0, 5).map((c) => `${c.documentId}:${c.pageNumber}`);
    expect(top5).toContain(`${docIds.get(doc)}:${page}`);
  });

  it("returns both the old rule and the newer circular for a conflicting question", async () => {
    const { top } = await retrieve(spaceId, "attendance condonation shortage percentage", hashEmbedder);
    const docs = new Set(top.slice(0, 5).map((c) => c.documentId));
    expect(docs.has(docIds.get("handbook")!)).toBe(true);
    expect(docs.has(docIds.get("circular")!)).toBe(true);
  });

  it("flags a question with nothing relevant on the shelf as unanswerable", async () => {
    const { unanswerable } = await retrieve(spaceId, "Who won the cricket world cup?", hashEmbedder);
    expect(unanswerable).toBe(true);
  });

  it("does not flag an answerable question", async () => {
    const { unanswerable } = await retrieve(spaceId, "How many credits do I need to graduate?", hashEmbedder);
    expect(unanswerable).toBe(false);
  });
});

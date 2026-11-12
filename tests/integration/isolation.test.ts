import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findAccess } from "@/server/access";
import { db } from "@/server/db";
import { keywordSearch, retrieve, vectorSearch } from "@/server/retrieval";
import {
  gapsReport,
  getConversation,
  getDocument,
  getDocumentFile,
  getPageText,
  listConversations,
  listDocuments,
  recentTurns,
  saveFeedback,
  suggestedQuestions,
} from "@/server/space-data";
import { addDocument, cleanup, createSpace, createUser } from "../helpers/db-fixtures";
import { hashEmbedder } from "../helpers/fakes";

/**
 * Two colleges, one secret each. A member of college A must never see anything of college B,
 * through any query path, even when they know B's ids.
 */
let alice: { id: string };
let bob: { id: string };
let spaceA: { id: string };
let spaceB: { id: string };
let docA: { id: string };
let docB: { id: string };
let convoB: { id: string };
let answerB: { id: string };

const SECRET_B = "Zephyrium scholarship pays a quokka allowance of Rs. 99,999 to every hosteller.";

beforeAll(async () => {
  alice = await createUser("alice");
  bob = await createUser("bob");
  spaceA = await createSpace("college-a", [{ userId: alice.id, role: "ADMIN" }]);
  spaceB = await createSpace("college-b", [{ userId: bob.id, role: "ADMIN" }]);
  docA = await addDocument(spaceA.id, {
    title: "A Handbook",
    pages: [{ pageNumber: 1, text: "4.1 Minimum attendance\nA student needs 75% attendance in each course." }],
  });
  docB = await addDocument(spaceB.id, {
    title: "B Handbook",
    pages: [{ pageNumber: 3, text: `8.1 Scholarships\n${SECRET_B}` }],
  });
  await db.documentPage.create({ data: { documentId: docB.id, pageNumber: 3, text: SECRET_B } });
  await db.suggestedQuestion.create({ data: { spaceId: spaceB.id, documentId: docB.id, text: "What is the Zephyrium scholarship?" } });
  convoB = await db.conversation.create({ data: { spaceId: spaceB.id, userId: bob.id, title: "Zephyrium" } });
  await db.message.create({ data: { conversationId: convoB.id, spaceId: spaceB.id, role: "USER", content: "Zephyrium scholarship amount?" } });
  answerB = await db.message.create({
    data: { conversationId: convoB.id, spaceId: spaceB.id, role: "ASSISTANT", content: "", outcome: "NOT_FOUND" },
  });
});

afterAll(cleanup);

describe("space isolation", () => {
  it("membership: alice has no access to college B", async () => {
    expect(await findAccess(alice.id, spaceB.id)).toBeNull();
    expect(await findAccess(alice.id, spaceA.id)).toMatchObject({ role: "ADMIN", canManage: true });
  });

  it("vector search in A never returns B's chunks, even for B's exact text", async () => {
    const results = await vectorSearch(spaceA.id, await hashEmbedder.embedQuery(SECRET_B));
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.documentId === docA.id)).toBe(true);
    expect(results.some((r) => r.text.includes("Zephyrium"))).toBe(false);
  });

  it("keyword search in A never returns B's chunks", async () => {
    expect(await keywordSearch(spaceA.id, "Zephyrium quokka scholarship")).toEqual([]);
    expect((await keywordSearch(spaceB.id, "Zephyrium quokka scholarship"))[0]?.documentId).toBe(docB.id);
  });

  it("hybrid retrieval in A only sees A", async () => {
    const { ranked } = await retrieve(spaceA.id, "Zephyrium scholarship quokka allowance", hashEmbedder);
    expect(ranked.every((r) => r.documentId === docA.id)).toBe(true);
  });

  it("documents, files and page text of B are invisible from A", async () => {
    expect((await listDocuments(spaceA.id)).map((d) => d.id)).toEqual([docA.id]);
    expect(await getDocument(spaceA.id, docB.id)).toBeNull();
    expect(await getDocumentFile(spaceA.id, docB.id)).toBeNull();
    expect(await getPageText(spaceA.id, docB.id, 3)).toBeNull();
    expect(await getPageText(spaceB.id, docB.id, 3)).not.toBeNull();
  });

  it("conversations are private to their space and their owner", async () => {
    expect(await getConversation(spaceA.id, alice.id, convoB.id)).toBeNull();
    expect(await getConversation(spaceB.id, alice.id, convoB.id)).toBeNull();
    expect(await getConversation(spaceB.id, bob.id, convoB.id)).not.toBeNull();
    expect(await listConversations(spaceA.id, alice.id)).toEqual([]);
    expect(await recentTurns(spaceA.id, alice.id, convoB.id)).toEqual([]);
  });

  it("alice can't rate an answer in B", async () => {
    expect(await saveFeedback({ spaceId: spaceA.id, userId: alice.id, messageId: answerB.id, rating: "DOWN" })).toBe(false);
    expect(await saveFeedback({ spaceId: spaceB.id, userId: alice.id, messageId: answerB.id, rating: "DOWN" })).toBe(false);
    expect(await db.feedback.count({ where: { messageId: answerB.id } })).toBe(0);
  });

  it("A's admin report and starter questions don't include B's questions", async () => {
    const report = await gapsReport(spaceA.id);
    expect(report.rows).toEqual([]);
    expect(report.stats.asked).toBe(0);
    expect(await suggestedQuestions(spaceA.id)).toEqual([]);
    expect((await gapsReport(spaceB.id)).rows[0]?.question).toBe("Zephyrium scholarship amount?");
  });

  it("the database itself refuses a chunk that points at another space's document", async () => {
    await expect(
      db.chunk.create({ data: { spaceId: spaceA.id, documentId: docB.id, pageNumber: 1, ordinal: 999, heading: "", text: "smuggled" } }),
    ).rejects.toThrow();
  });
});

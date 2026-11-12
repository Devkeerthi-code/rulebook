import { randomBytes } from "node:crypto";
import { chunkPages, embeddingInput, type PageText } from "@/lib/chunking";
import { db } from "@/server/db";
import { toVectorLiteral } from "@/server/retrieval";
import { hashEmbedder } from "./fakes";

/** Every row created by tests carries this tag so a crashed run can still be cleaned up. */
export const TEST_TAG = `TEST-${randomBytes(4).toString("hex")}`;

export async function createUser(label: string) {
  return db.user.create({
    data: { email: `${TEST_TAG.toLowerCase()}-${label}@example.test`, name: `${TEST_TAG} ${label}`, passwordHash: "x" },
  });
}

export async function createSpace(label: string, members: { userId: string; role: "ADMIN" | "MEMBER" }[] = []) {
  return db.space.create({
    data: {
      name: `${TEST_TAG} ${label}`,
      shortName: label.slice(0, 12),
      inviteToken: randomBytes(12).toString("base64url"),
      memberships: { create: members },
    },
  });
}

/** Insert a READY document with chunked pages and deterministic embeddings. */
export async function addDocument(
  spaceId: string,
  doc: { title: string; type?: "HANDBOOK" | "POLICY" | "CIRCULAR" | "RULES"; effectiveDate?: string; pages: PageText[] },
) {
  const created = await db.document.create({
    data: {
      spaceId,
      title: doc.title,
      type: doc.type ?? "HANDBOOK",
      effectiveDate: new Date(`${doc.effectiveDate ?? "2025-07-01"}T00:00:00Z`),
      status: "READY",
      fileName: `${doc.title}.pdf`,
      fileSize: 100,
      fileSha256: randomBytes(16).toString("hex"),
      pageCount: doc.pages.length,
      file: { create: { bytes: Buffer.from("%PDF-1.4 test") } },
    },
  });
  const chunks = chunkPages(doc.pages);
  await db.chunk.createMany({
    data: chunks.map((c) => ({ spaceId, documentId: created.id, pageNumber: c.pageNumber, ordinal: c.ordinal, heading: c.heading, text: c.text })),
  });
  const rows = await db.chunk.findMany({ where: { documentId: created.id }, orderBy: { ordinal: "asc" } });
  const vectors = await hashEmbedder.embedDocuments(rows.map((r) => embeddingInput(doc.title, r)));
  for (let i = 0; i < rows.length; i++) {
    await db.$executeRaw`UPDATE "Chunk" SET "embedding" = ${toVectorLiteral(vectors[i]!)}::vector WHERE "id" = ${rows[i]!.id}`;
  }
  return created;
}

export async function cleanup() {
  await db.space.deleteMany({ where: { name: { startsWith: TEST_TAG } } });
  await db.user.deleteMany({ where: { email: { startsWith: TEST_TAG.toLowerCase() } } });
  await db.rateLimitBucket.deleteMany({ where: { key: { contains: TEST_TAG } } });
}

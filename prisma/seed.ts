/**
 * Seeds the DEMO space: a fictional college with four fictional documents, ingested through the real pipeline.
 * Creates no user accounts and no passwords. Any signed-up user can join the demo from the Spaces page.
 * Re-running replaces the demo documents (idempotent).
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { db } from "../src/server/db";
import { geminiEmbedder, ocrPdfPage, suggestQuestions } from "../src/server/gemini";
import { ingestToCompletion } from "../src/server/ingest";
import { DEMO_COLLEGE, DEMO_DOCUMENTS } from "./demo/corpus";
import { renderDemoPdf } from "./demo/render-pdf";

async function demoSpace() {
  const existing = await db.space.findFirst({ where: { isDemo: true } });
  if (existing) {
    await db.document.deleteMany({ where: { spaceId: existing.id } });
    return db.space.update({ where: { id: existing.id }, data: { name: DEMO_COLLEGE.name, shortName: DEMO_COLLEGE.shortName } });
  }
  return db.space.create({
    data: { name: DEMO_COLLEGE.name, shortName: DEMO_COLLEGE.shortName, isDemo: true, inviteToken: randomBytes(18).toString("base64url") },
  });
}

async function main() {
  const space = await demoSpace();
  console.log(`DEMO space: ${space.name} (${space.id})`);
  for (const doc of DEMO_DOCUMENTS) {
    const bytes = await renderDemoPdf(doc);
    const created = await db.document.create({
      data: {
        spaceId: space.id,
        title: doc.title,
        type: doc.type,
        effectiveDate: new Date(`${doc.effectiveDate}T00:00:00Z`),
        fileName: doc.fileName,
        fileSize: bytes.length,
        fileSha256: createHash("sha256").update(bytes).digest("hex"),
        file: { create: { bytes: Buffer.from(bytes) } },
      },
    });
    const started = Date.now();
    const result = await ingestToCompletion(created.id, { embedder: geminiEmbedder, ocr: ocrPdfPage, suggest: suggestQuestions });
    if (result.status !== "READY") throw new Error(`${doc.title} failed: ${result.errorMessage}`);
    console.log(`  ✓ ${doc.title}: ${doc.pages.length} pages, ${result.progress.chunks} chunks (${Date.now() - started} ms)`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });

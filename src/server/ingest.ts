import { AiQuotaError, type Embedder } from "@/lib/ai-types";
import { chunkPages, embeddingInput } from "@/lib/chunking";
import type { IngestStatus, Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { extractPages, extractSinglePage, needsOcr } from "./pdf";
import { toVectorLiteral } from "./retrieval";
import { track } from "./usage";

/** Each step stops starting new work after this, so one request stays well inside serverless limits. */
const STEP_BUDGET_MS = 20_000;
const LEASE_SECONDS = 60;
const EMBED_BATCH = 50;

/** A failure the admin can act on; its message is shown as-is. */
class IngestError extends Error {}

export interface IngestProgress {
  pagesRead?: number;
  ocrTotal?: number;
  ocrDone?: number;
  ocrFailed?: number;
  chunks?: number;
  embedded?: number;
  /** Set when work is paused (e.g. AI quota) and will resume on the next step. */
  pausedReason?: string;
}

export interface IngestDeps {
  embedder: Embedder;
  ocr: (pagePdf: Uint8Array) => Promise<string>;
  suggest?: (title: string, excerpt: string) => Promise<string[]>;
}

export interface StepResult {
  status: IngestStatus;
  progress: IngestProgress;
  done: boolean;
  errorMessage: string | null;
}

async function acquireLease(documentId: string): Promise<boolean> {
  const rows = await db.$executeRaw`
    UPDATE "Document" SET "leaseUntil" = now() + make_interval(secs => ${LEASE_SECONDS})
    WHERE "id" = ${documentId} AND ("leaseUntil" IS NULL OR "leaseUntil" < now())`;
  return rows === 1;
}

async function releaseLease(documentId: string): Promise<void> {
  await db.document.update({ where: { id: documentId }, data: { leaseUntil: null } });
}

async function setStage(documentId: string, status: IngestStatus, progress: IngestProgress, extra: Prisma.DocumentUpdateInput = {}) {
  await db.document.update({ where: { id: documentId }, data: { status, progress: progress as Prisma.InputJsonValue, ...extra } });
}

/** Stage 1: pull text out page by page; mark pages without a text layer for OCR. Replaces any previous version's data. */
async function extractStage(documentId: string, progress: IngestProgress): Promise<IngestStatus> {
  const file = await db.documentFile.findUniqueOrThrow({ where: { documentId } });
  const { pageCount, pages } = await extractPages(file.bytes);
  const ocrTotal = pages.filter((p) => needsOcr(p.text)).length;
  await db.$transaction([
    db.chunk.deleteMany({ where: { documentId } }),
    db.suggestedQuestion.deleteMany({ where: { documentId } }),
    db.documentPage.deleteMany({ where: { documentId } }),
    db.documentPage.createMany({
      data: pages.map((p) => ({ documentId, pageNumber: p.pageNumber, text: p.text, needsOcr: needsOcr(p.text) })),
    }),
  ]);
  Object.assign(progress, { pagesRead: pageCount, ocrTotal, ocrDone: 0, ocrFailed: 0 });
  const next: IngestStatus = ocrTotal > 0 ? "OCR" : "CHUNKING";
  await setStage(documentId, next, progress, { pageCount, ocrPageCount: ocrTotal });
  return next;
}

/** Stage 2: OCR scanned pages one at a time with Gemini, until the time budget runs out. */
async function ocrStage(documentId: string, progress: IngestProgress, deps: IngestDeps, deadline: number): Promise<IngestStatus> {
  const file = await db.documentFile.findUniqueOrThrow({ where: { documentId } });
  while (Date.now() < deadline) {
    const page = await db.documentPage.findFirst({ where: { documentId, needsOcr: true }, orderBy: { pageNumber: "asc" } });
    if (!page) break;
    let text = "";
    try {
      text = await deps.ocr(await extractSinglePage(file.bytes, page.pageNumber));
    } catch (err) {
      if (err instanceof AiQuotaError) throw err;
      console.error(`OCR failed for page ${page.pageNumber}`, err);
      progress.ocrFailed = (progress.ocrFailed ?? 0) + 1;
    }
    await db.documentPage.update({
      where: { documentId_pageNumber: { documentId, pageNumber: page.pageNumber } },
      data: { text: text.trim() || page.text, ocr: Boolean(text.trim()), needsOcr: false },
    });
    progress.ocrDone = (progress.ocrDone ?? 0) + 1;
    await setStage(documentId, "OCR", progress);
  }
  const left = await db.documentPage.count({ where: { documentId, needsOcr: true } });
  if (left > 0) return "OCR";
  await setStage(documentId, "CHUNKING", progress);
  return "CHUNKING";
}

/** Stage 3: split along headings into page-bound chunks with overlap. */
async function chunkStage(documentId: string, spaceId: string, progress: IngestProgress): Promise<IngestStatus> {
  const pages = await db.documentPage.findMany({ where: { documentId }, orderBy: { pageNumber: "asc" } });
  const chunks = chunkPages(pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text })));
  if (chunks.length === 0) {
    throw new IngestError("No readable text was found in this PDF, even after OCR. Is it an image of a blank or handwritten page?");
  }
  await db.$transaction([
    db.chunk.deleteMany({ where: { documentId } }),
    db.chunk.createMany({
      data: chunks.map((c) => ({ spaceId, documentId, pageNumber: c.pageNumber, ordinal: c.ordinal, heading: c.heading, text: c.text })),
    }),
  ]);
  Object.assign(progress, { chunks: chunks.length, embedded: 0 });
  await setStage(documentId, "EMBEDDING", progress);
  return "EMBEDDING";
}

/** Stage 4: embed chunks in batches and write vectors. Resumable: only chunks without a vector are picked up. */
async function embedStage(documentId: string, title: string, progress: IngestProgress, deps: IngestDeps, deadline: number): Promise<IngestStatus> {
  while (Date.now() < deadline) {
    const batch = await db.$queryRaw<{ id: string; heading: string; text: string }[]>`
      SELECT "id", "heading", "text" FROM "Chunk"
      WHERE "documentId" = ${documentId} AND "embedding" IS NULL
      ORDER BY "ordinal" LIMIT ${EMBED_BATCH}`;
    if (batch.length === 0) break;
    const vectors = await deps.embedder.embedDocuments(batch.map((c) => embeddingInput(title, c)));
    const ids = batch.map((c) => c.id);
    const literals = vectors.map(toVectorLiteral);
    await db.$executeRaw`
      UPDATE "Chunk" AS c SET "embedding" = v.vec::vector
      FROM unnest(${ids}::text[], ${literals}::text[]) AS v(id, vec)
      WHERE c."id" = v.id`;
    progress.embedded = (progress.embedded ?? 0) + batch.length;
    await setStage(documentId, "EMBEDDING", progress);
  }
  const rows = await db.$queryRaw<{ left: number }[]>`
    SELECT count(*)::int AS "left" FROM "Chunk" WHERE "documentId" = ${documentId} AND "embedding" IS NULL`;
  return (rows[0]?.left ?? 0) > 0 ? "EMBEDDING" : "READY";
}

/** Best-effort starter questions from the first chunks of a document. Failure never blocks READY. */
async function generateSuggestions(documentId: string, spaceId: string, title: string, deps: IngestDeps) {
  if (!deps.suggest) return;
  try {
    const chunks = await db.chunk.findMany({ where: { documentId }, orderBy: { ordinal: "asc" }, take: 6, select: { heading: true, text: true } });
    const excerpt = chunks.map((c) => `${c.heading}\n${c.text}`).join("\n\n").slice(0, 6000);
    const questions = await deps.suggest(title, excerpt);
    if (questions.length) {
      await db.suggestedQuestion.createMany({ data: questions.map((text) => ({ spaceId, documentId, text })) });
    }
  } catch (err) {
    console.error("starter question generation failed", err);
  }
}

/**
 * Advance one document's ingestion as far as the time budget allows.
 * Safe to call repeatedly and concurrently: a lease makes sure only one caller works at a time.
 */
export async function runIngestStep(documentId: string, deps: IngestDeps, budgetMs = STEP_BUDGET_MS): Promise<StepResult> {
  const doc = await db.document.findUniqueOrThrow({ where: { id: documentId } });
  const progress = { ...(doc.progress as IngestProgress) };
  delete progress.pausedReason;
  const snapshot = (status: IngestStatus, errorMessage: string | null = null): StepResult => ({
    status,
    progress,
    done: status === "READY" || status === "FAILED",
    errorMessage,
  });

  if (doc.status === "READY" || doc.status === "FAILED") return snapshot(doc.status, doc.errorMessage);
  if (!(await acquireLease(documentId))) return snapshot(doc.status);

  const deadline = Date.now() + budgetMs;
  let status: IngestStatus = doc.status;
  try {
    if (status === "QUEUED" || status === "EXTRACTING") {
      await setStage(documentId, "EXTRACTING", progress);
      status = await extractStage(documentId, progress);
    }
    if (status === "OCR" && Date.now() < deadline) status = await ocrStage(documentId, progress, deps, deadline);
    if (status === "CHUNKING" && Date.now() < deadline) status = await chunkStage(documentId, doc.spaceId, progress);
    if (status === "EMBEDDING" && Date.now() < deadline) status = await embedStage(documentId, doc.title, progress, deps, deadline);
    if (status === "READY") {
      await setStage(documentId, "READY", progress, { readyAt: new Date(), errorMessage: null });
      await track("DOCUMENT_READY", { spaceId: doc.spaceId });
      await generateSuggestions(documentId, doc.spaceId, doc.title, deps);
    }
    return snapshot(status);
  } catch (err) {
    if (err instanceof AiQuotaError) {
      progress.pausedReason = "Gemini's free quota is used up for now. Processing resumes automatically in a minute.";
      await setStage(documentId, status, progress);
      return snapshot(status);
    }
    console.error(`ingestion failed for ${documentId}`, err);
    const message =
      err instanceof IngestError
        ? err.message
        : "We couldn't read this PDF. If it's password-protected or damaged, export a fresh copy and replace it.";
    await setStage(documentId, "FAILED", progress, { errorMessage: message });
    return snapshot("FAILED", message);
  } finally {
    await releaseLease(documentId);
  }
}

/** For scripts (seed, eval): keep stepping until the document is READY or FAILED. */
export async function ingestToCompletion(documentId: string, deps: IngestDeps): Promise<StepResult> {
  for (let i = 0; i < 200; i++) {
    const result = await runIngestStep(documentId, deps, 60_000);
    if (result.done) return result;
    if (result.progress.pausedReason) await new Promise((r) => setTimeout(r, 20_000));
  }
  throw new Error("Ingestion did not finish after 200 steps.");
}

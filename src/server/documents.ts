import "server-only";
import { createHash } from "node:crypto";
import { RULES } from "@/lib/rate-limit";
import { documentMetaSchema, MAX_PDF_BYTES } from "@/lib/validation";
import { db } from "./db";
import { geminiEmbedder, ocrPdfPage, suggestQuestions } from "./gemini";
import type { IngestDeps } from "./ingest";
import { looksLikePdf } from "./pdf";
import { limit } from "./rate-limiter";

export const ingestDeps: IngestDeps = { embedder: geminiEmbedder, ocr: ocrPdfPage, suggest: suggestQuestions };

export type UploadCheck =
  | { ok: true; bytes: Uint8Array; sha256: string; fileName: string; meta: { title: string; type: (typeof documentMetaSchema)["_output"]["type"]; effectiveDate: string } }
  | { ok: false; status: number; error: string; field?: string };

/** Validate an upload form: the PDF itself and its metadata. Nothing from the client is trusted. */
export async function readUpload(form: FormData, { requireMeta = true } = {}): Promise<UploadCheck> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, status: 400, error: "Choose a PDF to upload.", field: "file" };
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, status: 413, error: `That PDF is ${(file.size / 1048576).toFixed(1)} MB; the limit is 15 MB.`, field: "file" };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) return { ok: false, status: 415, error: "That file isn't a PDF.", field: "file" };

  const meta = documentMetaSchema.safeParse({
    title: form.get("title") ?? (requireMeta ? undefined : "placeholder"),
    type: form.get("type") ?? (requireMeta ? undefined : "OTHER"),
    effectiveDate: form.get("effectiveDate") ?? (requireMeta ? undefined : "2000-01-01"),
  });
  if (!meta.success) {
    const issue = meta.error.issues[0];
    return { ok: false, status: 400, error: issue?.message ?? "Check the document details.", field: String(issue?.path[0] ?? "") };
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { ok: true, bytes, sha256, fileName: file.name.slice(0, 200), meta: meta.data };
}

/** The same PDF uploaded twice to one space is almost always a double click or a mistake. */
export async function findDuplicate(spaceId: string, sha256: string, exceptId?: string) {
  return db.document.findFirst({
    where: { spaceId, fileSha256: sha256, status: { not: "FAILED" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true, title: true },
  });
}

export async function uploadAllowed(userId: string) {
  return limit(RULES.upload, userId);
}

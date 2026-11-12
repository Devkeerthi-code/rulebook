import { documentMetaSchema } from "@/lib/validation";
import { apiAccess } from "@/server/access";
import { db } from "@/server/db";
import { findDuplicate, readUpload, uploadAllowed } from "@/server/documents";
import { getDocument } from "@/server/space-data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ spaceId: string; documentId: string }> };

/** Status and progress, polled by the shelf while a document is being processed. */
export async function GET(_request: Request, { params }: Params) {
  const { spaceId, documentId } = await params;
  const gate = await apiAccess(spaceId);
  if (!gate.ok) return gate.response;
  const doc = await getDocument(spaceId, documentId);
  if (!doc) return Response.json({ error: "Not found." }, { status: 404 });
  const { id, title, status, progress, errorMessage, pageCount, version } = doc;
  return Response.json({ document: { id, title, status, progress, errorMessage, pageCount, version } });
}

/**
 * Replace the PDF (multipart with `file`) and/or edit title, type and effective date.
 * A new file bumps the version and re-indexes from scratch; old chunks are removed on extraction.
 */
export async function PUT(request: Request, { params }: Params) {
  const { spaceId, documentId } = await params;
  const gate = await apiAccess(spaceId, { manage: true });
  if (!gate.ok) return gate.response;
  const doc = await getDocument(spaceId, documentId);
  if (!doc) return Response.json({ error: "Not found." }, { status: 404 });

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Send the changes with the form." }, { status: 400 });

  const meta = documentMetaSchema.safeParse({ title: form.get("title"), type: form.get("type"), effectiveDate: form.get("effectiveDate") });
  if (!meta.success) {
    const issue = meta.error.issues[0];
    return Response.json({ error: issue?.message ?? "Check the details.", field: String(issue?.path[0] ?? "") }, { status: 400 });
  }
  const metaUpdate = { title: meta.data.title, type: meta.data.type, effectiveDate: new Date(`${meta.data.effectiveDate}T00:00:00Z`) };

  if (!(form.get("file") instanceof File)) {
    await db.document.update({ where: { id: doc.id }, data: metaUpdate });
    return Response.json({ document: { id: doc.id, status: doc.status, version: doc.version } });
  }

  const rate = await uploadAllowed(gate.access.user.id);
  if (!rate.allowed) return Response.json({ error: "Upload limit reached for today. Try again tomorrow." }, { status: 429 });
  const upload = await readUpload(form, { requireMeta: false });
  if (!upload.ok) return Response.json({ error: upload.error, field: upload.field }, { status: upload.status });
  if (upload.sha256 === doc.fileSha256) return Response.json({ error: "That's the same PDF that's already here." }, { status: 409 });
  const duplicate = await findDuplicate(spaceId, upload.sha256, doc.id);
  if (duplicate) return Response.json({ error: `This PDF is already on the shelf as "${duplicate.title}".` }, { status: 409 });

  const updated = await db.document.update({
    where: { id: doc.id },
    data: {
      ...metaUpdate,
      version: { increment: 1 },
      status: "QUEUED",
      progress: {},
      errorMessage: null,
      readyAt: null,
      fileName: upload.fileName,
      fileSize: upload.bytes.length,
      fileSha256: upload.sha256,
      uploadedById: gate.access.user.id,
      file: { update: { bytes: Buffer.from(upload.bytes) } },
    },
    select: { id: true, status: true, version: true },
  });
  return Response.json({ document: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { spaceId, documentId } = await params;
  const gate = await apiAccess(spaceId, { manage: true });
  if (!gate.ok) return gate.response;
  const { count } = await db.document.deleteMany({ where: { id: documentId, spaceId } });
  if (count === 0) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ deleted: true });
}

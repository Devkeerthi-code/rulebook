import { apiAccess } from "@/server/access";
import { db } from "@/server/db";
import { findDuplicate, readUpload, uploadAllowed } from "@/server/documents";
import { listDocuments } from "@/server/space-data";
import { track } from "@/server/usage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const gate = await apiAccess(spaceId);
  if (!gate.ok) return gate.response;
  return Response.json({ documents: await listDocuments(spaceId) });
}

/** Upload a new PDF. Processing starts when the client calls the ingest step endpoint. */
export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const gate = await apiAccess(spaceId, { manage: true });
  if (!gate.ok) return gate.response;
  const { user } = gate.access;

  const rate = await uploadAllowed(user.id);
  if (!rate.allowed) return Response.json({ error: "Upload limit reached for today (30 PDFs). Try again tomorrow." }, { status: 429 });

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Upload a PDF with the form." }, { status: 400 });
  const upload = await readUpload(form);
  if (!upload.ok) return Response.json({ error: upload.error, field: upload.field }, { status: upload.status });

  const duplicate = await findDuplicate(spaceId, upload.sha256);
  if (duplicate) {
    return Response.json({ error: `This exact PDF is already on the shelf as "${duplicate.title}".`, documentId: duplicate.id }, { status: 409 });
  }

  const document = await db.document.create({
    data: {
      spaceId,
      title: upload.meta.title,
      type: upload.meta.type,
      effectiveDate: new Date(`${upload.meta.effectiveDate}T00:00:00Z`),
      fileName: upload.fileName,
      fileSize: upload.bytes.length,
      fileSha256: upload.sha256,
      uploadedById: user.id,
      file: { create: { bytes: Buffer.from(upload.bytes) } },
    },
    select: { id: true, title: true, status: true },
  });
  await track("DOCUMENT_UPLOADED", { userId: user.id, spaceId });
  return Response.json({ document }, { status: 201 });
}

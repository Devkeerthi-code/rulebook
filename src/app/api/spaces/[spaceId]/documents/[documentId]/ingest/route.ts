import { apiAccess } from "@/server/access";
import { ingestDeps } from "@/server/documents";
import { runIngestStep } from "@/server/ingest";
import { getDocument } from "@/server/space-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Advance processing by one time-boxed step. The shelf calls this in a loop until the document is READY. */
export async function POST(_request: Request, { params }: { params: Promise<{ spaceId: string; documentId: string }> }) {
  const { spaceId, documentId } = await params;
  const gate = await apiAccess(spaceId, { manage: true });
  if (!gate.ok) return gate.response;
  if (!(await getDocument(spaceId, documentId))) return Response.json({ error: "Not found." }, { status: 404 });
  const result = await runIngestStep(documentId, ingestDeps);
  return Response.json(result);
}

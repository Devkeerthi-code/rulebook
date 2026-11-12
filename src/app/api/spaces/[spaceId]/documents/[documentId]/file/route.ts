import { apiAccess } from "@/server/access";
import { getDocumentFile } from "@/server/space-data";
import { track } from "@/server/usage";

export const dynamic = "force-dynamic";

/** Serve the PDF to members only. `?v=` is the version, so a replaced document is never served from cache. */
export async function GET(request: Request, { params }: { params: Promise<{ spaceId: string; documentId: string }> }) {
  const { spaceId, documentId } = await params;
  const gate = await apiAccess(spaceId);
  if (!gate.ok) return gate.response;
  const file = await getDocumentFile(spaceId, documentId);
  if (!file) return Response.json({ error: "Not found." }, { status: 404 });
  if (new URL(request.url).searchParams.get("from") === "citation") {
    await track("CITATION_OPENED", { userId: gate.access.user.id, spaceId });
  }
  const safeName = file.document.fileName.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

import { z } from "zod";
import { apiAccess } from "@/server/access";
import { getPageText } from "@/server/space-data";

export const dynamic = "force-dynamic";

/** Extracted text of one page. Used to show the cited passage beside scanned pages that have no text layer. */
export async function GET(_request: Request, { params }: { params: Promise<{ spaceId: string; documentId: string; page: string }> }) {
  const { spaceId, documentId, page } = await params;
  const gate = await apiAccess(spaceId);
  if (!gate.ok) return gate.response;
  const pageNumber = z.coerce.number().int().min(1).max(10_000).safeParse(page);
  if (!pageNumber.success) return Response.json({ error: "Bad page number." }, { status: 400 });
  const row = await getPageText(spaceId, documentId, pageNumber.data);
  if (!row) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json(row, { headers: { "Cache-Control": "private, max-age=300" } });
}

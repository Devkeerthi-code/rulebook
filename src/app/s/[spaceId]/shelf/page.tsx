import type { Metadata } from "next";
import { RevealHeading } from "@/components/motion/reveal-heading";
import { ShelfManager, type ShelfDoc } from "@/components/shelf/shelf-manager";
import { requireMember } from "@/server/access";
import { listDocuments } from "@/server/space-data";

export const metadata: Metadata = { title: "Shelf" };

export default async function ShelfPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireMember(spaceId);
  const docs = await listDocuments(spaceId);
  const shelfDocs: ShelfDoc[] = docs.map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    effectiveDate: d.effectiveDate.toISOString().slice(0, 10),
    version: d.version,
    status: d.status,
    progress: (d.progress ?? {}) as ShelfDoc["progress"],
    errorMessage: d.errorMessage,
    pageCount: d.pageCount,
    fileName: d.fileName,
  }));

  return (
    <div className="page">
      <div className="wrap page-head">
        <div className="section-num">The shelf</div>
        <RevealHeading as="h1" trigger="load" parts={[{ text: `What ${access.space.shortName}'s rulebook` }, { text: "reads from.", emphasis: true }]} />
        <p className="muted">
          {access.canManage
            ? "Upload PDFs here. Each one is read page by page, scanned pages go through OCR, and students can ask about it as soon as it's ready."
            : "These are the only documents answers come from. Tap a cover to read one."}
        </p>
      </div>
      <ShelfManager docs={shelfDocs} />
    </div>
  );
}

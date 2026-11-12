import type { Metadata } from "next";
import { SpaceShell } from "@/components/space/space-shell";
import { requireMember } from "@/server/access";
import { listConversations, listDocuments, spaceCounts } from "@/server/space-data";

export async function generateMetadata({ params }: { params: Promise<{ spaceId: string }> }): Promise<Metadata> {
  const { spaceId } = await params;
  const { space } = await requireMember(spaceId);
  return { title: space.shortName };
}

export default async function SpaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireMember(spaceId);
  const [docs, conversations, counts] = await Promise.all([listDocuments(spaceId), listConversations(spaceId, access.user.id), spaceCounts(spaceId)]);

  return (
    <SpaceShell
      space={{ ...access.space, canManage: access.canManage }}
      memberCount={counts.members}
      userName={access.user.name}
      docs={docs.map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        pageCount: d.pageCount,
        effectiveDate: d.effectiveDate.toISOString().slice(0, 10),
        ready: d.status === "READY",
      }))}
      conversations={conversations.map((c) => ({ id: c.id, title: c.title }))}
    >
      {children}
    </SpaceShell>
  );
}

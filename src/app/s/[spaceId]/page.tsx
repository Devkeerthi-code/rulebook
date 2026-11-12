import { AskScreen } from "@/components/ask/ask-screen";
import { requireMember } from "@/server/access";
import { askPageData } from "@/server/ask-page";

export default async function AskPage({ params, searchParams }: { params: Promise<{ spaceId: string }>; searchParams: Promise<{ q?: string }> }) {
  const [{ spaceId }, { q }] = await Promise.all([params, searchParams]);
  const access = await requireMember(spaceId);
  const data = await askPageData(spaceId, access.user.id);
  const initialQuestion = typeof q === "string" && q.trim().length >= 3 ? q.slice(0, 300) : undefined;
  return <AskScreen key="new" initialItems={[]} conversationId={null} initialQuestion={initialQuestion} {...data} />;
}

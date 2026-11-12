import { notFound } from "next/navigation";
import { AskScreen } from "@/components/ask/ask-screen";
import { requireMember } from "@/server/access";
import { askPageData, toThreadItems } from "@/server/ask-page";
import { getConversation } from "@/server/space-data";

export default async function ConversationPage({ params }: { params: Promise<{ spaceId: string; conversationId: string }> }) {
  const { spaceId, conversationId } = await params;
  const access = await requireMember(spaceId);
  const [conversation, data] = await Promise.all([getConversation(spaceId, access.user.id, conversationId), askPageData(spaceId, access.user.id)]);
  if (!conversation) notFound();
  return <AskScreen key={conversation.id} initialItems={toThreadItems(conversation.messages)} conversationId={conversation.id} {...data} />;
}

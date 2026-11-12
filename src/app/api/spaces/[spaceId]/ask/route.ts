import { RULES } from "@/lib/rate-limit";
import { askSchema } from "@/lib/validation";
import { apiAccess } from "@/server/access";
import { answerStream, AskError, startTurn } from "@/server/ask";
import { limit } from "@/server/rate-limiter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const gate = await apiAccess(spaceId);
  if (!gate.ok) return gate.response;
  const { user } = gate.access;

  const parsed = askSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid question." }, { status: 400 });

  const rate = await limit(RULES.ask, user.id);
  if (!rate.allowed) {
    const minutes = Math.ceil(rate.retryAfterSeconds / 60);
    return Response.json(
      {
        error: `You've asked ${rate.limit} questions this hour, the limit that keeps Rulebook free. Try again in ${minutes} min.`,
        retryAfterSeconds: rate.retryAfterSeconds,
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    const turn = await startTurn(spaceId, user.id, parsed.data.question, parsed.data.conversationId);
    const stream = answerStream({ spaceId, userId: user.id, question: parsed.data.question, ...turn, signal: request.signal });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (err) {
    if (err instanceof AskError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

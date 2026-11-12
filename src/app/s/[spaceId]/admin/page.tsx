import type { Metadata } from "next";
import { GapsList, type GapItem } from "@/components/admin/gaps-list";
import { InviteCard } from "@/components/admin/invite-card";
import { MembersList } from "@/components/admin/members-list";
import { RevealHeading } from "@/components/motion/reveal-heading";
import { requireManager } from "@/server/access";
import { db } from "@/server/db";
import { gapsReport, listMembers } from "@/server/space-data";

export const metadata: Metadata = { title: "Gaps & members" };

const REASON_LABEL: Record<string, string> = {
  WRONG_ANSWER: "Wrong answer",
  OUTDATED_RULE: "Outdated rule",
  WRONG_PAGE: "Wrong page cited",
  INCOMPLETE: "Missed something",
  SHOULD_BE_IN_DOCS: "Should be in the documents",
  OTHER: "Something else",
};

export default async function AdminPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireManager(spaceId);
  const [report, members, space, askers] = await Promise.all([
    gapsReport(spaceId),
    listMembers(spaceId),
    db.space.findUniqueOrThrow({ where: { id: spaceId }, select: { inviteToken: true, inviteEnabled: true } }),
    db.conversation.findMany({ where: { spaceId }, distinct: ["userId"], select: { userId: true } }),
  ]);
  const { stats } = report;
  const answeredPct = stats.answered + stats.notFound > 0 ? Math.round((stats.answered / (stats.answered + stats.notFound)) * 100) : null;

  const rows: GapItem[] = report.rows.map((r) => ({
    messageId: r.messageId,
    question: r.question,
    status: r.status,
    reasonLabel: r.reason ? REASON_LABEL[r.reason] ?? null : null,
    note: r.note,
    askedAt: r.askedAt.toISOString(),
    closestTitles: r.closestTitles,
  }));

  return (
    <div className="page">
      <div className="wrap page-head">
        <div className="section-num">For the admin</div>
        <RevealHeading as="h1" trigger="load" parts={[{ text: "What students asked that the shelf" }, { text: "couldn't answer.", emphasis: true }]} />
        <p className="muted">Unanswered and downvoted questions, newest first, with a hint about which document is missing. Fix the shelf, not the student.</p>
      </div>

      <div className="wrap admin-stack">
        <section className="admin" aria-labelledby="gaps-title">
          <div className="admin-head">
            <h2 id="gaps-title">Gaps</h2>
          </div>
          <div className="stats">
            <div className="stat">
              <b>{stats.asked.toLocaleString("en-IN")}</b>
              <span>questions asked by {askers.length.toLocaleString("en-IN")} {askers.length === 1 ? "person" : "people"}</span>
            </div>
            <div className="stat">
              <b>{answeredPct === null ? "–" : `${answeredPct}%`}</b>
              <span>answered with a citation</span>
            </div>
            <div className="stat">
              <b>{stats.notFound.toLocaleString("en-IN")}</b>
              <span>not in documents</span>
            </div>
            <div className="stat">
              <b>{stats.down.toLocaleString("en-IN")}</b>
              <span>thumbs down</span>
            </div>
          </div>
          {report.topics.length > 0 && (
            <div className="topics">
              <span className="hand">students keep asking about</span>
              {report.topics.map((t) => (
                <span key={t.term} className="topic">
                  {t.term} <b>×{t.count}</b>
                </span>
              ))}
            </div>
          )}
          <div className="admin-body">
            <GapsList rows={rows} />
          </div>
        </section>

        <div className="admin-side">
          <InviteCard spaceId={spaceId} token={space.inviteToken} enabled={space.inviteEnabled} />
          <MembersList
            spaceId={spaceId}
            members={members.map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role, isYou: m.user.id === access.user.id }))}
          />
        </div>
      </div>
    </div>
  );
}

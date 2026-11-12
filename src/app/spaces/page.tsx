import type { Metadata } from "next";
import Link from "next/link";
import { CreateSpaceForm } from "@/components/create-space-form";
import { SubmitButton } from "@/components/forms";
import { SimpleTopbar } from "@/components/page-chrome";
import { joinDemoAction } from "@/server/actions/space-actions";
import { logoutAction } from "@/server/actions/auth-actions";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { badge } from "@/lib/doc-types";

export const metadata: Metadata = { title: "Your spaces" };

const ERRORS: Record<string, string> = {
  invite: "That invite link doesn't work any more. Ask your college admin for a fresh one.",
  "no-demo": "The demo college isn't set up on this server yet.",
};

export default async function SpacesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser("/spaces");
  const { error } = await searchParams;
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      space: { select: { id: true, name: true, shortName: true, isDemo: true, _count: { select: { documents: { where: { status: "READY" } }, memberships: true } } } },
    },
  });
  const inDemo = memberships.some((m) => m.space.isDemo);

  return (
    <>
      <SimpleTopbar
        right={
          <form action={logoutAction}>
            <span className="topbar-user">{user.name}</span>
            <button className="btn btn-ghost btn-sm" type="submit">
              Log out
            </button>
          </form>
        }
      />
      <main id="main" className="wrap spaces-page">
        <span className="hand annotate">hi {user.name.split(" ")[0]}</span>
        <h1 className="page-title">Your college spaces</h1>
        {error && ERRORS[error] && (
          <div className="form-error" role="alert">
            {ERRORS[error]}
          </div>
        )}

        {memberships.length === 0 ? (
          <div className="card empty-inline">
            <h2 className="card-title">You haven&apos;t joined a college yet</h2>
            <p className="muted">
              Students: open the invite link your college shared (it looks like <code>/join/…</code>). Or try the demo college below, or set up yours.
            </p>
          </div>
        ) : (
          <ul className="space-list" role="list">
            {memberships.map(({ role, space }) => (
              <li key={space.id}>
                <Link className="space-card" href={`/s/${space.id}`}>
                  <span className="mono" aria-hidden="true">
                    {badge(space.shortName)}
                  </span>
                  <span className="space-card-body">
                    <b>{space.name}</b>
                    <span>
                      {space._count.documents} documents &middot; {space._count.memberships} {space._count.memberships === 1 ? "member" : "members"} &middot;{" "}
                      {space.isDemo ? "demo, read-only" : role === "ADMIN" ? "you're an admin" : "member"}
                    </span>
                  </span>
                  <span className="space-card-go" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="spaces-grid">
          <CreateSpaceForm />
          {!inDemo && (
            <form action={joinDemoAction} className="card">
              <h2 className="card-title">Just looking?</h2>
              <p className="muted">
                Join a fictional college with a sample handbook, placement policy, hostel rules and a circular that overrides an attendance rule. Ask anything.
              </p>
              <SubmitButton pendingLabel="Joining…" variant="plain">
                Try the demo college
              </SubmitButton>
            </form>
          )}
        </div>
      </main>
    </>
  );
}

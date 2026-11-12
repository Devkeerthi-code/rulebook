import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/forms";
import { SimpleTopbar } from "@/components/page-chrome";
import { joinDemoAction } from "@/server/actions/space-actions";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Try the demo college" };

export default async function TryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw } = await searchParams;
  const q = typeof raw === "string" ? raw.slice(0, 300) : undefined;
  const [user, demo] = await Promise.all([getCurrentUser(), db.space.findFirst({ where: { isDemo: true }, select: { id: true, name: true } })]);
  const here = `/try${q ? `?q=${encodeURIComponent(q)}` : ""}`;

  if (user && demo) {
    const member = await db.membership.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: demo.id } } });
    if (member) redirect(`/s/${demo.id}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  }

  return (
    <>
      <SimpleTopbar />
      <main id="main" className="wrap narrow-page">
        <span className="hand annotate">a pretend college, real answers</span>
        <h1 className="page-title">Try Rulebook on a demo college</h1>
        {q && (
          <p className="quoted-q">
            Your question: <q>{q}</q>
          </p>
        )}
        {!demo ? (
          <div className="notice">The demo college hasn&apos;t been set up on this server yet. Run <code>npm run db:seed</code>.</div>
        ) : (
          <div className="card">
            <p>
              <b>{demo.name}</b> is a fictional college with a sample handbook, placement policy, hostel rules and one circular that changes an attendance
              rule. Nothing in it is a real college&apos;s rules.
            </p>
            {user ? (
              <form action={joinDemoAction}>
                {q && <input type="hidden" name="q" value={q} />}
                <SubmitButton pendingLabel="Joining…">{q ? "Join the demo and ask" : "Join the demo college"}</SubmitButton>
              </form>
            ) : (
              <div className="row">
                <Link className="btn btn-primary" href={`/signup?next=${encodeURIComponent(here)}`} data-spring="">
                  Sign up to try it
                </Link>
                <Link className="btn" href={`/login?next=${encodeURIComponent(here)}`} data-spring="">
                  I have an account
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}

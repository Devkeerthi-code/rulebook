import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/forms";
import { SimpleTopbar } from "@/components/page-chrome";
import { joinWithInviteAction } from "@/server/actions/space-actions";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Join your college" };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const space = /^[\w-]{10,64}$/.test(token)
    ? await db.space.findFirst({ where: { inviteToken: token, inviteEnabled: true }, select: { id: true, name: true, _count: { select: { memberships: true } } } })
    : null;
  const user = await getCurrentUser();

  if (space && user) {
    const member = await db.membership.findUnique({ where: { userId_spaceId: { userId: user.id, spaceId: space.id } } });
    if (member) redirect(`/s/${space.id}`);
  }
  const here = `/join/${token}`;

  return (
    <>
      <SimpleTopbar />
      <main id="main" className="wrap narrow-page">
        {!space ? (
          <>
            <span className="hand annotate">hmm</span>
            <h1 className="page-title">This invite link doesn&apos;t work</h1>
            <p className="muted">It may have been replaced with a new one. Ask whoever shared it for the current link.</p>
            <Link className="btn" href="/" data-spring="">
              Go to the home page
            </Link>
          </>
        ) : (
          <>
            <span className="hand annotate">you&apos;re invited</span>
            <h1 className="page-title">Join {space.name}</h1>
            <p className="muted">
              {space._count.memberships} {space._count.memberships === 1 ? "person is" : "people are"} already here. You&apos;ll be able to ask about the documents this
              college has uploaded.
            </p>
            {user ? (
              <form action={joinWithInviteAction}>
                <input type="hidden" name="token" value={token} />
                <SubmitButton pendingLabel="Joining…">Join as {user.name}</SubmitButton>
              </form>
            ) : (
              <div className="row">
                <Link className="btn btn-primary" href={`/signup?next=${encodeURIComponent(here)}`} data-spring="">
                  Sign up to join
                </Link>
                <Link className="btn" href={`/login?next=${encodeURIComponent(here)}`} data-spring="">
                  Log in
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

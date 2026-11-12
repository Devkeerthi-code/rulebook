"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeMemberAction, setMemberRoleAction } from "@/server/actions/space-actions";

export interface MemberItem {
  userId: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  isYou: boolean;
}

export function MembersList({ spaceId, members }: { spaceId: string; members: MemberItem[] }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else toast.success(ok);
      setConfirming(null);
    });

  return (
    <div className="card">
      <h2 className="card-title">
        Members <span className="muted">({members.length})</span>
      </h2>
      <ul className="member-list" role="list">
        {members.map((m) => (
          <li key={m.userId} className="member-row">
            <span className="member-who">
              <b>
                {m.name}
                {m.isYou ? " (you)" : ""}
              </b>
              <span>{m.email}</span>
            </span>
            <span className={`status ${m.role === "ADMIN" ? "status--ok" : ""}`}>{m.role === "ADMIN" ? "Admin" : "Member"}</span>
            <span className="member-actions">
              {confirming === m.userId ? (
                <>
                  <button className="btn btn-sm btn-danger" type="button" disabled={pending} onClick={() => run(() => removeMemberAction(spaceId, m.userId), `${m.name} removed.`)}>
                    Remove
                  </button>
                  <button className="btn btn-sm btn-ghost" type="button" onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn btn-sm btn-ghost"
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => setMemberRoleAction(spaceId, m.userId, m.role === "ADMIN" ? "MEMBER" : "ADMIN"),
                        m.role === "ADMIN" ? `${m.name} is now a member.` : `${m.name} can now upload documents.`,
                      )
                    }
                  >
                    {m.role === "ADMIN" ? "Make member" : "Make admin"}
                  </button>
                  {!m.isYou && (
                    <button className="btn btn-sm btn-ghost" type="button" onClick={() => setConfirming(m.userId)} aria-label={`Remove ${m.name}`}>
                      Remove
                    </button>
                  )}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

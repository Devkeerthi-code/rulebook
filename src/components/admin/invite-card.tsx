"use client";

import { useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { rotateInviteAction, setInviteEnabledAction } from "@/server/actions/space-actions";
import { Icon } from "../icons";

const noop = () => () => undefined;

export function InviteCard({ spaceId, token, enabled }: { spaceId: string; token: string; enabled: boolean }) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const [pending, start] = useTransition();
  const url = `${origin}/join/${token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied. Paste it in your class group.");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">Invite link</h2>
      <p className="muted">Anyone with this link can join as a member and ask questions. Members can&apos;t upload or see other members.</p>
      {enabled ? (
        <div className="invite-row">
          <input className="input" readOnly value={url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
          <button className="btn btn-primary" type="button" onClick={copy} data-spring="">
            <Icon name="copy" />
            Copy
          </button>
        </div>
      ) : (
        <p className="notice">The invite link is turned off. Nobody new can join until you turn it back on.</p>
      )}
      <div className="row">
        <button
          className="btn btn-sm"
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await rotateInviteAction(spaceId);
              toast.success("New link made. The old one stops working now.");
            })
          }
          data-spring=""
        >
          <Icon name="replay" />
          Make a new link
        </button>
        <button
          className="btn btn-sm btn-ghost"
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setInviteEnabledAction(spaceId, !enabled);
              toast.success(enabled ? "Invite link turned off." : "Invite link turned on.");
            })
          }
        >
          {enabled ? "Turn link off" : "Turn link on"}
        </button>
      </div>
    </div>
  );
}

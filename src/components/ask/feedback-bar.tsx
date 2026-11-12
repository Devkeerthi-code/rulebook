"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { feedbackAction } from "@/server/actions/space-actions";
import { Icon } from "../icons";
import { useSpace } from "../space/space-context";

const REASONS = [
  ["WRONG_ANSWER", "Wrong answer"],
  ["OUTDATED_RULE", "Outdated rule"],
  ["WRONG_PAGE", "Wrong page cited"],
  ["INCOMPLETE", "Missed something"],
  ["SHOULD_BE_IN_DOCS", "Should be in the documents"],
  ["OTHER", "Something else"],
] as const;

type Reason = (typeof REASONS)[number][0];

/** Thumbs up/down. A thumbs-down asks why, so the admin knows what to fix. */
export function FeedbackBar({ messageId, initial }: { messageId: string; initial: "UP" | "DOWN" | null }) {
  const space = useSpace();
  const [rating, setRating] = useState(initial);
  const [askingWhy, setAskingWhy] = useState(false);
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(initial !== null);
  const [pending, start] = useTransition();

  const send = (r: "UP" | "DOWN", why?: Reason) =>
    start(async () => {
      const result = await feedbackAction(space.id, { messageId, rating: r, reason: why, note: note.trim() || undefined });
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't save that. Try again.");
        return;
      }
      setRating(r);
      setSent(true);
      setAskingWhy(false);
      toast.success(r === "UP" ? "Thanks, noted." : "Thanks. Your admin will see this.");
    });

  return (
    <div className="feedback">
      <span className="label">Was this right?</span>
      <button className="icon-btn" type="button" aria-pressed={rating === "UP"} aria-label="Yes, helpful" disabled={pending} onClick={() => send("UP")}>
        <Icon name="up" />
      </button>
      <button
        className="icon-btn"
        type="button"
        aria-pressed={rating === "DOWN" || askingWhy}
        aria-label="No, not helpful"
        aria-expanded={askingWhy}
        disabled={pending}
        onClick={() => setAskingWhy((v) => !v)}
      >
        <Icon name="down" />
      </button>
      {sent && !askingWhy && (
        <span className="thanks">
          <Icon name="check" />
          {rating === "UP" ? "Marked helpful" : "Reported to your admin"}
        </span>
      )}
      {askingWhy && (
        <form
          className="reasons"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason) send("DOWN", reason);
          }}
        >
          <div className="reason-chips" role="radiogroup" aria-label="What was wrong?">
            {REASONS.map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={reason === value} className="chip" onClick={() => setReason(value)}>
                {label}
              </button>
            ))}
          </div>
          <div className="reason-note">
            <label className="visually-hidden" htmlFor={`note-${messageId}`}>
              Anything else? (optional)
            </label>
            <input
              id={`note-${messageId}`}
              className="input input-sm"
              maxLength={500}
              placeholder="Anything else? (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button className="btn btn-sm btn-primary" type="submit" disabled={!reason || pending} data-spring="">
              {pending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

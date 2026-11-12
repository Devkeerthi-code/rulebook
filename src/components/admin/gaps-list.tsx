"use client";

import { useState } from "react";

export interface GapItem {
  messageId: string;
  question: string;
  status: "NOT_FOUND" | "DOWNVOTED";
  reasonLabel: string | null;
  note: string | null;
  askedAt: string;
  closestTitles: string[];
}

type Filter = "all" | "NOT_FOUND" | "DOWNVOTED";

export function GapsList({ rows }: { rows: GapItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = rows.filter((r) => filter === "all" || r.status === filter);
  const count = (f: Filter) => rows.filter((r) => f === "all" || r.status === f).length;

  return (
    <>
      <div className="tabs" role="group" aria-label="Filter questions">
        {(
          [
            ["all", "All"],
            ["NOT_FOUND", "Not in documents"],
            ["DOWNVOTED", "Thumbs down"],
          ] as const
        ).map(([f, label]) => (
          <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {label} ({count(f)})
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="qrows-empty">
          <span className="hand">nothing here, nice</span>
          <p className="muted">{rows.length === 0 ? "Every question so far was answered from the shelf, and nobody has flagged an answer." : "No questions match this filter."}</p>
        </div>
      ) : (
        <ul className="qrows">
          {shown.map((r) => (
            <li key={r.messageId} className="qrow">
              <span className="q">
                {r.question}
                <small>{new Date(r.askedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small>
              </span>
              <span className={`status ${r.status === "NOT_FOUND" ? "status--unanswered" : "status--down"}`}>{r.status === "NOT_FOUND" ? "Not in documents" : "Thumbs down"}</span>
              <span className="hint">
                {r.status === "NOT_FOUND" ? (
                  <>
                    <span className="hand">missing doc?</span>
                    <span>{r.closestTitles.length ? `Closest was ${r.closestTitles.join(" and ")}, which doesn't cover it.` : "Nothing on the shelf came close."}</span>
                  </>
                ) : (
                  <span>
                    {r.reasonLabel ?? "No reason given"}
                    {r.note ? `: “${r.note}”` : ""}
                    {r.closestTitles.length ? ` · cited ${r.closestTitles.join(", ")}` : ""}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

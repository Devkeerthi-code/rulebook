"use client";

import Link from "next/link";
import { Fragment } from "react";
import { parseAnswer, type Inline } from "@/lib/answer-format";
import type { AnswerSource } from "@/lib/answer-types";
import { formatDate } from "@/lib/doc-types";
import { Icon } from "../icons";
import { useSpace } from "../space/space-context";
import { CitationChip } from "./citation-chip";
import { FeedbackBar } from "./feedback-bar";
import type { AnswerItem } from "./types";

function Inlines({ parts, sources, streaming }: { parts: Inline[]; sources: AnswerSource[]; streaming: boolean }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === "cite") {
          const source = sources.find((s) => s.n === p.n);
          return source ? <CitationChip key={i} source={source} pop={streaming} /> : null;
        }
        return p.bold ? <strong key={i}>{p.text}</strong> : <Fragment key={i}>{p.text}</Fragment>;
      })}
    </>
  );
}

/** The answer body: paragraphs, bullets, bold numbers and citation chips. Never raw HTML. */
function AnswerBody({ text, sources, streaming }: { text: string; sources: AnswerSource[]; streaming: boolean }) {
  // While streaming, hide a half-arrived "[S1" so it doesn't flash as text.
  const visible = streaming ? text.replace(/\[S?\d*$/, "") : text;
  const blocks = parseAnswer(visible);
  const caret = streaming ? <span className="caret" aria-hidden="true" /> : null;
  return (
    <div className="answer">
      {blocks.map((b, i) => {
        const last = i === blocks.length - 1;
        return b.kind === "p" ? (
          <p key={i}>
            <Inlines parts={b.parts} sources={sources} streaming={streaming} />
            {last && caret}
          </p>
        ) : (
          <ul key={i}>
            {b.items.map((item, j) => (
              <li key={j}>
                <Inlines parts={item} sources={sources} streaming={streaming} />
                {last && j === b.items.length - 1 && caret}
              </li>
            ))}
          </ul>
        );
      })}
      {blocks.length === 0 && caret}
    </div>
  );
}

function uniqueByPage(sources: AnswerSource[]): AnswerSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = `${s.documentId}:${s.page}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ConflictCallout({ answer }: { answer: AnswerItem }) {
  const newer = answer.sources.find((s) => s.n === answer.conflict?.newer);
  const older = answer.sources.find((s) => s.n === answer.conflict?.older);
  if (!answer.conflict || !newer || !older) return null;
  return (
    <div className="conflict" role="note">
      <div className="conflict-head">
        <Icon name="warn" />
        Two documents disagree
        <span className="sticker sticker--warn" data-sticker="">
          <Icon name="clock" />
          Newer rule wins
        </span>
      </div>
      {answer.conflict.note && <p>{answer.conflict.note}</p>}
      <p>
        The answer follows <CitationChip source={newer} /> dated {formatDate(newer.effectiveDate)}, which is newer than <CitationChip source={older} /> dated{" "}
        {formatDate(older.effectiveDate)}.
      </p>
    </div>
  );
}

function NotFound({ answer, onAsk }: { answer: AnswerItem; onAsk: (q: string) => void }) {
  const space = useSpace();
  return (
    <div className="notfound">
      <div className="notfound-head">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <rect x="10" y="6" width="36" height="46" fill="var(--paper)" />
          <path d="M18 18h20M18 26h20M18 34h12" />
          <circle cx="42" cy="42" r="12" fill="var(--surface)" />
          <path d="M51 51l9 9" strokeWidth="4" />
          <path d="M38 38l8 8M46 38l-8 8" stroke="var(--accent)" />
        </svg>
        <div>
          <h3>Not in your documents</h3>
          <p>
            Nothing on {space.shortName}&apos;s shelf answers this, so Rulebook won&apos;t guess.
            {answer.closest.length > 0 ? " These passages came closest:" : ""}
          </p>
        </div>
      </div>
      {answer.closest.length > 0 && (
        <ul className="closest">
          {answer.closest.map((s) => (
            <li key={s.chunkId}>
              {s.text.length > 180 ? `${s.text.slice(0, 180).trimEnd()}…` : s.text}
              <div>
                <CitationChip source={s} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">
        <span className="hand">missing doc?</span>
        {space.canManage ? (
          <span>
            Students&apos; unanswered questions show up on the <Link href={`/s/${space.id}/admin`}>Gaps page</Link>, so you can see which PDF to add.
          </span>
        ) : (
          <span>Your college admin sees questions the shelf couldn&apos;t answer, so they know which document to add.</span>
        )}
      </p>
      {answer.followups.length > 0 && <Followups questions={answer.followups} onAsk={onAsk} />}
    </div>
  );
}

function Followups({ questions, onAsk }: { questions: string[]; onAsk: (q: string) => void }) {
  return (
    <div className="followups" aria-label="Follow-up questions">
      {questions.map((q) => (
        <button key={q} type="button" className="chip" onClick={() => onAsk(q)}>
          {q}
        </button>
      ))}
    </div>
  );
}

export function AnswerView({ answer, onAsk, onRetry }: { answer: AnswerItem; onAsk: (q: string) => void; onRetry: () => void }) {
  const cited = uniqueByPage(answer.sources.filter((s) => new RegExp(`\\[S${s.n}\\]`).test(answer.text)));
  const docCount = new Set(answer.sources.concat(answer.closest).map((s) => s.documentId)).size;
  return (
    <article className="msg-a" aria-busy={answer.status === "thinking" || answer.status === "streaming"}>
      <div className="who">
        <svg className="dot" viewBox="0 0 30 34" aria-hidden="true">
          <use href="#logo" />
        </svg>
        <span>
          Rulebook
          {answer.status === "done" && docCount > 0 && ` · read ${docCount} ${docCount === 1 ? "document" : "documents"}`}
          {answer.elapsedMs !== undefined && ` · ${(answer.elapsedMs / 1000).toFixed(1)} s`}
        </span>
      </div>

      {answer.status === "thinking" && (
        <span className="thinking" role="status">
          Reading the shelf
          <i />
          <i />
          <i />
        </span>
      )}

      {answer.status === "error" && (
        <div className="answer-error" role="alert">
          <p>{answer.error}</p>
          <button className="btn btn-sm" type="button" onClick={onRetry} data-spring="">
            <Icon name="replay" />
            Ask again
          </button>
        </div>
      )}

      {answer.notFound ? (
        answer.status === "done" && <NotFound answer={answer} onAsk={onAsk} />
      ) : (
        (answer.status === "streaming" || answer.status === "done") && (
          <>
            <AnswerBody text={answer.text} sources={answer.sources} streaming={answer.status === "streaming"} />
            {answer.status === "done" && (
              <>
                <ConflictCallout answer={answer} />
                {cited.length > 0 && (
                  <div className="sources">
                    <span>Read from</span>
                    {cited.map((s) => (
                      <CitationChip key={`${s.documentId}:${s.page}`} source={s} />
                    ))}
                  </div>
                )}
                {answer.id && <FeedbackBar messageId={answer.id} initial={answer.rating} />}
                {answer.followups.length > 0 && <Followups questions={answer.followups} onAsk={onAsk} />}
              </>
            )}
          </>
        )
      )}
    </article>
  );
}

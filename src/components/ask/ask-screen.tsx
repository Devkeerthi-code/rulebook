"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { StreamEvent } from "@/lib/answer-types";
import { Icon } from "../icons";
import { CONVERSATION_EVENT, useSpace, type ConversationEventDetail } from "../space/space-context";
import { AnswerView } from "./answer-view";
import { AskFailure, askStream, type AnswerItem, type ThreadItem } from "./types";

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

function emptyAnswer(): AnswerItem {
  return { kind: "answer", key: nextKey(), id: null, status: "thinking", text: "", sources: [], closest: [], notFound: false, conflict: null, followups: [], rating: null };
}

/** Fold one stream event into the answer being built. */
function applyEvent(answer: AnswerItem, event: StreamEvent, startedAt: number): AnswerItem {
  switch (event.type) {
    case "sources":
      return { ...answer, sources: event.sources };
    case "delta":
      return { ...answer, status: "streaming", text: answer.text + event.text };
    case "conflict":
      return { ...answer, conflict: event.conflict };
    case "not_found":
      return { ...answer, notFound: true, closest: event.closest, text: "" };
    case "done":
      return { ...answer, status: "done", id: event.messageId, followups: event.followups, text: event.content || answer.text, elapsedMs: Date.now() - startedAt };
    case "error":
      return { ...answer, status: "error", error: event.message };
    default:
      return answer;
  }
}

interface Props {
  initialItems: ThreadItem[];
  conversationId: string | null;
  starters: string[];
  hasDocuments: boolean;
  remaining: number;
  limit: number;
  initialQuestion?: string;
}

export function AskScreen({ initialItems, conversationId: initialConversationId, starters, hasDocuments, remaining: initialRemaining, limit, initialQuestion }: Props) {
  const space = useSpace();
  const [items, setItems] = useState<ThreadItem[]>(initialItems);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const conversationRef = useRef<string | null>(initialConversationId);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const autoAsked = useRef(false);
  // While an answer arrives the page follows it, until the reader scrolls up to read something else.
  const followRef = useRef(false);

  const ask = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (q.length < 3 || busy) return;
      setBusy(true);
      setQuestion("");
      const answer = emptyAnswer();
      const startedAt = Date.now();
      followRef.current = true;
      setItems((prev) => [...prev, { kind: "question", key: nextKey(), text: q }, answer]);
      const update = (fn: (a: AnswerItem) => AnswerItem) => setItems((prev) => prev.map((it) => (it.key === answer.key && it.kind === "answer" ? fn(it) : it)));

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        for await (const event of askStream(space.id, q, conversationRef.current, controller.signal, setRemaining)) {
          if (event.type === "start" && !conversationRef.current) {
            conversationRef.current = event.conversationId;
            window.history.replaceState(null, "", `/s/${space.id}/c/${event.conversationId}`);
            window.dispatchEvent(new CustomEvent<ConversationEventDetail>(CONVERSATION_EVENT, { detail: { id: event.conversationId, title: q } }));
          }
          update((a) => applyEvent(a, event, startedAt));
        }
      } catch (err) {
        const message = err instanceof AskFailure ? err.message : "The answer was interrupted. Ask again.";
        update((a) => ({ ...a, status: "error", error: message }));
        if (err instanceof AskFailure && err.status === 429) toast.error(message);
      } finally {
        abortRef.current = null;
        setBusy(false);
        inputRef.current?.focus({ preventScroll: true });
      }
    },
    [busy, space.id],
  );

  useEffect(() => {
    if (followRef.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [items]);

  useEffect(() => {
    const stop = () => {
      followRef.current = false;
    };
    const onWheel = (e: WheelEvent) => e.deltaY < 0 && stop();
    const onKey = (e: KeyboardEvent) => ["ArrowUp", "PageUp", "Home"].includes(e.key) && stop();
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchmove", stop, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // A question carried over from the landing page (?q=) is asked once, then removed from the URL.
  useEffect(() => {
    if (!initialQuestion || autoAsked.current || items.length > 0) return;
    autoAsked.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    void ask(initialQuestion);
  }, [initialQuestion, ask, items.length]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const lastQuestion = [...items].reverse().find((i) => i.kind === "question")?.text ?? "";

  return (
    <div className="ask-screen">
      <div className="thread" aria-live="polite">
        <div className="thread-inner">
          {items.length === 0 && (
            <EmptyThread hasDocuments={hasDocuments} starters={starters} onAsk={ask} />
          )}
          {items.map((item) =>
            item.kind === "question" ? (
              <p key={item.key} className="msg-q">
                {item.text}
              </p>
            ) : (
              <AnswerView key={item.key} answer={item} onAsk={ask} onRetry={() => ask(lastQuestion)} />
            ),
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="composer">
        <div className="composer-inner">
          {items.length > 0 && starters.length > 0 && !busy && (
            <div className="starters" aria-label="Suggested questions">
              {starters.slice(0, 5).map((s) => (
                <button key={s} type="button" className="chip" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="ask"
            aria-label="Ask a question"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
          >
            <label className="visually-hidden" htmlFor="ask-input">
              Your question about {space.shortName}&apos;s rules
            </label>
            <input
              ref={inputRef}
              id="ask-input"
              type="text"
              autoComplete="off"
              maxLength={500}
              placeholder={hasDocuments ? "Ask about attendance, exams, placements, hostel…" : "Waiting for the first document…"}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={!hasDocuments}
            />
            <button className="btn btn-primary" type="submit" aria-label="Ask" disabled={busy || !hasDocuments || question.trim().length < 3} data-spring="">
              <Icon name="send" />
            </button>
          </form>
          <div className="meta">
            <span>Answers only from documents on this shelf{space.isDemo ? " (demo documents, fictional college)" : ""}.</span>
            <span>
              {remaining} of {limit} questions left this hour
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyThread({ hasDocuments, starters, onAsk }: { hasDocuments: boolean; starters: string[]; onAsk: (q: string) => void }) {
  const space = useSpace();
  if (!hasDocuments) {
    return (
      <div className="card empty">
        <div className="illo" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 150h280" strokeWidth="6" />
            <path d="M40 150V92h22v58" fill="var(--surface)" />
            <path d="M40 92l11-10 11 10" />
            <g className="bob">
              <path d="M150 60c10-14 30-14 40 0" strokeDasharray="3 7" />
              <circle cx="168" cy="42" r="3" fill="currentColor" />
              <circle cx="196" cy="30" r="2" fill="currentColor" />
              <circle cx="140" cy="34" r="2.5" fill="currentColor" />
            </g>
            <path d="M262 150v-46l18 4v42" fill="var(--surface)" />
          </svg>
        </div>
        <span className="hand">the shelf&apos;s waiting</span>
        <h2>No documents yet</h2>
        {space.canManage ? (
          <>
            <p>Upload the student handbook first. It answers most questions on its own. Add the regulations and placement policy next.</p>
            <div className="row">
              <Link className="btn btn-primary btn-sm" href={`/s/${space.id}/shelf`} data-spring="">
                <Icon name="upload" />
                Upload a PDF
              </Link>
            </div>
          </>
        ) : (
          <p>Your college admin hasn&apos;t added any documents yet. Questions open up as soon as the first PDF is ready.</p>
        )}
      </div>
    );
  }
  return (
    <div className="card empty">
      <div className="illo" aria-hidden="true">
        <svg viewBox="0 0 320 200" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <g className="bob">
            <path d="M70 40h150a14 14 0 0 1 14 14v40a14 14 0 0 1-14 14h-96l-24 22v-22H70a14 14 0 0 1-14-14V54a14 14 0 0 1 14-14z" fill="var(--surface)" />
            <text x="132" y="92" fontWeight="800" fontSize="46" fill="currentColor" stroke="none" style={{ fontFamily: "var(--font-display)" }}>
              ?
            </text>
          </g>
          <path d="M246 132l10-12M262 148l14-4M246 154l6 10" stroke="var(--accent)" strokeWidth="3" />
          <path d="M40 170h240" strokeWidth="2" strokeDasharray="2 8" />
        </svg>
      </div>
      <span className="hand">go on, ask the awkward one</span>
      <h2>Ask {space.shortName}&apos;s rulebook</h2>
      <p>Plain words are fine. Every answer comes with the document and page it&apos;s from, and it says so if the documents don&apos;t cover it.</p>
      {starters.length > 0 && (
        <div className="row" aria-label="Suggested questions">
          {starters.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => onAsk(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

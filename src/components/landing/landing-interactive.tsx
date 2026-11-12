"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "../icons";
import { Shelf } from "../shelf/shelf";
import type { CoverData } from "../shelf/cover";
import { Tickers } from "../ticker";

/** Every question asked from the landing page goes to the demo college, via a page that asks before joining. */
function tryHref(question: string): string {
  return `/try?q=${encodeURIComponent(question.slice(0, 300))}`;
}

export function HeroAsk({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      className="ask"
      role="search"
      aria-label="Ask the demo college's rulebook"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(tryHref(q.trim() || placeholder));
      }}
    >
      <label className="visually-hidden" htmlFor="hero-input">
        Ask a question about the demo college&apos;s rules
      </label>
      <input id="hero-input" name="q" type="text" autoComplete="off" maxLength={300} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="btn btn-primary" type="submit" data-spring="" aria-label="Ask">
        <Icon name="send" />
        <span>Ask</span>
      </button>
    </form>
  );
}

export function LandingTickers({ rows }: { rows: [string[], string[]] }) {
  const router = useRouter();
  return <Tickers rows={rows} onAsk={(q) => router.push(tryHref(q))} label="questions students actually ask, tap one" />;
}

export function LandingShelf({ covers }: { covers: CoverData[] }) {
  const router = useRouter();
  return <Shelf covers={covers} label="Demo document shelf" onOpen={() => router.push("/try")} />;
}

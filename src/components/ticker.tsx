"use client";

import { useState } from "react";

/** Two strips of real questions scrolling in opposite directions. Clicking one asks it. Pausable (WCAG 2.2.2). */
export function Tickers({ rows, onAsk, label }: { rows: [string[], string[]]; onAsk: (q: string) => void; label: string }) {
  const [paused, setPaused] = useState(false);
  return (
    <section aria-label={label}>
      <div className="ticker-row-label wrap">
        <span className="hand">{label}</span>
        <button className="btn btn-ghost btn-sm" type="button" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
          {paused ? "Play" : "Pause"}
        </button>
      </div>
      {rows.map((questions, r) => (
        <div
          key={r}
          className={`ticker${paused ? " is-paused" : ""}`}
          data-dir={r === 0 ? "left" : "right"}
          style={{ ["--speed" as string]: `${60 + questions.length * 4 + r * 15}s` }}
        >
          <div className="ticker-track">
            {[0, 1].map((copy) =>
              questions.map((q, i) => (
                <span key={`${copy}-${i}`} style={{ display: "contents" }}>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => onAsk(q)}
                    tabIndex={copy ? -1 : undefined}
                    aria-hidden={copy ? true : undefined}
                  >
                    {q}
                  </button>
                  <span className="sep" aria-hidden="true">
                    /
                  </span>
                </span>
              )),
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

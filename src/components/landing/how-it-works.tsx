"use client";

import { useEffect, useRef } from "react";

const STEPS = [
  {
    n: 1,
    tag: "upload",
    title: "The admin drops in the PDFs",
    body: "Handbook, regulations, syllabi, placement policy, the circular from last Tuesday. Scanned copies too.",
    art: (
      <svg viewBox="0 0 240 180" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path className="draw" style={{ ["--len" as string]: 420 }} d="M40 120h160l-14 44H54z" />
        <path className="draw" style={{ ["--len" as string]: 120 }} d="M40 120l18-22h124l18 22" />
        <g className="bob">
          <rect x="88" y="22" width="64" height="82" fill="var(--surface)" />
          <path d="M98 40h44M98 52h44M98 64h30" />
          <rect x="132" y="22" width="20" height="18" className="wash" stroke="none" />
          <text x="135" y="35" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" style={{ fontFamily: "var(--font-ui)" }}>PDF</text>
        </g>
        <path className="acc-s draw" style={{ ["--len" as string]: 80 }} d="M190 40v40M178 52l12-12 12 12" strokeWidth="3" />
      </svg>
    ),
  },
  {
    n: 2,
    tag: "we read it",
    title: "Rulebook reads every page",
    body: "Text is pulled out page by page, scanned pages go through OCR, and each clause is indexed with its page number.",
    art: (
      <svg viewBox="0 0 240 180" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect className="draw" style={{ ["--len" as string]: 400 }} x="56" y="20" width="110" height="142" fill="var(--surface)" />
        <path d="M72 44h78M72 58h78M72 72h60M72 92h78M72 106h78M72 120h44M72 140h70" strokeWidth="2" />
        <g className="scan"><path className="acc-s" d="M48 36h126" strokeWidth="3" /></g>
        <circle className="draw" style={{ ["--len" as string]: 200 }} cx="168" cy="118" r="28" fill="var(--paper)" fillOpacity=".6" />
        <path className="draw" style={{ ["--len" as string]: 60 }} d="M188 138l26 26" strokeWidth="6" />
      </svg>
    ),
  },
  {
    n: 3,
    tag: "ask",
    title: "Students ask in plain words",
    body: "“Can I sit placements with one backlog?” No need to know which document or which section it lives in.",
    art: (
      <svg viewBox="0 0 240 180" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect className="draw" style={{ ["--len" as string]: 520 }} x="22" y="70" width="196" height="46" rx="23" fill="var(--surface)" />
        <path d="M42 93h104" strokeWidth="2" strokeDasharray="6 6" />
        <rect x="176" y="76" width="34" height="34" rx="17" className="acc" stroke="none" />
        <path d="M193 101V85M186 92l7-7 7 7" stroke="var(--on-accent)" strokeWidth="2.5" />
        <g className="bob">
          <path className="draw" style={{ ["--len" as string]: 200 }} d="M50 20h90a10 10 0 0 1 10 10v16a10 10 0 0 1-10 10H78l-14 12V56H50a10 10 0 0 1-10-10V30a10 10 0 0 1 10-10z" fill="var(--surface)" />
          <path d="M58 34h70M58 44h44" strokeWidth="2" />
        </g>
      </svg>
    ),
  },
  {
    n: 4,
    tag: "get the page",
    title: "The answer opens to the page",
    body: "Every claim has a chip. Tap it and the PDF opens at that page with the passage highlighted. Check it yourself.",
    art: (
      <svg viewBox="0 0 240 180" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="60" y="14" width="120" height="152" fill="var(--surface)" />
        <path d="M76 36h88M76 50h88M76 64h60" strokeWidth="2" />
        <rect x="72" y="80" width="96" height="30" className="wash" stroke="none" />
        <path className="draw acc-s" style={{ ["--len" as string]: 200 }} d="M72 110h96" strokeWidth="3" />
        <path d="M78 88h84M78 100h60M76 126h88M76 140h70" strokeWidth="2" />
        <path d="M150 14v30l8-7 8 7V14" className="acc" stroke="none" />
        <g className="bob">
          <rect x="168" y="118" width="58" height="26" rx="13" fill="var(--surface)" className="acc-s" />
          <text x="180" y="136" fontSize="13" fontWeight="700" className="acc" stroke="none" style={{ fontFamily: "var(--font-ui)" }}>p.14</text>
        </g>
      </svg>
    ),
  },
];

export function HowItWorks() {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const items = listRef.current?.querySelectorAll(".step");
    if (!items) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.3 },
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, []);

  return (
    <ol className="steps" role="list" ref={listRef}>
      {STEPS.map((s) => (
        <li key={s.n} className="step">
          <div className="illo" aria-hidden="true">
            {s.art}
          </div>
          <span className="step-n">
            {s.n}
            <small>{s.tag}</small>
          </span>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

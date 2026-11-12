"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface Part {
  text: string;
  emphasis?: boolean;
}

/**
 * Oversized heading whose words rise out of a clip mask, 70 ms apart, on a spring curve.
 * Screen readers get the full sentence once; the animated words are aria-hidden.
 */
export function RevealHeading({
  as = "h2",
  parts,
  trigger = "view",
  className = "",
  id,
}: {
  as?: "h1" | "h2";
  parts: Part[];
  trigger?: "load" | "view";
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const show = () => requestAnimationFrame(() => node.classList.add("in"));
    if (trigger === "load") {
      document.fonts.ready.then(show, show);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          show();
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [trigger]);

  let i = 0;
  const words: ReactNode[] = [];
  for (const part of parts) {
    for (const word of part.text.split(/\s+/).filter(Boolean)) {
      const index = i++;
      words.push(
        <span key={index} className="w" style={{ ["--i" as string]: index }}>
          <span className={part.emphasis ? "em" : undefined}>{word}</span>
        </span>,
        " ",
      );
    }
  }

  const Tag = as;
  return (
    <Tag ref={ref} id={id} className={`reveal ${className}`}>
      <span className="visually-hidden">{parts.map((p) => p.text).join(" ")}</span>
      <span aria-hidden="true">{words}</span>
    </Tag>
  );
}

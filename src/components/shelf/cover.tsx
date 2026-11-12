import { useId } from "react";
import type { CoverPattern } from "@/lib/doc-types";

const TILES: Record<CoverPattern, (id: string) => React.ReactNode> = {
  ruled: (id) => (
    <pattern id={id} width="12" height="10" patternUnits="userSpaceOnUse">
      <path d="M0 9.5h12" stroke="currentColor" strokeWidth="1.2" />
    </pattern>
  ),
  grid: (id) => (
    <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M14 0V14H0" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </pattern>
  ),
  stripes: (id) => (
    <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="4" height="10" fill="currentColor" />
    </pattern>
  ),
  dots: (id) => (
    <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
      <circle cx="6" cy="6" r="2.2" fill="currentColor" />
    </pattern>
  ),
  zigzag: (id) => (
    <pattern id={id} width="16" height="12" patternUnits="userSpaceOnUse">
      <path d="M0 9l4-6 4 6 4-6 4 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </pattern>
  ),
  plus: (id) => (
    <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="1.6" />
    </pattern>
  ),
};

export function PatternFill({ pattern }: { pattern: CoverPattern }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg aria-hidden="true" width="100%" height="100%">
      <defs>{TILES[pattern](id)}</defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export interface CoverData {
  id: string;
  title: string;
  typeLabel: string;
  pattern: CoverPattern;
  dateLabel: string;
  pages: number;
  demo: boolean;
  inverted?: boolean;
  sticker?: string;
  /** Shown instead of page count while processing, e.g. "Reading 12/86". */
  statusLabel?: string;
}

export function CoverFace({ cover }: { cover: CoverData }) {
  return (
    <>
      <span className="pattern">
        <PatternFill pattern={cover.pattern} />
      </span>
      <span className="type">{cover.typeLabel}</span>
      {cover.demo && <span className="demo">DEMO</span>}
      <span className="title">{cover.title}</span>
      <span className="meta">
        <span>{cover.dateLabel}</span>
        <span>{cover.statusLabel ?? `${cover.pages} pp`}</span>
      </span>
      {cover.sticker && (
        <span className="sticker sticker--accent" data-sticker="">
          {cover.sticker}
        </span>
      )}
    </>
  );
}

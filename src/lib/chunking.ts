import { cleanText, splitSentences } from "./text";

export interface PageText {
  pageNumber: number;
  text: string;
}

export interface TextChunk {
  ordinal: number;
  pageNumber: number;
  /** Nearest heading above the chunk, carried across page breaks. */
  heading: string;
  text: string;
  /** Characters at the start of `text` repeated from the previous chunk (0 for the first chunk of a section). */
  overlapChars: number;
}

export interface ChunkOptions {
  maxChars: number;
  overlapChars: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { maxChars: 1100, overlapChars: 220 };

const HEADING_KEYWORD = /^(chapter|section|part|clause|annexure|appendix|schedule|rule|article)\s+[\dIVXLC]+\b/i;
const NUMBERED_HEADING = /^\d{1,2}(\.\d{1,2}){0,3}\.?\s+\p{Lu}/u;
const SUBJECT_LINE = /^(subject|sub|re)\s*:/i;

/** A line is a heading if it is short and looks like a section title, not a sentence. */
export function isHeading(line: string): boolean {
  const s = line.trim();
  if (s.length < 3 || s.length > 120) return false;
  if (SUBJECT_LINE.test(s)) return true;
  if (s.length > 90) return false;
  const endsLikeSentence = /[.,;]$/.test(s);
  if (HEADING_KEYWORD.test(s) && !endsLikeSentence) return true;
  if (NUMBERED_HEADING.test(s) && !endsLikeSentence && s.split(/\s+/).length <= 10) return true;
  const letters = s.replace(/[^\p{L}]/gu, "");
  return letters.length >= 4 && letters === letters.toUpperCase() && !endsLikeSentence && /\p{Lu}/u.test(letters);
}

const PAGE_FOOTER = /^(page\s+)?\d+\s*(of\s*\d+)?$|\bpage\s+\d+\s+of\s+\d+\b/i;

/**
 * Remove running headers and footers: lines that repeat (digits ignored) on most pages,
 * plus "Page 3 of 10" style lines. They add noise to every chunk and every search.
 */
export function stripRunningLines(pages: PageText[]): PageText[] {
  const signature = (line: string) => line.trim().toLowerCase().replace(/\d+/g, "#");
  const counts = new Map<string, number>();
  for (const page of pages) {
    for (const sig of new Set(cleanText(page.text).split("\n").map(signature).filter(Boolean))) {
      counts.set(sig, (counts.get(sig) ?? 0) + 1);
    }
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.6));
  const repeated = new Set([...counts].filter(([, n]) => n >= threshold).map(([sig]) => sig));
  return pages.map((page) => ({
    pageNumber: page.pageNumber,
    text: cleanText(page.text)
      .split("\n")
      .filter((line) => !repeated.has(signature(line)) && !PAGE_FOOTER.test(line.trim()))
      .join("\n"),
  }));
}

interface Block {
  pageNumber: number;
  heading: string;
  text: string;
}

/** Group each page's lines under the heading that precedes them. Headings carry over page breaks. */
function toBlocks(pages: PageText[]): Block[] {
  const blocks: Block[] = [];
  let heading = "";
  for (const page of stripRunningLines([...pages].sort((a, b) => a.pageNumber - b.pageNumber))) {
    let lines: string[] = [];
    const flush = () => {
      const text = lines.join(" ").replace(/\s+/g, " ").trim();
      if (text) blocks.push({ pageNumber: page.pageNumber, heading, text });
      lines = [];
    };
    for (const raw of cleanText(page.text).split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (isHeading(line)) {
        flush();
        heading = line.replace(/\s+/g, " ");
      } else {
        lines.push(line);
      }
    }
    flush();
  }
  return blocks;
}

/** Break one over-long sentence on word boundaries. */
function hardSplit(sentence: string, maxChars: number): string[] {
  const out: string[] = [];
  let current = "";
  for (const word of sentence.split(" ")) {
    if (current && current.length + 1 + word.length > maxChars) {
      out.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) out.push(current);
  return out;
}

/** Trailing sentences of the previous chunk that fit in the overlap budget. */
function overlapTail(sentences: string[], overlapChars: number): string[] {
  const tail: string[] = [];
  // Stop before index 0 so a chunk is never repeated wholesale.
  for (let i = sentences.length - 1; i > 0; i--) {
    if ([sentences[i]!, ...tail].join(" ").length > overlapChars) break;
    tail.unshift(sentences[i]!);
  }
  return tail;
}

/**
 * Split extracted pages into retrievable chunks.
 * - Boundaries follow headings, so a chunk rarely mixes two rules.
 * - A chunk never spans two pages, so every citation points at exactly one page.
 * - Consecutive chunks of the same section share whole trailing sentences (the overlap).
 */
export function chunkPages(pages: PageText[], options: ChunkOptions = DEFAULT_CHUNK_OPTIONS): TextChunk[] {
  const { maxChars, overlapChars } = options;
  const chunks: TextChunk[] = [];

  for (const block of toBlocks(pages)) {
    const sentences = splitSentences(block.text).flatMap((s) => (s.length > maxChars ? hardSplit(s, maxChars) : [s]));
    let current: string[] = [];
    let carried = 0;

    const emit = () => {
      if (current.length === 0 || current.length === carried) return;
      const text = current.join(" ");
      const overlap = carried ? current.slice(0, carried).join(" ").length : 0;
      chunks.push({ ordinal: chunks.length, pageNumber: block.pageNumber, heading: block.heading, text, overlapChars: overlap });
    };

    for (const sentence of sentences) {
      const length = current.join(" ").length;
      if (current.length > carried && length + 1 + sentence.length > maxChars) {
        emit();
        const tail = overlapTail(current, overlapChars);
        // Only carry the tail if the new sentence still fits beside it.
        current = tail.join(" ").length + 1 + sentence.length <= maxChars ? tail : [];
        carried = current.length;
      }
      current.push(sentence);
    }
    emit();
  }
  return chunks;
}

/** What gets embedded: the document and section give a short passage its context. */
export function embeddingInput(documentTitle: string, chunk: Pick<TextChunk, "heading" | "text">): string {
  const head = chunk.heading ? `${documentTitle} — ${chunk.heading}` : documentTitle;
  return `${head}\n${chunk.text}`;
}

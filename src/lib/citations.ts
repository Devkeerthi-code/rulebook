import type { AnswerSource, ConflictNote } from "./answer-types";
import { CONFLICT_PREFIX } from "./prompt";

/** Matches [S1], [S1, S3], [S1][S2] (each bracket handled separately), [s2]. */
const CITATION_GROUP = /\[\s*S\d+(?:\s*[,;]\s*S?\d+)*\s*\]/gi;

/** Numbers cited inside one bracket group, e.g. "[S1, S3]" -> [1, 3]. */
function numbersIn(group: string): number[] {
  return (group.match(/\d+/g) ?? []).map(Number);
}

/** Every source number cited in the text, in first-seen order. */
export function citedNumbers(text: string): number[] {
  const seen: number[] = [];
  for (const group of text.match(CITATION_GROUP) ?? []) {
    for (const n of numbersIn(group)) if (!seen.includes(n)) seen.push(n);
  }
  return seen;
}

/**
 * Rewrite citation groups into canonical single markers ([S1][S3]) and drop any number
 * that isn't one of the sources we actually gave the model (a hallucinated citation).
 */
export function normalizeCitations(text: string, sources: Pick<AnswerSource, "n">[]): string {
  const valid = new Set(sources.map((s) => s.n));
  return text.replace(CITATION_GROUP, (group) =>
    numbersIn(group)
      .filter((n) => valid.has(n))
      .map((n) => `[S${n}]`)
      .join(""),
  );
}

/** Strip anything that could carry data out or render as markup: links, images, raw HTML. */
export function sanitizeAnswer(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\((?:https?:|mailto:|javascript:|data:)[^)]*\)/gi, "$1")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/\bhttps?:\/\/\S+/gi, "[link removed]")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** Map a citation number to the document and page it points at. */
export function resolveCitation(n: number, sources: AnswerSource[]): AnswerSource | null {
  return sources.find((s) => s.n === n) ?? null;
}

/**
 * Parse "CONFLICT: S3 over S7 | note". The database's effective dates decide which source is newer,
 * not the model: if the model named them the wrong way round, they are swapped.
 */
export function parseConflict(line: string | null, sources: AnswerSource[]): ConflictNote | null {
  if (!line?.startsWith(CONFLICT_PREFIX)) return null;
  const body = line.slice(CONFLICT_PREFIX.length);
  const [pair = "", note = ""] = body.split("|");
  const nums = (pair.match(/S(\d+)/gi) ?? []).map((m) => Number(m.slice(1)));
  if (nums.length < 2) return null;
  const a = resolveCitation(nums[0]!, sources);
  const b = resolveCitation(nums[1]!, sources);
  if (!a || !b || a.n === b.n || a.documentId === b.documentId) return null;
  const [newer, older] = a.effectiveDate >= b.effectiveDate ? [a, b] : [b, a];
  return { newer: newer.n, older: older.n, note: nameSources(sanitizeAnswer(note), sources).slice(0, 300) };
}

/** The model refers to sources as S1, S2; students should see document names instead. */
export function nameSources(text: string, sources: AnswerSource[]): string {
  return text.replace(/\[?\bS(\d+)\b\]?/g, (match, n: string) => {
    const s = resolveCitation(Number(n), sources);
    return s ? `${s.title.replace(/\s*\(DEMO\)/i, "")} (p. ${s.page})` : match;
  });
}

export interface FinalAnswer {
  text: string;
  cited: number[];
  /** True when the model produced text but cited nothing we gave it: treated as "not in documents". */
  uncited: boolean;
}

/** Final pass over the model's visible text before it is stored. */
export function finalizeAnswer(raw: string, sources: AnswerSource[]): FinalAnswer {
  const text = normalizeCitations(sanitizeAnswer(raw), sources).replace(/\n{3,}/g, "\n\n").trim();
  const cited = citedNumbers(text);
  return { text, cited, uncited: text.length > 0 && cited.length === 0 };
}

import { normalizeForMatch } from "./text";

/**
 * True if a PDF text-layer item is part of the cited passage. Items are usually whole lines;
 * short items only count when the passage is short too, so stray words like "the" don't light up.
 */
export function inPassage(item: string, normalizedPassage: string): boolean {
  const n = normalizeForMatch(item);
  if (n.length < 4) return false;
  if (n.length < 12 && normalizedPassage.length > 80) return false;
  return normalizedPassage.includes(n);
}

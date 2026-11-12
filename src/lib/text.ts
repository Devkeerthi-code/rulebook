/** Small text helpers shared by chunking, keyword search, re-ranking and highlighting. */

const STOPWORDS = new Set(
  (
    "a an and are as at be been but by can could did do does for from had has have how i if in into is it its " +
    "me my of on or our shall should so than that the their them then there these they this to too was we were " +
    "what when where which who whom why will with would you your am any all also about after before during " +
    "per under over up out not no nor only own same such very just get got much many more most"
  ).split(" "),
);

/** Collapse whitespace and strip control characters (PDF extraction leaves plenty of both). */
export function cleanText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/­/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Lowercase, drop punctuation, single-space. Used for fuzzy containment checks. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Meaningful query terms: lowercase words of 2+ chars (or numbers), minus stopwords, de-duplicated. */
export function queryTerms(text: string): string[] {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const seen = new Set<string>();
  for (const w of words) {
    if (w.length < 2 && !/\d/.test(w)) continue;
    if (STOPWORDS.has(w)) continue;
    seen.add(w);
  }
  return [...seen];
}

/** Very small suffix stemmer so "backlogs" matches "backlog" in re-ranking. */
export function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 4 && word.endsWith("es") && /(ss|sh|ch|x)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Split into sentences, keeping list markers like "(a)" or "4.1" attached to their sentence. */
export function splitSentences(text: string): string[] {
  const parts = text
    .replace(/\n+/g, " \n ")
    .split(/(?<=[.!?;:])\s+(?=[("'\p{Lu}\d])|\s\n\s/u)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts;
}

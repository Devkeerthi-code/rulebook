import type { DocTypeName } from "./answer-types";

/** Document types are told apart by label and cover pattern, never by colour. */
export const DOC_TYPE_META: Record<DocTypeName, { label: string; pattern: CoverPattern }> = {
  HANDBOOK: { label: "Handbook", pattern: "ruled" },
  REGULATIONS: { label: "Regulations", pattern: "grid" },
  POLICY: { label: "Policy", pattern: "stripes" },
  RULES: { label: "Rules", pattern: "dots" },
  CIRCULAR: { label: "Circular", pattern: "zigzag" },
  SYLLABUS: { label: "Syllabus", pattern: "plus" },
  OTHER: { label: "Document", pattern: "ruled" },
};

export type CoverPattern = "ruled" | "grid" | "stripes" | "dots" | "zigzag" | "plus";

/** "12 Sept 2025". Dates are stored as calendar dates, so format in UTC to avoid off-by-one days. */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "Student Handbook 2025-26 p.5" style label for citation chips, kept short. */
export function shortTitle(title: string, max = 26): string {
  const cleaned = title.replace(/\s*\(DEMO\)\s*/i, "").replace(/^Circular\s+(\S+):.*$/i, "Circular $1");
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trimEnd()}…` : cleaned;
}

/** "NIT-DEMO" -> "NIT", "GECT" -> "GECT": the first word, at most 4 characters. */
export function badge(shortName: string): string {
  return (shortName.split(/[\s.&-]+/)[0] || shortName).slice(0, 4).toUpperCase();
}

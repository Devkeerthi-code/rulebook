import type { CoverData } from "@/components/shelf/cover";
import type { DocTypeName } from "./answer-types";
import { DOC_TYPE_META, formatDate } from "./doc-types";

export interface CoverSource {
  id: string;
  title: string;
  type: DocTypeName;
  effectiveDate: Date | string;
  pageCount: number;
  status: string;
  progress?: unknown;
}

const STAGE_LABEL: Record<string, string> = {
  QUEUED: "Queued",
  EXTRACTING: "Reading",
  OCR: "OCR",
  CHUNKING: "Splitting",
  EMBEDDING: "Indexing",
  FAILED: "Needs attention",
};

const iso = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/**
 * Turn documents into shelf covers. A circular newer than every non-circular document wears an
 * "Updated circular" sticker, since it probably overrides something on the shelf.
 */
export function toCovers(docs: CoverSource[], demo: boolean): CoverData[] {
  const newestBase = docs.filter((d) => d.type !== "CIRCULAR").reduce((max, d) => (iso(d.effectiveDate) > max ? iso(d.effectiveDate) : max), "");
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    typeLabel: DOC_TYPE_META[d.type].label,
    pattern: DOC_TYPE_META[d.type].pattern,
    dateLabel: `${d.type === "CIRCULAR" ? "Dated" : "Effective"} ${formatDate(iso(d.effectiveDate))}`,
    pages: d.pageCount,
    demo,
    inverted: d.type === "CIRCULAR",
    sticker: d.type === "CIRCULAR" && iso(d.effectiveDate) > newestBase ? "Updated circular" : undefined,
    statusLabel: d.status === "READY" ? undefined : STAGE_LABEL[d.status],
  }));
}

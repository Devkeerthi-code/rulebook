"use client";

import type { AnswerSource } from "@/lib/answer-types";
import { shortTitle } from "@/lib/doc-types";
import { Icon } from "../icons";
import { useOpenPdf } from "../pdf/pdf-panel";
import { useSpace } from "../space/space-context";

/** A citation: document + page. Opens the PDF at that page with the passage highlighted. */
export function CitationChip({ source, pop = false }: { source: AnswerSource; pop?: boolean }) {
  const openPdf = useOpenPdf();
  const space = useSpace();
  return (
    <button
      type="button"
      className={`cite${pop ? " pop" : ""}`}
      aria-label={`Open ${source.title} at page ${source.page}`}
      onClick={(e) =>
        openPdf(
          {
            spaceId: space.id,
            documentId: source.documentId,
            title: source.title,
            type: source.type,
            effectiveDate: source.effectiveDate,
            page: source.page,
            passage: source.text,
            demo: space.isDemo,
            fromCitation: true,
          },
          e.currentTarget,
        )
      }
    >
      <Icon name="page" />
      {shortTitle(source.title)} p.{source.page}
    </button>
  );
}

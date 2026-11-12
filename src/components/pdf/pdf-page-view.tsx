"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { inPassage } from "@/lib/highlight";
import { normalizeForMatch } from "@/lib/text";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface PdfPageViewProps {
  url: string;
  page: number;
  passage?: string;
  onPageCount: (n: number) => void;
  /** Called after the text layer renders: whether the passage could be highlighted on the page. */
  onHighlight: (found: boolean) => void;
}

/** One PDF page at the panel's width, with the cited passage highlighted in the text layer. */
export default function PdfPageView({ url, page, passage, onPageCount, onHighlight }: PdfPageViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const normalizedPassage = useMemo(() => (passage ? normalizeForMatch(passage) : ""), [passage]);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.min(720, Math.floor(entry?.contentRect.width ?? 0))));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // pdf.js inserts what this returns as HTML, so the text is escaped first.
  const renderText = useCallback(
    ({ str }: { str: string }) => {
      const safe = escapeHtml(str);
      return normalizedPassage && inPassage(str, normalizedPassage) ? `<mark class="pdf-hl">${safe}</mark>` : safe;
    },
    [normalizedPassage],
  );

  const afterTextLayer = useCallback(() => {
    const marks = wrapRef.current?.querySelectorAll<HTMLElement>("mark.pdf-hl");
    onHighlight(Boolean(marks && marks.length));
    if (!marks?.length) return;
    marks[0]!.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    // The wash sweeps in just after the page settles.
    window.setTimeout(() => marks.forEach((m) => m.classList.add("lit")), 120);
  }, [onHighlight]);

  const file = useMemo(() => ({ url, withCredentials: true }), [url]);

  return (
    <div ref={wrapRef} className="pdf-canvas-wrap">
      <Document
        file={file}
        onLoadSuccess={(pdf) => onPageCount(pdf.numPages)}
        loading={<div className="skel pdf-skel" aria-label="Loading the PDF" />}
        error={<p className="pdf-error">This PDF couldn&apos;t be opened. Try &ldquo;Open original&rdquo; below.</p>}
      >
        {width > 0 && (
          <Page
            key={`${page}-${width}`}
            pageNumber={page}
            width={width}
            renderAnnotationLayer={false}
            customTextRenderer={renderText}
            onRenderTextLayerSuccess={afterTextLayer}
            loading={<div className="skel pdf-skel" aria-label="Loading the page" />}
            error={<p className="pdf-error">That page couldn&apos;t be drawn.</p>}
          />
        )}
      </Document>
    </div>
  );
}

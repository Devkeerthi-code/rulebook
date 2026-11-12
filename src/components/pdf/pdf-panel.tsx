"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DOC_TYPE_META, formatDate } from "@/lib/doc-types";
import type { DocTypeName } from "@/lib/answer-types";
import { Icon } from "../icons";
import { Spring } from "../motion/spring";

const PdfPageView = dynamic(() => import("./pdf-page-view"), {
  ssr: false,
  loading: () => <div className="skel pdf-skel" aria-label="Loading the PDF viewer" />,
});

export interface PdfTarget {
  spaceId: string;
  documentId: string;
  title: string;
  type: DocTypeName;
  effectiveDate: string;
  page: number;
  /** The cited text to highlight; omitted when just browsing a document. */
  passage?: string;
  demo?: boolean;
  fromCitation?: boolean;
}

const PdfPanelContext = createContext<(target: PdfTarget, opener?: HTMLElement | null) => void>(() => undefined);
export const useOpenPdf = () => useContext(PdfPanelContext);

const MOBILE = "(max-width: 899px)";

export function PdfPanelProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<PdfTarget | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [highlightFound, setHighlightFound] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const springRef = useRef<Spring | null>(null);
  const dragRef = useRef(0);

  // Position = spring progress (0 closed, 1 open) plus any finger drag on mobile.
  const paint = useCallback((p: number) => {
    const panel = panelRef.current;
    if (!panel) return;
    const drag = dragRef.current;
    panel.style.transform = window.matchMedia(MOBILE).matches
      ? `translate3d(0, ${((1 - p) * panel.offsetHeight + drag).toFixed(1)}px, 0)`
      : `translate3d(${((1 - p) * (panel.offsetWidth + 40)).toFixed(1)}px, 0, 0)`;
    if (scrimRef.current) scrimRef.current.style.opacity = String(Math.max(0, Math.min(1, p - drag / (panel.offsetHeight || 1))));
  }, []);

  useEffect(() => {
    springRef.current = new Spring({
      value: 0,
      k: 380,
      c: 34,
      onUpdate: paint,
      onRest: (v) => {
        if (v === 0) panelRef.current?.classList.remove("open");
      },
    });
    return () => springRef.current?.stop();
  }, [paint]);

  const close = useCallback(() => {
    setOpen(false);
    dragRef.current = 0;
    springRef.current?.to(0);
    openerRef.current?.focus();
  }, []);

  const openPdf = useCallback(
    (next: PdfTarget, opener?: HTMLElement | null) => {
      openerRef.current = opener ?? (document.activeElement as HTMLElement | null);
      setTarget(next);
      setPage(next.page);
      setHighlightFound(null);
      setOpen(true);
      dragRef.current = 0;
      panelRef.current?.classList.add("open");
      paint(springRef.current?.value ?? 0);
      springRef.current?.to(1);
      window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 30);
    },
    [paint],
  );

  // Esc closes; Tab stays inside the dialog while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  // Mobile: drag the sheet down; past 30% of its height or a fast flick dismisses it, otherwise it springs back.
  const onHandleDown = (e: React.PointerEvent) => {
    if (!window.matchMedia(MOBILE).matches) return;
    // Pointer capture would swallow clicks on the header's buttons.
    if ((e.target as Element).closest("button, a")) return;
    const startY = e.clientY;
    let lastY = startY;
    let lastT = performance.now();
    let velocity = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const now = performance.now();
      velocity = (ev.clientY - lastY) / Math.max(1, now - lastT);
      lastY = ev.clientY;
      lastT = now;
      dragRef.current = Math.max(0, ev.clientY - startY);
      paint(1);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const height = panelRef.current?.offsetHeight ?? 1;
      if (dragRef.current > height * 0.3 || velocity > 0.6) {
        const p = 1 - dragRef.current / height;
        dragRef.current = 0;
        springRef.current?.set(p);
        close();
      } else {
        const start = dragRef.current;
        new Spring({ value: start, k: 380, c: 34, onUpdate: (v) => ((dragRef.current = v), paint(1)) }).to(0);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const fileUrl = target ? `/api/spaces/${target.spaceId}/documents/${target.documentId}/file` : "";
  const onHighlight = useCallback((found: boolean) => setHighlightFound(found), []);
  const onPageCount = useCallback((n: number) => setPageCount(n), []);
  const citedPage = target?.page === page;

  return (
    <PdfPanelContext.Provider value={openPdf}>
      {children}
      <div ref={scrimRef} className={`scrim${open ? " open" : ""}`} onClick={close} aria-hidden="true" />
      <div ref={panelRef} className="pdf-panel" role="dialog" aria-modal="true" aria-labelledby="pdf-title" aria-hidden={!open} inert={!open}>
        <div className="sheet-handle" aria-hidden="true" onPointerDown={onHandleDown}>
          <span />
        </div>
        {target && (
          <>
            <div className="pdf-head" onPointerDown={onHandleDown}>
              <div className="doc">
                <b id="pdf-title">{target.title}</b>
                <span>
                  {DOC_TYPE_META[target.type].label} &middot; {target.type === "CIRCULAR" ? "dated" : "effective"} {formatDate(target.effectiveDate)}
                  {target.demo ? " · DEMO" : ""}
                </span>
              </div>
              <div className="pager">
                <button className="icon-btn" type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <Icon name="left" />
                </button>
                <span aria-live="polite">
                  p. {page}
                  {pageCount ? ` / ${pageCount}` : ""}
                </span>
                <button
                  className="icon-btn"
                  type="button"
                  aria-label="Next page"
                  disabled={pageCount !== null && page >= pageCount}
                  onClick={() => setPage((p) => (pageCount ? Math.min(pageCount, p + 1) : p + 1))}
                >
                  <Icon name="right" />
                </button>
              </div>
              <button className="icon-btn" type="button" aria-label="Close document" onClick={close} data-autofocus="">
                <Icon name="close" />
              </button>
            </div>
            <div className="pdf-body">
              {citedPage && target.passage && highlightFound === false && (
                <figure className="pdf-passage">
                  <figcaption>Cited passage on this page</figcaption>
                  <blockquote>{target.passage}</blockquote>
                </figure>
              )}
              {open && (
                <PdfPageView
                  url={`${fileUrl}${target.fromCitation ? "?from=citation" : ""}`}
                  page={page}
                  passage={citedPage ? target.passage : undefined}
                  onPageCount={onPageCount}
                  onHighlight={onHighlight}
                />
              )}
            </div>
            <div className="pdf-foot">
              <span>{target.passage ? (citedPage ? "Highlighted: the passage the answer cites." : `The cited passage is on p. ${target.page}.`) : "Browsing the document."}</span>
              <a className="btn btn-sm" href={`${fileUrl}#page=${page}`} target="_blank" rel="noopener" data-spring="">
                Open original
              </a>
            </div>
          </>
        )}
      </div>
    </PdfPanelContext.Provider>
  );
}

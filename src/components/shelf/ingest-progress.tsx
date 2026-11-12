"use client";

import { Icon } from "../icons";

export interface Progress {
  pagesRead?: number;
  ocrTotal?: number;
  ocrDone?: number;
  ocrFailed?: number;
  chunks?: number;
  embedded?: number;
  pausedReason?: string;
}

export type Status = "QUEUED" | "EXTRACTING" | "OCR" | "CHUNKING" | "EMBEDDING" | "READY" | "FAILED";

const ORDER: Status[] = ["QUEUED", "EXTRACTING", "OCR", "CHUNKING", "EMBEDDING", "READY"];

/** Overall progress, weighted by how long each stage usually takes. */
export function percent(status: Status, p: Progress): number {
  if (status === "READY") return 1;
  const ocrShare = p.ocrTotal ? 0.35 : 0;
  const extract = 0.15;
  const chunk = 0.05;
  const embed = 1 - extract - ocrShare - chunk;
  const at = ORDER.indexOf(status);
  let value = 0;
  if (at > ORDER.indexOf("EXTRACTING")) value += extract;
  if (status === "OCR") value += ocrShare * ((p.ocrDone ?? 0) / Math.max(1, p.ocrTotal ?? 1));
  else if (at > ORDER.indexOf("OCR")) value += ocrShare;
  if (at > ORDER.indexOf("CHUNKING")) value += chunk;
  if (status === "EMBEDDING") value += embed * ((p.embedded ?? 0) / Math.max(1, p.chunks ?? 1));
  return Math.min(0.99, value);
}

function stageState(stage: Status, status: Status): "done" | "active" | "todo" {
  if (status === "READY") return "done";
  const a = ORDER.indexOf(stage);
  const b = ORDER.indexOf(status === "QUEUED" ? "EXTRACTING" : status);
  return a < b ? "done" : a === b ? "active" : "todo";
}

/** The admin watches it read: which stage, how many pages, OCR only when needed, and exactly when it's ready. */
export function IngestProgress({ status, progress, pageCount, error }: { status: Status; progress: Progress; pageCount: number; error: string | null }) {
  const ocr = progress.ocrTotal ?? 0;
  const stages: { key: Status; label: string; value: string }[] = [
    { key: "EXTRACTING", label: "Reading pages", value: progress.pagesRead ? `${progress.pagesRead} pages` : "" },
    { key: "OCR", label: "OCR on scanned pages", value: progress.pagesRead === undefined ? "" : ocr ? `${progress.ocrDone ?? 0}/${ocr}` : "none needed" },
    { key: "CHUNKING", label: "Splitting into clauses", value: progress.chunks ? `${progress.chunks} clauses` : "" },
    { key: "EMBEDDING", label: "Indexing for search", value: progress.chunks ? `${progress.embedded ?? 0}/${progress.chunks}` : "" },
  ];
  const p = percent(status, progress);

  if (status === "FAILED") {
    return (
      <div className="ingest-failed" role="alert">
        <Icon name="warn" />
        <p>{error ?? "Processing failed."}</p>
      </div>
    );
  }

  return (
    <div className="ingest">
      <div className="progress" role="progressbar" aria-label="Processing progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
        <i style={{ ["--p" as string]: p }} />
      </div>
      <ol className="stages">
        {stages.map((s) => {
          const state = stageState(s.key, status);
          return (
            <li key={s.key} className={state === "todo" ? "" : state}>
              <span className="mark">
                <Icon name="check" />
              </span>
              <span>{s.label}</span>
              <span className="val">{s.value}</span>
            </li>
          );
        })}
      </ol>
      {status === "OCR" && <div className="ocr-preview" aria-hidden="true" />}
      <p className="ingest-status" aria-live="polite">
        {progress.pausedReason ??
          (status === "READY"
            ? ""
            : status === "QUEUED"
              ? "Waiting to start…"
              : status === "OCR"
                ? `Page ${Math.min(ocr, (progress.ocrDone ?? 0) + 1)} of ${ocr} scanned pages is being read by OCR.`
                : status === "EMBEDDING"
                  ? "Indexing clauses so students can search them."
                  : "Reading the PDF…")}
      </p>
      {status === "READY" && (
        <div className="ingest-ready">
          <span className="sticker sticker--success" data-sticker="" style={{ ["--tilt" as string]: "-3deg" }}>
            <Icon name="check" />
            Ready to ask
          </span>
          <span className="muted small">
            {progress.chunks} clauses from {pageCount} pages{progress.ocrFailed ? ` · ${progress.ocrFailed} scanned pages unreadable` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

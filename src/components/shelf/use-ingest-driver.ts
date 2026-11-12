"use client";

import { useEffect, useRef } from "react";
import type { Progress, Status } from "./ingest-progress";

export interface DocState {
  status: Status;
  progress: Progress;
  errorMessage: string | null;
  pageCount?: number;
}

const PAUSE_MS = 20_000;
const POLL_MS = 4_000;

/**
 * Keeps a document moving until it's READY or FAILED.
 * Admins drive it (each POST runs one time-boxed step on the server); members just poll for status.
 * Reloading the page resumes where it stopped, because every step is resumable server-side.
 */
export function useIngestDriver(spaceId: string, documentId: string, active: boolean, drive: boolean, onUpdate: (s: DocState) => void, onFinished: () => void) {
  const update = useRef(onUpdate);
  const finished = useRef(onFinished);
  useEffect(() => {
    update.current = onUpdate;
    finished.current = onFinished;
  });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      let failures = 0;
      while (!cancelled) {
        try {
          const res = drive
            ? await fetch(`/api/spaces/${spaceId}/documents/${documentId}/ingest`, { method: "POST" })
            : await fetch(`/api/spaces/${spaceId}/documents/${documentId}`);
          if (!res.ok) throw new Error(String(res.status));
          const body = (await res.json()) as DocState & { document?: DocState };
          const state = body.document ?? body;
          if (cancelled) return;
          failures = 0;
          update.current(state);
          if (state.status === "READY" || state.status === "FAILED") {
            finished.current();
            return;
          }
          await sleep(!drive ? POLL_MS : state.progress?.pausedReason ? PAUSE_MS : 300);
        } catch {
          failures++;
          if (failures > 5) return;
          await sleep(Math.min(15_000, 1000 * 2 ** failures));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId, documentId, active, drive]);
}

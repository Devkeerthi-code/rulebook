"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { DocTypeName } from "@/lib/answer-types";
import { toCovers } from "@/lib/covers";
import { DOC_TYPE_META, formatDate } from "@/lib/doc-types";
import { DOC_TYPES } from "@/lib/validation";
import { Icon } from "../icons";
import { useOpenPdf } from "../pdf/pdf-panel";
import { useSpace } from "../space/space-context";
import { PatternFill } from "./cover";
import { IngestProgress, type Progress, type Status } from "./ingest-progress";
import { Shelf } from "./shelf";
import { UploadForm } from "./upload-form";
import { useIngestDriver, type DocState } from "./use-ingest-driver";

export interface ShelfDoc {
  id: string;
  title: string;
  type: DocTypeName;
  effectiveDate: string;
  version: number;
  status: Status;
  progress: Progress;
  errorMessage: string | null;
  pageCount: number;
  fileName: string;
}

export function ShelfManager({ docs: initialDocs }: { docs: ShelfDoc[] }) {
  const space = useSpace();
  const router = useRouter();
  const openPdf = useOpenPdf();
  const [docs, setDocs] = useState(initialDocs);
  const [prevInitial, setPrevInitial] = useState(initialDocs);
  if (prevInitial !== initialDocs) {
    setPrevInitial(initialDocs);
    setDocs(initialDocs);
  }

  const patch = (id: string, changes: Partial<ShelfDoc>) => setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...changes } : d)));
  const ready = docs.filter((d) => d.status === "READY");
  const covers = toCovers(ready, space.isDemo);
  const open = (id: string, opener?: HTMLElement | null) => {
    const d = docs.find((x) => x.id === id);
    if (d) openPdf({ spaceId: space.id, documentId: d.id, title: d.title, type: d.type, effectiveDate: d.effectiveDate, page: 1, demo: space.isDemo }, opener);
  };

  return (
    <div className="shelf-page">
      {covers.length > 0 && <Shelf covers={covers} onOpen={(id) => open(id)} label={`${space.shortName} document shelf`} hint="tap a cover to read it" />}

      <div className="wrap shelf-grid">
        <section aria-labelledby="all-docs" className="doc-section">
          <div className="doc-section-head">
            <h2 id="all-docs" className="card-title">
              All documents <span className="muted">({docs.length})</span>
            </h2>
            {space.isDemo && <span className="demo-tag">Demo documents, fictional college</span>}
          </div>
          {docs.length === 0 ? (
            <div className="card empty">
              <span className="hand">the shelf&apos;s waiting</span>
              <h3>No documents yet</h3>
              <p>{space.canManage ? "Start with the student handbook. It answers most questions on its own." : "Your college admin hasn't added any documents yet."}</p>
            </div>
          ) : (
            <ul className="doc-list" role="list">
              {docs.map((d) => (
                <DocRow key={`${d.id}:${d.version}`} doc={d} onPatch={(c) => patch(d.id, c)} onOpen={(el) => open(d.id, el)} onRemoved={() => setDocs((prev) => prev.filter((x) => x.id !== d.id))} />
              ))}
            </ul>
          )}
        </section>

        {space.canManage && (
          <aside aria-label="Upload">
            <UploadForm
              spaceId={space.id}
              onUploaded={(doc) => {
                toast.success(`"${doc.title}" uploaded. Reading it now.`);
                setDocs((prev) => [
                  { id: doc.id, title: doc.title, type: "OTHER", effectiveDate: new Date().toISOString().slice(0, 10), version: 1, status: "QUEUED", progress: {}, errorMessage: null, pageCount: 0, fileName: "" },
                  ...prev,
                ]);
                router.refresh();
              }}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function DocRow({ doc, onPatch, onOpen, onRemoved }: { doc: ShelfDoc; onPatch: (c: Partial<ShelfDoc>) => void; onOpen: (el: HTMLElement) => void; onRemoved: () => void }) {
  const space = useSpace();
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [busy, setBusy] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);
  const processing = doc.status !== "READY" && doc.status !== "FAILED";

  useIngestDriver(
    space.id,
    doc.id,
    processing,
    space.canManage,
    (s: DocState) => onPatch({ status: s.status, progress: s.progress ?? {}, errorMessage: s.errorMessage, ...(s.pageCount ? { pageCount: s.pageCount } : {}) }),
    () => router.refresh(),
  );

  const send = async (method: "PUT" | "DELETE", form?: FormData) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/spaces/${space.id}/documents/${doc.id}`, { method, body: form });
      const body = (await res.json().catch(() => ({}))) as { error?: string; document?: { status: Status; version: number } };
      if (!res.ok) {
        toast.error(body.error ?? "That didn't work. Try again.");
        return null;
      }
      return body;
    } catch {
      toast.error("Couldn't reach Rulebook. Check your connection.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const metaForm = (title = doc.title, type: string = doc.type, effectiveDate = doc.effectiveDate) => {
    const form = new FormData();
    form.set("title", title);
    form.set("type", type);
    form.set("effectiveDate", effectiveDate);
    return form;
  };

  const replace = async (file: File | undefined) => {
    if (!file) return;
    const form = metaForm();
    form.set("file", file);
    const body = await send("PUT", form);
    if (body?.document) {
      toast.success("New version uploaded. Re-indexing now; the old version's passages are being replaced.");
      onPatch({ status: "QUEUED", progress: {}, errorMessage: null, version: body.document.version });
    }
    if (replaceRef.current) replaceRef.current.value = "";
  };

  return (
    <li className="doc-row">
      <div className="doc-row-main">
        <span className={`doc-glyph${doc.type === "CIRCULAR" ? " inverted" : ""}`} aria-hidden="true">
          <PatternFill pattern={DOC_TYPE_META[doc.type].pattern} />
        </span>
        <div className="doc-row-text">
          <b>{doc.title}</b>
          <span>
            {DOC_TYPE_META[doc.type].label} &middot; {doc.type === "CIRCULAR" ? "dated" : "effective"} {formatDate(doc.effectiveDate)} &middot; v{doc.version}
            {doc.pageCount > 0 && <> &middot; {doc.pageCount} pages</>}
          </span>
        </div>
        <span className={`status ${doc.status === "READY" ? "status--ok" : doc.status === "FAILED" ? "status--unanswered" : "status--down"}`}>
          {doc.status === "READY" ? "Ready" : doc.status === "FAILED" ? "Failed" : "Processing"}
        </span>
      </div>

      {(processing || doc.status === "FAILED") && (
        <IngestProgress status={doc.status} progress={doc.progress} pageCount={doc.pageCount} error={doc.errorMessage} />
      )}

      {mode === "edit" && (
        <EditForm
          doc={doc}
          busy={busy}
          onCancel={() => setMode("view")}
          onSave={async (title, type, date) => {
            const body = await send("PUT", metaForm(title, type, date));
            if (body) {
              onPatch({ title, type: type as DocTypeName, effectiveDate: date });
              setMode("view");
              toast.success("Details saved.");
              router.refresh();
            }
          }}
        />
      )}

      {mode === "delete" && (
        <div className="confirm" role="alert">
          <p>
            Remove <b>{doc.title}</b> from the shelf? Students won&apos;t get answers from it any more. This can&apos;t be undone.
          </p>
          <div className="row">
            <button
              className="btn btn-sm btn-danger"
              type="button"
              disabled={busy}
              data-spring=""
              onClick={async () => {
                if (await send("DELETE")) {
                  toast.success("Removed from the shelf.");
                  onRemoved();
                  router.refresh();
                }
              }}
            >
              {busy ? "Removing…" : "Yes, remove it"}
            </button>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => setMode("view")}>
              Keep it
            </button>
          </div>
        </div>
      )}

      {mode === "view" && (
        <div className="doc-actions">
          <button className="btn btn-sm" type="button" disabled={doc.status !== "READY"} onClick={(e) => onOpen(e.currentTarget)} data-spring="">
            <Icon name="page" />
            Read
          </button>
          {space.canManage && (
            <>
              <label className={`btn btn-sm${busy ? " is-disabled" : ""}`} data-spring="">
                <Icon name="replay" />
                Replace PDF
                <input ref={replaceRef} type="file" accept="application/pdf,.pdf" className="visually-hidden" disabled={busy} onChange={(e) => replace(e.target.files?.[0])} />
              </label>
              <button className="btn btn-sm btn-ghost" type="button" onClick={() => setMode("edit")}>
                Edit details
              </button>
              <button className="btn btn-sm btn-ghost" type="button" onClick={() => setMode("delete")} aria-label={`Remove ${doc.title}`}>
                <Icon name="trash" />
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function EditForm({ doc, busy, onCancel, onSave }: { doc: ShelfDoc; busy: boolean; onCancel: () => void; onSave: (title: string, type: string, date: string) => void }) {
  const [title, setTitle] = useState(doc.title);
  const [type, setType] = useState<string>(doc.type);
  const [date, setDate] = useState(doc.effectiveDate);
  return (
    <form
      className="edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(title.trim(), type, date);
      }}
    >
      <div className="field">
        <label htmlFor={`t-${doc.id}`}>Title</label>
        <input id={`t-${doc.id}`} className="input" value={title} minLength={3} maxLength={140} required onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`ty-${doc.id}`}>Type</label>
          <select id={`ty-${doc.id}`} className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_META[t].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`d-${doc.id}`}>Effective from</label>
          <input id={`d-${doc.id}`} className="input" type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="row">
        <button className="btn btn-sm btn-primary" type="submit" disabled={busy || title.trim().length < 3} data-spring="">
          {busy ? "Saving…" : "Save"}
        </button>
        <button className="btn btn-sm btn-ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

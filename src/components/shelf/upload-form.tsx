"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { DOC_TYPE_META } from "@/lib/doc-types";
import { DOC_TYPES, MAX_PDF_BYTES } from "@/lib/validation";
import { Icon } from "../icons";

/** "Placement_Policy_2025-26.pdf" -> "Placement Policy 2025-26" */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

/** Guess the type from the file name so most uploads need no extra clicks. */
export function guessType(name: string): (typeof DOC_TYPES)[number] {
  const n = name.toLowerCase();
  if (/circular|notice|notification/.test(n)) return "CIRCULAR";
  if (/syllabus|curriculum|scheme/.test(n)) return "SYLLABUS";
  if (/regulation|ordinance|statute/.test(n)) return "REGULATIONS";
  if (/placement|policy/.test(n)) return "POLICY";
  if (/hostel|rules|code of conduct/.test(n)) return "RULES";
  if (/handbook|prospectus|guide/.test(n)) return "HANDBOOK";
  return "OTHER";
}

export function UploadForm({ spaceId, onUploaded }: { spaceId: string; onUploaded: (doc: { id: string; title: string }) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof DOC_TYPES)[number]>("HANDBOOK");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const choose = (f: File | null | undefined) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setErrors({ file: "That isn't a PDF. Export or scan it as a PDF first." });
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      setErrors({ file: `That PDF is ${(f.size / 1048576).toFixed(1)} MB; the limit is 15 MB.` });
      return;
    }
    setErrors({});
    setFile(f);
    setTitle(titleFromFileName(f.name));
    setType(guessType(f.name));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setErrors({ file: "Choose a PDF to upload." });
    if (title.trim().length < 3) return setErrors({ title: "Give the document a title (3+ characters)." });
    setPending(true);
    const form = new FormData();
    form.set("file", file);
    form.set("title", title.trim());
    form.set("type", type);
    form.set("effectiveDate", date);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/documents`, { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { error?: string; field?: string; document?: { id: string; title: string } };
      if (!res.ok || !body.document) {
        if (body.field) setErrors({ [body.field]: body.error ?? "Check this." });
        else toast.error(body.error ?? "Upload failed. Try again.");
        return;
      }
      onUploaded(body.document);
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      toast.error("Upload failed: check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="card upload-card" onSubmit={submit} noValidate>
      <h2 className="card-title">Add a document</h2>
      <label
        className={`dropzone${dragOver ? " is-over" : ""}${errors.file ? " has-error" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          choose(e.dataTransfer.files[0]);
        }}
      >
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="visually-hidden" onChange={(e) => choose(e.target.files?.[0])} aria-describedby="file-help" />
        <Icon name="upload" />
        {file ? (
          <span>
            <b>{file.name}</b>
            <span className="muted small"> &middot; {(file.size / 1048576).toFixed(1)} MB &middot; tap to change</span>
          </span>
        ) : (
          <span>
            <b>Drop a PDF here</b> or tap to choose one
          </span>
        )}
      </label>
      <span id="file-help" className={errors.file ? "field-error" : "field-hint"} role={errors.file ? "alert" : undefined}>
        {errors.file ?? "Up to 15 MB and 400 pages. Scanned PDFs work too (they take longer)."}
      </span>

      <div className="field">
        <label htmlFor="doc-title">Title</label>
        <input id="doc-title" className="input" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} aria-invalid={errors.title ? true : undefined} placeholder="e.g. Student Handbook 2025-26" />
        {errors.title && (
          <span className="field-error" role="alert">
            {errors.title}
          </span>
        )}
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="doc-type">Type</label>
          <select id="doc-type" className="input" value={type} onChange={(e) => setType(e.target.value as (typeof DOC_TYPES)[number])}>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_META[t].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="doc-date">Effective from</label>
          <input id="doc-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={errors.effectiveDate ? true : undefined} />
          {errors.effectiveDate && (
            <span className="field-error" role="alert">
              {errors.effectiveDate}
            </span>
          )}
        </div>
      </div>
      <p className="field-hint">The effective date decides which rule wins when two documents disagree. For a circular, use the date it takes effect.</p>
      <button className="btn btn-primary" type="submit" disabled={pending || !file} data-spring="">
        <Icon name="upload" />
        {pending ? "Uploading…" : "Upload and process"}
      </button>
    </form>
  );
}

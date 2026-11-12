"use client";

import { useFormStatus } from "react-dom";

/** Submit button that disables itself while the form is pending, so a double click can't submit twice. */
export function SubmitButton({ children, pendingLabel, variant = "primary" }: { children: React.ReactNode; pendingLabel: string; variant?: "primary" | "plain" }) {
  const { pending } = useFormStatus();
  return (
    <button className={`btn${variant === "primary" ? " btn-primary" : ""}`} type="submit" disabled={pending} aria-busy={pending} data-spring="">
      {pending ? pendingLabel : children}
    </button>
  );
}

export function Field({
  label,
  name,
  error,
  hint,
  ...input
}: { label: string; name: string; error?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `f-${name}`;
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {hint && !error && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-err`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

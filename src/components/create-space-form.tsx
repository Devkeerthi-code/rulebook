"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/form-state";
import { createSpaceAction } from "@/server/actions/space-actions";
import { Field, SubmitButton } from "./forms";

export function CreateSpaceForm() {
  const [state, action] = useActionState<FormState, FormData>(createSpaceAction, {});
  return (
    <form action={action} className="card" id="new" noValidate>
      <h2 className="card-title">Set up a college</h2>
      <p className="muted">You&apos;ll be its admin: you upload the PDFs and share the invite link. You can add co-admins later.</p>
      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}
      <Field label="College name" name="name" placeholder="e.g. Government Engineering College, Thrissur" defaultValue={state.values?.name} error={state.fields?.name} required maxLength={120} />
      <Field
        label="Short name"
        name="shortName"
        placeholder="e.g. GECT"
        hint="Shown on the space badge. Up to 12 characters."
        defaultValue={state.values?.shortName}
        error={state.fields?.shortName}
        required
        maxLength={12}
      />
      <SubmitButton pendingLabel="Creating…">Create the space</SubmitButton>
    </form>
  );
}

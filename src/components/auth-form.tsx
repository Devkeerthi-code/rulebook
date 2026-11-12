"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/lib/form-state";
import { loginAction, signupAction } from "@/server/actions/auth-actions";
import { Field, SubmitButton } from "./forms";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(mode === "login" ? loginAction : signupAction, {});
  const v = state.values ?? {};
  const f = state.fields ?? {};
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <form action={action} className="card auth-card" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}
      {mode === "signup" && <Field label="Your name" name="name" autoComplete="name" defaultValue={v.name} error={f.name} required maxLength={80} />}
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={v.email} error={f.email} required maxLength={254} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        error={f.password}
        hint={mode === "signup" ? "8+ characters, with at least one number." : undefined}
        required
        maxLength={128}
      />
      <SubmitButton pendingLabel={mode === "signup" ? "Creating your account…" : "Logging in…"}>{mode === "signup" ? "Create account" : "Log in"}</SubmitButton>
      <p className="auth-switch">
        {mode === "signup" ? (
          <>
            Already have an account? <Link href={`/login${nextQuery}`}>Log in</Link>
          </>
        ) : (
          <>
            New here? <Link href={`/signup${nextQuery}`}>Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { SimpleTopbar } from "@/components/page-chrome";
import { safeNext } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next));
  return (
    <>
      <SimpleTopbar />
      <main id="main" className="wrap auth-page">
        <div className="auth-intro">
          <span className="hand annotate">welcome back</span>
          <h1 className="page-title">Log in to your college&apos;s rulebook</h1>
          <p>Pick up where you left off: your spaces, your questions, and the pages they came from.</p>
        </div>
        <AuthForm mode="login" next={next} />
      </main>
    </>
  );
}

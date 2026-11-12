import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { SimpleTopbar } from "@/components/page-chrome";
import { safeNext } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next));
  return (
    <>
      <SimpleTopbar />
      <main id="main" className="wrap auth-page">
        <div className="auth-intro">
          <span className="hand annotate">takes 20 seconds</span>
          <h1 className="page-title">Make an account, then join your college</h1>
          <p>Students join with the invite link their college shares. Setting up a new college? You can create its space right after this.</p>
        </div>
        <AuthForm mode="signup" next={next} />
      </main>
    </>
  );
}

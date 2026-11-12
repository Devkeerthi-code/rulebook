"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import type { FormState } from "@/lib/form-state";
import { RULES } from "@/lib/rate-limit";
import { fieldErrors, loginSchema, safeNext, signupSchema } from "@/lib/validation";
import { createSession, destroySession, hashPassword, verifyPassword } from "../auth";
import { db } from "../db";
import { limit } from "../rate-limiter";
import { track } from "../usage";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function values(form: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "")]));
}

export async function signupAction(_prev: FormState, form: FormData): Promise<FormState> {
  const kept = values(form, ["name", "email"]);
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values: kept };

  const rate = await limit(RULES.signup, await clientIp());
  if (!rate.allowed) return { error: "Too many sign-ups from this network. Try again in an hour.", values: kept };

  try {
    const user = await db.user.create({
      data: { name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password) },
    });
    await createSession(user.id);
    await track("SIGNUP", { userId: user.id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { fields: { email: "There's already an account with this email. Log in instead." }, values: kept };
    }
    throw err;
  }
  redirect(safeNext(parsed.data.next));
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const kept = values(form, ["email"]);
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values: kept };

  const rate = await limit(RULES.login, `${parsed.data.email}|${await clientIp()}`);
  if (!rate.allowed) {
    return { error: `Too many attempts. Wait ${Math.ceil(rate.retryAfterSeconds / 60)} minutes and try again.`, values: kept };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, passwordHash: true } });
  if (!(await verifyPassword(parsed.data.password, user?.passwordHash ?? null)) || !user) {
    return { error: "That email and password don't match.", values: kept };
  }
  await createSession(user.id);
  redirect(safeNext(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

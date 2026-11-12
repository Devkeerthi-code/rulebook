"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/form-state";
import { createSpaceSchema, feedbackSchema, fieldErrors, idSchema } from "@/lib/validation";
import { requireManager, requireMember } from "../access";
import { requireUser } from "../auth";
import { db } from "../db";
import { saveFeedback } from "../space-data";
import { track } from "../usage";

const newInviteToken = () => randomBytes(18).toString("base64url");

export async function createSpaceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const kept = { name: String(form.get("name") ?? ""), shortName: String(form.get("shortName") ?? "") };
  const parsed = createSpaceSchema.safeParse(kept);
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values: kept };

  const owned = await db.membership.count({ where: { userId: user.id, role: "ADMIN" } });
  if (owned >= 5) return { error: "You can admin up to 5 college spaces.", values: kept };

  const space = await db.space.create({
    data: { ...parsed.data, inviteToken: newInviteToken(), memberships: { create: { userId: user.id, role: "ADMIN" } } },
  });
  await track("SPACE_CREATED", { userId: user.id, spaceId: space.id });
  redirect(`/s/${space.id}/shelf`);
}

async function join(userId: string, spaceId: string) {
  // upsert with an empty update: re-joining never downgrades an admin.
  await db.membership.upsert({
    where: { userId_spaceId: { userId, spaceId } },
    create: { userId, spaceId, role: "MEMBER" },
    update: {},
  });
  await track("SPACE_JOINED", { userId, spaceId });
}

/** Join the fictional demo college. Optional `q` carries a question asked on the landing page. */
export async function joinDemoAction(form: FormData): Promise<void> {
  const user = await requireUser("/try");
  const q = z.string().trim().max(300).optional().catch(undefined).parse(form.get("q") ?? undefined);
  const demo = await db.space.findFirst({ where: { isDemo: true }, select: { id: true } });
  if (!demo) redirect("/spaces?error=no-demo");
  await join(user.id, demo.id);
  redirect(`/s/${demo.id}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}

export async function joinWithInviteAction(form: FormData): Promise<void> {
  const token = z.string().min(10).max(64).safeParse(form.get("token"));
  if (!token.success) redirect("/spaces?error=invite");
  const user = await requireUser(`/join/${token.data}`);
  const space = await db.space.findFirst({ where: { inviteToken: token.data, inviteEnabled: true }, select: { id: true } });
  if (!space) redirect("/spaces?error=invite");
  await join(user.id, space.id);
  redirect(`/s/${space.id}`);
}

export async function rotateInviteAction(spaceId: string): Promise<void> {
  await requireManager(idSchema.parse(spaceId));
  await db.space.update({ where: { id: spaceId }, data: { inviteToken: newInviteToken(), inviteEnabled: true } });
  revalidatePath(`/s/${spaceId}/admin`);
}

export async function setInviteEnabledAction(spaceId: string, enabled: boolean): Promise<void> {
  await requireManager(idSchema.parse(spaceId));
  await db.space.update({ where: { id: spaceId }, data: { inviteEnabled: z.boolean().parse(enabled) } });
  revalidatePath(`/s/${spaceId}/admin`);
}

export async function setMemberRoleAction(spaceId: string, userId: string, role: "ADMIN" | "MEMBER"): Promise<{ error?: string }> {
  const access = await requireManager(idSchema.parse(spaceId));
  const parsedRole = z.enum(["ADMIN", "MEMBER"]).parse(role);
  if (role === "MEMBER" && userId === access.user.id) {
    const admins = await db.membership.count({ where: { spaceId, role: "ADMIN" } });
    if (admins <= 1) return { error: "You're the only admin. Make someone else an admin first." };
  }
  await db.membership.updateMany({ where: { spaceId, userId: idSchema.parse(userId) }, data: { role: parsedRole } });
  revalidatePath(`/s/${spaceId}/admin`);
  return {};
}

export async function removeMemberAction(spaceId: string, userId: string): Promise<{ error?: string }> {
  const access = await requireManager(idSchema.parse(spaceId));
  if (userId === access.user.id) return { error: "You can't remove yourself here." };
  await db.membership.deleteMany({ where: { spaceId, userId: idSchema.parse(userId) } });
  revalidatePath(`/s/${spaceId}/admin`);
  return {};
}

export async function leaveSpaceAction(spaceId: string): Promise<{ error?: string }> {
  const access = await requireMember(idSchema.parse(spaceId));
  if (access.role === "ADMIN" && !access.space.isDemo) {
    const admins = await db.membership.count({ where: { spaceId, role: "ADMIN" } });
    if (admins <= 1) return { error: "You're the only admin of this college. Make someone else an admin before leaving." };
  }
  await db.membership.delete({ where: { userId_spaceId: { userId: access.user.id, spaceId } } });
  redirect("/spaces");
}

export async function feedbackAction(spaceId: string, input: z.input<typeof feedbackSchema>): Promise<{ ok: boolean; error?: string }> {
  const access = await requireMember(idSchema.parse(spaceId));
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Couldn't save that feedback." };
  const saved = await saveFeedback({ spaceId, userId: access.user.id, ...parsed.data });
  if (!saved) return { ok: false, error: "That answer isn't yours to rate." };
  await track("FEEDBACK_GIVEN", { userId: access.user.id, spaceId });
  return { ok: true };
}

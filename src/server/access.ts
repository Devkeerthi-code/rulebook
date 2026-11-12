import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/generated/prisma/client";
import { getCurrentUser, requireUser, type CurrentUser } from "./auth";
import { db } from "./db";

export interface SpaceAccess {
  user: CurrentUser;
  role: Role;
  space: { id: string; name: string; shortName: string; isDemo: boolean };
  /** Admins of a real space can manage documents. Nobody manages the demo space from the UI. */
  canManage: boolean;
}

/**
 * The single gate for everything inside a space. Returns null unless the user is a member.
 * Non-members get the same answer as "no such space", so space ids can't be probed.
 */
export async function findAccess(userId: string, spaceId: string): Promise<Omit<SpaceAccess, "user"> | null> {
  const membership = await db.membership.findUnique({
    where: { userId_spaceId: { userId, spaceId } },
    select: { role: true, space: { select: { id: true, name: true, shortName: true, isDemo: true } } },
  });
  if (!membership) return null;
  const canManage = membership.role === "ADMIN" && !membership.space.isDemo;
  return { role: membership.role, space: membership.space, canManage };
}

/** For pages: redirect to login if signed out, 404 if not a member. */
export const requireMember = cache(async (spaceId: string): Promise<SpaceAccess> => {
  const user = await requireUser(`/s/${spaceId}`);
  const access = await findAccess(user.id, spaceId);
  if (!access) notFound();
  return { user, ...access };
});

export async function requireManager(spaceId: string): Promise<SpaceAccess> {
  const access = await requireMember(spaceId);
  if (!access.canManage) notFound();
  return access;
}

export type ApiAccess = { ok: true; access: SpaceAccess } | { ok: false; response: Response };

/** For route handlers: JSON 401/404 instead of redirects. */
export async function apiAccess(spaceId: string, { manage = false } = {}): Promise<ApiAccess> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: Response.json({ error: "Please log in again." }, { status: 401 }) };
  const access = await findAccess(user.id, spaceId);
  if (!access || (manage && !access.canManage)) {
    return { ok: false, response: Response.json({ error: "Not found." }, { status: 404 }) };
  }
  return { ok: true, access: { user, ...access } };
}

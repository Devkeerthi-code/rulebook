"use client";

import { createContext, useContext } from "react";

export interface SpaceInfo {
  id: string;
  name: string;
  shortName: string;
  isDemo: boolean;
  canManage: boolean;
}

const SpaceContext = createContext<SpaceInfo | null>(null);

export function SpaceProvider({ space, children }: { space: SpaceInfo; children: React.ReactNode }) {
  return <SpaceContext.Provider value={space}>{children}</SpaceContext.Provider>;
}

export function useSpace(): SpaceInfo {
  const space = useContext(SpaceContext);
  if (!space) throw new Error("useSpace must be used inside a space.");
  return space;
}

/** Lets the ask screen tell the sidebar about a new conversation without a full refresh. */
export const CONVERSATION_EVENT = "rb:conversation";
export interface ConversationEventDetail {
  id: string;
  title: string;
}

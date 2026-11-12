"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { DocTypeName } from "@/lib/answer-types";
import { DOC_TYPE_META, shortTitle } from "@/lib/doc-types";
import { logoutAction } from "@/server/actions/auth-actions";
import { Icon, LogoMark } from "../icons";
import { PdfPanelProvider, useOpenPdf } from "../pdf/pdf-panel";
import { PatternFill } from "../shelf/cover";
import { SpaceBadge } from "./space-badge";
import { ThemeToggle } from "../theme-toggle";
import { CONVERSATION_EVENT, SpaceProvider, useSpace, type ConversationEventDetail, type SpaceInfo } from "./space-context";

export interface SideDoc {
  id: string;
  title: string;
  type: DocTypeName;
  pageCount: number;
  effectiveDate: string;
  ready: boolean;
}

export interface SideConversation {
  id: string;
  title: string;
}

interface Props {
  space: SpaceInfo;
  memberCount: number;
  userName: string;
  docs: SideDoc[];
  conversations: SideConversation[];
  children: React.ReactNode;
}

export function SpaceShell(props: Props) {
  return (
    <SpaceProvider space={props.space}>
      <PdfPanelProvider>
        <ShellInner {...props} />
      </PdfPanelProvider>
    </SpaceProvider>
  );
}

function ShellInner({ memberCount, userName, docs, conversations: initialConversations, children }: Props) {
  const space = useSpace();
  const openPdf = useOpenPdf();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState(initialConversations);
  const [prevPath, setPrevPath] = useState(pathname);

  // Close the drawer on navigation (state adjusted during render, not in an effect).
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    const onNew = (e: Event) => {
      const detail = (e as CustomEvent<ConversationEventDetail>).detail;
      setConversations((prev) => [detail, ...prev.filter((c) => c.id !== detail.id)].slice(0, 20));
    };
    window.addEventListener(CONVERSATION_EVENT, onNew);
    return () => window.removeEventListener(CONVERSATION_EVENT, onNew);
  }, []);

  const tabs = [
    { href: `/s/${space.id}`, label: "Ask", active: pathname === `/s/${space.id}` || pathname.startsWith(`/s/${space.id}/c/`) },
    { href: `/s/${space.id}/shelf`, label: "Shelf", active: pathname.startsWith(`/s/${space.id}/shelf`) },
    ...(space.canManage ? [{ href: `/s/${space.id}/admin`, label: "Gaps & members", active: pathname.startsWith(`/s/${space.id}/admin`) }] : []),
  ];

  return (
    <div className="shell">
      <a className="skip" href="#space-main">
        Skip to content
      </a>
      <aside className={`app-side${drawerOpen ? " open" : ""}`} aria-label={`${space.name} navigation`} id="space-nav">
        <Link href="/spaces" className="space-switch" title="Switch college">
          <SpaceBadge shortName={space.shortName} />
          <div>
            <b>{space.name}</b>
            <span>
              {space.isDemo ? "DEMO space · " : ""}
              {memberCount.toLocaleString("en-IN")} {memberCount === 1 ? "member" : "members"}
            </span>
          </div>
        </Link>

        <nav aria-label="Space sections" className="side-tabs">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>

        <div>
          <h4>On the shelf</h4>
          {docs.length === 0 ? (
            <p className="side-empty">No documents yet.</p>
          ) : (
            <ul className="side-list">
              {docs.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    disabled={!d.ready}
                    onClick={(e) =>
                      openPdf({ spaceId: space.id, documentId: d.id, title: d.title, type: d.type, effectiveDate: d.effectiveDate, page: 1, demo: space.isDemo }, e.currentTarget)
                    }
                  >
                    <span className="glyph" aria-hidden="true">
                      <PatternFill pattern={DOC_TYPE_META[d.type].pattern} />
                    </span>
                    <span>{shortTitle(d.title, 24)}</span>
                    <span className="count">{d.ready ? `${d.pageCount}p` : "…"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4>Your recent questions</h4>
          {conversations.length === 0 ? (
            <p className="side-empty">Nothing asked yet.</p>
          ) : (
            <ul className="side-list">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link href={`/s/${space.id}/c/${c.id}`} aria-current={pathname.endsWith(c.id) ? "page" : undefined}>
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link className="side-new" href={`/s/${space.id}`}>
            <Icon name="plus" />
            New question
          </Link>
        </div>

        <div className="side-foot">
          <span className="side-user">{userName}</span>
          <Link href="/spaces">All spaces</Link>
          <form action={logoutAction}>
            <button type="submit" className="linkish">
              Log out
            </button>
          </form>
          <ThemeToggle />
        </div>
      </aside>
      {drawerOpen && <div className="drawer-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <div className="shell-main">
        <header className="mobile-bar">
          <button className="icon-btn" type="button" aria-label="Open menu" aria-controls="space-nav" aria-expanded={drawerOpen} onClick={() => setDrawerOpen((v) => !v)}>
            <Icon name="menu" />
          </button>
          <Link href="/spaces" className="logo logo-sm" aria-label="Rulebook, all spaces">
            <LogoMark />
          </Link>
          <span className="mobile-space">{space.shortName}</span>
          <nav aria-label="Space sections" className="mobile-tabs">
            {tabs.map((t) => (
              <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined}>
                {t.label === "Gaps & members" ? "Gaps" : t.label}
              </Link>
            ))}
          </nav>
        </header>
        <main id="space-main" className="space-main">
          {children}
        </main>
      </div>
    </div>
  );
}

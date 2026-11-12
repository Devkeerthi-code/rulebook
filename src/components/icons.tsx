/** One stroke family (1.75px, square caps) used everywhere. Rendered once as a sprite, referenced by id. */

export type IconName =
  | "send"
  | "up"
  | "down"
  | "close"
  | "left"
  | "right"
  | "warn"
  | "check"
  | "page"
  | "clock"
  | "upload"
  | "replay"
  | "copy"
  | "trash"
  | "menu"
  | "plus";

export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="i-send" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="square" /></symbol>
        <symbol id="i-up" viewBox="0 0 24 24"><path d="M7 11v9H3v-9zM7 20h10.5l2.5-8.5V10h-6l1-5-1.5-1L7 11" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" /></symbol>
        <symbol id="i-down" viewBox="0 0 24 24"><path d="M7 13V4H3v9zM7 4h10.5l2.5 8.5V14h-6l1 5-1.5 1L7 13" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" /></symbol>
        <symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" /></symbol>
        <symbol id="i-left" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" /></symbol>
        <symbol id="i-right" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" /></symbol>
        <symbol id="i-warn" viewBox="0 0 24 24"><path d="M12 3l10 18H2z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" /><path d="M12 10v5M12 17.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" /></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" /></symbol>
        <symbol id="i-page" viewBox="0 0 24 24"><path d="M5 2h10l4 4v16H5z M15 2v4h4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" /><path d="M8 11h8M8 15h8M8 19h5" stroke="currentColor" strokeWidth="1.75" /></symbol>
        <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" /><path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.75" /></symbol>
        <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V4M6 10l6-6 6 6M4 20h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" /></symbol>
        <symbol id="i-replay" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v5h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" /></symbol>
        <symbol id="i-copy" viewBox="0 0 24 24"><path d="M8 8h12v12H8zM4 16V4h12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" /></symbol>
        <symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" /></symbol>
        <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" /></symbol>
        <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" /></symbol>
        <symbol id="logo" viewBox="0 0 30 34"><rect x="1" y="1" width="26" height="32" fill="var(--surface)" stroke="currentColor" strokeWidth="2" /><path d="M6 9h11M6 14h14M6 19h9" stroke="currentColor" strokeWidth="2" /><path d="M19 0h7v16l-3.5-3-3.5 3z" fill="var(--accent)" /></symbol>
      </defs>
    </svg>
  );
}

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden="true" className={className}>
      <use href={`#i-${name}`} />
    </svg>
  );
}

export function LogoMark({ className = "logo-mark" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 30 34">
      <use href="#logo" />
    </svg>
  );
}

import Link from "next/link";
import { LogoMark } from "./icons";

/** Slim top bar for pages outside a college space (auth, spaces list, join). */
export function SimpleTopbar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div className="wrap">
        <Link className="logo" href="/" aria-label="Rulebook home">
          <LogoMark />
          Rulebook
        </Link>
        <div className="topbar-right">{right}</div>
      </div>
    </header>
  );
}

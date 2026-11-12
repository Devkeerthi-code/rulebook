"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="wrap narrow-page">
      <span className="hand annotate">that wasn&apos;t supposed to happen</span>
      <h1 className="page-title">Something broke on our side</h1>
      <p className="muted">Nothing you did. It may be a hiccup with the database or the network. Try again; if it keeps happening, come back in a few minutes.</p>
      <div className="row">
        <button className="btn btn-primary" type="button" onClick={reset} data-spring="">
          Try again
        </button>
        <Link className="btn" href="/" data-spring="">
          Home
        </Link>
      </div>
    </main>
  );
}

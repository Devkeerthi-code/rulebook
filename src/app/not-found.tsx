import Link from "next/link";
import { SimpleTopbar } from "@/components/page-chrome";

export default function NotFound() {
  return (
    <>
      <SimpleTopbar />
      <main id="main" className="wrap narrow-page">
        <span className="hand annotate">page not on the shelf</span>
        <h1 className="page-title">We couldn&apos;t find that</h1>
        <p className="muted">The link may be old, or this college space isn&apos;t one you&apos;ve joined. If someone sent you an invite link, open that link again.</p>
        <div className="row">
          <Link className="btn btn-primary" href="/spaces" data-spring="">
            Your spaces
          </Link>
          <Link className="btn" href="/" data-spring="">
            Home
          </Link>
        </div>
      </main>
    </>
  );
}

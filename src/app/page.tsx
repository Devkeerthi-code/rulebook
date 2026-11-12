import Link from "next/link";
import { LogoMark } from "@/components/icons";
import { HowItWorks } from "@/components/landing/how-it-works";
import { HeroAsk, LandingShelf, LandingTickers } from "@/components/landing/landing-interactive";
import { RevealHeading } from "@/components/motion/reveal-heading";
import { ThemeToggle } from "@/components/theme-toggle";
import { toCovers } from "@/lib/covers";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { listDocuments, spaceCounts, suggestedQuestions } from "@/server/space-data";
import { publicStats } from "@/server/usage";

export const dynamic = "force-dynamic";

const FALLBACK_QUESTIONS = [
  "How many backlogs are allowed for placements?",
  "What's the minimum attendance for end-sem exams?",
  "How do I apply for re-evaluation?",
  "Can I change my hostel room mid-semester?",
  "Is CGPA 5.98 rounded to 6 for placements?",
  "What's the condonation fee?",
  "Is revaluation allowed for lab exams?",
  "Can I keep a kettle in my hostel room?",
];

async function demoShelf() {
  const demo = await db.space.findFirst({ where: { isDemo: true }, select: { id: true, name: true } });
  if (!demo) return null;
  const [docs, questions, counts] = await Promise.all([listDocuments(demo.id), suggestedQuestions(demo.id, 14), spaceCounts(demo.id)]);
  return { ...demo, covers: toCovers(docs.filter((d) => d.status === "READY"), true), questions, counts };
}

export default async function LandingPage() {
  const [user, demo, stats] = await Promise.all([getCurrentUser(), demoShelf(), publicStats()]);
  const questions = demo && demo.questions.length >= 6 ? demo.questions : FALLBACK_QUESTIONS;
  const half = Math.ceil(questions.length / 2);
  const rows: [string[], string[]] = [questions.slice(0, half), questions.slice(half)];

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="wrap">
          <Link className="logo" href="/" aria-label="Rulebook home">
            <LogoMark />
            Rulebook
          </Link>
          <nav className="links" aria-label="Main">
            <a href="#how">How it works</a>
            <a href="#admins">For colleges</a>
            {user ? <Link href="/spaces">Your spaces</Link> : <Link href="/login">Log in</Link>}
          </nav>
          <Link className="btn btn-sm" href={user ? "/spaces" : "/signup"} data-spring="">
            {user ? "Open Rulebook" : "Sign up free"}
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="wrap">
            <div className="hero-space">
              {demo && <span className="demo-tag">Try it on: {demo.name}</span>}
              {demo && (
                <span className="eyebrow">
                  {demo.counts.documents} demo documents &middot; {demo.counts.pages} pages &middot; fictional college
                </span>
              )}
              <span className="sticker sticker--accent" data-sticker="" style={{ ["--tilt" as string]: "-5deg" }}>
                Every line cited
              </span>
            </div>
            <RevealHeading as="h1" id="hero-title" trigger="load" parts={[{ text: "The rules, answered. With the" }, { text: "page number.", emphasis: true }]} />
            <div className="hero-grid">
              <div className="hero-ask">
                <HeroAsk placeholder="How many backlogs are allowed for placements?" />
                <p className="hint">Answers come only from the college&apos;s uploaded PDFs. Every line links to its page.</p>
              </div>
              <p className="hero-lede">
                Attendance cut-offs, re-evaluation fees, backlog limits for placements, hostel in-times. Ask in plain words, read the exact clause, and stop
                relying on what a senior heard from a senior.
              </p>
            </div>
          </div>
          <div className="hero-note" aria-hidden="true">
            <span className="hand">no more &quot;ask a senior&quot;</span>
            <svg viewBox="0 0 90 70" fill="none">
              <path d="M78 6C70 30 50 52 14 60M14 60l12-12M14 60l16 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </section>

        <LandingTickers rows={rows} />

        {demo && demo.covers.length > 0 && (
          <section className="section" id="shelf" aria-labelledby="shelf-title">
            <div className="wrap">
              <div className="section-num">01 &nbsp;The shelf</div>
              <div className="section-head">
                <RevealHeading id="shelf-title" parts={[{ text: "Every PDF your college ever sent, on one shelf." }]} />
                <p>
                  Each upload becomes a cover with its type, effective date and page count, so you can see what Rulebook is reading from. A circular newer than
                  the handbook wears a sticker, because newer rules win.
                </p>
              </div>
            </div>
            <LandingShelf covers={demo.covers} />
          </section>
        )}

        <section className="section" id="how" aria-labelledby="how-title" style={{ paddingTop: "var(--s-8)" }}>
          <div className="wrap">
            <div className="section-num">02 &nbsp;How it works</div>
            <div className="section-head">
              <RevealHeading id="how-title" parts={[{ text: "Four steps from a 200-page PDF to one clear line." }]} />
              <p>Admins upload once. Students ask any time. Nothing is answered from the internet or from memory, only from what is on the shelf.</p>
            </div>
            <HowItWorks />
          </div>
        </section>

        <section className="section" id="admins" aria-labelledby="admins-title" style={{ paddingTop: "var(--s-8)" }}>
          <div className="wrap">
            <div className="section-num">03 &nbsp;For your college</div>
            <div className="section-head">
              <RevealHeading id="admins-title" parts={[{ text: "Bring your own college's rules." }]} />
              <p>
                A class rep, a department office or a student council can set up a space in two minutes. Upload the PDFs, share the invite link in the class
                group, and see which questions the documents couldn&apos;t answer.
              </p>
            </div>
            <div className="promises">
              <div className="card">
                <h3>Honest by design</h3>
                <p>If the documents don&apos;t say it, Rulebook says so and shows the closest passages. It never fills gaps from general knowledge.</p>
              </div>
              <div className="card">
                <h3>Newer rules win</h3>
                <p>Every document has an effective date. When a circular changes the handbook, the answer follows the circular and tells you so.</p>
              </div>
              <div className="card">
                <h3>Private to your college</h3>
                <p>Each college is its own space. Members join with your invite link and never see another college&apos;s documents or questions.</p>
              </div>
            </div>
            <div className="cta-row">
              <Link className="btn btn-primary" href={user ? "/spaces#new" : "/signup?next=%2Fspaces%23new"} data-spring="">
                Set up your college
              </Link>
              <Link className="btn" href="/try" data-spring="">
                Try the demo college
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap">
          <span className="big" aria-hidden="true">
            Rulebook
          </span>
          <div className="footer-meta">
            <p className="footer-stats">
              {stats.people.toLocaleString("en-IN")} {stats.people === 1 ? "person has" : "people have"} signed up &middot;{" "}
              {stats.colleges.toLocaleString("en-IN")} college {stats.colleges === 1 ? "space" : "spaces"} &middot; {stats.questions.toLocaleString("en-IN")}{" "}
              questions asked
            </p>
            <p>The demo college and its documents are fictional. Rulebook answers only from documents a college uploads; check important rules with your college office.</p>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </>
  );
}

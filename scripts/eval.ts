/**
 * Evaluation on the fictional DEMO corpus (run `npm run db:seed` first).
 *
 * For each question we know which document page holds the answer. We measure:
 *   - retrieval hit@1 / hit@5 and MRR: is that page among the top retrieved chunks?
 *   - citation accuracy: does the generated answer cite that page?
 *   - refusal accuracy: for questions the documents don't answer, does Rulebook say "not in your documents"?
 *
 * Uses real Gemini embeddings and generation, so it spends ~18 generation calls of free-tier quota.
 * Results are printed and written to eval-results/ (git-ignored).
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { runAnswerPipeline, type PipelineResult } from "../src/lib/answer-pipeline";
import { db } from "../src/server/db";
import { geminiAnswerModel, geminiEmbedder } from "../src/server/gemini";
import { retrieve } from "../src/server/retrieval";
import { DEMO_DOCUMENTS, type DemoDocument } from "../prisma/demo/corpus";

type Key = DemoDocument["key"];
interface Case {
  q: string;
  /** Any of these (document, page) pairs counts as the right source. */
  expect: [Key, number][];
}

const ANSWERABLE: Case[] = [
  { q: "What is the minimum attendance needed to write the end-semester exam?", expect: [["handbook", 5]] },
  { q: "What attendance do I need for my shortage to be condoned?", expect: [["circular", 1]] },
  { q: "How much is the condonation fee?", expect: [["circular", 1]] },
  { q: "How many times can attendance shortage be condoned during the programme?", expect: [["handbook", 6], ["circular", 1]] },
  { q: "How many days do I have to apply for re-evaluation after results?", expect: [["handbook", 8]] },
  { q: "What does a photocopy of my answer script cost?", expect: [["handbook", 8]] },
  { q: "Can I get my lab exam re-evaluated?", expect: [["handbook", 8]] },
  { q: "How many backlogs can I have and still register for placements?", expect: [["placement", 2]] },
  { q: "Is a CGPA of 5.98 rounded up to 6 for placement eligibility?", expect: [["placement", 2]] },
  { q: "I already accepted an offer. Can I sit for another company's drive?", expect: [["placement", 3]] },
  { q: "What happens if I skip a placement round after applying?", expect: [["placement", 4]] },
  { q: "What time do I have to be back in the hostel at night?", expect: [["hostel", 1]] },
  { q: "Can I change my hostel room in the middle of the semester?", expect: [["hostel", 2]] },
  { q: "What is the fee for a supplementary exam?", expect: [["handbook", 9]] },
  { q: "How many credits do I need to get my B.Tech degree?", expect: [["handbook", 3]] },
];

const UNANSWERABLE = ["Is there a free laptop scheme for first years?", "Which bus route goes to the campus?", "What is the campus wifi password?"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function answer(spaceId: string, question: string): Promise<PipelineResult> {
  const gen = runAnswerPipeline(
    { question, history: [] },
    { retrieve: (q) => retrieve(spaceId, q, geminiEmbedder), model: geminiAnswerModel, signal: AbortSignal.timeout(60_000) },
  );
  let step = await gen.next();
  while (!step.done) step = await gen.next();
  return step.value;
}

async function main() {
  const space = await db.space.findFirst({ where: { isDemo: true }, select: { id: true } });
  if (!space) throw new Error("No demo space. Run `npm run db:seed` first.");
  const docs = await db.document.findMany({ where: { spaceId: space.id }, select: { id: true, title: true } });
  const idOf = (key: Key) => docs.find((d) => d.title === DEMO_DOCUMENTS.find((x) => x.key === key)!.title)!.id;

  const rows: Record<string, unknown>[] = [];
  let hit1 = 0;
  let hit5 = 0;
  let rrSum = 0;
  let cited = 0;
  let answered = 0;
  const latencies: number[] = [];

  for (const c of ANSWERABLE) {
    const wanted = new Set(c.expect.map(([k, p]) => `${idOf(k)}:${p}`));
    const { top } = await retrieve(space.id, c.q, geminiEmbedder);
    const keys = top.map((t) => `${t.documentId}:${t.pageNumber}`);
    const rank = keys.findIndex((k) => wanted.has(k)) + 1;
    if (rank === 1) hit1++;
    if (rank >= 1 && rank <= 5) hit5++;
    if (rank > 0) rrSum += 1 / rank;

    const started = Date.now();
    const result = await answer(space.id, c.q);
    latencies.push(Date.now() - started);
    const citedPages = result.outcome === "ANSWERED" ? result.sources.filter((s) => result.cited.includes(s.n)).map((s) => `${s.documentId}:${s.page}`) : [];
    const citesExpected = citedPages.some((k) => wanted.has(k));
    if (result.outcome === "ANSWERED") answered++;
    if (citesExpected) cited++;
    rows.push({ question: c.q, retrievalRank: rank || null, outcome: result.outcome, citesExpectedPage: citesExpected });
    console.log(`${citesExpected ? "✓" : "✗"} rank=${rank || "-"} ${result.outcome.padEnd(9)} ${c.q}`);
    await sleep(1500);
  }

  let refused = 0;
  for (const q of UNANSWERABLE) {
    const result = await answer(space.id, q);
    if (result.outcome === "NOT_FOUND") refused++;
    rows.push({ question: q, expected: "NOT_FOUND", outcome: result.outcome });
    console.log(`${result.outcome === "NOT_FOUND" ? "✓" : "✗"} (should refuse) ${result.outcome.padEnd(9)} ${q}`);
    await sleep(1500);
  }

  const n = ANSWERABLE.length;
  const pct = (x: number, of: number) => `${Math.round((x / of) * 100)}%`;
  const sorted = [...latencies].sort((a, b) => a - b);
  const summary = {
    date: new Date().toISOString().slice(0, 10),
    questions: n,
    retrievalHitAt1: pct(hit1, n),
    retrievalHitAt5: pct(hit5, n),
    mrr: Number((rrSum / n).toFixed(3)),
    answered: pct(answered, n),
    citationAccuracy: pct(cited, n),
    refusalAccuracy: `${refused}/${UNANSWERABLE.length}`,
    medianAnswerMs: sorted[Math.floor(sorted.length / 2)] ?? null,
  };
  console.log("\n", summary);
  mkdirSync("eval-results", { recursive: true });
  writeFileSync(`eval-results/eval-${summary.date}.json`, JSON.stringify({ summary, rows }, null, 2));
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});

/** Prints retrieval signal strength for answerable vs unanswerable questions, to tune the "not in documents" gate. */
import "dotenv/config";
import { db } from "../src/server/db";
import { geminiEmbedder } from "../src/server/gemini";
import { retrieve } from "../src/server/retrieval";

const QUESTIONS: [string, boolean][] = [
  ["What is the minimum attendance needed for end-sem exams?", true],
  ["How many backlogs are allowed for placements?", true],
  ["How many credits do I need to graduate?", true],
  ["Can I keep a kettle in my hostel room?", true],
  ["What is the condonation fee?", true],
  ["Is CGPA rounded for placement eligibility?", true],
  ["Is there a free laptop scheme for first years?", false],
  ["What is the bus route to campus?", false],
  ["Who won the cricket world cup?", false],
  ["What is the canteen menu on Friday?", false],
  ["How do I apply for a passport?", false],
  ["What is the wifi password?", false],
];

async function main() {
  const space = await db.space.findFirstOrThrow({ where: { isDemo: true } });
  for (const [q, answerable] of QUESTIONS) {
    const { ranked } = await retrieve(space.id, q, geminiEmbedder);
    const bestVector = Math.max(...ranked.map((c) => c.vectorScore ?? 0));
    const bestCoverage = Math.max(...ranked.map((c) => c.termCoverage));
    console.log(`${answerable ? "ANS " : "NONE"} vec=${bestVector.toFixed(3)} cov=${bestCoverage.toFixed(2)}  ${q}`);
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

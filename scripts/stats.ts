/** Prints honest usage numbers from the UsageEvent table (for "Used by N people" claims). */
import "dotenv/config";
import { db } from "../src/server/db";

async function main() {
  const [users, spaces, byType, askers] = await Promise.all([
    db.user.count(),
    db.space.count({ where: { isDemo: false } }),
    db.usageEvent.groupBy({ by: ["type"], _count: { _all: true } }),
    db.usageEvent.findMany({ where: { type: "QUESTION_ASKED" }, distinct: ["userId"], select: { userId: true } }),
  ]);
  console.log(`Signed-up users:        ${users}`);
  console.log(`College spaces (real):  ${spaces}`);
  console.log(`People who asked:       ${askers.length}`);
  for (const row of byType.sort((a, b) => a.type.localeCompare(b.type))) console.log(`${row.type.padEnd(22)}  ${row._count._all}`);
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});

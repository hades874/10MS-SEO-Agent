import "../lib/loadEnv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSeedCsv } from "../lib/memory/parseCsv";
import { mineStyle } from "../lib/memory/styleMine";
import { getDb } from "../lib/db";
import { styleMemory } from "../lib/db/schema";

/** Re-mine the house style/phrase bank from the CSV and replace style_memory. */
async function main() {
  const pathArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const csvPath = resolve(pathArg ?? "./csv/SEO Data - Sheet1.csv");
  const parsed = parseSeedCsv(readFileSync(csvPath, "utf8"));
  const mined = mineStyle(parsed);

  const db = getDb();
  await db.delete(styleMemory);
  await db.insert(styleMemory).values(
    mined.map((m) => ({
      kind: m.kind,
      language: m.language,
      value: m.value,
      frequency: m.frequency,
      isCurated: m.isCurated,
    }))
  );
  console.log(`Stored ${mined.length} style entries (${mined.filter((m) => m.kind === "phrase").length} mined phrases)`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

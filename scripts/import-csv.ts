import "../lib/loadEnv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSeedCsv } from "../lib/memory/parseCsv";
import { importCourses } from "../lib/memory/importCourses";
import { isAiConfigured } from "../lib/ai/models";

/**
 * Seed the agent's memory from the SEO CSV. Fast by default: parses, derives facets,
 * builds schema, scores, mines style, and creates embeddings. AI keyword back-fill is
 * SEPARATE (slow on free-tier Gemini) — run `npm run backfill:keywords` after.
 *   npm run import:csv                  -> default path
 *   npm run import:csv -- ./csv/x.csv   -> custom path
 *   npm run import:csv -- --no-ai       -> skip embeddings too (no AI at all)
 *   npm run import:csv -- --keywords    -> also back-fill keywords inline (slow)
 */
async function main() {
  const args = process.argv.slice(2);
  const noAi = args.includes("--no-ai");
  const inlineKeywords = args.includes("--keywords");
  const pathArg = args.find((a) => !a.startsWith("--"));
  const csvPath = resolve(pathArg ?? "./csv/SEO Data - Sheet1.csv");

  console.log(`Reading ${csvPath}`);
  const csv = readFileSync(csvPath, "utf8");
  const parsed = parseSeedCsv(csv);
  console.log(`Parsed ${parsed.length} courses`);

  if (!noAi && !isAiConfigured()) {
    console.warn(
      "⚠ No AI key set — importing WITHOUT embeddings. Semantic recall will be\n" +
        "  limited until you add GOOGLE_GENERATIVE_AI_API_KEY and re-import."
    );
  }

  const summary = await importCourses(parsed, {
    withAi: !noAi,
    backfillKw: inlineKeywords,
    resetSeed: true,
    onProgress: (m) => console.log("  " + m),
  });

  console.log("\nDone:", JSON.stringify(summary, null, 2));
  if (!inlineKeywords) {
    console.log("Next: run `npm run backfill:keywords` to AI-fill keywords (paced for free tier).");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import "../lib/loadEnv";
import postgres from "postgres";
import { generateText, embed } from "ai";
import {
  draftModel,
  embedModel,
  isAiConfigured,
  isEmbeddingConfigured,
  DRAFT_MODEL_ID,
  EMBED_MODEL_ID,
  ACTIVE_PROVIDER,
} from "../lib/ai/models";

/**
 * Verifies your two credentials independently and prints clear pass/fail.
 *   npm run check
 */
function ok(msg: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}
function fail(msg: string) {
  console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
}

async function checkDb(): Promise<boolean> {
  console.log("\nDatabase (DATABASE_URL)");
  const url = process.env.DATABASE_URL;
  if (!url) {
    fail("DATABASE_URL is not set in .env.local");
    return false;
  }
  ok("DATABASE_URL is set");
  try {
    const sql = postgres(url, { prepare: false, connect_timeout: 10 });
    const [{ now }] = await sql`select now() as now`;
    ok(`Connected to Postgres (server time ${now})`);

    const ext = await sql`select extname from pg_extension where extname = 'vector'`;
    if (ext.length) ok("pgvector extension is enabled");
    else fail("pgvector NOT enabled — run: npm run db:init");

    const tables = await sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name in ('courses','seo_records','seo_embeddings')`;
    if (tables.length >= 3) ok(`Tables exist (${tables.length}/3 core tables found)`);
    else fail(`Tables missing (${tables.length}/3) — run: npm run db:push`);

    await sql.end();
    return true;
  } catch (e) {
    fail(`Connection failed: ${(e as Error).message}`);
    return false;
  }
}

async function checkAi(): Promise<boolean> {
  console.log(`\nAI provider (${ACTIVE_PROVIDER})`);
  if (!isAiConfigured()) {
    fail("No AI key set — add GOOGLE_GENERATIVE_AI_API_KEY (or OPENROUTER_API_KEY) to .env.local");
    return false;
  }
  ok("AI key is set");

  let pass = true;
  try {
    const { text } = await generateText({
      model: draftModel(),
      prompt: "Reply with exactly: OK",
      maxOutputTokens: 5,
    });
    ok(`Draft model works (${DRAFT_MODEL_ID}, replied "${text.trim()}")`);
  } catch (e) {
    fail(`Draft model failed (${DRAFT_MODEL_ID}): ${(e as Error).message}`);
    pass = false;
  }

  if (!isEmbeddingConfigured()) {
    fail("Embeddings need GOOGLE_GENERATIVE_AI_API_KEY (OpenRouter has none) — semantic recall will be disabled");
    return false;
  }
  try {
    const { embedding } = await embed({
      model: embedModel(),
      value: "test",
      providerOptions: EMBED_MODEL_ID.includes("gemini-embedding")
        ? { google: { outputDimensionality: 768 } }
        : undefined,
    });
    ok(`Embeddings work (${EMBED_MODEL_ID}, ${embedding.length} dims)`);
  } catch (e) {
    fail(`Embedding model failed (${EMBED_MODEL_ID}): ${(e as Error).message}`);
    pass = false;
  }
  return pass;
}

async function main() {
  console.log("Checking credentials…");
  const db = await checkDb();
  const ai = await checkAi();
  console.log("\n" + "─".repeat(40));
  if (db && ai) {
    console.log("\x1b[32mAll good — you can run: npm run import:csv\x1b[0m");
  } else {
    console.log("\x1b[33mSome checks failed — fix the ✗ items above.\x1b[0m");
  }
  process.exit(db && ai ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

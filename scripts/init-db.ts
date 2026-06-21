import "../lib/loadEnv";
import postgres from "postgres";

/**
 * Enables the pgvector extension. Run this BEFORE `npm run db:push`, because the
 * seo_embeddings table uses a `vector` column.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set (see .env.example)");
  const sql = postgres(url, { prepare: false });
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("✓ pgvector extension ready");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

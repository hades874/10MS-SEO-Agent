import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

/**
 * Lazy singleton. We don't throw at import time so the app can boot (and pages
 * that don't touch the DB can render) before a database is configured.
 */
let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (see .env.example) — pull from Vercel/Neon."
    );
  }
  if (!_db) {
    _client = postgres(connectionString, { prepare: false });
    _db = drizzle(_client, { schema });
  }
  return _db;
}

export function isDbConfigured() {
  return Boolean(connectionString);
}

export { schema };

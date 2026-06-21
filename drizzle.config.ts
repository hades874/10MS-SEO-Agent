import "./lib/loadEnv";
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // pgvector needs the extension; we create it in the SQL migration / init.
} satisfies Config;

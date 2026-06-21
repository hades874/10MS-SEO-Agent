import { config } from "dotenv";

/**
 * Standalone scripts (tsx) and drizzle-kit don't auto-load .env.local the way
 * Next.js does. Import this first so CLI tools see the same env as the app.
 * .env.local wins (loaded first; dotenv does not override already-set vars).
 */
config({ path: ".env.local" });
config(); // .env fallback

export {};

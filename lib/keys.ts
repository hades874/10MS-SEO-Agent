/**
 * Per-request API key resolution: browser-supplied cookie first, then server env.
 *
 * Keys are entered by the user in the browser (Settings) and stored as httpOnly
 * cookies (`seo_key_<NAME>`), so nothing ships with keys by default. Server-side
 * AI/SERP calls read them per-request via getApiKey(). When there's no request
 * scope (standalone scripts, build) or no cookie, we transparently fall back to
 * process.env — keeping local dev and the tsx scripts working unchanged.
 *
 * DATABASE_URL is intentionally NOT managed here: a Postgres connection string is
 * server infrastructure, not a per-user browser secret. It stays env-only.
 */

export const COOKIE_PREFIX = "seo_key_";

/** Keys a user can set from the browser. Order drives the Settings UI. */
export const MANAGED_KEYS = [
  {
    name: "GOOGLE_GENERATIVE_AI_API_KEY",
    label: "Google Gemini",
    help: "Free key from aistudio.google.com/apikey — powers generation AND embeddings.",
  },
  {
    name: "OPENROUTER_API_KEY",
    label: "OpenRouter",
    help: "Optional — chat models via OpenRouter (no embeddings).",
  },
  {
    name: "OPENAI_API_KEY",
    label: "OpenAI",
    help: "Optional — adds ChatGPT as an AI-visibility engine.",
  },
  {
    name: "PERPLEXITY_API_KEY",
    label: "Perplexity",
    help: "Optional — adds Perplexity as an AI-visibility engine.",
  },
  {
    name: "SERPER_API_KEY",
    label: "Serper (Google SERP)",
    help: "Recommended — reliable Google results for competitor + rank checks.",
  },
  {
    name: "BRAVE_SEARCH_API_KEY",
    label: "Brave Search",
    help: "Alternative SERP source (used if Serper is absent).",
  },
] as const;

export type ManagedKeyName = (typeof MANAGED_KEYS)[number]["name"];

const MANAGED_KEY_NAMES = new Set<string>(MANAGED_KEYS.map((k) => k.name));

export function isManagedKey(name: string): name is ManagedKeyName {
  return MANAGED_KEY_NAMES.has(name);
}

/**
 * Resolve an API key for the current request. Tries the browser cookie, then env.
 * Safe to call anywhere: outside a request scope the cookie read is skipped.
 */
export async function getApiKey(name: string): Promise<string | undefined> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const value = store.get(`${COOKIE_PREFIX}${name}`)?.value;
    if (value) return value;
  } catch {
    // No request scope (scripts/build) or next/headers unavailable — use env.
  }
  return process.env[name] || undefined;
}

/** True if the key is set in either the request cookie or the server env. */
export async function hasApiKey(name: string): Promise<boolean> {
  return Boolean(await getApiKey(name));
}

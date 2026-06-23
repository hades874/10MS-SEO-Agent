/**
 * Free keyword research via Google Autocomplete (the public suggest endpoint).
 * No paid API. We expand a seed with a-z/0-9 suffixes to surface what students
 * actually type, in both English and Bangla locales, and use suggestion breadth as
 * a rough demand proxy (NOT real search volume — directional only).
 */

const SUGGEST = "https://suggestqueries.google.com/complete/search";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function fetchSuggest(
  query: string,
  hl: "en" | "bn"
): Promise<string[]> {
  const url = `${SUGGEST}?client=chrome&hl=${hl}&gl=bd&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = JSON.parse(await res.text());
    return Array.isArray(data?.[1]) ? (data[1] as string[]) : [];
  } catch {
    return [];
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

/**
 * Google Autocomplete spell-corrects and drops words, so an obscure seed (e.g.
 * "hsc 29", a batch that doesn't exist) drifts into garbage like "hsc 2924" /
 * "hsc 293" — Google reads the trailing number as a year and invents one. We only
 * trust a completion if it preserves the seed: every seed token must appear as a
 * whole word, and NUMERIC tokens must match exactly (so "29" never matches "2924").
 * Genuine long-tail expansions ("hsc 29 science book") keep all seed words; drift
 * does not.
 */
export function isRelevant(seedTokens: string[], suggestion: string): boolean {
  const words = new Set(tokenize(suggestion));
  return seedTokens.every((t) =>
    /^\d+$/.test(t)
      ? words.has(t) // numbers: exact whole-word, no digit extension
      : [...words].some((w) => w.includes(t)) // words: allow inflection/joins
  );
}

export interface KeywordResearch {
  seed: string;
  suggestions: string[]; // direct completions of the seed
  related: string[]; // expansion via a-z/0-9 suffixes
  demandSignal: number; // 0..100 proxy from breadth (NOT real volume)
}

const SUFFIXES = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

export async function researchKeyword(
  seed: string,
  opts: { expand?: boolean; locales?: ("en" | "bn")[] } = {}
): Promise<KeywordResearch> {
  const locales = opts.locales ?? ["en", "bn"];
  const expand = opts.expand ?? true;
  const seedTokens = tokenize(seed);

  const direct = new Set<string>();
  for (const hl of locales) {
    for (const s of await fetchSuggest(seed, hl)) {
      if (isRelevant(seedTokens, s)) direct.add(s);
    }
  }

  const related = new Set<string>();
  if (expand) {
    for (const hl of locales) {
      for (const suffix of SUFFIXES) {
        const sugg = await fetchSuggest(`${seed} ${suffix}`, hl);
        for (const s of sugg) {
          if (isRelevant(seedTokens, s)) related.add(s);
        }
        await sleep(40); // be polite to the endpoint
      }
    }
  }
  // Don't duplicate direct suggestions inside related.
  for (const d of direct) related.delete(d);

  const breadth = direct.size + related.size;
  const demandSignal = Math.min(100, Math.round((breadth / 60) * 100));

  return {
    seed,
    suggestions: [...direct],
    related: [...related],
    demandSignal,
  };
}

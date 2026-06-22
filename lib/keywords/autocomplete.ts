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

  const direct = new Set<string>();
  for (const hl of locales) {
    for (const s of await fetchSuggest(seed, hl)) direct.add(s);
  }

  const related = new Set<string>();
  if (expand) {
    for (const hl of locales) {
      for (const suffix of SUFFIXES) {
        const sugg = await fetchSuggest(`${seed} ${suffix}`, hl);
        for (const s of sugg) related.add(s);
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

import { researchKeyword, type KeywordResearch } from "./autocomplete";

/**
 * Pluggable keyword-research provider — mirrors lib/serp/provider.ts. The free
 * Google Autocomplete path is the keyless default (demand = suggestion breadth, a
 * directional proxy, NOT real volume). A paid source (DataForSEO/Ahrefs) can be
 * dropped in behind a key for real monthly search volume — no caller change needed.
 */

export type KeywordProvider = "autocomplete" | "dataforseo";

export function activeKeywordProvider(): KeywordProvider {
  if (process.env.DATAFORSEO_API_KEY) return "dataforseo";
  return "autocomplete";
}

interface ResearchOpts {
  expand?: boolean;
  locales?: ("en" | "bn")[];
}

/**
 * SCAFFOLD — paid provider slot. When DATAFORSEO_API_KEY is set this should call the
 * DataForSEO Keywords Data API and map its real search-volume into KeywordResearch
 * (demandSignal = normalized volume). Until implemented it falls back to the free
 * autocomplete path so callers always get a valid result.
 *
 * TODO(phase4-paid): implement the DataForSEO request + response mapping here.
 */
async function dataforseoResearch(
  seed: string,
  opts: ResearchOpts
): Promise<KeywordResearch> {
  return researchKeyword(seed, opts);
}

/** Run keyword research via the active provider (free autocomplete by default). */
export async function researchKeywordVia(
  seed: string,
  opts: ResearchOpts = {}
): Promise<KeywordResearch> {
  switch (activeKeywordProvider()) {
    case "dataforseo":
      return dataforseoResearch(seed, opts);
    default:
      return researchKeyword(seed, opts);
  }
}

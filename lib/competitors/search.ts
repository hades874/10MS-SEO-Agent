import { serpSearch } from "../serp/provider";
import { COMPETITORS, competitorForUrl, genericCompetitorForUrl, type Competitor } from "./config";

/** Max generic (non-watchlist) competitors to surface when nothing in the watchlist ranks. */
const MAX_DISCOVERED = 5;

/**
 * SERP discovery via DuckDuckGo (free, no API key) — our stand-in for "where do
 * competitors rank for this keyword". Results are filtered to the BD ed-tech
 * watchlist. A paid SERP API can replace the underlying ddgSearch later.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface DiscoveredUrl {
  url: string;
  competitor: Competitor;
}

export interface DiscoveryResult {
  urls: DiscoveredUrl[];
  /** Total raw SERP results seen across all queries — 0 means the provider returned
   *  nothing (almost always a blocked/keyless provider, not a genuinely empty SERP). */
  rawResults: number;
  /** "watchlist" when curated BD domains ranked; "discovered" when we fell back to the
   *  top general-SERP domains because no watchlist domain ranked for the keyword. */
  source: "watchlist" | "discovered";
}

/**
 * Find one best competitor URL per watchlist domain for a keyword. Runs a general
 * query first, then targeted `site:` queries for domains not yet covered.
 */
export async function discoverCompetitorUrls(
  keyword: string,
  opts: { maxSiteQueries?: number } = {}
): Promise<DiscoveryResult> {
  const found = new Map<string, string>(); // domain -> url
  let rawResults = 0;

  const general = await serpSearch(keyword);
  rawResults += general.length;
  for (const url of general) {
    const c = competitorForUrl(url);
    if (c && !found.has(c.domain)) found.set(c.domain, url);
  }

  const maxSite = opts.maxSiteQueries ?? COMPETITORS.length;
  let siteQueries = 0;
  for (const c of COMPETITORS) {
    if (found.has(c.domain) || siteQueries >= maxSite) continue;
    siteQueries++;
    const urls = await serpSearch(`${keyword} site:${c.domain}`);
    rawResults += urls.length;
    const hit = urls.find((u) => competitorForUrl(u)?.domain === c.domain);
    if (hit) found.set(c.domain, hit);
    await sleep(300); // polite spacing between SERP calls
  }

  if (found.size > 0) {
    return {
      urls: [...found.entries()].map(([domain, url]) => ({
        url,
        competitor: COMPETITORS.find((c) => c.domain === domain)!,
      })),
      rawResults,
      source: "watchlist",
    };
  }

  // No curated watchlist domain ranked. Fall back to the top general-SERP domains
  // (excluding 10MS itself and non-competitor platforms) so we still show who actually
  // ranks. Reuses the `general` results — no extra API calls.
  const discovered: DiscoveredUrl[] = [];
  const seen = new Set<string>();
  for (const url of general) {
    const c = genericCompetitorForUrl(url);
    if (!c || seen.has(c.domain)) continue;
    seen.add(c.domain);
    discovered.push({ url, competitor: c });
    if (discovered.length >= MAX_DISCOVERED) break;
  }

  return { urls: discovered, rawResults, source: "discovered" };
}

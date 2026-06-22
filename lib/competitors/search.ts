import { serpSearch } from "../serp/provider";
import { COMPETITORS, competitorForUrl, type Competitor } from "./config";

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

  return {
    urls: [...found.entries()].map(([domain, url]) => ({
      url,
      competitor: COMPETITORS.find((c) => c.domain === domain)!,
    })),
    rawResults,
  };
}

import { getDb, isDbConfigured } from "../db";
import { competitorSnapshots } from "../db/schema";
import { discoverCompetitorUrls } from "./search";
import { fetchHtml } from "./fetch";
import { parsePage, type ParsedPage } from "./parse";
import { scoreCompetitor, type CompetitorScore } from "./score";
import { activeSerpProvider } from "../serp/provider";

export interface CompetitorResult {
  competitorName: string;
  domain: string;
  page: ParsedPage;
  score: CompetitorScore;
}

export interface AnalyzeResult {
  keyword: string;
  competitors: CompetitorResult[];
  checkedDomains: number;
}

/**
 * End-to-end competitor analysis for a keyword: discover BD-watchlist URLs that rank,
 * fetch + parse each page, score it, and cache the snapshot. Returns results sorted
 * by competitor score (strongest rival first).
 */
export async function analyzeCompetitors(
  keyword: string,
  targetKeywords: string[] = []
): Promise<AnalyzeResult> {
  const kws = targetKeywords.length ? targetKeywords : [keyword];
  const { urls: discovered, rawResults } = await discoverCompetitorUrls(keyword);

  // Zero raw SERP results means the search provider returned nothing — almost always
  // the keyless DuckDuckGo scraper getting blocked (HTTP 403), not an empty SERP.
  // Surface this as an actionable error instead of a misleading "no competitors found".
  if (rawResults === 0 && activeSerpProvider() === "duckduckgo") {
    throw new Error(
      "SERP provider returned no results — the keyless DuckDuckGo scraper is being blocked. " +
        "Set SERPER_API_KEY (serper.dev, free tier) or BRAVE_SEARCH_API_KEY in .env.local to enable competitor discovery."
    );
  }

  const competitors: CompetitorResult[] = [];
  for (const d of discovered) {
    const html = await fetchHtml(d.url);
    if (!html) continue;
    const page = parsePage(d.url, html, kws);
    const score = scoreCompetitor(page, kws);
    competitors.push({
      competitorName: d.competitor.name,
      domain: d.competitor.domain,
      page,
      score,
    });

    if (isDbConfigured()) {
      try {
        await getDb().insert(competitorSnapshots).values({
          keyword,
          competitorDomain: d.competitor.domain,
          url: d.url,
          title: page.title,
          metaDescription: page.metaDescription,
          keywordsDetected: page.keywordsDetected,
          schemaPresent: page.schemaPresent,
          schemaTypes: page.schemaTypes,
          wordCount: page.wordCount,
          validationScore: score.total,
        });
      } catch {
        /* caching is best-effort */
      }
    }
  }

  competitors.sort((a, b) => b.score.total - a.score.total);
  return {
    keyword,
    competitors,
    checkedDomains: discovered.length,
  };
}

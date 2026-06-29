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
  /** "watchlist" when curated BD domains ranked; "discovered" when we fell back to the
   *  top general-SERP domains because no watchlist domain ranked for the keyword. */
  source: "watchlist" | "discovered";
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
  const { urls: discovered, rawResults, source } = await discoverCompetitorUrls(keyword);

  // Zero raw SERP results means the provider returned nothing at all — almost never a
  // genuinely empty SERP for real-world ed-tech keywords. Surface as an actionable error.
  if (rawResults === 0) {
    const provider = await activeSerpProvider();
    throw new Error(
      provider === "duckduckgo"
        ? "SERP provider returned no results — the keyless DuckDuckGo scraper may be blocked. " +
          "Add a Serper key (serper.dev, free tier) or Brave Search key in Settings for reliable results."
        : `${provider} returned 0 results — your API key may be invalid or the service is temporarily unavailable. ` +
          "Check your key in Settings, or try again in a moment."
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
      } catch (e) {
        // Caching is best-effort; the analysis result is still returned.
        console.error(`analyzeCompetitors: snapshot insert failed (${d.competitor.domain}, "${keyword}"):`, e);
      }
    }
  }

  competitors.sort((a, b) => b.score.total - a.score.total);
  return {
    keyword,
    competitors,
    checkedDomains: discovered.length,
    source,
  };
}

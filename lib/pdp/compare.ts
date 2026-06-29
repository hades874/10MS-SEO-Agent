import { fetchHtml } from "../competitors/fetch";
import { scoreCompetitor } from "../competitors/score";
import { isAiConfigured } from "../ai/models";
import { researchKeywordVia } from "../keywords/provider";
import { parsePdp } from "./parse";
import { computeKeywordGap } from "./keywordGap";
import { analyzePdpGap } from "./analyze";
import type { ParsedPdp, PdpSide, PdpComparisonResult } from "./types";

/** Cap the competitor field — keeps fetch fan-out and the AI prompt bounded. */
export const MAX_COMPETITORS = 5;

export interface CompareOpts {
  targetKeywords?: string[];
}

function side(url: string, page: ParsedPdp, targetKeywords: string[]): PdpSide {
  return { url, page, score: scoreCompetitor(page, targetKeywords) };
}

/**
 * Head-to-head PDP comparison: fetch + parse + score our page against a field of
 * competitors, derive the aggregated page-level keyword gap, then (if AI is
 * configured) run a single combined gap-analysis. The on-page half always works
 * keyless; AI failure degrades to analysis: null rather than failing the call.
 * A competitor that can't be fetched is skipped, not fatal.
 */
export async function comparePdps(
  ourUrl: string,
  competitorUrls: string[],
  opts: CompareOpts = {}
): Promise<PdpComparisonResult> {
  const targetKeywords = (opts.targetKeywords ?? []).filter((k) => k.trim());
  const rivals = competitorUrls.filter((u) => u.trim()).slice(0, MAX_COMPETITORS);
  if (rivals.length === 0) {
    throw new Error("Add at least one competitor URL to compare against.");
  }

  const [ourHtml, ...rivalHtml] = await Promise.all([
    fetchHtml(ourUrl),
    ...rivals.map((u) => fetchHtml(u)),
  ]);
  if (!ourHtml) {
    throw new Error("Couldn't fetch your URL (timeout, blocked, or not HTML). Check it loads publicly.");
  }

  const ourPage = parsePdp(ourUrl, ourHtml, targetKeywords);

  const competitorPages: ParsedPdp[] = [];
  for (let i = 0; i < rivals.length; i++) {
    const html = rivalHtml[i];
    if (!html) continue; // skip unreachable competitor, keep the rest
    competitorPages.push(parsePdp(rivals[i], html, targetKeywords));
  }
  if (competitorPages.length === 0) {
    throw new Error("Couldn't fetch any competitor URL (timeout, blocked, or not HTML). Check they load publicly.");
  }

  // Best-effort free Autocomplete expansion to enrich keyword-gap candidates.
  let expanded: string[] = [];
  if (targetKeywords[0]) {
    try {
      const research = await researchKeywordVia(targetKeywords[0], { expand: true });
      expanded = [...research.suggestions, ...research.related];
    } catch (e) {
      console.error("comparePdps: keyword expansion failed (non-fatal):", e);
    }
  }

  const keywordGap = computeKeywordGap(ourPage, competitorPages, expanded);

  const result: PdpComparisonResult = {
    ours: side(ourUrl, ourPage, targetKeywords),
    competitors: competitorPages.map((p) => side(p.url, p, targetKeywords)),
    targetKeywords,
    keywordGap,
    analysis: null,
  };

  if (!(await isAiConfigured())) {
    result.aiSkippedReason =
      "AI not configured — showing on-page comparison and keyword gap only. Set your Gemini key in Settings (or GOOGLE_GENERATIVE_AI_API_KEY for local dev) for the full content-gap analysis.";
    return result;
  }

  try {
    result.analysis = await analyzePdpGap(ourPage, competitorPages, keywordGap, targetKeywords);
  } catch (e) {
    // Degrade gracefully: the on-page comparison still stands.
    console.error("comparePdps: AI gap analysis failed (non-fatal):", e);
    result.aiSkippedReason = `AI content-gap analysis unavailable: ${(e as Error).message}`;
  }

  return result;
}

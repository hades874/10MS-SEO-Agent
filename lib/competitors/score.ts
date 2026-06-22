import { visibleLength } from "../util/lang";
import { LIMITS } from "../score/validate";
import type { ParsedPage } from "./parse";

/**
 * Competitor on-page SEO score (0–100). Mirrors our own rubric where it applies, so
 * a competitor's page can be ranked head-to-head against ours. Competitors are
 * single-language, so there's no bilingual dimension here.
 */
export interface CompetitorScore {
  total: number;
  breakdown: {
    title: number;
    description: number;
    keywordUsage: number;
    schema: number;
    og: number;
    content: number;
  };
}

function lenScore(text: string | null, min: number, max: number) {
  if (!text) return 0;
  const n = visibleLength(text);
  if (n >= min && n <= max) return 1;
  const dist = n < min ? min - n : n - max;
  return Math.max(0, 1 - dist / Math.max(min, 20));
}

export function scoreCompetitor(
  page: ParsedPage,
  targetKeywords: string[]
): CompetitorScore {
  const title = lenScore(page.title, LIMITS.titleMin, LIMITS.titleMax);
  const description = lenScore(
    page.metaDescription,
    LIMITS.descMin,
    LIMITS.descMax
  );
  const keywordUsage =
    targetKeywords.length === 0
      ? 0.5
      : Math.min(1, page.keywordsDetected.length / Math.min(targetKeywords.length, 3));
  const schema = page.schemaPresent ? 1 : 0;
  const og = (page.ogTitle ? 0.5 : 0) + (page.ogDescription ? 0.5 : 0);
  const content =
    page.wordCount >= 600 ? 1 : page.wordCount >= 200 ? 0.6 : 0.2;

  const weights = {
    title: 22,
    description: 22,
    keywordUsage: 18,
    schema: 16,
    og: 12,
    content: 10,
  };
  const fr = { title, description, keywordUsage, schema, og, content };
  let total = 0;
  const breakdown = {} as CompetitorScore["breakdown"];
  for (const k of Object.keys(weights) as (keyof typeof weights)[]) {
    total += fr[k] * weights[k];
    breakdown[k] = Math.round(fr[k] * weights[k]);
  }
  return { total: Math.round(total), breakdown };
}

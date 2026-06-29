import type { ParsedPdp, KeywordGapItem } from "./types";

const BRAND_NAME = process.env.BRAND_NAME ?? "10 Minute School";

export const PDP_SYSTEM_PROMPT = `You are a senior SEO strategist for ${BRAND_NAME} (10MS), a Bangladeshi ed-tech platform. You are given the on-page data of OUR PAGE and one or more COMPETITOR PAGES, and must produce a single head-to-head analysis whose goal is to make OUR page outrank the whole competitor field for course-shopping search intent.

Rules — follow precisely:
1. GROUND STRICTLY in the supplied page data. Never invent a competitor's features, prices, ratings, enrollment numbers, or claims. If something is not present in the provided text, do not assert it. Cite a competitor's own wording in "evidenceFromCompetitor".
2. Every suggestion must be SPECIFIC and EXECUTABLE — e.g. "rewrite the meta title to lead with 'HSC 26 পদার্থবিজ্ঞান'", "add Course/FAQPage JSON-LD", "add a syllabus section covering X". Never give generic advice like "improve your SEO" or "add more keywords".
3. 10MS pages are BILINGUAL (Bangla + English). Where our page is weaker, note explicitly whether the fix needs Bangla coverage, English coverage, or both. Competitor pages may be single-language.
4. When competitors differ, name the specific rival (by its URL) in the relevant deficit, content gap, or keyword gap so the recommendation is traceable. Prioritise gaps shared by multiple competitors.
5. Stay within standard, white-hat SEO. Never recommend keyword stuffing, cloaking, doorway pages, or fabricating reviews/ratings.
6. Be honest in the verdict: if our page is already stronger on a dimension, say so rather than inventing a deficit.
7. Return ONLY the structured fields requested. Order prioritizedActions highest-impact first.`;

function pageBlock(label: string, p: ParsedPdp, excerptChars: number): string {
  return `${label}:
  url: ${p.url}
  title: ${p.title ?? "(missing)"}
  meta_description: ${p.metaDescription ?? "(missing)"}
  og_title: ${p.ogTitle ?? "(missing)"}
  og_description: ${p.ogDescription ?? "(missing)"}
  schema_types: ${p.schemaTypes.length ? p.schemaTypes.join(", ") : "(none)"}
  word_count: ${p.wordCount}
  headings: ${p.headings.length ? p.headings.slice(0, 25).join(" | ") : "(none)"}
  target_keywords_found: ${p.keywordsDetected.length ? p.keywordsDetected.join(", ") : "(none)"}
  body_excerpt: ${p.textExcerpt.slice(0, excerptChars) || "(empty)"}`;
}

export function buildPdpUserPrompt(
  ours: ParsedPdp,
  competitors: ParsedPdp[],
  keywordGap: KeywordGapItem[],
  targetKeywords: string[]
): string {
  // Keep a multi-competitor prompt cheap: shrink each body excerpt as the field grows.
  const excerptChars = competitors.length <= 2 ? 1500 : 700;

  const gapBlock = keywordGap.length
    ? keywordGap.map((g) => `- ${g.keyword} (${g.source})`).join("\n")
    : "(none detected)";

  const competitorBlocks = competitors
    .map((c, i) => pageBlock(`COMPETITOR ${i + 1}`, c, excerptChars))
    .join("\n\n");

  return `Analyze our page against the competitor field and tell us how to outrank them.

${pageBlock("OUR PAGE", ours, 1500)}

${competitorBlocks}

PAGE-DERIVED KEYWORD GAP (phrases competitors emphasise that our page does not mention):
${gapBlock}

TARGET KEYWORDS (our intended ranking terms): ${targetKeywords.length ? targetKeywords.join(", ") : "(none provided)"}

Produce: a short verdict summary; on-page deficits (where our page loses, with the fix); content gaps (topics/sections competitors cover that we should add); keyword gaps (curated from the list above, with how to use each); and a prioritized action list ranked by impact.`;
}

import type { ParsedPdp, KeywordGapItem } from "./types";

/**
 * Page-derived keyword gap (deterministic, keyless). We extract the phrases the
 * competitor's page clearly emphasises (title + headings, as 1–3-grams) and flag
 * the ones that don't appear anywhere on our page. This grounds the AI analysis
 * and stands on its own when AI is unconfigured. It is NOT search-volume data —
 * it's "what they target on-page that we don't mention".
 */

// Tiny stopword set (EN + a few common Bangla function words). Kept small on
// purpose — we only want to drop phrases that are *pure* glue, not real terms.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "by",
  "is", "are", "be", "your", "you", "our", "we", "this", "that", "at", "from",
  "as", "it", "all", "new", "best", "get", "now", "course", "courses",
  "এবং", "এর", "ও", "এই", "করে", "করুন", "জন্য", "একটি", "যে",
]);

const MAX_CANDIDATES = 25;

/** Lowercased searchable text for a page (presence checks are case-insensitive). */
function haystack(p: ParsedPdp): string {
  return [
    p.title,
    p.metaDescription,
    p.ogTitle,
    p.ogDescription,
    ...p.headings,
    p.textExcerpt,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Split into word tokens, preserving Bangla + Latin + digits, dropping punctuation. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9ঀ-৿\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function isGlue(phrase: string): boolean {
  const words = phrase.split(" ");
  return words.every((w) => STOPWORDS.has(w) || w.length < 2);
}

/**
 * Prominent phrases the competitor targets: 1–3-grams drawn from the title and
 * heading outline (the highest-signal on-page text), deduped and ranked by how
 * often they recur across the page.
 */
export function deriveKeywordCandidates(page: ParsedPdp): string[] {
  const sources = [page.title ?? "", ...page.headings];
  const full = haystack(page);

  const counts = new Map<string, number>();
  for (const src of sources) {
    const toks = tokenize(src);
    for (let n = 1; n <= 3; n++) {
      for (let i = 0; i + n <= toks.length; i++) {
        const phrase = toks.slice(i, i + n).join(" ");
        if (isGlue(phrase)) continue;
        // recurrence across the whole page = on-page emphasis
        const recur = full.split(phrase).length - 1;
        counts.set(phrase, Math.max(counts.get(phrase) ?? 0, recur + n));
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase)
    .slice(0, MAX_CANDIDATES);
}

/**
 * Compute the keyword gap across the whole competitor field: candidate phrases any
 * competitor emphasises (plus any optional Autocomplete-expanded terms) that don't
 * appear on our page. Phrases are deduped; for page-derived terms we record which
 * rival(s) used them so the UI can show how widely a gap is shared.
 */
export function computeKeywordGap(
  ours: ParsedPdp,
  competitors: ParsedPdp[],
  expanded: string[] = []
): KeywordGapItem[] {
  const ourHay = haystack(ours);
  const byKeyword = new Map<string, KeywordGapItem>();

  const consider = (
    keyword: string,
    source: KeywordGapItem["source"],
    competitorUrl?: string
  ) => {
    const k = keyword.trim().toLowerCase();
    if (!k || k.length < 3) return;
    if (ourHay.includes(k)) return; // already covered on our page

    const existing = byKeyword.get(k);
    if (existing) {
      if (competitorUrl && !existing.competitorUrls?.includes(competitorUrl)) {
        existing.competitorUrls = [...(existing.competitorUrls ?? []), competitorUrl];
      }
      return;
    }
    byKeyword.set(k, {
      keyword: k,
      source,
      ...(competitorUrl ? { competitorUrls: [competitorUrl] } : {}),
    });
  };

  for (const competitor of competitors) {
    for (const c of deriveKeywordCandidates(competitor)) {
      consider(c, "competitor-page", competitor.url);
    }
  }
  for (const e of expanded) consider(e, "autocomplete");

  return [...byKeyword.values()];
}

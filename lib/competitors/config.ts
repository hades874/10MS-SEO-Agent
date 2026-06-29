/**
 * Bangladeshi ed-tech watchlist. Competitor analysis is scoped to these domains
 * first (per project decision), so SERP discovery filters to relevant local rivals
 * rather than the whole web. Editable as priorities change.
 */
export interface Competitor {
  domain: string;
  name: string;
}

export const COMPETITORS: Competitor[] = [
  { domain: "shikho.com", name: "Shikho" },
  { domain: "acsfutureschool.com", name: "ACS Future School" },
  { domain: "britishcouncil.org.bd", name: "British Council Bangladesh" },
  { domain: "udvash.com", name: "Udvash" },
  { domain: "bohubrihi.com", name: "Bohubrihi" },
  { domain: "ostad.app", name: "Ostad" },
];

export function competitorForUrl(url: string): Competitor | null {
  const host = hostOf(url);
  if (!host) return null;
  return (
    COMPETITORS.find((c) => host === c.domain || host.endsWith(`.${c.domain}`)) ??
    null
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * 10MS's own host(s) — never treated as a competitor. Derived from SITE_ORIGIN
 * (mirrors lib/rank/serp.ts), falling back to the canonical domain.
 */
export const SELF_HOSTS: string[] = (() => {
  try {
    return [new URL(process.env.SITE_ORIGIN ?? "https://10minuteschool.com").hostname.replace(/^www\./, "")];
  } catch {
    return ["10minuteschool.com"];
  }
})();

/**
 * Platforms whose on-page SEO score is meaningless as a course competitor
 * (social, video, marketplaces, news, encyclopedias). Excluded from generic
 * SERP-discovered competitors. Extend as needed.
 */
export const EXCLUDED_HOSTS: string[] = [
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "tiktok.com",
  "wikipedia.org",
  "prothomalo.com",
  "rokomari.com",
];

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Synthesize a competitor from an arbitrary SERP URL when no curated watchlist
 * domain ranks for a keyword. Returns null for invalid hosts, 10MS itself,
 * excluded platforms, or hosts already covered by the watchlist (those should go
 * through competitorForUrl). The host doubles as the display name.
 */
export function genericCompetitorForUrl(url: string): Competitor | null {
  const host = hostOf(url);
  if (!host) return null;
  if (SELF_HOSTS.some((d) => hostMatches(host, d))) return null;
  if (EXCLUDED_HOSTS.some((d) => hostMatches(host, d))) return null;
  if (COMPETITORS.some((c) => hostMatches(host, c.domain))) return null;
  return { domain: host, name: host };
}

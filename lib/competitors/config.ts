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
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  return (
    COMPETITORS.find((c) => host === c.domain || host.endsWith(`.${c.domain}`)) ??
    null
  );
}

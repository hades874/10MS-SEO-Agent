/**
 * Google Search Console adapter — SCAFFOLD (Phase 4, optional).
 *
 * The live rank path is SERP-based (lib/rank/serp.ts); we have no GSC access today.
 * If Search Console access is granted, implement checkRankGsc() here to read EXACT
 * impressions / clicks / CTR / average position via the Search Analytics API. The
 * rank_checks table already has impressions/clicks/ctr columns and a source="gsc"
 * value, so results slot in with no schema change. This stays gated and unused until
 * the credentials below are set, so it never affects the free default.
 *
 * TODO(phase4-gsc): OAuth (service account or refresh token) + Search Analytics query.
 */

export interface GscRankResult {
  query: string;
  pageUrl: string | null;
  position: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  source: "gsc";
}

/** True once Search Console credentials are configured. */
export function isGscConfigured(): boolean {
  return Boolean(
    process.env.GSC_SITE_URL &&
      (process.env.GSC_SERVICE_ACCOUNT_JSON || process.env.GSC_REFRESH_TOKEN)
  );
}

/**
 * Placeholder. Returns null until the adapter is implemented; callers must keep the
 * SERP path as the default and only prefer GSC when isGscConfigured() is true.
 */
export async function checkRankGsc(
  _query: string,
  _pageUrl: string | null
): Promise<GscRankResult | null> {
  // TODO(phase4-gsc): call the Search Analytics API and map the response.
  return null;
}

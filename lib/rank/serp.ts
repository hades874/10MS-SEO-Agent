import { serpSearch } from "../serp/provider";

const SITE_HOST = (() => {
  try {
    return new URL(process.env.SITE_ORIGIN ?? "https://10minuteschool.com").hostname.replace(/^www\./, "");
  } catch {
    return "10minuteschool.com";
  }
})();

export interface RankResult {
  keyword: string;
  position: number | null; // 1-based position of our URL, null = not in scanned results
  pageUrl: string | null; // the matched 10MS URL
  scanned: number; // how many results we looked at
  topResults: { position: number; url: string; host: string }[]; // first few results, for context when we don't rank
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Web SERP rank check (DuckDuckGo proxy — Google blocks scrapers). Finds the
 * position of a 10minuteschool.com result for a keyword. If `preferUrl` is given,
 * an exact URL match wins; otherwise the first result on our domain counts.
 * Directional, not Google-exact; swap in a paid Google SERP API later.
 */
function isOurHost(host: string): boolean {
  return host === SITE_HOST || host.endsWith(`.${SITE_HOST}`);
}

export async function checkRank(
  keyword: string,
  preferUrl?: string | null
): Promise<RankResult> {
  const results = await serpSearch(keyword);
  // First few results, for context in the UI when 10MS doesn't rank.
  const topResults = results.slice(0, 5).map((url, i) => ({
    position: i + 1,
    url,
    host: hostOf(url),
  }));

  let domainPos: number | null = null;
  let domainUrl: string | null = null;

  for (let i = 0; i < results.length; i++) {
    const url = results[i];
    if (preferUrl && url.split("?")[0] === preferUrl.split("?")[0]) {
      return { keyword, position: i + 1, pageUrl: url, scanned: results.length, topResults };
    }
    if (domainPos === null && isOurHost(hostOf(url))) {
      domainPos = i + 1;
      domainUrl = url;
    }
  }
  return {
    keyword,
    position: domainPos,
    pageUrl: domainUrl,
    scanned: results.length,
    topResults,
  };
}

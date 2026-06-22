import * as cheerio from "cheerio";

/**
 * Shared DuckDuckGo SERP fetch (no API key). Used for competitor discovery and
 * web-rank checks. DDG occasionally returns an empty/challenge page under load, so
 * we try the html endpoint (POST), then fall back to the lite endpoint, with a retry.
 * A paid Google SERP API can replace this behind the same signature later.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cleanUrl(href: string): string | null {
  const m = href.match(/uddg=([^&]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  }
  if (/^https?:\/\//.test(href) && !/duckduckgo\.com/.test(href)) return href;
  return null;
}

async function fetchHtmlEndpoint(query: string): Promise<string[]> {
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `q=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const $ = cheerio.load(await res.text());
  const urls: string[] = [];
  $("a.result__a").each((_, el) => {
    const u = cleanUrl($(el).attr("href") ?? "");
    if (u) urls.push(u);
  });
  return urls;
}

async function fetchLiteEndpoint(query: string): Promise<string[]> {
  const res = await fetch("https://lite.duckduckgo.com/lite/", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `q=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const $ = cheerio.load(await res.text());
  const urls: string[] = [];
  $("a").each((_, el) => {
    const u = cleanUrl($(el).attr("href") ?? "");
    if (u) urls.push(u);
  });
  return urls;
}

export async function ddgSearch(query: string): Promise<string[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const html = await fetchHtmlEndpoint(query);
      if (html.length) return html;
      const lite = await fetchLiteEndpoint(query);
      if (lite.length) return lite;
    } catch {
      /* retry */
    }
    await sleep(600);
  }
  return [];
}

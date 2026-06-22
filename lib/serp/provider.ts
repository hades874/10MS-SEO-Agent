import { ddgSearch } from "./ddg";

/**
 * Pluggable SERP provider. Free DuckDuckGo scraping is the keyless default, but it
 * rate-limits under load and isn't Google. Set ONE of these (both have free tiers,
 * no paid plan needed) for reliable results — no code change required:
 *   SERPER_API_KEY        -> google.serper.dev (actual Google results) [recommended]
 *   BRAVE_SEARCH_API_KEY  -> api.search.brave.com
 */

export type SerpProvider = "serper" | "brave" | "duckduckgo";

export function activeSerpProvider(): SerpProvider {
  if (process.env.SERPER_API_KEY) return "serper";
  if (process.env.BRAVE_SEARCH_API_KEY) return "brave";
  return "duckduckgo";
}

async function serperSearch(query: string): Promise<string[]> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, gl: "bd", num: 20 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { organic?: { link: string }[] };
    return (data.organic ?? []).map((o) => o.link).filter(Boolean);
  } catch {
    return [];
  }
}

async function braveSearch(query: string): Promise<string[]> {
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&country=bd&count=20`;
    const res = await fetch(url, {
      headers: {
        "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY!,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { web?: { results?: { url: string }[] } };
    return (data.web?.results ?? []).map((r) => r.url).filter(Boolean);
  } catch {
    return [];
  }
}

/** Run a web search via the active provider, returning ordered result URLs. */
export async function serpSearch(query: string): Promise<string[]> {
  switch (activeSerpProvider()) {
    case "serper":
      return serperSearch(query);
    case "brave":
      return braveSearch(query);
    default:
      return ddgSearch(query);
  }
}

import * as cheerio from "cheerio";

/**
 * Extract on-page SEO signals from a competitor's public course page. Legitimate
 * use of public HTML — title, meta description, OG tags, JSON-LD types, headings,
 * word count, and which of our target keywords appear.
 */
export interface ParsedPage {
  url: string;
  title: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  h1: string[];
  schemaPresent: boolean;
  schemaTypes: string[];
  wordCount: number;
  keywordsDetected: string[];
}

export function parsePage(
  url: string,
  html: string,
  targetKeywords: string[] = []
): ParsedPage {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || null;
  const ogDescription =
    $('meta[property="og:description"]').attr("content")?.trim() || null;

  const h1 = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 5);

  // JSON-LD types
  const schemaTypes = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      const collect = (node: unknown) => {
        if (Array.isArray(node)) return node.forEach(collect);
        if (node && typeof node === "object") {
          const t = (node as Record<string, unknown>)["@type"];
          if (typeof t === "string") schemaTypes.add(t);
          else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && schemaTypes.add(x));
          const graph = (node as Record<string, unknown>)["@graph"];
          if (graph) collect(graph);
        }
      };
      collect(json);
    } catch {
      /* ignore malformed JSON-LD */
    }
  });

  // Visible text word count (strip script/style)
  $("script, style, noscript").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(" ").length : 0;

  const haystack = `${title ?? ""} ${metaDescription ?? ""} ${bodyText}`.toLowerCase();
  const keywordsDetected = targetKeywords.filter((k) =>
    haystack.includes(k.toLowerCase())
  );

  return {
    url,
    title,
    metaDescription,
    ogTitle,
    ogDescription,
    h1,
    schemaPresent: schemaTypes.size > 0,
    schemaTypes: [...schemaTypes],
    wordCount,
    keywordsDetected,
  };
}

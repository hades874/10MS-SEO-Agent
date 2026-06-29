import * as cheerio from "cheerio";
import { parsePage } from "../competitors/parse";
import type { ParsedPdp } from "./types";

/** Max characters of visible body text sent to the LLM (keeps the prompt cheap). */
const EXCERPT_CHARS = 1500;

/**
 * Parse a PDP for comparison. Reuses the competitor on-page extractor
 * (`parsePage` — title/meta/og/schema/word-count/keyword presence) and adds the
 * two signals the gap-analysis LLM needs: an h1–h3 heading outline and a
 * cleaned, token-budgeted excerpt of the visible body text.
 */
export function parsePdp(
  url: string,
  html: string,
  targetKeywords: string[] = []
): ParsedPdp {
  const base = parsePage(url, html, targetKeywords);

  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const headings = $("h1, h2, h3")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean)
    .slice(0, 40);

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const textExcerpt = bodyText.slice(0, EXCERPT_CHARS);

  return { ...base, headings, textExcerpt };
}

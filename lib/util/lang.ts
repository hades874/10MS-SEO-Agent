/**
 * Language detection by Unicode script, NOT by column label.
 *
 * The seed CSV frequently mislabels or swaps the "Bangla"/"English" rows, so we
 * decide a string's primary language from its actual characters. Bengali lives in
 * the Unicode block U+0980–U+09FF.
 */

const BENGALI_RE = /[ঀ-৿]/g;
const LATIN_RE = /[A-Za-z]/g;

export type Lang = "bn" | "en" | "mixed" | "unknown";

export function scriptCounts(text: string): { bn: number; en: number } {
  const bn = (text.match(BENGALI_RE) ?? []).length;
  const en = (text.match(LATIN_RE) ?? []).length;
  return { bn, en };
}

/**
 * Primary language of a string. A field counts as a language if that script makes
 * up the majority of its letters; near-even mixes return "mixed".
 */
export function detectLang(text: string | null | undefined): Lang {
  if (!text) return "unknown";
  const { bn, en } = scriptCounts(text);
  const total = bn + en;
  if (total === 0) return "unknown";
  const bnShare = bn / total;
  if (bnShare >= 0.6) return "bn";
  if (bnShare <= 0.4) return "en";
  return "mixed";
}

function bengaliShare(text: string): number {
  const { bn, en } = scriptCounts(text);
  const total = bn + en;
  return total === 0 ? 0 : bn / total;
}

/**
 * Given two candidate strings (whatever their CSV labels claimed), assign them to
 * bn/en slots by their real script. Used for title/description pairs.
 *
 * Both 10MS variants routinely mix scripts (a "Bangla" title may contain English
 * keywords and vice-versa), so we compare them RELATIVELY: the one with the higher
 * Bengali share is the bn variant, the other is en. A single candidate is assigned
 * by its own majority script.
 */
export function assignByScript(
  a: string | null | undefined,
  b: string | null | undefined
): { bn: string | null; en: string | null } {
  const candidates = [a, b].filter((x): x is string => Boolean(x && x.trim()));

  if (candidates.length === 0) return { bn: null, en: null };
  if (candidates.length === 1) {
    const only = candidates[0];
    return detectLang(only) === "bn"
      ? { bn: only, en: null }
      : { bn: null, en: only };
  }

  const [first, second] = candidates;
  if (bengaliShare(first) >= bengaliShare(second)) {
    return { bn: first, en: second };
  }
  return { bn: second, en: first };
}

/**
 * Grapheme-aware length for SEO character limits. Bangla uses conjuncts and
 * combining marks, so counting JS code units (string.length) overcounts. We count
 * user-perceived characters via Intl.Segmenter when available.
 */
let segmenter: Intl.Segmenter | null = null;
export function visibleLength(text: string | null | undefined): number {
  if (!text) return 0;
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    segmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let n = 0;
    for (const _ of segmenter.segment(text)) n++;
    return n;
  }
  return [...text].length;
}

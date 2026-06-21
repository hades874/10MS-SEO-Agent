import type { ParsedCourse } from "./parseCsv";

/**
 * Layer-3 style mining: distill the house voice from the corpus so generation
 * sounds like 10MS. We mine recurring clauses (data-driven, frequency-based) and
 * add a few curated brand/template rules.
 */

export interface MinedStyle {
  kind: "phrase" | "template" | "brand_rule";
  language: "bn" | "en" | "mixed";
  value: string;
  frequency: number;
  isCurated: boolean;
}

const BRAND_NAME = process.env.BRAND_NAME ?? "10 Minute School";

function clauses(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/[,।!\n]/)
    .map((c) => c.trim())
    .filter((c) => c.length >= 8 && c.length <= 70);
}

function detectClauseLang(c: string): "bn" | "en" | "mixed" {
  const bn = (c.match(/[ঀ-৿]/g) ?? []).length;
  const en = (c.match(/[A-Za-z]/g) ?? []).length;
  if (bn > en * 1.5) return "bn";
  if (en > bn * 1.5) return "en";
  return "mixed";
}

export function mineStyle(courses: ParsedCourse[]): MinedStyle[] {
  const freq = new Map<string, number>();

  for (const c of courses) {
    const texts = [c.metaDescBn, c.metaDescEn, c.ogDescription];
    const seen = new Set<string>();
    for (const t of texts) {
      for (const cl of clauses(t)) {
        const key = cl.toLowerCase();
        if (seen.has(key)) continue; // count once per course
        seen.add(key);
        freq.set(cl, (freq.get(cl) ?? 0) + 1);
      }
    }
  }

  // Phrases recurring across >=2 courses are house USPs.
  const phrases: MinedStyle[] = [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([value, frequency]) => ({
      kind: "phrase" as const,
      language: detectClauseLang(value),
      value,
      frequency,
      isCurated: false,
    }));

  const curated: MinedStyle[] = [
    {
      kind: "brand_rule",
      language: "mixed",
      value: `Brand name appears as "${BRAND_NAME}" (English) and "টেন মিনিট স্কুল" (Bangla).`,
      frequency: 0,
      isCurated: true,
    },
    {
      kind: "template",
      language: "mixed",
      value: "Meta title shape: '<Course short name> | <other-language variant or subject>'.",
      frequency: 0,
      isCurated: true,
    },
    {
      kind: "template",
      language: "en",
      value: "Slug pattern: {level}-{year}-{subject}-{batch_type}, lowercase, hyphenated.",
      frequency: 0,
      isCurated: true,
    },
    {
      kind: "template",
      language: "mixed",
      value:
        "Image names end with -thumbnail / -sqr-thumbnail; alt text ends with '- thumbnail'.",
      frequency: 0,
      isCurated: true,
    },
  ];

  return [...curated, ...phrases];
}

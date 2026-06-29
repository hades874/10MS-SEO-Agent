import { visibleLength } from "../util/lang";
import { validateProductSchema } from "../generate/buildSchema";

/** SEO character-limit rules from the 10MS house spec. */
export const LIMITS = {
  titleMin: 30,
  titleMax: 60,
  descMin: 70,
  descMax: 160,
  keywordMax: 50,
} as const;

export interface ScorableRecord {
  metaTitleBn?: string | null;
  metaTitleEn?: string | null;
  metaDescBn?: string | null;
  metaDescEn?: string | null;
  keywords?: string[] | null;
  ogTitleBn?: string | null;
  ogTitleEn?: string | null;
  ogDescriptionBn?: string | null;
  ogDescriptionEn?: string | null;
  ogImage?: string | null;
  imageAltThumb?: string | null;
  imageAltSqr?: string | null;
  imageNameThumb?: string | null;
  imageNameSqr?: string | null;
  schemaJsonld?: Record<string, unknown> | null;
  slug?: string | null;
}

export interface ScoreContext {
  /** Other course titles in memory, to check uniqueness. */
  existingTitles?: string[];
}

export interface ScoreBreakdown {
  titleLength: number;
  descLength: number;
  keywordUsage: number;
  bilingual: number;
  ogCompleteness: number;
  schema: number;
  imageMeta: number;
  slugSanity: number;
  uniqueness: number;
}

const WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  titleLength: 15,
  descLength: 15,
  keywordUsage: 10,
  bilingual: 15,
  ogCompleteness: 10,
  schema: 15,
  imageMeta: 8,
  slugSanity: 7,
  uniqueness: 5,
};

function withinLen(text: string | null | undefined, min: number, max: number) {
  if (!text) return 0;
  const n = visibleLength(text);
  if (n >= min && n <= max) return 1;
  // Partial credit: close-but-over/under scales down with distance.
  const dist = n < min ? min - n : n - max;
  return Math.max(0, 1 - dist / Math.max(min, 20));
}

export interface ScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
  /** 0..1 fraction per dimension, for UI detail. */
  fractions: ScoreBreakdown;
  issues: string[];
}

export function scoreRecord(
  rec: ScorableRecord,
  ctx: ScoreContext = {}
): ScoreResult {
  const issues: string[] = [];
  const f = {} as ScoreBreakdown;

  // 1. Title length (avg of bn + en compliance)
  const tBn = withinLen(rec.metaTitleBn, LIMITS.titleMin, LIMITS.titleMax);
  const tEn = withinLen(rec.metaTitleEn, LIMITS.titleMin, LIMITS.titleMax);
  f.titleLength = (tBn + tEn) / 2;
  if (tBn < 1) issues.push("Bangla title length outside 30–60");
  if (tEn < 1) issues.push("English title length outside 30–60");

  // 2. Description length
  const dBn = withinLen(rec.metaDescBn, LIMITS.descMin, LIMITS.descMax);
  const dEn = withinLen(rec.metaDescEn, LIMITS.descMin, LIMITS.descMax);
  f.descLength = (dBn + dEn) / 2;
  if (dBn < 1) issues.push("Bangla description length outside 70–160");
  if (dEn < 1) issues.push("English description length outside 70–160");

  // 3. Keyword usage: keywords exist, are <=50 chars, and the primary appears in copy
  const kws = (rec.keywords ?? []).filter((k) => k && k.trim());
  if (kws.length === 0) {
    f.keywordUsage = 0;
    issues.push("No keywords");
  } else {
    const tooLong = kws.filter((k) => visibleLength(k) > LIMITS.keywordMax);
    const corpus = [
      rec.metaTitleBn,
      rec.metaTitleEn,
      rec.metaDescBn,
      rec.metaDescEn,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const primary = kws[0].toLowerCase();
    const present = corpus.includes(primary);
    f.keywordUsage = (present ? 0.7 : 0.3) + (tooLong.length === 0 ? 0.3 : 0);
    if (!present) issues.push("Primary keyword not found in title/description");
    if (tooLong.length) issues.push(`${tooLong.length} keyword(s) exceed 50 chars`);
  }

  // 4. Bilingual completeness: all 4 copy fields present
  const copyFields = [
    rec.metaTitleBn,
    rec.metaTitleEn,
    rec.metaDescBn,
    rec.metaDescEn,
  ];
  const filled = copyFields.filter((x) => x && x.trim()).length;
  f.bilingual = filled / 4;
  if (filled < 4) issues.push(`${4 - filled} bilingual copy field(s) missing`);

  // 5. OG completeness (bilingual title + description + image)
  const ogFields = [
    rec.ogTitleBn,
    rec.ogTitleEn,
    rec.ogDescriptionBn,
    rec.ogDescriptionEn,
    rec.ogImage,
  ];
  const ogFilled = ogFields.filter((x) => x && x.trim()).length;
  f.ogCompleteness = ogFilled / ogFields.length;
  if (ogFilled < ogFields.length) issues.push("Open Graph tags incomplete");

  // 6. Schema validity
  if (rec.schemaJsonld) {
    const v = validateProductSchema(rec.schemaJsonld);
    f.schema = v.valid ? 1 : Math.max(0, 1 - v.errors.length / 5);
    if (!v.valid) issues.push(`Schema: ${v.errors.join(", ")}`);
  } else {
    f.schema = 0;
    issues.push("No JSON-LD schema");
  }

  // 7. Image metadata (alt texts + image names)
  const imgFields = [
    rec.imageAltThumb,
    rec.imageAltSqr,
    rec.imageNameThumb,
    rec.imageNameSqr,
  ];
  f.imageMeta = imgFields.filter((x) => x && x.trim()).length / 4;
  if (f.imageMeta < 1) issues.push("Image alt/name metadata incomplete");

  // 8. Slug sanity
  if (!rec.slug) {
    f.slugSanity = 0;
    issues.push("No slug");
  } else {
    const ok = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rec.slug.trim());
    f.slugSanity = ok ? 1 : 0.4;
    if (!ok) issues.push("Slug should be lowercase, hyphen-separated, no spaces");
  }

  // 9. Uniqueness vs existing titles
  if (ctx.existingTitles && ctx.existingTitles.length) {
    const mine = [rec.metaTitleEn, rec.metaTitleBn]
      .filter(Boolean)
      .map((x) => x!.trim().toLowerCase());
    const dup = mine.some((t) =>
      ctx.existingTitles!.some((e) => e.trim().toLowerCase() === t)
    );
    f.uniqueness = dup ? 0 : 1;
    if (dup) issues.push("Title duplicates an existing course");
  } else {
    f.uniqueness = 1; // no corpus to compare -> assume unique
  }

  // Weighted total
  let total = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof ScoreBreakdown)[]) {
    total += f[key] * WEIGHTS[key];
  }
  const breakdown = {} as ScoreBreakdown;
  for (const key of Object.keys(WEIGHTS) as (keyof ScoreBreakdown)[]) {
    breakdown[key] = Math.round(f[key] * WEIGHTS[key]);
  }

  return {
    total: Math.round(total),
    breakdown,
    fractions: f,
    issues,
  };
}

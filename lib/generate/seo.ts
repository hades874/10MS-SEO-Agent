import { generateObject } from "ai";
import { z } from "zod";
import { draftModel, chatProviderOptions } from "../ai/models";
import { withQuotaRetry } from "../util/throttle";
import { visibleLength } from "../util/lang";
import { LIMITS, scoreRecord, type ScoreResult } from "../score/validate";
import { buildProductSchema, type ProductSchema } from "./buildSchema";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  buildRepairPrompt,
} from "./prompt";
import type {
  CourseInput,
  Exemplar,
  StyleContext,
  GeneratedCopy,
} from "./types";

const copySchema = z.object({
  metaTitleBn: z.string().describe("Bangla meta title, 30–60 visible chars, majority Bangla"),
  metaTitleEn: z.string().describe("English meta title, 30–60 visible chars, majority Latin"),
  metaDescBn: z.string().describe("Bangla meta description, 70–160 visible chars"),
  metaDescEn: z.string().describe("English meta description, 70–160 visible chars"),
  keywords: z.array(z.string()).min(3).max(6).describe("3–6 SEO keywords, each ≤50 chars"),
  ogTitleBn: z.string().describe("Bangla Open Graph title, majority Bangla"),
  ogTitleEn: z.string().describe("English Open Graph title, majority Latin"),
  ogDescriptionBn: z.string().describe("Bangla Open Graph description, majority Bangla"),
  ogDescriptionEn: z.string().describe("English Open Graph description, majority Latin"),
  ogImageAlt: z.string(),
  imageNameThumb: z.string().describe("lowercase hyphenated, ends with -thumbnail"),
  imageNameSqr: z.string().describe("lowercase hyphenated, ends with -sqr-thumbnail"),
  imageAltThumb: z.string(),
  imageAltSqr: z.string(),
});

interface LenRule {
  field: keyof GeneratedCopy;
  min: number;
  max: number;
}

const LEN_RULES: LenRule[] = [
  { field: "metaTitleBn", min: LIMITS.titleMin, max: LIMITS.titleMax },
  { field: "metaTitleEn", min: LIMITS.titleMin, max: LIMITS.titleMax },
  { field: "metaDescBn", min: LIMITS.descMin, max: LIMITS.descMax },
  { field: "metaDescEn", min: LIMITS.descMin, max: LIMITS.descMax },
];

function findViolations(copy: GeneratedCopy) {
  return LEN_RULES.flatMap((r) => {
    const value = copy[r.field] as string;
    const current = visibleLength(value);
    if (current < r.min || current > r.max) {
      return [{ field: r.field, current, min: r.min, max: r.max, value }];
    }
    return [];
  });
}

export interface GenerateResult {
  copy: GeneratedCopy;
  schema: ProductSchema;
  schemaMissing: string[];
  score: ScoreResult;
  repairAttempts: number;
  remainingViolations: number;
}

/**
 * Generate a full bilingual SEO bundle for a course, grounded on retrieved
 * exemplars + house style. Runs a generate→validate→repair loop so character
 * limits are actually enforced (we don't trust the LLM to count Bangla graphemes).
 */
export async function generateSeo(
  input: CourseInput,
  exemplars: Exemplar[],
  style: StyleContext,
  opts: { existingTitles?: string[]; maxRepairs?: number } = {}
): Promise<GenerateResult> {
  const maxRepairs = opts.maxRepairs ?? 2;
  const userPrompt = buildUserPrompt(input, exemplars, style);

  const model = await draftModel();
  const providerOptions = await chatProviderOptions();

  let { object: copy } = await withQuotaRetry(() =>
    generateObject({
      model,
      schema: copySchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      providerOptions,
    })
  );

  let attempts = 0;
  let violations = findViolations(copy);
  while (violations.length > 0 && attempts < maxRepairs) {
    attempts++;
    // Repair is self-contained (no exemplar/style block) to keep tokens low.
    const res = await withQuotaRetry(() =>
      generateObject({
        model,
        schema: copySchema,
        system: SYSTEM_PROMPT,
        prompt: buildRepairPrompt(copy, violations),
        providerOptions,
      })
    );
    copy = res.object;
    violations = findViolations(copy);
  }

  const { schema, missing } = buildProductSchema({
    name: input.name,
    slug: input.slug,
    description: copy.metaDescBn,
    imageUrl: input.imageUrl,
    sku: input.sku,
    price: input.price,
    currency: "BDT",
    isFree: input.isFree,
  });

  const score = scoreRecord(
    {
      metaTitleBn: copy.metaTitleBn,
      metaTitleEn: copy.metaTitleEn,
      metaDescBn: copy.metaDescBn,
      metaDescEn: copy.metaDescEn,
      keywords: copy.keywords,
      ogTitleBn: copy.ogTitleBn,
      ogTitleEn: copy.ogTitleEn,
      ogDescriptionBn: copy.ogDescriptionBn,
      ogDescriptionEn: copy.ogDescriptionEn,
      ogImage: input.imageUrl,
      imageAltThumb: copy.imageAltThumb,
      imageAltSqr: copy.imageAltSqr,
      imageNameThumb: copy.imageNameThumb,
      imageNameSqr: copy.imageNameSqr,
      schemaJsonld: schema as unknown as Record<string, unknown>,
      slug: input.slug,
    },
    { existingTitles: opts.existingTitles }
  );

  return {
    copy,
    schema,
    schemaMissing: missing,
    score,
    repairAttempts: attempts,
    remainingViolations: violations.length,
  };
}

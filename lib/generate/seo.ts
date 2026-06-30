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

// Image *names* are mechanical slugs, not creative copy, so we build them
// deterministically from the course slug (like the JSON-LD) instead of trusting
// the LLM — that guarantees the house pattern (square always carries "-sqr-").
const copySchema = z.object({
  metaTitleBn: z.string().describe("Bangla meta title, 30–60 visible chars, majority Bangla"),
  metaTitleEn: z.string().describe("English meta title, 30–60 visible chars, majority Latin"),
  metaDescBn: z.string().describe("Bangla meta description, 70–160 visible chars"),
  metaDescEn: z.string().describe("English meta description, 70–160 visible chars"),
  keywords: z.array(z.string()).min(3).max(6).describe("3–6 SEO keywords, each ≤50 chars"),
  ogTitleBn: z.string().describe("Bangla Open Graph title, majority Bangla"),
  ogDescriptionBn: z.string().describe("Bangla Open Graph description, majority Bangla"),
  ogImageAlt: z.string(),
  imageAltThumb: z.string().describe('thumbnail alt text, ends with "- thumbnail"'),
  imageAltSqr: z.string().describe('square alt text, ends with "- sqr thumbnail"'),
});

/**
 * House image-name convention (mined from the seed data):
 *   thumbnail → `<slug>-thumbnail`
 *   square    → `<slug>-sqr-thumbnail`
 * Built from the slug, never AI-guessed, so the square name always carries "sqr".
 */
function imageNames(slug: string | null | undefined): {
  imageNameThumb: string;
  imageNameSqr: string;
} {
  const base = (slug ?? "").trim().replace(/-+$/, "") || "course";
  return {
    imageNameThumb: `${base}-thumbnail`,
    imageNameSqr: `${base}-sqr-thumbnail`,
  };
}

type LenField = "metaTitleBn" | "metaTitleEn" | "metaDescBn" | "metaDescEn";

interface LenRule {
  field: LenField;
  min: number;
  max: number;
}

const LEN_RULES: LenRule[] = [
  { field: "metaTitleBn", min: LIMITS.titleMin, max: LIMITS.titleMax },
  { field: "metaTitleEn", min: LIMITS.titleMin, max: LIMITS.titleMax },
  { field: "metaDescBn", min: LIMITS.descMin, max: LIMITS.descMax },
  { field: "metaDescEn", min: LIMITS.descMin, max: LIMITS.descMax },
];

function findViolations(copy: Record<LenField, string>) {
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

  // Interactive flow: cap the retry wait so a hard quota limit surfaces a clear error
  // in a few seconds instead of leaving the user staring at a spinner for ~70s.
  const retryOpts = { retries: 1, maxWaitMs: 10000 } as const;

  let { object: copy } = await withQuotaRetry(
    () =>
      generateObject({
        model,
        schema: copySchema,
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        providerOptions,
      }),
    retryOpts
  );

  let attempts = 0;
  let violations = findViolations(copy);
  while (violations.length > 0 && attempts < maxRepairs) {
    attempts++;
    // Repair is self-contained (no exemplar/style block) to keep tokens low.
    const res = await withQuotaRetry(
      () =>
        generateObject({
          model,
          schema: copySchema,
          system: SYSTEM_PROMPT,
          prompt: buildRepairPrompt(copy, violations),
          providerOptions,
        }),
      retryOpts
    );
    copy = res.object;
    violations = findViolations(copy);
  }

  // Image names are derived from the slug, not the LLM (see imageNames()).
  const fullCopy: GeneratedCopy = { ...copy, ...imageNames(input.slug) };

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
      metaTitleBn: fullCopy.metaTitleBn,
      metaTitleEn: fullCopy.metaTitleEn,
      metaDescBn: fullCopy.metaDescBn,
      metaDescEn: fullCopy.metaDescEn,
      keywords: fullCopy.keywords,
      ogTitleBn: fullCopy.ogTitleBn,
      ogTitleEn: null,
      ogDescriptionBn: fullCopy.ogDescriptionBn,
      ogDescriptionEn: null,
      ogImage: input.imageUrl,
      imageAltThumb: fullCopy.imageAltThumb,
      imageAltSqr: fullCopy.imageAltSqr,
      imageNameThumb: fullCopy.imageNameThumb,
      imageNameSqr: fullCopy.imageNameSqr,
      schemaJsonld: schema as unknown as Record<string, unknown>,
      slug: input.slug,
    },
    { existingTitles: opts.existingTitles }
  );

  return {
    copy: fullCopy,
    schema,
    schemaMissing: missing,
    score,
    repairAttempts: attempts,
    remainingViolations: violations.length,
  };
}

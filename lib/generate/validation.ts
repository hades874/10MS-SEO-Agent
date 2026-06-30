import { z } from "zod";
import type { CourseInput, GeneratedCopy } from "./types";

/**
 * Runtime validation for the data crossing the Server Action boundary. Inputs
 * arrive from the client (forms / fetch) and flow straight into prompts, the
 * embedder, and the DB, so we bound their size here rather than trusting them —
 * an unbounded `name`/`details` would otherwise fail deep inside the AI call.
 *
 * Bounds are deliberately generous (we only reject the absurd); field-level SEO
 * rules stay in the scorer (lib/score/validate.ts).
 */

const shortText = z.string().max(200);
const nullableShort = shortText.nullish();

export const CourseInputSchema = z.object({
  name: z.string().trim().min(1, "Course name is required").max(300),
  details: z.string().max(10_000).optional(),
  level: nullableShort,
  year: nullableShort,
  subject: nullableShort,
  batchType: nullableShort,
  group: nullableShort,
  isFree: z.boolean().optional(),
  duration: nullableShort,
  price: nullableShort,
  sku: nullableShort,
  slug: z.string().max(200).nullish(),
  imageUrl: z.string().max(2000).nullish(),
  targetKeywords: z.array(z.string().max(100)).max(50).optional(),
}) satisfies z.ZodType<CourseInput>;

const copyText = z.string().max(2000);

export const GeneratedCopySchema = z.object({
  metaTitleBn: copyText,
  metaTitleEn: copyText,
  metaDescBn: copyText,
  metaDescEn: copyText,
  keywords: z.array(z.string().max(100)).max(50),
  ogTitleBn: copyText,
  ogTitleEn: copyText.optional(),
  ogDescriptionBn: copyText,
  ogDescriptionEn: copyText.optional(),
  ogImageAlt: copyText,
  imageNameThumb: copyText,
  imageNameSqr: copyText,
  imageAltThumb: copyText,
  imageAltSqr: copyText,
}) satisfies z.ZodType<GeneratedCopy>;

/**
 * Input for the PDP comparison action — two public page URLs and optional target
 * keywords. URLs flow into fetch() and the prompt, so we bound + shape them here.
 */
export const ComparePdpsInputSchema = z.object({
  ourUrl: z.string().trim().min(1, "Your page URL is required").max(2000).url("Your page must be a valid URL"),
  competitorUrls: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(2000)
        .url("Each competitor must be a valid URL")
    )
    .min(1, "Add at least one competitor URL")
    .max(5, "Compare up to 5 competitors at a time"),
  targetKeywords: z.array(z.string().max(100)).max(50).optional(),
});

/** First human-readable issue from a Zod error, prefixed with its field path. */
export function firstIssue(error: z.ZodError): string {
  const i = error.issues[0];
  const path = i.path.join(".");
  return path ? `${path}: ${i.message}` : i.message;
}

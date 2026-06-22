import { generateObject } from "ai";
import { z } from "zod";
import { tagModel, chatProviderOptions } from "./models";

const kwSchema = z.object({
  keywords: z
    .array(z.string())
    .min(2)
    .max(6)
    .describe("SEO keywords a Bangladeshi student would search, each ≤50 chars"),
});

/**
 * The seed CSV has no keywords. On import we AI-back-fill them from the course
 * name + descriptions so memory is complete and the style/keyword features have
 * data from day one. Results are flagged ai_generated for human review.
 */
export async function backfillKeywords(course: {
  name: string;
  metaTitleEn?: string | null;
  metaDescBn?: string | null;
  metaDescEn?: string | null;
}): Promise<string[]> {
  const { object } = await generateObject({
    model: tagModel(),
    schema: kwSchema,
    maxRetries: 0, // let the caller's quota-aware backoff handle rate limits
    providerOptions: chatProviderOptions(),
    prompt: `Generate 3–5 concise SEO keywords for this 10 Minute School course page. Mix Bangla and English/Banglish terms as students actually search. Use ONLY the given facts; do not invent. Each keyword ≤ 50 characters.

Course name: ${course.name}
English title: ${course.metaTitleEn ?? ""}
Bangla description: ${course.metaDescBn ?? ""}
English description: ${course.metaDescEn ?? ""}`,
  });
  return object.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 6);
}

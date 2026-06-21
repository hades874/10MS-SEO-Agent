import type { CourseInput, Exemplar, StyleContext } from "./types";
import { LIMITS } from "../score/validate";

const BRAND_NAME = process.env.BRAND_NAME ?? "10 Minute School";

export const SYSTEM_PROMPT = `You are the senior SEO copywriter for ${BRAND_NAME} (10MS), a Bangladeshi ed-tech platform. You write product SEO metadata for course/program pages, in BOTH Bangla and English, matching the house voice exactly.

Core rules — follow precisely:
1. BANGLA and ENGLISH variants are INDEPENDENTLY keyword-optimized, NOT translations of each other. Each may freely mix Bangla and English/Latin words where that captures how students actually search (e.g. "HSC 28 Science অনলাইন ব্যাচ"). Never produce a literal translation pair.
2. The Bangla meta title/description must be majority-Bangla script; the English ones majority-Latin script.
3. Character limits (count user-visible characters):
   - meta title: ${LIMITS.titleMin}–${LIMITS.titleMax} chars (both languages)
   - meta description: ${LIMITS.descMin}–${LIMITS.descMax} chars (both languages)
   - each keyword: ≤ ${LIMITS.keywordMax} chars
4. GROUNDING: Use ONLY facts provided about the course. Do NOT invent features, subjects, prices, or claims. If a detail isn't given, omit it — never fabricate.
5. Reuse the house phrases/USPs provided when they genuinely fit the course; keep the brand's energetic, exam-prep tone and call-to-action style (e.g. "এনরোল করো এই কোর্সে").
6. image names must be lowercase, hyphen-separated slugs ending in -thumbnail / -sqr-thumbnail. alt texts follow the house pattern "<EN/BN name> - thumbnail".

Return only the structured fields requested.`;

export function buildUserPrompt(
  input: CourseInput,
  exemplars: Exemplar[],
  style: StyleContext
): string {
  const facts = [
    `Name: ${input.name}`,
    input.level && `Level: ${input.level}`,
    input.year && `Year: ${input.year}`,
    input.subject && `Subject: ${input.subject}`,
    input.batchType && `Batch type: ${input.batchType}`,
    input.group && `Group: ${input.group}`,
    typeof input.isFree === "boolean" && `Free course: ${input.isFree}`,
    input.duration && `Duration: ${input.duration}`,
    input.slug && `Slug: ${input.slug}`,
    input.targetKeywords?.length &&
      `Target keywords: ${input.targetKeywords.join(", ")}`,
    input.details && `Details: ${input.details}`,
  ]
    .filter(Boolean)
    .join("\n");

  const exemplarBlock = exemplars
    .slice(0, 4)
    .map((e, i) => {
      return `Example ${i + 1} — ${e.name}
  meta_title_bn: ${e.metaTitleBn ?? ""}
  meta_title_en: ${e.metaTitleEn ?? ""}
  meta_desc_bn: ${e.metaDescBn ?? ""}
  meta_desc_en: ${e.metaDescEn ?? ""}
  keywords: ${(e.keywords ?? []).join(", ")}
  og_title: ${e.ogTitle ?? ""}
  og_description: ${e.ogDescription ?? ""}`;
    })
    .join("\n\n");

  const phraseBlock = style.phrases.length
    ? `House phrases / USPs to reuse where they fit:\n- ${style.phrases.join("\n- ")}`
    : "";
  const templateBlock = style.templates.length
    ? `House templates:\n- ${style.templates.join("\n- ")}`
    : "";
  const brandBlock = style.brandRules.length
    ? `Brand rules:\n- ${style.brandRules.join("\n- ")}`
    : "";

  return `Write the SEO metadata for this new course.

COURSE FACTS:
${facts}

${phraseBlock}
${templateBlock}
${brandBlock}

MOST SIMILAR PAST COURSES (match this style — but do NOT copy their specifics):
${exemplarBlock || "(none retrieved)"}

Produce: meta title (bn+en), meta description (bn+en), 3–6 keywords, og title, og description, og image alt, image names (thumbnail + square), image alt texts (thumbnail + square). Respect every character limit.`;
}

/** A focused repair instruction listing only the fields that broke length limits. */
export function buildRepairPrompt(
  violations: Array<{ field: string; current: number; min: number; max: number; value: string }>
): string {
  const lines = violations
    .map(
      (v) =>
        `- ${v.field}: currently ${v.current} chars, must be ${v.min}–${v.max}. Current value: "${v.value}"`
    )
    .join("\n");
  return `Some fields are outside their character limits. Rewrite ONLY these fields to fit, preserving meaning, language (Bangla stays Bangla, English stays English), and keywords:\n${lines}\n\nReturn the full set of fields again with these fixed.`;
}

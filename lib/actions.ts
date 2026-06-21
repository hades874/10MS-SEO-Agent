"use server";

import { revalidatePath } from "next/cache";
import { getDb, isDbConfigured } from "./db";
import { courses, seoRecords, seoEmbeddings } from "./db/schema";
import { eq } from "drizzle-orm";
import { deriveFacets } from "./util/facets";
import { suggestSlug } from "./util/slug";
import { isAiConfigured } from "./ai/models";
import { embedText, buildEmbedSourceText } from "./ai/embed";
import { generateSeo, type GenerateResult } from "./generate/seo";
import { recallExemplars, loadStyleContext, existingTitles } from "./memory/recall";
import { parseSeedCsv } from "./memory/parseCsv";
import { importCourses } from "./memory/importCourses";
import type { CourseInput, GeneratedCopy } from "./generate/types";

export interface GenerateActionResult {
  ok: boolean;
  error?: string;
  result?: GenerateResult;
  exemplarNames?: string[];
  input?: CourseInput;
}

/** Generate (but do not save) a full SEO bundle for a new course. */
export async function generateForNewCourse(
  raw: CourseInput
): Promise<GenerateActionResult> {
  try {
    if (!isAiConfigured()) {
      return {
        ok: false,
        error:
          "AI not configured. Add GOOGLE_GENERATIVE_AI_API_KEY to .env.local (free key at https://aistudio.google.com/apikey).",
      };
    }
    const facets = deriveFacets(raw.name, raw.slug);
    const input: CourseInput = {
      ...raw,
      level: raw.level ?? facets.level,
      year: raw.year ?? facets.year,
      subject: raw.subject ?? facets.subject,
      batchType: raw.batchType ?? facets.batchType,
      group: raw.group ?? facets.group,
      isFree: raw.isFree ?? facets.isFree,
      slug: raw.slug?.trim() || suggestSlug(facets, raw.name),
    };

    const [exemplars, style, titles] = isDbConfigured()
      ? await Promise.all([
          recallExemplars(input, 4),
          loadStyleContext(12),
          existingTitles(),
        ])
      : [[], { phrases: [], templates: [], brandRules: [] }, []];

    const result = await generateSeo(input, exemplars, style, {
      existingTitles: titles,
    });

    return {
      ok: true,
      result,
      exemplarNames: exemplars.map((e) => e.name),
      input,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface SaveActionResult {
  ok: boolean;
  error?: string;
  courseId?: number;
}

/** Persist a generated/edited bundle as a new course + SEO record (+ embedding). */
export async function saveCourse(
  input: CourseInput,
  copy: GeneratedCopy,
  schema: Record<string, unknown>,
  validationScore: number,
  publish: boolean
): Promise<SaveActionResult> {
  try {
    if (!isDbConfigured()) {
      return { ok: false, error: "Database not configured (set DATABASE_URL)." };
    }
    const db = getDb();
    const facets = deriveFacets(input.name, input.slug);
    const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "https://10minuteschool.com";
    const slug = input.slug?.trim() || suggestSlug(facets, input.name);

    const [course] = await db
      .insert(courses)
      .values({
        name: input.name,
        slug,
        level: input.level ?? facets.level,
        year: input.year ?? facets.year,
        subject: input.subject ?? facets.subject,
        batchType: input.batchType ?? facets.batchType,
        group: input.group ?? facets.group,
        isFree: input.isFree ?? facets.isFree,
        duration: input.duration,
        price: input.price,
        sku: input.sku,
        imageUrl: input.imageUrl,
        productUrl: slug ? `${SITE_ORIGIN}/product/${slug}` : null,
        completeness: "full",
        source: "app",
        status: publish ? "live" : "draft",
        launchedAt: publish ? new Date() : null,
      })
      .returning({ id: courses.id });

    await db.insert(seoRecords).values({
      courseId: course.id,
      version: 1,
      metaTitleBn: copy.metaTitleBn,
      metaTitleEn: copy.metaTitleEn,
      metaDescBn: copy.metaDescBn,
      metaDescEn: copy.metaDescEn,
      keywords: copy.keywords,
      ogTitle: copy.ogTitle,
      ogDescription: copy.ogDescription,
      ogImage: input.imageUrl,
      ogImageAlt: copy.ogImageAlt,
      imageNameThumb: copy.imageNameThumb,
      imageNameSqr: copy.imageNameSqr,
      imageAltThumb: copy.imageAltThumb,
      imageAltSqr: copy.imageAltSqr,
      schemaJsonld: schema,
      validationScore,
      aiGenerated: true,
      isPublished: publish,
    });

    if (isAiConfigured()) {
      try {
        const sourceText = buildEmbedSourceText({
          name: input.name,
          metaDescBn: copy.metaDescBn,
          metaDescEn: copy.metaDescEn,
          keywords: copy.keywords,
        });
        const embedding = await embedText(sourceText);
        await db
          .insert(seoEmbeddings)
          .values({ courseId: course.id, sourceText, embedding });
      } catch {
        /* embedding optional */
      }
    }

    revalidatePath("/");
    return { ok: true, courseId: course.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface ImportActionResult {
  ok: boolean;
  error?: string;
  summary?: Awaited<ReturnType<typeof importCourses>>;
}

/** Import a CSV (the seed format) uploaded from the UI. */
export async function runImport(csvText: string): Promise<ImportActionResult> {
  try {
    if (!isDbConfigured()) {
      return { ok: false, error: "Database not configured (set DATABASE_URL)." };
    }
    const parsed = parseSeedCsv(csvText);
    const summary = await importCourses(parsed, { withAi: true, resetSeed: true });
    revalidatePath("/");
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Delete a course (and its cascade) from memory. */
export async function deleteCourse(courseId: number): Promise<{ ok: boolean }> {
  if (!isDbConfigured()) return { ok: false };
  const db = getDb();
  await db.delete(courses).where(eq(courses.id, courseId));
  revalidatePath("/");
  return { ok: true };
}

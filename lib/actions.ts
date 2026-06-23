"use server";

import { revalidatePath } from "next/cache";
import { getDb, isDbConfigured } from "./db";
import {
  courses,
  seoRecords,
  seoEmbeddings,
  keywordResearch,
  validationScores,
  type Course,
} from "./db/schema";
import { eq } from "drizzle-orm";
import { type KeywordResearch } from "./keywords/autocomplete";
import { researchKeywordVia, activeKeywordProvider } from "./keywords/provider";
import { analyzeCompetitors, type AnalyzeResult } from "./competitors/analyze";
import { trackCourse, type TrackResult } from "./track";
import { getCourseDetail, getCourseVersions } from "./queries";
import { deriveFacets } from "./util/facets";
import { suggestSlug } from "./util/slug";
import { isAiConfigured } from "./ai/models";
import { embedText, buildEmbedSourceText } from "./ai/embed";
import { generateSeo, type GenerateResult } from "./generate/seo";
import { buildProductSchema } from "./generate/buildSchema";
import {
  CourseInputSchema,
  GeneratedCopySchema,
  firstIssue,
} from "./generate/validation";
import { scoreRecord, type ScoreResult } from "./score/validate";
import { recallExemplars, loadStyleContext, existingTitles } from "./memory/recall";
import { parseSeedCsv } from "./memory/parseCsv";
import { importCourses } from "./memory/importCourses";
import type { CourseInput, GeneratedCopy } from "./generate/types";

type Db = ReturnType<typeof getDb>;

/**
 * Persist one SEO record version for a course: rebuild the JSON-LD deterministically,
 * re-score, insert the record, refresh the embedding, and write validation history.
 * Shared by saveCourse (v1) and updateCourseSeo (vN) so they stay consistent.
 */
async function writeSeoVersion(
  db: Db,
  args: {
    course: Pick<
      Course,
      "id" | "name" | "slug" | "imageUrl" | "sku" | "price" | "currency" | "isFree"
    >;
    version: number;
    copy: GeneratedCopy;
    publish: boolean;
    aiGenerated: boolean;
  }
): Promise<{ schema: Record<string, unknown>; score: ScoreResult; warnings: string[] }> {
  const { course, version, copy, publish, aiGenerated } = args;
  const warnings: string[] = [];

  // JSON-LD is always derived from stored facts, never the client/LLM.
  const built = buildProductSchema({
    name: course.name,
    slug: course.slug,
    description: copy.metaDescBn,
    imageUrl: course.imageUrl,
    sku: course.sku,
    price: course.price,
    currency: course.currency,
    isFree: course.isFree ?? false,
  });
  const schema = built.schema as unknown as Record<string, unknown>;

  // Uniqueness check excludes this course's own (prior) versions.
  let titles: string[] = [];
  try {
    titles = await existingTitles(course.id);
  } catch (e) {
    // Scoring still works without the uniqueness corpus — just note it.
    warnings.push("uniqueness corpus unavailable");
    console.error(`writeSeoVersion: existingTitles failed for course ${course.id}:`, e);
  }
  const score = scoreRecord(
    {
      metaTitleBn: copy.metaTitleBn,
      metaTitleEn: copy.metaTitleEn,
      metaDescBn: copy.metaDescBn,
      metaDescEn: copy.metaDescEn,
      keywords: copy.keywords,
      ogTitle: copy.ogTitle,
      ogDescription: copy.ogDescription,
      ogImage: course.imageUrl,
      imageAltThumb: copy.imageAltThumb,
      imageAltSqr: copy.imageAltSqr,
      imageNameThumb: copy.imageNameThumb,
      imageNameSqr: copy.imageNameSqr,
      schemaJsonld: schema,
      slug: course.slug,
    },
    { existingTitles: titles }
  );

  // Compute the embedding BEFORE the transaction — it's a network/AI call that
  // can be slow or fail on quota, and we don't want to hold a DB tx open for it.
  // Embedding is enrichment for recall, so a failure here is non-fatal: we still
  // persist the record + history, just without refreshing the vector.
  let embedding: number[] | null = null;
  let sourceText = "";
  if (isAiConfigured()) {
    try {
      sourceText = buildEmbedSourceText({
        name: course.name,
        metaDescBn: copy.metaDescBn,
        metaDescEn: copy.metaDescEn,
        keywords: copy.keywords,
      });
      embedding = await embedText(sourceText);
    } catch (e) {
      warnings.push("embedding not refreshed");
      console.error(`writeSeoVersion: embedText failed for course ${course.id}:`, e);
    }
  }

  // All DB writes are atomic: the record, the refreshed embedding, and the score
  // history commit together or not at all (no stale/orphaned state on a crash).
  await db.transaction(async (tx) => {
    await tx.insert(seoRecords).values({
      courseId: course.id,
      version,
      metaTitleBn: copy.metaTitleBn,
      metaTitleEn: copy.metaTitleEn,
      metaDescBn: copy.metaDescBn,
      metaDescEn: copy.metaDescEn,
      keywords: copy.keywords,
      ogTitle: copy.ogTitle,
      ogDescription: copy.ogDescription,
      ogImage: course.imageUrl,
      ogImageAlt: copy.ogImageAlt,
      imageNameThumb: copy.imageNameThumb,
      imageNameSqr: copy.imageNameSqr,
      imageAltThumb: copy.imageAltThumb,
      imageAltSqr: copy.imageAltSqr,
      schemaJsonld: schema,
      validationScore: score.total,
      aiGenerated,
      isPublished: publish,
    });

    // Refresh the embedding (one per course) via upsert on the unique courseId.
    if (embedding) {
      await tx
        .insert(seoEmbeddings)
        .values({ courseId: course.id, sourceText, embedding })
        .onConflictDoUpdate({
          target: seoEmbeddings.courseId,
          set: { sourceText, embedding, createdAt: new Date() },
        });
    }

    // Validation score history (one row per version).
    await tx.insert(validationScores).values({
      courseId: course.id,
      recordVersion: version,
      breakdown: score.breakdown as unknown as Record<string, number>,
      total: score.total,
    });
  });

  return { schema, score, warnings };
}

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
    const parsed = CourseInputSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: `Invalid course input — ${firstIssue(parsed.error)}` };
    }
    raw = parsed.data;
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
          recallExemplars(input, 2),
          loadStyleContext(6),
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
    const msg = (e as Error).message ?? "";
    if (/high.?demand|overload|temporarily|\b503\b|\b529\b|unavailable/i.test(msg)) {
      return {
        ok: false,
        error:
          "The AI model is temporarily busy (high demand). We retried automatically — please try generating again in a moment.",
      };
    }
    return { ok: false, error: msg };
  }
}

export interface SaveActionResult {
  ok: boolean;
  error?: string;
  courseId?: number;
  warnings?: string[];
}

/** Persist a generated/edited bundle as a new course + SEO record v1 (+ embedding). */
export async function saveCourse(
  input: CourseInput,
  copy: GeneratedCopy,
  publish: boolean
): Promise<SaveActionResult> {
  try {
    if (!isDbConfigured()) {
      return { ok: false, error: "Database not configured (set DATABASE_URL)." };
    }
    const parsedInput = CourseInputSchema.safeParse(input);
    if (!parsedInput.success) {
      return { ok: false, error: `Invalid course input — ${firstIssue(parsedInput.error)}` };
    }
    const parsedCopy = GeneratedCopySchema.safeParse(copy);
    if (!parsedCopy.success) {
      return { ok: false, error: `Invalid SEO copy — ${firstIssue(parsedCopy.error)}` };
    }
    input = parsedInput.data;
    copy = parsedCopy.data;
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
      .returning();

    const { warnings } = await writeSeoVersion(db, {
      course,
      version: 1,
      copy,
      publish,
      aiGenerated: true,
    });

    revalidatePath("/");
    return { ok: true, courseId: course.id, warnings };
  } catch (e) {
    console.error("saveCourse failed:", e);
    return { ok: false, error: (e as Error).message };
  }
}

export interface UpdateActionResult {
  ok: boolean;
  error?: string;
  version?: number;
  score?: number;
  warnings?: string[];
}

/** Save human edits to an existing course as a NEW seo_record version (vN+1). */
export async function updateCourseSeo(
  courseId: number,
  copy: GeneratedCopy,
  publish: boolean
): Promise<UpdateActionResult> {
  try {
    if (!isDbConfigured()) {
      return { ok: false, error: "Database not configured (set DATABASE_URL)." };
    }
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return { ok: false, error: "Invalid course id." };
    }
    const parsedCopy = GeneratedCopySchema.safeParse(copy);
    if (!parsedCopy.success) {
      return { ok: false, error: `Invalid SEO copy — ${firstIssue(parsedCopy.error)}` };
    }
    copy = parsedCopy.data;
    const db = getDb();
    const detail = await getCourseDetail(courseId);
    if (!detail) return { ok: false, error: "Course not found." };
    const { course } = detail;

    const versions = await getCourseVersions(courseId);
    const nextVersion = (versions[0]?.version ?? 0) + 1;

    const { score, warnings } = await writeSeoVersion(db, {
      course,
      version: nextVersion,
      copy,
      publish,
      aiGenerated: false, // human-reviewed edit
    });

    // Promoting an edited version to publish also flips the course live.
    if (publish && course.status !== "live") {
      await db
        .update(courses)
        .set({ status: "live", launchedAt: course.launchedAt ?? new Date() })
        .where(eq(courses.id, courseId));
    }

    revalidatePath(`/courses/${courseId}`);
    revalidatePath("/");
    return { ok: true, version: nextVersion, score: score.total, warnings };
  } catch (e) {
    console.error("updateCourseSeo failed:", e);
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
    console.error("runImport failed:", e);
    return { ok: false, error: (e as Error).message };
  }
}

export interface KeywordActionResult {
  ok: boolean;
  error?: string;
  research?: KeywordResearch;
}

/** Run free keyword research (Google Autocomplete) and cache it. */
export async function keywordResearchAction(
  seed: string,
  expand = true
): Promise<KeywordActionResult> {
  try {
    if (!seed.trim()) return { ok: false, error: "Enter a seed keyword." };
    const research = await researchKeywordVia(seed.trim(), { expand });
    if (isDbConfigured()) {
      try {
        await getDb().insert(keywordResearch).values({
          seedKeyword: research.seed,
          suggestions: research.suggestions,
          related: research.related,
          approxDemandSignal: research.demandSignal,
          source: activeKeywordProvider(),
        });
      } catch (e) {
        // Caching is best-effort; the research result is still returned.
        console.error(`keywordResearchAction: cache write failed for "${research.seed}":`, e);
      }
    }
    return { ok: true, research };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface CompetitorActionResult {
  ok: boolean;
  error?: string;
  result?: AnalyzeResult;
}

/** Analyze BD ed-tech competitors for a keyword (discover, parse, score, cache). */
export async function analyzeCompetitorsAction(
  keyword: string,
  targetKeywords: string[] = []
): Promise<CompetitorActionResult> {
  try {
    if (!keyword.trim()) return { ok: false, error: "No keyword to analyze." };
    const result = await analyzeCompetitors(keyword.trim(), targetKeywords);
    return { ok: true, result };
  } catch (e) {
    console.error("analyzeCompetitorsAction failed:", e);
    return { ok: false, error: (e as Error).message };
  }
}

export interface TrackActionResult {
  ok: boolean;
  error?: string;
  result?: TrackResult;
}

/** Manually run rank + AI-visibility tracking for a course now. */
export async function trackCourseAction(
  courseId: number
): Promise<TrackActionResult> {
  try {
    if (!isDbConfigured()) return { ok: false, error: "Database not configured." };
    const detail = await getCourseDetail(courseId);
    if (!detail) return { ok: false, error: "Course not found." };
    const { course, record } = detail;
    if (!(record?.keywords ?? []).length) {
      return { ok: false, error: "Course has no keywords to track." };
    }
    const result = await trackCourse({
      courseId,
      productUrl: course.productUrl,
      keywords: record!.keywords,
      level: course.level,
      year: course.year,
      subject: course.subject,
    });
    revalidatePath(`/courses/${courseId}`);
    return { ok: true, result };
  } catch (e) {
    console.error("trackCourseAction failed:", e);
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

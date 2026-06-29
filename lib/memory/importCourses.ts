import { getDb } from "../db";
import { courses, seoRecords, seoEmbeddings, styleMemory } from "../db/schema";
import { eq } from "drizzle-orm";
import type { ParsedCourse } from "./parseCsv";
import { deriveFacets } from "../util/facets";
import { deriveKeywords } from "../util/keywords";
import { detectLang } from "../util/lang";
import { mineStyle } from "./styleMine";
import { isAiConfigured, isEmbeddingConfigured } from "../ai/models";
import { backfillKeywords } from "../ai/backfill";
import { embedText, buildEmbedSourceText } from "../ai/embed";
import { buildProductSchema } from "../generate/buildSchema";
import { scoreRecord } from "../score/validate";
import { sleep, withQuotaRetry } from "../util/throttle";

const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "https://10minuteschool.com";
// Free-tier Gemini caps requests/minute; space out AI calls to stay under it.
const THROTTLE_MS = Number(process.env.IMPORT_THROTTLE_MS ?? 6500);

export interface ImportOptions {
  withAi?: boolean; // create embeddings (requires a Google key)
  backfillKw?: boolean; // also AI-backfill keywords inline (slow on free tier; default off)
  resetSeed?: boolean; // wipe previous csv_seed rows first
  onProgress?: (msg: string) => void;
}

export interface ImportSummary {
  inserted: number;
  aiBackfilled: number;
  embedded: number;
  stylePhrases: number;
  skipped: number;
}

export async function importCourses(
  parsed: ParsedCourse[],
  opts: ImportOptions = {}
): Promise<ImportSummary> {
  const db = getDb();
  const useAi = (opts.withAi ?? true) && (await isAiConfigured());
  const log = opts.onProgress ?? (() => {});

  if (opts.resetSeed) {
    await db.delete(courses).where(eq(courses.source, "csv_seed"));
    // seo_records / embeddings cascade via FK on delete.
    log("Cleared previous csv_seed rows");
  }

  const summary: ImportSummary = {
    inserted: 0,
    aiBackfilled: 0,
    embedded: 0,
    stylePhrases: 0,
    skipped: 0,
  };

  for (const p of parsed) {
    if (!p.name) {
      summary.skipped++;
      continue;
    }
    const facets = deriveFacets(p.name, p.slug);
    const productUrl = p.slug ? `${SITE_ORIGIN}/product/${p.slug}` : null;

    const [course] = await db
      .insert(courses)
      .values({
        name: p.name,
        slug: p.slug,
        level: facets.level,
        year: facets.year,
        subject: facets.subject,
        batchType: facets.batchType,
        group: facets.group,
        isFree: facets.isFree,
        imageUrl: p.imageUrl,
        productUrl,
        completeness: p.completeness,
        source: "csv_seed",
        status: "draft",
      })
      .returning({ id: courses.id });

    // Keywords: deterministic by default (CSV has none, and this avoids the
    // free-tier rate-limit bottleneck). AI back-fill upgrades these when run.
    let keywords: string[] | null = deriveKeywords(facets, p.name);
    let aiGenerated = false;
    if (opts.backfillKw && useAi && (p.metaDescBn || p.metaDescEn || p.metaTitleEn)) {
      try {
        keywords = await withQuotaRetry(
          () =>
            backfillKeywords({
              name: p.name,
              metaTitleEn: p.metaTitleEn,
              metaDescBn: p.metaDescBn,
              metaDescEn: p.metaDescEn,
            }),
          { onWait: (ms) => log(`Rate limited — waiting ${Math.round(ms / 1000)}s…`) }
        );
        aiGenerated = true;
        summary.aiBackfilled++;
      } catch (e) {
        log(`Keyword backfill failed for "${p.name}": ${(e as Error).message}`);
      }
      if (THROTTLE_MS > 0) await sleep(THROTTLE_MS);
    }

    // Deterministic schema (price/sku unknown from CSV -> flagged, not invented)
    const { schema } = buildProductSchema({
      name: p.name,
      slug: p.slug,
      description: p.metaDescBn ?? p.ogDescription,
      imageUrl: p.imageUrl,
      isFree: facets.isFree,
    });

    // OG mirrors the bilingual meta; the seed's single og:* value is a fallback,
    // placed into the bn/en slot that matches its actual script.
    const ogTitleBn = p.metaTitleBn ?? (detectLang(p.ogTitle) === "bn" ? p.ogTitle : null);
    const ogTitleEn = p.metaTitleEn ?? (detectLang(p.ogTitle) === "en" ? p.ogTitle : null);
    const ogDescriptionBn = p.metaDescBn ?? (detectLang(p.ogDescription) === "bn" ? p.ogDescription : null);
    const ogDescriptionEn = p.metaDescEn ?? (detectLang(p.ogDescription) === "en" ? p.ogDescription : null);

    const recordValues = {
      courseId: course.id,
      version: 1,
      metaTitleBn: p.metaTitleBn,
      metaTitleEn: p.metaTitleEn,
      metaDescBn: p.metaDescBn,
      metaDescEn: p.metaDescEn,
      keywords,
      ogTitleBn,
      ogTitleEn,
      ogDescriptionBn,
      ogDescriptionEn,
      ogImage: p.imageUrl,
      ogImageAlt: p.imageAltThumb,
      imageNameThumb: p.imageNameThumb,
      imageNameSqr: p.imageNameSqr,
      imageAltThumb: p.imageAltThumb,
      imageAltSqr: p.imageAltSqr,
      schemaJsonld: schema as unknown as Record<string, unknown>,
      aiGenerated,
      isPublished: false,
    };

    const score = scoreRecord(recordValues);

    await db
      .insert(seoRecords)
      .values({ ...recordValues, validationScore: score.total });

    // Embedding for semantic recall (requires a Google key)
    if (await isEmbeddingConfigured()) {
      try {
        const sourceText = buildEmbedSourceText({
          name: p.name,
          metaDescBn: p.metaDescBn,
          metaDescEn: p.metaDescEn,
          keywords,
        });
        const embedding = await withQuotaRetry(() => embedText(sourceText));
        await db.insert(seoEmbeddings).values({
          courseId: course.id,
          sourceText,
          embedding,
        });
        summary.embedded++;
      } catch (e) {
        log(`Embedding failed for "${p.name}": ${(e as Error).message}`);
      }
    }

    summary.inserted++;
    log(`Imported: ${p.name} (score ${score.total})`);
  }

  // Mine + store house style
  const mined = mineStyle(parsed);
  if (opts.resetSeed) {
    await db.delete(styleMemory);
  }
  if (mined.length) {
    await db.insert(styleMemory).values(
      mined.map((m) => ({
        kind: m.kind,
        language: m.language,
        value: m.value,
        frequency: m.frequency,
        isCurated: m.isCurated,
      }))
    );
    summary.stylePhrases = mined.filter((m) => m.kind === "phrase").length;
  }

  return summary;
}

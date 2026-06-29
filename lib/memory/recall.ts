import { and, desc, eq, sql, inArray, ne } from "drizzle-orm";
import { getDb } from "../db";
import { courses, seoRecords, seoEmbeddings, styleMemory } from "../db/schema";
import { embedText } from "../ai/embed";
import type { Exemplar, StyleContext, CourseInput } from "../generate/types";

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/**
 * Facet-first + vector recall. The seed corpus is small, so we filter by facets
 * (level/subject/batch_type, progressively relaxed) BEFORE ranking by embedding
 * cosine distance — pure vector search over ~20 rows is noisy.
 */
export async function recallExemplars(
  input: CourseInput,
  k = 4,
  excludeCourseId?: number
): Promise<Exemplar[]> {
  const db = getDb();

  // Candidate set by facets (only complete records make good exemplars).
  const facetConds = [eq(courses.completeness, "full")];
  if (excludeCourseId) facetConds.push(ne(courses.id, excludeCourseId));

  // Build a relevance ranking: same subject+level scores highest.
  const candidates = await db
    .select({ id: courses.id, subject: courses.subject, level: courses.level, batchType: courses.batchType })
    .from(courses)
    .where(and(...facetConds));

  const ranked = candidates
    .map((c) => {
      let s = 0;
      if (input.subject && c.subject === input.subject) s += 3;
      if (input.level && c.level === input.level) s += 2;
      if (input.batchType && c.batchType === input.batchType) s += 1;
      return { id: c.id, s };
    })
    .sort((a, b) => b.s - a.s);

  // Take a facet-preferred pool, then refine by vector distance within it.
  const poolIds = ranked.slice(0, Math.max(k * 3, 8)).map((r) => r.id);
  const idsForVector = poolIds.length ? poolIds : candidates.map((c) => c.id);

  let orderedIds = idsForVector.slice(0, k);

  try {
    const queryText = [input.name, input.details, (input.targetKeywords ?? []).join(", ")]
      .filter(Boolean)
      .join("\n");
    const qvec = await embedText(queryText);
    const lit = toVectorLiteral(qvec);
    const rows = await db
      .select({
        courseId: seoEmbeddings.courseId,
        dist: sql<number>`${seoEmbeddings.embedding} <=> ${lit}::vector`,
      })
      .from(seoEmbeddings)
      .where(idsForVector.length ? inArray(seoEmbeddings.courseId, idsForVector) : undefined)
      .orderBy(sql`${seoEmbeddings.embedding} <=> ${lit}::vector`)
      .limit(k);
    if (rows.length) orderedIds = rows.map((r) => r.courseId);
  } catch {
    // No embeddings / AI not configured: fall back to facet ordering.
  }

  if (orderedIds.length === 0) return [];

  const records = await db
    .select({
      courseId: seoRecords.courseId,
      name: courses.name,
      metaTitleBn: seoRecords.metaTitleBn,
      metaTitleEn: seoRecords.metaTitleEn,
      metaDescBn: seoRecords.metaDescBn,
      metaDescEn: seoRecords.metaDescEn,
      keywords: seoRecords.keywords,
      slug: courses.slug,
      version: seoRecords.version,
    })
    .from(seoRecords)
    .innerJoin(courses, eq(courses.id, seoRecords.courseId))
    .where(inArray(seoRecords.courseId, orderedIds))
    .orderBy(desc(seoRecords.version));

  // Keep latest version per course, preserve vector order.
  const byCourse = new Map<number, Exemplar>();
  for (const r of records) {
    if (!byCourse.has(r.courseId)) {
      byCourse.set(r.courseId, {
        name: r.name,
        metaTitleBn: r.metaTitleBn,
        metaTitleEn: r.metaTitleEn,
        metaDescBn: r.metaDescBn,
        metaDescEn: r.metaDescEn,
        keywords: r.keywords ?? undefined,
        slug: r.slug,
      });
    }
  }
  return orderedIds.map((id) => byCourse.get(id)).filter((x): x is Exemplar => Boolean(x));
}

/** Load the house-style context (curated rules + top mined phrases) for prompting. */
export async function loadStyleContext(limitPhrases = 6): Promise<StyleContext> {
  const db = getDb();
  const rows = await db
    .select()
    .from(styleMemory)
    .orderBy(desc(styleMemory.isCurated), desc(styleMemory.frequency));

  const phrases = rows
    .filter((r) => r.kind === "phrase")
    .slice(0, limitPhrases)
    .map((r) => r.value);
  const templates = rows.filter((r) => r.kind === "template").map((r) => r.value);
  const brandRules = rows.filter((r) => r.kind === "brand_rule").map((r) => r.value);

  return { phrases, templates, brandRules };
}

/** All existing course titles, for the uniqueness check in scoring. */
export async function existingTitles(excludeCourseId?: number): Promise<string[]> {
  const db = getDb();
  const conds = excludeCourseId ? [ne(seoRecords.courseId, excludeCourseId)] : [];
  const rows = await db
    .select({ en: seoRecords.metaTitleEn, bn: seoRecords.metaTitleBn })
    .from(seoRecords)
    .where(conds.length ? and(...conds) : undefined);
  return rows.flatMap((r) => [r.en, r.bn]).filter((x): x is string => Boolean(x));
}

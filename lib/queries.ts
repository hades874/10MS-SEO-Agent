import { getDb, isDbConfigured } from "./db";
import {
  courses,
  seoRecords,
  rankChecks,
  aiVisibilityChecks,
  type SeoRecord,
} from "./db/schema";
import { desc, eq, and } from "drizzle-orm";

export interface CourseListItem {
  id: number;
  name: string;
  slug: string | null;
  level: string | null;
  subject: string | null;
  batchType: string | null;
  status: string | null;
  completeness: string | null;
  score: number | null;
}

export async function listCourses(): Promise<CourseListItem[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: courses.id,
      name: courses.name,
      slug: courses.slug,
      level: courses.level,
      subject: courses.subject,
      batchType: courses.batchType,
      status: courses.status,
      completeness: courses.completeness,
      score: seoRecords.validationScore,
    })
    .from(courses)
    .leftJoin(seoRecords, eq(seoRecords.courseId, courses.id))
    .orderBy(desc(courses.createdAt));

  // Collapse to one row per course (keep highest score if multiple records)
  const byId = new Map<number, CourseListItem>();
  for (const r of rows) {
    const existing = byId.get(r.id);
    if (!existing) byId.set(r.id, r);
    else if ((r.score ?? -1) > (existing.score ?? -1)) byId.set(r.id, r);
  }
  return [...byId.values()];
}

export async function getCourseDetail(id: number) {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, id));
  if (!course) return null;
  const records = await db
    .select()
    .from(seoRecords)
    .where(eq(seoRecords.courseId, id))
    .orderBy(desc(seoRecords.version));
  return { course, record: records[0] ?? null };
}

/** All SEO record versions for a course, newest first (for version history + diff). */
export async function getCourseVersions(courseId: number): Promise<SeoRecord[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db
    .select()
    .from(seoRecords)
    .where(eq(seoRecords.courseId, courseId))
    .orderBy(desc(seoRecords.version));
}

/** Latest rank checks (one per keyword) + latest AI-visibility for a course. */
export async function getTracking(courseId: number) {
  if (!isDbConfigured()) return { ranks: [], aivis: [] };
  const db = getDb();
  const ranks = await db
    .select()
    .from(rankChecks)
    .where(eq(rankChecks.courseId, courseId))
    .orderBy(desc(rankChecks.checkedAt))
    .limit(30);
  const aivis = await db
    .select()
    .from(aiVisibilityChecks)
    .where(and(eq(aiVisibilityChecks.courseId, courseId)))
    .orderBy(desc(aiVisibilityChecks.sampledAt))
    .limit(10);

  // Keep the most recent entry per keyword / per engine.
  const latestRankByKw = new Map<string, (typeof ranks)[number]>();
  for (const r of ranks) if (!latestRankByKw.has(r.query)) latestRankByKw.set(r.query, r);
  const latestAiByEngine = new Map<string, (typeof aivis)[number]>();
  for (const a of aivis) if (!latestAiByEngine.has(a.engine)) latestAiByEngine.set(a.engine, a);

  return {
    ranks: [...latestRankByKw.values()],
    aivis: [...latestAiByEngine.values()],
  };
}

import { getDb, isDbConfigured } from "./db";
import { courses, seoRecords } from "./db/schema";
import { desc, eq } from "drizzle-orm";

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

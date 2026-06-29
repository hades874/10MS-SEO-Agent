import { NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/db";
import { courses, rankChecks } from "@/lib/db/schema";
import { and, eq, desc, lt, or, isNull } from "drizzle-orm";
import { trackCourse } from "@/lib/track";
import { getCourseDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000;

/**
 * 3-week rank + AI-visibility re-check. Wired to Vercel Cron (vercel.ts, daily); it
 * only re-checks LIVE courses whose last check is older than 21 days, so the cadence
 * lives here, not in the cron string. Protect with CRON_SECRET in production.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: "db not configured" }, { status: 503 });
  }

  const db = getDb();
  const cutoff = new Date(Date.now() - THREE_WEEKS_MS);

  // Step 1: find live courses whose most recent rank check is missing or older than 3 weeks.
  // We intentionally do NOT join seoRecords here — a course may have multiple versions,
  // and the ORDER BY on rankChecks.checkedAt does not correlate with seoRecords.version,
  // so the de-dup would pick an arbitrary (potentially stale) version's keywords.
  const dueRaw = await db
    .select({
      id: courses.id,
      productUrl: courses.productUrl,
      level: courses.level,
      year: courses.year,
      subject: courses.subject,
      lastChecked: rankChecks.checkedAt,
    })
    .from(courses)
    .leftJoin(rankChecks, eq(rankChecks.courseId, courses.id))
    .where(
      and(
        eq(courses.status, "live"),
        or(isNull(rankChecks.checkedAt), lt(rankChecks.checkedAt, cutoff))
      )
    )
    .orderBy(desc(rankChecks.checkedAt));

  // De-dupe to one row per course (a course may join many rank rows).
  const seen = new Set<number>();
  const due = dueRaw.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));

  const checked: { courseId: number; bestPosition: number | null; aiMentioned: boolean }[] = [];
  for (const c of due) {
    try {
      // Step 2: fetch the latest seoRecord per course so we always track the current keywords.
      const detail = await getCourseDetail(c.id);
      const keywords = detail?.record?.keywords ?? null;
      const res = await trackCourse({
        courseId: c.id,
        productUrl: c.productUrl,
        keywords,
        level: c.level,
        year: c.year,
        subject: c.subject,
      });
      const positions = res.ranks.map((r) => r.position).filter((p): p is number => p != null);
      checked.push({
        courseId: c.id,
        bestPosition: positions.length ? Math.min(...positions) : null,
        aiMentioned: res.aivis.engines.some((e) => e.mentioned),
      });
    } catch {
      /* continue with the rest */
    }
  }

  return NextResponse.json({ ok: true, dueCourses: due.length, checked });
}

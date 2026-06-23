import { getDb, isDbConfigured } from "./db";
import { rankChecks, aiVisibilityChecks } from "./db/schema";
import { checkRank, type RankResult } from "./rank/serp";
import { checkAiVisibility, type AiVisibilityResult } from "./aivis/check";

export interface TrackInput {
  courseId: number;
  productUrl?: string | null;
  keywords?: string[] | null;
  level?: string | null;
  year?: string | null;
  subject?: string | null;
}

export interface TrackResult {
  ranks: RankResult[];
  aivis: AiVisibilityResult;
}

/**
 * Run both tracking surfaces for one course and persist them:
 *  - web rank (SERP proxy) for up to 3 of its keywords
 *  - AI-search visibility (Gemini, grounded)
 * Used by the manual "Track now" action and the 3-week cron.
 */
export async function trackCourse(input: TrackInput): Promise<TrackResult> {
  const keywords = (input.keywords ?? []).slice(0, 3);
  const ranks: RankResult[] = [];

  for (const kw of keywords) {
    const r = await checkRank(kw, input.productUrl);
    ranks.push(r);
    if (isDbConfigured()) {
      try {
        await getDb().insert(rankChecks).values({
          courseId: input.courseId,
          query: kw,
          pageUrl: r.pageUrl,
          position: r.position,
          source: "serp",
        });
      } catch (e) {
        // Best-effort persistence; the rank result is still returned to the caller.
        console.error(`trackCourse: rankChecks insert failed (course ${input.courseId}, "${kw}"):`, e);
      }
    }
  }

  const aivis = await checkAiVisibility({
    level: input.level,
    year: input.year,
    subject: input.subject,
  });

  if (isDbConfigured()) {
    for (const e of aivis.engines) {
      if (!e.configured) continue;
      try {
        await getDb().insert(aiVisibilityChecks).values({
          courseId: input.courseId,
          query: aivis.queries.join(" | "),
          engine: e.engine,
          mentioned: e.mentioned,
          prominence: e.prominence,
          citationUrl: e.citationUrl,
          samples: e.samples,
          mentionRate: e.mentionRate,
        });
      } catch (err) {
        // Best-effort persistence; the visibility result is still returned.
        console.error(`trackCourse: aiVisibilityChecks insert failed (course ${input.courseId}, ${e.engine}):`, err);
      }
    }
  }

  return { ranks, aivis };
}

import "../lib/loadEnv";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { courses, seoRecords } from "../lib/db/schema";
import { backfillKeywords } from "../lib/ai/backfill";
import { scoreRecord } from "../lib/score/validate";
import { isAiConfigured } from "../lib/ai/models";
import { sleep, withQuotaRetry } from "../lib/util/throttle";

/**
 * Resumable, rate-limit-friendly keyword back-fill. Processes records whose keywords
 * are still the deterministic defaults (aiGenerated = false) and upgrades them to AI
 * keywords. Run repeatedly until all are upgraded — ideal for free-tier Gemini.
 *   npm run backfill:keywords
 */
async function main() {
  if (!isAiConfigured()) {
    console.error("No AI key set — add GOOGLE_GENERATIVE_AI_API_KEY to .env.local");
    process.exit(1);
  }
  const throttle = Number(process.env.IMPORT_THROTTLE_MS ?? 7000);
  const db = getDb();

  const rows = await db
    .select({
      recordId: seoRecords.id,
      courseId: seoRecords.courseId,
      name: courses.name,
      metaTitleEn: seoRecords.metaTitleEn,
      metaDescBn: seoRecords.metaDescBn,
      metaDescEn: seoRecords.metaDescEn,
      metaTitleBn: seoRecords.metaTitleBn,
      ogTitle: seoRecords.ogTitle,
      ogDescription: seoRecords.ogDescription,
      ogImage: seoRecords.ogImage,
      imageAltThumb: seoRecords.imageAltThumb,
      imageAltSqr: seoRecords.imageAltSqr,
      imageNameThumb: seoRecords.imageNameThumb,
      imageNameSqr: seoRecords.imageNameSqr,
      schemaJsonld: seoRecords.schemaJsonld,
      slug: courses.slug,
    })
    .from(seoRecords)
    .innerJoin(courses, eq(courses.id, seoRecords.courseId))
    .where(eq(seoRecords.aiGenerated, false));

  console.log(`${rows.length} course(s) with deterministic keywords to upgrade.`);
  let done = 0;
  let failed = 0;

  for (const r of rows) {
    if (!(r.metaDescBn || r.metaDescEn || r.metaTitleEn)) continue;
    try {
      const keywords = await withQuotaRetry(
        () =>
          backfillKeywords({
            name: r.name,
            metaTitleEn: r.metaTitleEn,
            metaDescBn: r.metaDescBn,
            metaDescEn: r.metaDescEn,
          }),
        { onWait: (ms) => console.log(`  rate limited — waiting ${Math.round(ms / 1000)}s…`) }
      );

      const score = scoreRecord({ ...r, keywords });
      await db
        .update(seoRecords)
        .set({ keywords, aiGenerated: true, validationScore: score.total })
        .where(eq(seoRecords.id, r.recordId));

      done++;
      console.log(`  ✓ ${r.name} → [${keywords.join(", ")}] (score ${score.total})`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${r.name}: ${(e as Error).message}`);
    }
    await sleep(throttle);
  }

  console.log(`\nDone. Filled ${done}, failed ${failed}. Re-run to retry failures.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

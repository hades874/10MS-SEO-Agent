import { NextResponse } from "next/server";

/**
 * Phase 3 placeholder: the 3-week rank + AI-visibility re-check.
 * Wired into Vercel Cron (see vercel.ts) so the schedule exists now; the actual
 * SERP position checks and AI-engine visibility sampling land in Phase 3.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "not_implemented",
    phase: 3,
    message:
      "Rank + AI-visibility re-check is not built yet. This endpoint is reserved for the 3-week cron.",
  });
}

import type { VercelConfig } from "@vercel/config/v1";

/**
 * Vercel project config. The cron runs the 3-week rank + AI-visibility re-check
 * (Phase 3). Schedule fires daily; the handler only re-checks courses past their
 * 3-week mark, so the cadence lives in code, not the cron string.
 */
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [{ path: "/api/cron/recheck", schedule: "0 3 * * *" }],
};

export default config;

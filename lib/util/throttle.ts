export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retry a call when the provider reports a quota/rate-limit error, honoring the
 * "retry in Ns" hint when present. Free-tier Gemini caps requests-per-minute, so
 * a one-time bulk import needs to back off rather than fail.
 */
export async function withQuotaRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; onWait?: (ms: number) => void } = {}
): Promise<T> {
  const retries = opts.retries ?? 2;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      const isQuota = /quota|rate.?limit|\b429\b|exceeded/i.test(msg);
      if (!isQuota || attempt >= retries) throw e;
      const m = msg.match(/retry in ([\d.]+)\s*s/i);
      const waitMs = m ? Math.ceil(parseFloat(m[1]) * 1000) + 1500 : 35000;
      opts.onWait?.(waitMs);
      await sleep(waitMs);
    }
  }
}

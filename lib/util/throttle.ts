export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Retryable = "quota" | "overload";

/**
 * Classify a provider error as a transient, retryable condition:
 *  - "quota"    → free-tier requests-per-minute cap (429). Honor any "retry in Ns" hint.
 *  - "overload" → the model is temporarily busy ("high demand" / overloaded / 503 / 529 /
 *                 UNAVAILABLE). No retry hint is given, so we use exponential backoff.
 * Returns null for non-retryable errors (auth, bad request, etc.).
 */
function classify(msg: string): Retryable | null {
  if (/quota|rate.?limit|\b429\b|exceeded/i.test(msg)) return "quota";
  if (
    /high.?demand|overload|temporarily|\b503\b|\b529\b|unavailable|try again/i.test(
      msg
    )
  )
    return "overload";
  return null;
}

/**
 * Retry a call when the provider reports a transient quota or overload error.
 * Free-tier Gemini caps requests-per-minute, and any model can briefly return a
 * "high demand"/overloaded error during a spike — both are temporary, so we back
 * off and retry rather than failing the whole request.
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
      const kind = classify(msg);
      if (!kind || attempt >= retries) throw e;

      let waitMs: number;
      if (kind === "quota") {
        const m = msg.match(/retry in ([\d.]+)\s*s/i);
        waitMs = m ? Math.ceil(parseFloat(m[1]) * 1000) + 1500 : 35000;
      } else {
        // Overload: exponential backoff (2s, 5s, 11s, …) with a little jitter.
        waitMs = (2 ** attempt * 2 + 1) * 1000 + Math.floor(Math.random() * 1000);
      }
      opts.onWait?.(waitMs);
      await sleep(waitMs);
    }
  }
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** Fetch a public page's HTML. Returns null on error/non-HTML/oversized. */
export async function fetchHtml(
  url: string,
  timeoutMs = 12000
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    const text = await res.text();
    return text.slice(0, 2_000_000); // cap at ~2MB
  } catch {
    return null;
  }
}

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/competitors/fetch", () => ({ fetchHtml: vi.fn() }));
vi.mock("@/lib/pdp/analyze", () => ({ analyzePdpGap: vi.fn() }));
vi.mock("@/lib/ai/models", () => ({ isAiConfigured: vi.fn(async () => true) }));
vi.mock("@/lib/keywords/provider", () => ({
  researchKeywordVia: vi.fn(async () => ({ seed: "", suggestions: [], related: [], demandSignal: 0 })),
}));

import { comparePdps } from "@/lib/pdp/compare";
import { fetchHtml } from "@/lib/competitors/fetch";
import { analyzePdpGap } from "@/lib/pdp/analyze";
import { isAiConfigured } from "@/lib/ai/models";

const mockFetch = vi.mocked(fetchHtml);
const mockAnalyze = vi.mocked(analyzePdpGap);
const mockAi = vi.mocked(isAiConfigured);

const HTML = (t: string) =>
  `<html><head><title>${t}</title><meta name="description" content="d ${t}"></head><body><h1>${t}</h1><p>body about ${t}</p></body></html>`;

const EMPTY_ANALYSIS = {
  summary: "verdict",
  onPageDeficits: [],
  contentGaps: [],
  keywordGaps: [],
  prioritizedActions: [],
};

const US = "https://us.com/p";
const C1 = "https://comp1.com/p";
const C2 = "https://comp2.com/p";

describe("comparePdps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAi.mockResolvedValue(true);
  });

  it("scores our page and every competitor, with one combined AI call", async () => {
    mockFetch.mockImplementation(async (url: string) => HTML(url));
    mockAnalyze.mockResolvedValue(EMPTY_ANALYSIS);

    const res = await comparePdps(US, [C1, C2]);

    expect(res.competitors).toHaveLength(2);
    expect(typeof res.ours.score.total).toBe("number");
    res.competitors.forEach((c) => expect(typeof c.score.total).toBe("number"));
    expect(res.analysis).toEqual(EMPTY_ANALYSIS);
    expect(mockAnalyze).toHaveBeenCalledOnce();
  });

  it("skips an unreachable competitor but keeps the rest", async () => {
    mockFetch.mockImplementation(async (url: string) =>
      url.includes("comp1") ? null : HTML(url)
    );
    mockAnalyze.mockResolvedValue(EMPTY_ANALYSIS);

    const res = await comparePdps(US, [C1, C2]);

    expect(res.competitors).toHaveLength(1);
    expect(res.competitors[0].url).toBe(C2);
  });

  it("throws when every competitor is unreachable", async () => {
    mockFetch.mockImplementation(async (url: string) =>
      url.includes("us.com") ? HTML(url) : null
    );
    await expect(comparePdps(US, [C1, C2])).rejects.toThrow(/any competitor/i);
  });

  it("throws an actionable error when our page can't be fetched", async () => {
    mockFetch.mockImplementation(async (url: string) =>
      url.includes("us.com") ? null : HTML(url)
    );
    await expect(comparePdps(US, [C1])).rejects.toThrow(/your URL/i);
  });

  it("skips AI and sets a reason when AI is unconfigured", async () => {
    mockAi.mockResolvedValue(false);
    mockFetch.mockImplementation(async (url: string) => HTML(url));

    const res = await comparePdps(US, [C1]);

    expect(res.analysis).toBeNull();
    expect(res.aiSkippedReason).toMatch(/AI not configured/i);
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it("degrades to analysis: null if the AI call throws", async () => {
    mockFetch.mockImplementation(async (url: string) => HTML(url));
    mockAnalyze.mockRejectedValue(new Error("overloaded"));

    const res = await comparePdps(US, [C1]);

    expect(res.analysis).toBeNull();
    expect(res.aiSkippedReason).toMatch(/overloaded/);
  });
});

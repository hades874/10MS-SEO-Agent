import { describe, it, expect } from "vitest";
import { computeKeywordGap } from "@/lib/pdp/keywordGap";
import type { ParsedPdp } from "@/lib/pdp/types";

function page(over: Partial<ParsedPdp>): ParsedPdp {
  return {
    url: "https://example.com",
    title: null,
    metaDescription: null,
    ogTitle: null,
    ogDescription: null,
    h1: [],
    schemaPresent: false,
    schemaTypes: [],
    wordCount: 0,
    keywordsDetected: [],
    headings: [],
    textExcerpt: "",
    ...over,
  };
}

describe("computeKeywordGap", () => {
  const competitor = page({
    title: "Physics Crash Course",
    headings: ["MCQ Practice Sessions"],
    textExcerpt: "physics crash course mcq practice sessions",
  });
  const ours = page({
    title: "Physics Course",
    metaDescription: "best physics course",
    textExcerpt: "physics course",
  });

  it("flags competitor phrases absent from our page", () => {
    const gap = computeKeywordGap(ours, [competitor]).map((g) => g.keyword);
    expect(gap).toContain("crash");
    expect(gap.some((k) => k.includes("mcq"))).toBe(true);
  });

  it("excludes phrases already present on our page (case-insensitive)", () => {
    const gap = computeKeywordGap(ours, [competitor]).map((g) => g.keyword);
    expect(gap).not.toContain("physics");
  });

  it("includes autocomplete-expanded terms missing on our page, tagged by source", () => {
    const gap = computeKeywordGap(ours, [competitor], ["physics mcq book", "physics course"]);
    const auto = gap.find((g) => g.keyword === "physics mcq book");
    expect(auto?.source).toBe("autocomplete");
    // "physics course" is on our page → excluded
    expect(gap.find((g) => g.keyword === "physics course")).toBeUndefined();
  });

  it("aggregates and dedupes across multiple competitors, recording which rivals use a term", () => {
    const compA = page({
      url: "https://a.com",
      title: "Physics Crash Course",
      headings: ["MCQ Practice"],
      textExcerpt: "physics crash course mcq practice",
    });
    const compB = page({
      url: "https://b.com",
      title: "Physics Crash Bootcamp",
      headings: ["Doubt Solving"],
      textExcerpt: "physics crash bootcamp doubt solving",
    });
    const gap = computeKeywordGap(ours, [compA, compB]);

    // "crash" appears on both → single deduped entry citing both rivals
    const crash = gap.find((g) => g.keyword === "crash");
    expect(crash).toBeDefined();
    expect(crash?.competitorUrls).toEqual(["https://a.com", "https://b.com"]);

    // a term unique to one rival cites only that rival
    const doubt = gap.find((g) => g.keyword.includes("doubt"));
    expect(doubt?.competitorUrls).toEqual(["https://b.com"]);
  });
});

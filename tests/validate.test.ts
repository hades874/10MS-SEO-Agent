import { describe, it, expect } from "vitest";
import { scoreRecord, type ScorableRecord } from "@/lib/score/validate";
import { buildProductSchema } from "@/lib/generate/buildSchema";

// A record engineered to satisfy every dimension. Lengths use repeated chars so
// they're exact: title 45 ∈ [30,60], description 90 ∈ [70,160].
function goodRecord(): ScorableRecord {
  const title = "t".repeat(45);
  const desc = "d".repeat(90);
  const { schema } = buildProductSchema({
    name: "Course",
    slug: "hsc-2026-science",
    description: "desc",
    imageUrl: "https://cdn.10minuteschool.com/x.jpg",
    sku: "SKU-1",
    price: "1500",
    currency: "BDT",
    isFree: false,
  });
  return {
    metaTitleBn: title,
    metaTitleEn: title,
    metaDescBn: desc,
    metaDescEn: desc,
    keywords: ["tt", "course"], // "tt" is a substring of the title corpus
    ogTitleBn: "og title bn",
    ogTitleEn: "og title en",
    ogDescriptionBn: "og description bn",
    ogDescriptionEn: "og description en",
    ogImage: "https://cdn.10minuteschool.com/x.jpg",
    imageAltThumb: "alt thumb",
    imageAltSqr: "alt sqr",
    imageNameThumb: "name-thumb",
    imageNameSqr: "name-sqr",
    schemaJsonld: schema as unknown as Record<string, unknown>,
    slug: "hsc-2026-science",
  };
}

describe("scoreRecord", () => {
  it("gives a perfect 100 with all dimensions satisfied and no issues", () => {
    const r = scoreRecord(goodRecord());
    expect(r.total).toBe(100);
    expect(r.issues).toEqual([]);
    for (const v of Object.values(r.fractions)) expect(v).toBe(1);
  });

  it("scores an empty record near zero with the expected issues", () => {
    const r = scoreRecord({});
    // Only uniqueness (no corpus → assumed unique) contributes its 5 points.
    expect(r.total).toBe(5);
    expect(r.issues).toEqual(
      expect.arrayContaining(["No keywords", "No slug", "No JSON-LD schema"])
    );
  });

  it("penalizes keyword usage when the primary keyword is absent from copy", () => {
    const r = scoreRecord({ ...goodRecord(), keywords: ["zzz-not-present"] });
    expect(r.fractions.keywordUsage).toBeLessThan(1);
    expect(r.issues).toContain("Primary keyword not found in title/description");
  });

  it("flags a non-conforming slug", () => {
    const r = scoreRecord({ ...goodRecord(), slug: "Bad Slug!" });
    expect(r.fractions.slugSanity).toBeCloseTo(0.4);
    expect(r.issues).toContain(
      "Slug should be lowercase, hyphen-separated, no spaces"
    );
  });

  it("zeroes uniqueness when the title duplicates an existing course", () => {
    const rec = goodRecord();
    const r = scoreRecord(rec, { existingTitles: [rec.metaTitleEn!] });
    expect(r.fractions.uniqueness).toBe(0);
    expect(r.issues).toContain("Title duplicates an existing course");
  });

  it("gives partial credit for a title that overshoots the max", () => {
    const r = scoreRecord({ ...goodRecord(), metaTitleEn: "t".repeat(70) });
    // 70 is 10 over the 60 max → partial, not full and not zero.
    expect(r.fractions.titleLength).toBeGreaterThan(0);
    expect(r.fractions.titleLength).toBeLessThan(1);
  });
});

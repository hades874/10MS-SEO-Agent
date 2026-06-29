import { describe, it, expect } from "vitest";
import {
  CourseInputSchema,
  GeneratedCopySchema,
  firstIssue,
} from "@/lib/generate/validation";

describe("CourseInputSchema", () => {
  it("accepts a minimal valid input", () => {
    const r = CourseInputSchema.safeParse({ name: "HSC Science" });
    expect(r.success).toBe(true);
  });

  it("rejects an empty / whitespace name", () => {
    expect(CourseInputSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(CourseInputSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an absurdly long name", () => {
    expect(
      CourseInputSchema.safeParse({ name: "x".repeat(301) }).success
    ).toBe(false);
  });

  it("rejects too many target keywords", () => {
    const r = CourseInputSchema.safeParse({
      name: "ok",
      targetKeywords: Array.from({ length: 51 }, (_, i) => `k${i}`),
    });
    expect(r.success).toBe(false);
  });

  it("preserves nullable facet fields", () => {
    const r = CourseInputSchema.safeParse({ name: "ok", level: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.level).toBeNull();
  });
});

describe("GeneratedCopySchema", () => {
  const valid = {
    metaTitleBn: "ক",
    metaTitleEn: "Title",
    metaDescBn: "ক",
    metaDescEn: "Desc",
    keywords: ["a", "b"],
    ogTitleBn: "og bn",
    ogTitleEn: "og en",
    ogDescriptionBn: "ogd bn",
    ogDescriptionEn: "ogd en",
    ogImageAlt: "alt",
    imageNameThumb: "n",
    imageNameSqr: "n",
    imageAltThumb: "a",
    imageAltSqr: "a",
  };

  it("accepts well-formed copy", () => {
    expect(GeneratedCopySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an over-long copy field", () => {
    const r = GeneratedCopySchema.safeParse({
      ...valid,
      metaDescEn: "x".repeat(2001),
    });
    expect(r.success).toBe(false);
  });
});

describe("firstIssue", () => {
  it("prefixes the field path", () => {
    const r = CourseInputSchema.safeParse({ name: "" });
    if (!r.success) expect(firstIssue(r.error)).toContain("name");
  });
});

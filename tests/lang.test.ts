import { describe, it, expect } from "vitest";
import {
  detectLang,
  assignByScript,
  visibleLength,
  scriptCounts,
} from "@/lib/util/lang";

describe("detectLang", () => {
  it("returns unknown for empty / non-letter input", () => {
    expect(detectLang(null)).toBe("unknown");
    expect(detectLang(undefined)).toBe("unknown");
    expect(detectLang("")).toBe("unknown");
    expect(detectLang("123 !!! ???")).toBe("unknown");
  });

  it("detects predominantly Bangla as bn", () => {
    expect(detectLang("এইচএসসি বিজ্ঞান কোর্স")).toBe("bn");
  });

  it("detects predominantly English as en", () => {
    expect(detectLang("HSC Science Course")).toBe("en");
  });

  it("returns mixed for a near-even script split", () => {
    // 4 Bangla letters (৫০%) vs 4 Latin letters → between the 0.4 and 0.6 cutoffs.
    expect(detectLang("কখগঘ abcd")).toBe("mixed");
  });
});

describe("assignByScript", () => {
  it("returns nulls when both inputs are empty", () => {
    expect(assignByScript(null, "  ")).toEqual({ bn: null, en: null });
  });

  it("assigns a single candidate by its own majority script", () => {
    expect(assignByScript("HSC Science", null)).toEqual({
      bn: null,
      en: "HSC Science",
    });
    expect(assignByScript(null, "বিজ্ঞান কোর্স")).toEqual({
      bn: "বিজ্ঞান কোর্স",
      en: null,
    });
  });

  it("assigns the higher-Bangla-share string to bn regardless of argument order", () => {
    const a = "HSC Science Course"; // mostly English
    const b = "এইচএসসি বিজ্ঞান কোর্স"; // mostly Bangla
    expect(assignByScript(a, b)).toEqual({ bn: b, en: a });
    expect(assignByScript(b, a)).toEqual({ bn: b, en: a });
  });
});

describe("visibleLength", () => {
  it("counts plain ASCII as one-per-character", () => {
    expect(visibleLength("hello")).toBe(5);
    expect(visibleLength("")).toBe(0);
    expect(visibleLength(null)).toBe(0);
  });

  it("treats a base + vowel sign as a single grapheme", () => {
    // "কা" = ক (base) + া (spacing vowel sign, U+09BE): 2 code units, 1 grapheme.
    const withVowelSign = "কা";
    expect(withVowelSign.length).toBe(2);
    expect(visibleLength(withVowelSign)).toBe(1);
  });

  it("counts a Bangla conjunct as fewer graphemes than JS code units", () => {
    // The exact cluster count for ক + ্ + ষ varies by ICU version, but it is
    // always fewer than the 3 code units — which is the whole point of the helper.
    const conjunct = "ক্ষ";
    expect(conjunct.length).toBe(3);
    expect(visibleLength(conjunct)).toBeLessThan(conjunct.length);
  });
});

describe("scriptCounts", () => {
  it("counts Bengali and Latin letters separately, ignoring digits/punct", () => {
    expect(scriptCounts("ab কখ 12!")).toEqual({ bn: 2, en: 2 });
  });
});

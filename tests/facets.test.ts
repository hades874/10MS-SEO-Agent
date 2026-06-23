import { describe, it, expect } from "vitest";
import { deriveFacets } from "@/lib/util/facets";
import { suggestSlug } from "@/lib/util/slug";

describe("deriveFacets", () => {
  it("derives level/year/subject/batch/group from a typical English name", () => {
    const f = deriveFacets("HSC 2026 Science Online Batch");
    expect(f.level).toBe("HSC");
    expect(f.year).toBe("26"); // 4-digit year is stored as 2-digit suffix
    expect(f.subject).toBe("Science");
    expect(f.batchType).toBe("Online Batch");
    expect(f.group).toBe("Science");
    expect(f.isFree).toBe(false);
  });

  it("reads unanchored Bangla facets (subject, free) from Bangla text", () => {
    const f = deriveFacets("ফ্রি এসএসসি বাংলা কোর্স");
    expect(f.subject).toBe("Bangla");
    expect(f.isFree).toBe(true);
  });

  it("KNOWN LIMITATION: Bangla-only level is not detected (\\b breaks on Bengali)", () => {
    // The level regexes anchor the Bangla alternative with a trailing \b, which
    // does not form a boundary against Bengali code points — so "এসএসসি" alone
    // yields no level. Documented here as a regression guard; fix is backlogged.
    expect(deriveFacets("এসএসসি বাংলা").level).toBeNull();
    // The Latin form still works.
    expect(deriveFacets("SSC Bangla").level).toBe("SSC");
  });

  it("marks multi-subject courses as Multiple", () => {
    const f = deriveFacets("HSC Science and English Combined");
    expect(f.subject).toBe("Multiple");
  });
});

describe("suggestSlug", () => {
  it("builds a kebab-case slug from facets", () => {
    const facets = deriveFacets("HSC 2026 Science Online Batch");
    expect(suggestSlug(facets)).toBe("hsc-26-science-online-batch");
  });

  it("strips punctuation and collapses spaces from a fallback name", () => {
    const empty = {
      level: null,
      year: null,
      subject: null,
      batchType: null,
      group: null,
      isFree: false,
    };
    expect(suggestSlug(empty, "My  Course!! 2026")).toBe("my-course-2026");
  });

  it("omits a Multiple subject from the slug", () => {
    const facets = {
      level: "HSC",
      year: "26",
      subject: "Multiple",
      batchType: "Online Batch",
      group: null,
      isFree: false,
    };
    expect(suggestSlug(facets)).toBe("hsc-26-online-batch");
  });
});

import { describe, it, expect } from "vitest";
import { parsePdp } from "@/lib/pdp/parse";

const HTML = `<!doctype html><html><head>
  <title>HSC 26 Physics Course</title>
  <meta name="description" content="Best physics prep">
  <meta property="og:title" content="Physics OG">
</head><body>
  <nav>Home About</nav>
  <h1>HSC 26 Physics</h1>
  <h2>Live Classes</h2>
  <h3>MCQ Practice</h3>
  <p>Master physics with live classes and MCQ practice for HSC 26.</p>
  <script>console.log('x')</script>
</body></html>`;

describe("parsePdp", () => {
  it("extracts base on-page fields plus headings and a body excerpt", () => {
    const p = parsePdp("https://example.com/c", HTML, ["physics"]);

    expect(p.title).toBe("HSC 26 Physics Course");
    expect(p.metaDescription).toBe("Best physics prep");
    expect(p.headings).toEqual(["HSC 26 Physics", "Live Classes", "MCQ Practice"]);
    expect(p.keywordsDetected).toContain("physics");
    // excerpt has the body text but not script contents
    expect(p.textExcerpt).toContain("Master physics");
    expect(p.textExcerpt).not.toContain("console.log");
  });

  it("handles a page with no headings", () => {
    const p = parsePdp("https://example.com/c", "<html><body><p>hi</p></body></html>");
    expect(p.headings).toEqual([]);
    expect(p.textExcerpt).toContain("hi");
  });
});

import { parse } from "csv-parse/sync";
import { assignByScript } from "../util/lang";

/**
 * Parser for the 10MS SEO seed CSV.
 *
 * The file is a vertical "block" layout — one block per course, blocks separated by
 * blank rows. Each row is `Category, Sub-Category, Element, ..., (maybe CDN url)`.
 * See memory note `seo-csv-seed-format`. Real-world quirks handled here:
 *  - label variants (`Og: Title` vs `og:title`, trailing spaces, `Url Suggestion`
 *    vs `Course URL/ Slug`)
 *  - Bangla/English rows mislabeled or swapped -> we assign by Unicode script, not label
 *  - course-name column drifts between col 1 and col 2
 *  - image CDN url sometimes in a far-right column
 *  - missing keywords/schema and half-empty blocks -> completeness = "partial"
 */

export interface ParsedCourse {
  name: string;
  slug: string | null;
  metaTitleBn: string | null;
  metaTitleEn: string | null;
  metaDescBn: string | null;
  metaDescEn: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  imageNameThumb: string | null;
  imageNameSqr: string | null;
  imageAltThumb: string | null;
  imageAltSqr: string | null;
  imageUrl: string | null;
  completeness: "full" | "partial";
}

type Category =
  | "name"
  | "slug"
  | "metaTitle"
  | "metaDesc"
  | "imageName"
  | "imageAlt"
  | "ogTitle"
  | "ogDescription"
  | null;

function normalizeCat(raw: string): Category {
  const s = raw.toLowerCase().trim().replace(/\s+/g, " ").replace(/:$/, "");
  if (s === "final course name") return "name";
  if (
    s === "url suggestion" ||
    s === "course url/ slug" ||
    s === "course url / slug" ||
    s === "url"
  )
    return "slug";
  if (s === "meta title") return "metaTitle";
  if (s === "meta description") return "metaDesc";
  if (s === "image renaming") return "imageName";
  if (s === "image alt text") return "imageAlt";
  if (s === "og: title" || s === "og:title" || s === "og title") return "ogTitle";
  if (s === "og: description" || s === "og:description" || s === "og description")
    return "ogDescription";
  return null;
}

function firstNonEmpty(...vals: (string | undefined)[]): string | null {
  for (const v of vals) {
    const t = v?.trim();
    if (t && t.toLowerCase() !== "n/a") return t;
  }
  return null;
}

function findUrl(row: string[]): string | null {
  for (const cell of row) {
    if (cell && /^https?:\/\//i.test(cell.trim())) return cell.trim();
  }
  return null;
}

function isSqr(subLabel: string): boolean {
  return /sqr|squre|square/i.test(subLabel);
}

interface Block {
  name: string | null;
  slug: string | null;
  metaTitleCandidates: string[];
  metaDescCandidates: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  imageNameThumb: string | null;
  imageNameSqr: string | null;
  imageAltThumb: string | null;
  imageAltSqr: string | null;
  imageUrl: string | null;
}

function emptyBlock(): Block {
  return {
    name: null,
    slug: null,
    metaTitleCandidates: [],
    metaDescCandidates: [],
    ogTitle: null,
    ogDescription: null,
    imageNameThumb: null,
    imageNameSqr: null,
    imageAltThumb: null,
    imageAltSqr: null,
    imageUrl: null,
  };
}

function finalizeBlock(b: Block): ParsedCourse | null {
  if (!b.name) return null;
  const title = assignByScript(
    b.metaTitleCandidates[0],
    b.metaTitleCandidates[1]
  );
  const desc = assignByScript(
    b.metaDescCandidates[0],
    b.metaDescCandidates[1]
  );

  const filledCore =
    [title.bn, title.en, desc.bn, desc.en, b.slug].filter(Boolean).length;
  const completeness: "full" | "partial" = filledCore >= 4 ? "full" : "partial";

  return {
    name: b.name,
    slug: b.slug,
    metaTitleBn: title.bn,
    metaTitleEn: title.en,
    metaDescBn: desc.bn,
    metaDescEn: desc.en,
    ogTitle: b.ogTitle,
    ogDescription: b.ogDescription,
    imageNameThumb: b.imageNameThumb,
    imageNameSqr: b.imageNameSqr,
    imageAltThumb: b.imageAltThumb,
    imageAltSqr: b.imageAltSqr,
    imageUrl: b.imageUrl,
    completeness,
  };
}

export function parseSeedCsv(csvText: string): ParsedCourse[] {
  const rows: string[][] = parse(csvText, {
    relax_column_count: true,
    skip_empty_lines: false,
    trim: false,
  });

  const courses: ParsedCourse[] = [];
  let block: Block | null = null;
  let currentCat: Category = null;

  for (const row of rows) {
    const col0 = (row[0] ?? "").trim();
    const col1 = (row[1] ?? "").trim();
    const col2 = (row[2] ?? "").trim();
    const url = findUrl(row);

    // A new course block begins ONLY at an explicit "Final Course Name" cell —
    // not when "name" merely carried over as the current category.
    const isNameRow = Boolean(col0) && normalizeCat(col0) === "name";
    if (isNameRow) {
      if (block) {
        const done = finalizeBlock(block);
        if (done) courses.push(done);
      }
      block = emptyBlock();
      block.name = firstNonEmpty(col1, col2);
      currentCat = null; // name is single-row; reset so continuations don't re-trigger
      continue;
    }

    if (!block) continue; // skip header / preamble before first course
    const cat: Category = col0 ? normalizeCat(col0) : currentCat;
    if (col0 && cat) currentCat = cat;

    switch (currentCat) {
      case "slug":
        block.slug ??= firstNonEmpty(col1, col2);
        break;
      case "metaTitle": {
        // Value is in col2; the sub-label (Bangla/English) in col1 is ignored —
        // we assign bn/en by Unicode script later, since labels are often swapped.
        const val = firstNonEmpty(col2);
        if (val) block.metaTitleCandidates.push(val);
        break;
      }
      case "metaDesc": {
        const val = firstNonEmpty(col2);
        if (val) block.metaDescCandidates.push(val);
        break;
      }
      case "imageName": {
        const val = firstNonEmpty(col2);
        if (val) {
          if (isSqr(col1)) block.imageNameSqr ??= val;
          else block.imageNameThumb ??= val;
        }
        if (url) block.imageUrl ??= url;
        break;
      }
      case "imageAlt": {
        const val = firstNonEmpty(col2);
        if (val) {
          if (isSqr(col1)) block.imageAltSqr ??= val;
          else block.imageAltThumb ??= val;
        }
        break;
      }
      case "ogTitle":
        block.ogTitle ??= firstNonEmpty(col2, col1);
        break;
      case "ogDescription":
        block.ogDescription ??= firstNonEmpty(col2, col1);
        break;
      default:
        break;
    }
  }

  if (block) {
    const done = finalizeBlock(block);
    if (done) courses.push(done);
  }

  return courses;
}

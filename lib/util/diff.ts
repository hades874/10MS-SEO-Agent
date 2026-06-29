import type { SeoRecord } from "../db/schema";

export interface FieldDiff {
  field: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

/** The copy fields we display + diff (schema/score are derived, not hand-edited). */
const DIFF_FIELDS: { key: keyof SeoRecord; label: string }[] = [
  { key: "metaTitleBn", label: "Meta title (BN)" },
  { key: "metaTitleEn", label: "Meta title (EN)" },
  { key: "metaDescBn", label: "Meta description (BN)" },
  { key: "metaDescEn", label: "Meta description (EN)" },
  { key: "keywords", label: "Keywords" },
  { key: "ogTitleBn", label: "og:title (BN)" },
  { key: "ogTitleEn", label: "og:title (EN)" },
  { key: "ogDescriptionBn", label: "og:description (BN)" },
  { key: "ogDescriptionEn", label: "og:description (EN)" },
  { key: "ogImageAlt", label: "og:image alt" },
  { key: "imageNameThumb", label: "Image name (thumbnail)" },
  { key: "imageNameSqr", label: "Image name (square)" },
  { key: "imageAltThumb", label: "Image alt (thumbnail)" },
  { key: "imageAltSqr", label: "Image alt (square)" },
];

function asText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/** Field-level before/after diff between two SEO record versions (dumb string compare). */
export function diffRecords(prev: SeoRecord, next: SeoRecord): FieldDiff[] {
  return DIFF_FIELDS.map(({ key, label }) => {
    const before = asText(prev[key]);
    const after = asText(next[key]);
    return { field: key as string, label, before, after, changed: before !== after };
  });
}

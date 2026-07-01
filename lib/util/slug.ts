import type { Facets } from "./facets";

/**
 * Suggest a slug from derived facets, following the house pattern
 * {level}-{year}-{subject}-{batch_type}. Bangla doesn't transliterate cleanly, so
 * we build from the English facet tokens rather than the (often Bangla) name.
 */
export function suggestSlug(facets: Facets, fallbackName?: string): string {
  const parts = [
    facets.level,
    facets.year,
    facets.subject && facets.subject !== "Multiple" ? facets.subject : null,
    facets.paper,
    facets.batchType,
  ]
    .filter(Boolean)
    .join(" ");

  const base = parts || fallbackName || "";
  return base
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

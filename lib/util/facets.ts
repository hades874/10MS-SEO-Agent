/**
 * Rule-based facet derivation from a course name (Bangla + English mixed).
 *
 * These facets power facet-first retrieval (find same level+subject+batch_type
 * neighbours before vector ranking) and dashboard filters. Rules cover the common
 * 10MS patterns seen in the seed; an optional LLM tag pass (lib/ai/tag.ts) can fill
 * gaps the rules miss.
 */

export interface Facets {
  level: string | null; // SSC / HSC / Class 6 / Class 8
  year: string | null; // "27" / "28" / "2026"
  subject: string | null; // Science / Bangla / English / ICT / Math / Economics / ...
  batchType: string | null; // Online Batch / Recorded Batch / Board Prep
  group: string | null; // Science / Commerce / Arts / All
  isFree: boolean;
}

// Note: \b word boundaries don't behave with Bengali Unicode, so Bangla terms are
// matched unanchored. Latin terms keep a leading boundary to avoid substring hits.
const SUBJECTS: Array<[RegExp, string]> = [
  [/\bscience\b|বিজ্ঞান/i, "Science"],
  [/\bict\b|আইসিটি|তথ্য ও যোগাযোগ/i, "ICT"],
  [/\benglish\b|ইংরেজি/i, "English"],
  [/\bbangla\b|বাংলা/i, "Bangla"],
  [/\bmath\b|গণিত/i, "Math"],
  [/\beconomics\b|ইকোনমিক্স|অর্থনীতি/i, "Economics"],
  [/\bcivics\b|পৌরনীতি/i, "Civics"],
  [/\bmarketing\b|মার্কেটিং/i, "Marketing"],
  [/\bmanagement\b|ম্যানেজমেন্ট/i, "Management"],
];

export function deriveFacets(name: string, slug?: string | null): Facets {
  const hay = `${name} ${slug ?? ""}`;

  // Level
  let level: string | null = null;
  if (/\bhsc|এইচএসসি\b/i.test(hay)) level = "HSC";
  else if (/\bssc|এসএসসি\b/i.test(hay)) level = "SSC";
  else if (/(class[- ]?6|ষষ্ঠ|৬ষ্ঠ)/i.test(hay)) level = "Class 6";
  else if (/(class[- ]?7|সপ্তম|৭ম)/i.test(hay)) level = "Class 7";
  else if (/(class[- ]?8|অষ্টম|৮ম)/i.test(hay)) level = "Class 8";
  else if (/(class[- ]?9|নবম|৯ম)/i.test(hay)) level = "Class 9";
  else if (/(class[- ]?10|দশম|১০ম)/i.test(hay)) level = "Class 10";

  // Year: prefer 4-digit, else 2-digit after the level keyword
  let year: string | null = null;
  const y4 = hay.match(/\b(20\d{2})\b/);
  if (y4) year = y4[1].slice(2);
  else {
    const y2 = hay.match(/\b(2[5-9])\b/);
    if (y2) year = y2[1];
  }

  // Subject
  let subject: string | null = null;
  for (const [re, label] of SUBJECTS) {
    if (re.test(hay)) {
      subject = label;
      break;
    }
  }
  // Multi-subject combos -> "Multiple"
  const subjectHits = SUBJECTS.filter(([re]) => re.test(hay)).length;
  if (subjectHits > 1) subject = "Multiple";

  // Batch type
  let batchType: string | null = null;
  if (/(recorded|রেকর্ডেড)/i.test(hay)) batchType = "Recorded Batch";
  else if (/(board exam|বোর্ড পরীক্ষা|board prep)/i.test(hay))
    batchType = "Board Prep";
  else if (/(online batch|অনলাইন ব্যাচ)/i.test(hay)) batchType = "Online Batch";
  else if (/(final preparation|শেষ মুহূর্ত)/i.test(hay))
    batchType = "Final Prep";

  // Group
  let group: string | null = null;
  if (subject === "Science" || /বিজ্ঞান বিভাগ/i.test(hay)) group = "Science";
  else if (/(commerce|ব্যবসায়|marketing|management|economics)/i.test(hay))
    group = "Commerce";
  else if (/(arts|humanities|মানবিক)/i.test(hay)) group = "Arts";
  else if (/(সকল বিভাগ|all group|all groups)/i.test(hay)) group = "All";

  const isFree = /(free|ফ্রি|super free)/i.test(hay);

  return { level, year, subject, batchType, group, isFree };
}

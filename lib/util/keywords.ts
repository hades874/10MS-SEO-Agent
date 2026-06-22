import type { Facets } from "./facets";

/**
 * Deterministic keyword derivation from course facts — zero AI calls. Guarantees
 * every course has usable bilingual keywords even when the Gemini free-tier quota is
 * exhausted. AI back-fill (lib/ai/backfill.ts) later *upgrades* these.
 */

const LEVEL_BN: Record<string, string> = {
  HSC: "এইচএসসি",
  SSC: "এসএসসি",
  "Class 6": "ষষ্ঠ শ্রেণি",
  "Class 7": "সপ্তম শ্রেণি",
  "Class 8": "অষ্টম শ্রেণি",
  "Class 9": "নবম শ্রেণি",
  "Class 10": "দশম শ্রেণি",
};
const SUBJECT_BN: Record<string, string> = {
  Science: "বিজ্ঞান",
  Bangla: "বাংলা",
  English: "ইংরেজি",
  ICT: "আইসিটি",
  Math: "গণিত",
  Economics: "ইকোনমিক্স",
  Civics: "পৌরনীতি",
  Marketing: "মার্কেটিং",
  Management: "ম্যানেজমেন্ট",
};
const BATCH_BN: Record<string, string> = {
  "Online Batch": "অনলাইন ব্যাচ",
  "Recorded Batch": "রেকর্ডেড ব্যাচ",
  "Board Prep": "বোর্ড পরীক্ষা প্রস্তুতি",
  "Final Prep": "শেষ মুহূর্তের প্রস্তুতি",
};

export function deriveKeywords(f: Facets, name: string): string[] {
  const year4 = f.year ? (f.year.length === 2 ? `20${f.year}` : f.year) : null;
  const subj = f.subject && f.subject !== "Multiple" ? f.subject : null;
  const levelBn = f.level ? LEVEL_BN[f.level] : null;
  const subjBn = subj ? SUBJECT_BN[subj] : null;
  const batchBn = f.batchType ? BATCH_BN[f.batchType] : null;

  const candidates: (string | null)[] = [
    // English, most specific first
    f.level && subj && year4 ? `${f.level} ${year4} ${subj}` : null,
    f.level && subj && f.batchType ? `${f.level} ${subj} ${f.batchType}` : null,
    f.level && subj ? `${f.level} ${subj}` : null,
    // Bangla
    levelBn && subjBn ? `${levelBn} ${subjBn}` : null,
    levelBn && subjBn && batchBn ? `${levelBn} ${subjBn} ${batchBn}` : null,
    // Fallbacks when subject is missing / multiple
    !subj && f.level && f.batchType && year4 ? `${f.level} ${year4} ${f.batchType}` : null,
    !subj && levelBn && batchBn ? `${levelBn} ${batchBn}` : null,
    subj,
    // Last resort: the course name itself
    name,
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    if (!c) continue;
    const v = c.trim().replace(/\s+/g, " ");
    if (!v || v.length > 50) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= 6) break;
  }
  return out;
}

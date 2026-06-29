import type { ParsedPage } from "../competitors/parse";
import type { CompetitorScore } from "../competitors/score";

/**
 * On-page signals for a single PDP being compared. Extends the competitor
 * `ParsedPage` (title/meta/og/schema/word-count) with the extra context the
 * gap-analysis LLM needs: the heading outline and a token-budgeted excerpt of
 * the visible body text.
 */
export interface ParsedPdp extends ParsedPage {
  headings: string[]; // h1–h3 outline, in document order
  textExcerpt: string; // cleaned, truncated visible body text for the LLM
}

/** One side of the comparison: parsed page + its on-page score. */
export interface PdpSide {
  url: string;
  page: ParsedPdp;
  score: CompetitorScore;
}

/** A keyword the competitor field targets that ours appears to miss. */
export interface KeywordGapItem {
  keyword: string;
  source: "competitor-page" | "autocomplete"; // where the candidate came from
  competitorUrls?: string[]; // which rivals emphasise it (page-derived only)
}

type Severity = "high" | "med" | "low";
type Effort = "low" | "med" | "high";

/** Structured AI gap analysis (the LLM output). */
export interface PdpGapAnalysis {
  summary: string;
  onPageDeficits: {
    dimension: string;
    ours: string;
    competitor: string;
    severity: Severity;
    fix: string;
  }[];
  contentGaps: {
    topic: string;
    whyItMatters: string;
    evidenceFromCompetitor: string;
    suggestion: string;
  }[];
  keywordGaps: {
    keyword: string;
    recommendation: string;
  }[];
  prioritizedActions: {
    action: string;
    impact: Severity;
    effort: Effort;
    rationale: string;
  }[];
}

/** Full result returned by the orchestrator + Server Action. */
export interface PdpComparisonResult {
  ours: PdpSide;
  competitors: PdpSide[]; // one your-page vs many competitors
  targetKeywords: string[];
  keywordGap: KeywordGapItem[]; // deterministic, page-derived, aggregated across rivals
  analysis: PdpGapAnalysis | null; // null when AI is not configured
  aiSkippedReason?: string; // why analysis is null, for the UI
}

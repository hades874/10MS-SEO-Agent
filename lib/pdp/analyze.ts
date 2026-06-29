import { generateObject } from "ai";
import { z } from "zod";
import { draftModel, chatProviderOptions } from "../ai/models";
import { withQuotaRetry } from "../util/throttle";
import { PDP_SYSTEM_PROMPT, buildPdpUserPrompt } from "./prompt";
import type { ParsedPdp, KeywordGapItem, PdpGapAnalysis } from "./types";

const severity = z.enum(["high", "med", "low"]);
const effort = z.enum(["low", "med", "high"]);

/** AI output schema — kept tight so the model returns scannable, bounded lists. */
const PdpGapSchema = z.object({
  summary: z.string(),
  onPageDeficits: z
    .array(
      z.object({
        dimension: z.string(),
        ours: z.string(),
        competitor: z.string(),
        severity,
        fix: z.string(),
      })
    )
    .max(10),
  contentGaps: z
    .array(
      z.object({
        topic: z.string(),
        whyItMatters: z.string(),
        evidenceFromCompetitor: z.string(),
        suggestion: z.string(),
      })
    )
    .max(10),
  keywordGaps: z
    .array(z.object({ keyword: z.string(), recommendation: z.string() }))
    .max(15),
  prioritizedActions: z
    .array(
      z.object({
        action: z.string(),
        impact: severity,
        effort,
        rationale: z.string(),
      })
    )
    .max(12),
});

/**
 * Run the AI gap analysis for a PDP comparison. Wrapped in withQuotaRetry (free
 * Gemini tier spikes) and with "thinking" disabled via chatProviderOptions.
 */
export async function analyzePdpGap(
  ours: ParsedPdp,
  competitors: ParsedPdp[],
  keywordGap: KeywordGapItem[],
  targetKeywords: string[]
): Promise<PdpGapAnalysis> {
  const model = await draftModel();
  const providerOptions = await chatProviderOptions();
  const { object } = await withQuotaRetry(() =>
    generateObject({
      model,
      schema: PdpGapSchema,
      system: PDP_SYSTEM_PROMPT,
      prompt: buildPdpUserPrompt(ours, competitors, keywordGap, targetKeywords),
      providerOptions,
    })
  );
  return object;
}

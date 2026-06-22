import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { EmbeddingModel, LanguageModel } from "ai";

/**
 * Provider layer. Defaults to Google Gemini (free tier covers BOTH chat AND
 * embeddings). OpenRouter is supported for chat models, but it has no embeddings —
 * so a Google key is still required for semantic recall.
 *
 * Env:
 *   GOOGLE_GENERATIVE_AI_API_KEY  — Gemini key from https://aistudio.google.com/apikey
 *   OPENROUTER_API_KEY            — optional, for chat via OpenRouter
 *   AI_PROVIDER                   — "google" (default) | "openrouter" (chat only)
 *   SEO_DRAFT_MODEL / SEO_TAG_MODEL / SEO_EMBED_MODEL — overridable model ids
 */

const GOOGLE_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

const PROVIDER = (
  process.env.AI_PROVIDER?.toLowerCase() ||
  (OPENROUTER_KEY && !GOOGLE_KEY ? "openrouter" : "google")
) as "google" | "openrouter";

// Defaults differ per provider (OpenRouter ids are namespaced).
export const DRAFT_MODEL_ID =
  process.env.SEO_DRAFT_MODEL ??
  (PROVIDER === "openrouter" ? "google/gemini-2.5-flash" : "gemini-2.5-flash");
export const TAG_MODEL_ID =
  process.env.SEO_TAG_MODEL ??
  (PROVIDER === "openrouter" ? "google/gemini-2.5-flash-lite" : "gemini-2.5-flash-lite");
export const EMBED_MODEL_ID =
  process.env.SEO_EMBED_MODEL ?? "gemini-embedding-001";

export const ACTIVE_PROVIDER = PROVIDER;

function google() {
  return createGoogleGenerativeAI({ apiKey: GOOGLE_KEY });
}
function openrouter() {
  return createOpenRouter({ apiKey: OPENROUTER_KEY });
}

export function draftModel(): LanguageModel {
  return PROVIDER === "openrouter"
    ? openrouter().chat(DRAFT_MODEL_ID)
    : google()(DRAFT_MODEL_ID);
}

export function tagModel(): LanguageModel {
  return PROVIDER === "openrouter"
    ? openrouter().chat(TAG_MODEL_ID)
    : google()(TAG_MODEL_ID);
}

/** Embeddings are Google-only (OpenRouter has none). */
export function embedModel(): EmbeddingModel {
  return google().textEmbeddingModel(EMBED_MODEL_ID);
}

/**
 * Provider options for chat calls. Disables Gemini "thinking" on free-tier
 * generation: reasoning tokens are billed/counted as OUTPUT and against the
 * tokens-per-minute cap, and our short structured SEO fields don't need them.
 * (flash-lite already defaults to no thinking; budget 0 is a safe no-op there.)
 * Returns undefined for OpenRouter — leave its provider defaults alone.
 */
export function chatProviderOptions() {
  if (PROVIDER === "openrouter") return undefined;
  return { google: { thinkingConfig: { thinkingBudget: 0 } } } as const;
}

/** Gemini model + Google Search grounding tool, for AI-search visibility checks. */
export function googleSearchModel(): LanguageModel {
  return google()(DRAFT_MODEL_ID);
}
export function googleSearchTool() {
  return google().tools.googleSearch({});
}

/** Chat (generation/tagging) is configured if either provider key is present. */
export function isAiConfigured() {
  return Boolean(GOOGLE_KEY || OPENROUTER_KEY);
}

/** Embeddings + semantic recall require a Google key specifically. */
export function isEmbeddingConfigured() {
  return Boolean(GOOGLE_KEY);
}

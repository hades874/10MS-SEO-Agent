import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { EmbeddingModel, LanguageModel } from "ai";
import { getApiKey } from "../keys";

/**
 * Provider layer. Defaults to Google Gemini (free tier covers BOTH chat AND
 * embeddings). OpenRouter is supported for chat models, but it has no embeddings —
 * so a Google key is still required for semantic recall.
 *
 * Keys are resolved PER REQUEST (browser cookie first, then env) via getApiKey, so
 * every accessor here is async. Callers are already in async contexts — `await`
 * the factory before use.
 *
 *   GOOGLE_GENERATIVE_AI_API_KEY  — Gemini key from https://aistudio.google.com/apikey
 *   OPENROUTER_API_KEY            — optional, for chat via OpenRouter
 *   AI_PROVIDER                   — "google" (default) | "openrouter" (chat only)
 *   SEO_DRAFT_MODEL / SEO_TAG_MODEL / SEO_EMBED_MODEL — overridable model ids
 */

export type AiProvider = "google" | "openrouter";

async function aiKeys() {
  const [google, openrouter] = await Promise.all([
    getApiKey("GOOGLE_GENERATIVE_AI_API_KEY"),
    getApiKey("OPENROUTER_API_KEY"),
  ]);
  return { google, openrouter };
}

/** Which provider to use this request. AI_PROVIDER env wins; else infer from keys. */
export async function activeProvider(): Promise<AiProvider> {
  const env = process.env.AI_PROVIDER?.toLowerCase();
  if (env === "google" || env === "openrouter") return env;
  const { google, openrouter } = await aiKeys();
  return openrouter && !google ? "openrouter" : "google";
}

// Model ids differ per provider (OpenRouter ids are namespaced).
export async function draftModelId(): Promise<string> {
  if (process.env.SEO_DRAFT_MODEL) return process.env.SEO_DRAFT_MODEL;
  return (await activeProvider()) === "openrouter"
    ? "google/gemini-2.5-flash"
    : "gemini-2.5-flash";
}
export async function tagModelId(): Promise<string> {
  if (process.env.SEO_TAG_MODEL) return process.env.SEO_TAG_MODEL;
  return (await activeProvider()) === "openrouter"
    ? "google/gemini-2.5-flash-lite"
    : "gemini-2.5-flash-lite";
}
export function embedModelId(): string {
  return process.env.SEO_EMBED_MODEL ?? "gemini-embedding-001";
}

async function google() {
  const { google: key } = await aiKeys();
  return createGoogleGenerativeAI({ apiKey: key });
}
async function openrouter() {
  const { openrouter: key } = await aiKeys();
  return createOpenRouter({ apiKey: key });
}

export async function draftModel(): Promise<LanguageModel> {
  if ((await activeProvider()) === "openrouter") {
    return (await openrouter()).chat(await draftModelId());
  }
  return (await google())(await draftModelId());
}

export async function tagModel(): Promise<LanguageModel> {
  if ((await activeProvider()) === "openrouter") {
    return (await openrouter()).chat(await tagModelId());
  }
  return (await google())(await tagModelId());
}

/** Embeddings are Google-only (OpenRouter has none). */
export async function embedModel(): Promise<EmbeddingModel> {
  return (await google()).textEmbeddingModel(embedModelId());
}

/**
 * Provider options for chat calls. Disables Gemini "thinking" on free-tier
 * generation: reasoning tokens are billed/counted as OUTPUT and against the
 * tokens-per-minute cap, and our short structured SEO fields don't need them.
 * (flash-lite already defaults to no thinking; budget 0 is a safe no-op there.)
 * Returns undefined for OpenRouter — leave its provider defaults alone.
 */
export async function chatProviderOptions() {
  if ((await activeProvider()) === "openrouter") return undefined;
  return { google: { thinkingConfig: { thinkingBudget: 0 } } } as const;
}

/** Gemini model + Google Search grounding tool, for AI-search visibility checks. */
export async function googleSearchModel(): Promise<LanguageModel> {
  return (await google())(await draftModelId());
}
export async function googleSearchTool() {
  return (await google()).tools.googleSearch({});
}

/** Chat (generation/tagging) is configured if either provider key is present. */
export async function isAiConfigured(): Promise<boolean> {
  const { google, openrouter } = await aiKeys();
  return Boolean(google || openrouter);
}

/** Embeddings + semantic recall require a Google key specifically. */
export async function isEmbeddingConfigured(): Promise<boolean> {
  const { google } = await aiKeys();
  return Boolean(google);
}

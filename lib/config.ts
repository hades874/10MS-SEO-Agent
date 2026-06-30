import { isDbConfigured } from "./db";
import {
  activeProvider,
  draftModelId,
  tagModelId,
  embedModelId,
  isAiConfigured,
  isEmbeddingConfigured,
} from "./ai/models";
import { getApiKey } from "./keys";
import { activeSerpProvider } from "./serp/provider";
import { activeKeywordProvider } from "./keywords/provider";
import { isGscConfigured } from "./rank/gsc";

export interface ProviderStatus {
  name: string;
  configured: boolean;
  detail?: string;
  note?: string;
}

export interface SystemConfig {
  db: ProviderStatus;
  ai: {
    provider: string;
    draftModel: string;
    tagModel: string;
    embedModel: string;
    chat: ProviderStatus;
    embeddings: ProviderStatus;
  };
  serp: ProviderStatus;
  keywords: ProviderStatus;
  aiVisibility: ProviderStatus[];
  rank: ProviderStatus[];
  brand: { name: string; siteOrigin: string };
}

/** Read-only snapshot of what's configured (cookie/env reads), for /settings. */
export async function systemConfig(): Promise<SystemConfig> {
  const [
    serp,
    keywords,
    provider,
    draftModel,
    tagModel,
    aiOk,
    embedOk,
    openaiKey,
  ] = await Promise.all([
    activeSerpProvider(),
    activeKeywordProvider(),
    activeProvider(),
    draftModelId(),
    tagModelId(),
    isAiConfigured(),
    isEmbeddingConfigured(),
    getApiKey("OPENAI_API_KEY"),
  ]);
  const embedModel = embedModelId();

  return {
    db: {
      name: "Neon Postgres",
      configured: isDbConfigured(),
      note: isDbConfigured() ? undefined : "Set DATABASE_URL in .env.local",
    },
    ai: {
      provider,
      draftModel,
      tagModel,
      embedModel,
      chat: {
        name: provider === "openrouter" ? "OpenRouter" : "Google Gemini",
        configured: aiOk,
        detail: `${draftModel} (draft) · ${tagModel} (tag)`,
        note: aiOk ? undefined : "Set your Gemini key in Settings below",
      },
      embeddings: {
        name: "Google embeddings",
        configured: embedOk,
        detail: embedModel,
        note: embedOk
          ? undefined
          : "Needs a Google Gemini key (Google-only)",
      },
    },
    serp: {
      name:
        serp === "serper"
          ? "Serper (Google)"
          : serp === "brave"
          ? "Brave Search"
          : "DuckDuckGo (keyless)",
      configured: true,
      detail: serp === "duckduckgo" ? "Free fallback — rate-limits under load" : "Active key",
      note:
        serp === "duckduckgo"
          ? "Add a Serper or Brave key in Settings (free) for reliable Google results"
          : undefined,
    },
    keywords: {
      name: keywords === "dataforseo" ? "DataForSEO (paid)" : "Google Autocomplete (free)",
      configured: true,
      detail:
        keywords === "dataforseo"
          ? "Real search volume"
          : "Demand = suggestion breadth (directional)",
      note:
        keywords === "autocomplete"
          ? "Set DATAFORSEO_API_KEY for real search volume (adapter is scaffolded)"
          : undefined,
    },
    aiVisibility: [
      {
        name: "Gemini (Google-grounded)",
        configured: embedOk,
        note: embedOk ? undefined : "Needs a Google Gemini key",
      },
      {
        name: "ChatGPT",
        configured: Boolean(openaiKey),
        note: openaiKey ? undefined : "Add an OpenAI key in Settings to enable",
      },
    ],
    rank: [
      { name: "SERP (web position)", configured: true, detail: "Live default" },
      {
        name: "Google Search Console",
        configured: isGscConfigured(),
        detail: "Exact impressions/clicks/CTR",
        note: isGscConfigured() ? undefined : "Scaffolded — set GSC_* creds to enable",
      },
    ],
    brand: {
      name: process.env.BRAND_NAME ?? "10 Minute School",
      siteOrigin: process.env.SITE_ORIGIN ?? "https://10minuteschool.com",
    },
  };
}

import { isDbConfigured } from "./db";
import {
  ACTIVE_PROVIDER,
  DRAFT_MODEL_ID,
  TAG_MODEL_ID,
  EMBED_MODEL_ID,
  isAiConfigured,
  isEmbeddingConfigured,
} from "./ai/models";
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

/** Read-only snapshot of what's configured (server-side env reads), for /settings. */
export function systemConfig(): SystemConfig {
  const serp = activeSerpProvider();
  const keywords = activeKeywordProvider();

  return {
    db: {
      name: "Neon Postgres",
      configured: isDbConfigured(),
      note: isDbConfigured() ? undefined : "Set DATABASE_URL in .env.local",
    },
    ai: {
      provider: ACTIVE_PROVIDER,
      draftModel: DRAFT_MODEL_ID,
      tagModel: TAG_MODEL_ID,
      embedModel: EMBED_MODEL_ID,
      chat: {
        name: ACTIVE_PROVIDER === "openrouter" ? "OpenRouter" : "Google Gemini",
        configured: isAiConfigured(),
        detail: `${DRAFT_MODEL_ID} (draft) · ${TAG_MODEL_ID} (tag)`,
        note: isAiConfigured() ? undefined : "Set GOOGLE_GENERATIVE_AI_API_KEY",
      },
      embeddings: {
        name: "Google embeddings",
        configured: isEmbeddingConfigured(),
        detail: EMBED_MODEL_ID,
        note: isEmbeddingConfigured()
          ? undefined
          : "Needs GOOGLE_GENERATIVE_AI_API_KEY (Google-only)",
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
          ? "Set SERPER_API_KEY or BRAVE_SEARCH_API_KEY (free) for reliable Google results"
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
        configured: isEmbeddingConfigured(),
        note: isEmbeddingConfigured() ? undefined : "Needs GOOGLE_GENERATIVE_AI_API_KEY",
      },
      {
        name: "ChatGPT",
        configured: Boolean(process.env.OPENAI_API_KEY),
        note: process.env.OPENAI_API_KEY ? undefined : "Add OPENAI_API_KEY to enable",
      },
      {
        name: "Perplexity",
        configured: Boolean(process.env.PERPLEXITY_API_KEY),
        note: process.env.PERPLEXITY_API_KEY ? undefined : "Add PERPLEXITY_API_KEY to enable",
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

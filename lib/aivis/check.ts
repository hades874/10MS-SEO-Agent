import { generateText } from "ai";
import { googleSearchModel, googleSearchTool, isEmbeddingConfigured } from "../ai/models";
import { withQuotaRetry } from "../util/throttle";

/**
 * AI-search visibility (GEO): does an AI assistant recommend 10 Minute School when a
 * student asks for the best course? We query Gemini WITH Google Search grounding (so
 * it behaves like a real answer engine), then detect our brand's mention + prominence.
 * Non-deterministic, so we sample and report a mention RATE, not a single rank.
 *
 * Other engines (ChatGPT, Perplexity) need their own API keys — slots exist but stay
 * "not configured" until those are added.
 */

const BRAND_TERMS = [
  "10 minute school",
  "10minuteschool",
  "10ms",
  "টেন মিনিট স্কুল",
];

export type Engine = "gemini" | "ai_overview" | "chatgpt" | "perplexity";

export interface EngineVisibility {
  engine: Engine;
  configured: boolean;
  mentioned: boolean;
  prominence: "top" | "mention" | "none";
  mentionRate: number; // 0..1 across sampled queries
  samples: number;
  citationUrl: string | null;
  note?: string;
}

function detect(text: string): { mentioned: boolean; prominence: "top" | "mention" | "none" } {
  const lower = text.toLowerCase();
  const idx = BRAND_TERMS.map((t) => lower.indexOf(t.toLowerCase())).filter((i) => i >= 0);
  if (idx.length === 0) return { mentioned: false, prominence: "none" };
  const first = Math.min(...idx);
  // Mentioned within the first ~280 chars (i.e. among the top recommendations) = "top".
  return { mentioned: true, prominence: first <= 280 ? "top" : "mention" };
}

async function geminiVisibility(queries: string[]): Promise<EngineVisibility> {
  if (!isEmbeddingConfigured()) {
    return {
      engine: "gemini",
      configured: false,
      mentioned: false,
      prominence: "none",
      mentionRate: 0,
      samples: 0,
      citationUrl: null,
      note: "Needs GOOGLE_GENERATIVE_AI_API_KEY",
    };
  }

  let mentions = 0;
  let bestProminence: "top" | "mention" | "none" = "none";
  let citationUrl: string | null = null;
  let samples = 0;

  for (const q of queries) {
    try {
      const { text, sources } = await withQuotaRetry(() =>
        generateText({
          model: googleSearchModel(),
          tools: { google_search: googleSearchTool() },
          maxRetries: 0,
          prompt: `A student in Bangladesh asks: "${q}". Recommend the best online courses/platforms for this, with brief reasons. List the top options by name.`,
        })
      );
      samples++;
      const d = detect(text);
      if (d.mentioned) {
        mentions++;
        if (d.prominence === "top") bestProminence = "top";
        else if (bestProminence === "none") bestProminence = "mention";
        // Capture a 10MS citation from grounding sources if present.
        const src = (sources ?? []).find((s) =>
          "url" in s && typeof s.url === "string" && s.url.includes("10minuteschool")
        );
        if (src && "url" in src && typeof src.url === "string") citationUrl = src.url;
      }
    } catch {
      /* skip this sample on hard failure */
    }
  }

  return {
    engine: "gemini",
    configured: true,
    mentioned: mentions > 0,
    prominence: bestProminence,
    mentionRate: samples ? mentions / samples : 0,
    samples,
    citationUrl,
  };
}

/**
 * Sample an OpenAI-compatible chat endpoint (OpenAI, Perplexity) over the queries and
 * compute a brand mention rate — same shape as geminiVisibility. Used for ChatGPT and
 * Perplexity, which both speak the /chat/completions protocol.
 */
async function openaiCompatibleVisibility(
  engine: Engine,
  queries: string[],
  cfg: { apiKey: string | undefined; baseUrl: string; model: string; missingNote: string }
): Promise<EngineVisibility> {
  if (!cfg.apiKey) {
    return {
      engine,
      configured: false,
      mentioned: false,
      prominence: "none",
      mentionRate: 0,
      samples: 0,
      citationUrl: null,
      note: cfg.missingNote,
    };
  }

  let mentions = 0;
  let bestProminence: "top" | "mention" | "none" = "none";
  let citationUrl: string | null = null;
  let samples = 0;

  for (const q of queries) {
    try {
      const text = await withQuotaRetry(async () => {
        const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: [
              {
                role: "user",
                content: `A student in Bangladesh asks: "${q}". Recommend the best online courses/platforms for this, with brief reasons. List the top options by name.`,
              },
            ],
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) throw new Error(`${engine} ${res.status}: ${await res.text()}`);
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
          citations?: string[];
        };
        const content = data.choices?.[0]?.message?.content ?? "";
        // Perplexity returns web citations; capture a 10MS one if present.
        const cite = (data.citations ?? []).find((u) => u.includes("10minuteschool"));
        if (cite) citationUrl = cite;
        return content;
      });
      samples++;
      const d = detect(text);
      if (d.mentioned) {
        mentions++;
        if (d.prominence === "top") bestProminence = "top";
        else if (bestProminence === "none") bestProminence = "mention";
      }
    } catch {
      /* skip this sample on hard failure */
    }
  }

  return {
    engine,
    configured: true,
    mentioned: mentions > 0,
    prominence: bestProminence,
    mentionRate: samples ? mentions / samples : 0,
    samples,
    citationUrl,
  };
}

/** Perplexity is web-grounded by design → a strong GEO signal. */
function perplexityVisibility(queries: string[]): Promise<EngineVisibility> {
  return openaiCompatibleVisibility("perplexity", queries, {
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseUrl: "https://api.perplexity.ai",
    model: process.env.PERPLEXITY_MODEL ?? "sonar",
    missingNote: "Add PERPLEXITY_API_KEY to enable",
  });
}

/**
 * ChatGPT without a web-search tool answers from model memory, so this is a weaker
 * (non-grounded) signal than Gemini/Perplexity — still sampled into a mention rate.
 */
function chatgptVisibility(queries: string[]): Promise<EngineVisibility> {
  return openaiCompatibleVisibility("chatgpt", queries, {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    missingNote: "Add OPENAI_API_KEY to enable",
  });
}

export interface AiVisibilityResult {
  queries: string[];
  engines: EngineVisibility[];
}

/** Build natural student queries from course facts, then check each engine. */
export function buildVisibilityQueries(facts: {
  level?: string | null;
  year?: string | null;
  subject?: string | null;
}): string[] {
  const { level, subject, year } = facts;
  const y = year ? (year.length === 2 ? `20${year}` : year) : "";
  const subj = subject && subject !== "Multiple" ? subject : "";
  const base = [level, y, subj].filter(Boolean).join(" ").trim();
  const queries = [
    `best ${base} online course in Bangladesh`,
    `which platform is best to prepare for ${[level, subj].filter(Boolean).join(" ")} exam online in Bangladesh`,
  ];
  return queries.filter((q) => q.replace(/\s+/g, " ").trim().length > 25);
}

export async function checkAiVisibility(facts: {
  level?: string | null;
  year?: string | null;
  subject?: string | null;
}): Promise<AiVisibilityResult> {
  const queries = buildVisibilityQueries(facts);
  // Engines auto-activate when their key is present; otherwise return a "not
  // configured" slot (free Gemini-only default is unchanged).
  const [gemini, chatgpt, perplexity] = await Promise.all([
    geminiVisibility(queries),
    chatgptVisibility(queries),
    perplexityVisibility(queries),
  ]);
  return {
    queries,
    engines: [gemini, chatgpt, perplexity],
  };
}

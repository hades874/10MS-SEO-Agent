import { generateText } from "ai";
import { googleSearchModel, googleSearchTool, isEmbeddingConfigured } from "../ai/models";
import { getApiKey } from "../keys";
import { withQuotaRetry, classifyError } from "../util/throttle";

// Interactive tracking should fail fast on a rate limit rather than retrying for ~70s
// and appearing to hang — one short retry, then bail and report it.
const INTERACTIVE_RETRY = { retries: 1, maxWaitMs: 8000 } as const;

/**
 * AI-search visibility (GEO): does an AI assistant recommend 10 Minute School when a
 * student asks for the best course? We query Gemini WITH Google Search grounding (so
 * it behaves like a real answer engine), then detect our brand's mention + prominence.
 * Non-deterministic, so we sample and report a mention RATE, not a single rank.
 *
 * ChatGPT is an optional second engine — its slot stays "not configured" until an
 * OpenAI key is added.
 */

const BRAND_TERMS = [
  "10 minute school",
  "10minuteschool",
  "10ms",
  "টেন মিনিট স্কুল",
];

export type Engine = "gemini" | "ai_overview" | "chatgpt";

export interface EngineVisibility {
  engine: Engine;
  configured: boolean;
  mentioned: boolean;
  prominence: "top" | "mention" | "none";
  mentionRate: number; // 0..1 across sampled queries
  samples: number;
  citationUrl: string | null;
  note?: string;
  rateLimited?: boolean; // true if sampling was cut short by a quota/overload error
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
  if (!(await isEmbeddingConfigured())) {
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
  let rateLimited = false;

  for (const q of queries) {
    try {
      const model = await googleSearchModel();
      const searchTool = await googleSearchTool();
      const { text, sources } = await withQuotaRetry(
        () =>
          generateText({
            model,
            tools: { google_search: searchTool },
            maxRetries: 0,
            prompt: `A student in Bangladesh asks: "${q}". Recommend the best online courses/platforms for this, with brief reasons. List the top options by name.`,
          }),
        INTERACTIVE_RETRY
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
    } catch (e) {
      console.error("checkAiVisibility (gemini): sample failed:", e);
      // A quota/overload error will repeat for the remaining queries — stop sampling
      // and report it rather than waiting through each one.
      if (classifyError(e)) {
        rateLimited = true;
        break;
      }
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
    rateLimited,
    note: rateLimited && samples === 0 ? "Rate limited — try again shortly" : undefined,
  };
}

/**
 * Sample an OpenAI-compatible chat endpoint over the queries and compute a brand
 * mention rate — same shape as geminiVisibility. Used for ChatGPT (the /chat/completions
 * protocol).
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
  const citationUrl: string | null = null;
  let samples = 0;
  let rateLimited = false;

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
        };
        return data.choices?.[0]?.message?.content ?? "";
      }, INTERACTIVE_RETRY);
      samples++;
      const d = detect(text);
      if (d.mentioned) {
        mentions++;
        if (d.prominence === "top") bestProminence = "top";
        else if (bestProminence === "none") bestProminence = "mention";
      }
    } catch (e) {
      console.error(`checkAiVisibility (${engine}): sample failed:`, e);
      // A quota/overload error will repeat for the remaining queries — stop sampling
      // and report it rather than waiting through each one.
      if (classifyError(e)) {
        rateLimited = true;
        break;
      }
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
    rateLimited,
    note: rateLimited && samples === 0 ? "Rate limited — try again shortly" : undefined,
  };
}

/**
 * ChatGPT without a web-search tool answers from model memory, so this is a weaker
 * (non-grounded) signal than Gemini — still sampled into a mention rate.
 */
async function chatgptVisibility(queries: string[]): Promise<EngineVisibility> {
  return openaiCompatibleVisibility("chatgpt", queries, {
    apiKey: await getApiKey("OPENAI_API_KEY"),
    baseUrl: "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    missingNote: "Add your OpenAI key in Settings to enable",
  });
}

export interface AiVisibilityResult {
  queries: string[];
  engines: EngineVisibility[];
  rateLimited: boolean; // any configured engine was cut short by a quota/overload error
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
  // ChatGPT auto-activates when an OpenAI key is present; otherwise it returns a "not
  // configured" slot (free Gemini-only default is unchanged).
  const [gemini, chatgpt] = await Promise.all([
    geminiVisibility(queries),
    chatgptVisibility(queries),
  ]);
  const engines = [gemini, chatgpt];
  return {
    queries,
    engines,
    rateLimited: engines.some((e) => e.rateLimited),
  };
}

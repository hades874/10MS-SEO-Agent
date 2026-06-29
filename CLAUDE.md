# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A memory-backed SEO agent for 10 Minute School (10MS) course pages. It remembers past courses and auto-generates a full **bilingual (Bangla + English)** SEO bundle for a new course — meta title/description, keywords, Open Graph tags, and Product JSON-LD — then scores it. It also does competitor analysis, keyword research, and Google/AI-search (GEO) visibility tracking, all defaulting to free keyless data sources with optional paid upgrades.

Stack: Next.js 16 (App Router, React 19) + Vercel AI SDK v6 + Neon Postgres (pgvector) via Drizzle ORM. TypeScript throughout, ESM (`"type": "module"`).

## Commands

```bash
npm run dev            # Next dev server → http://localhost:3000
npm run build          # production build
npm run lint           # next lint
npm run check          # verify DATABASE_URL + AI key (connection, pgvector, tables, model calls)

# Database (Drizzle + Neon)
npm run db:init        # CREATE EXTENSION vector — run BEFORE db:push
npm run db:push        # create/update tables from lib/db/schema.ts
npm run db:studio      # browse the DB
npm run db:generate    # generate SQL migrations into ./drizzle

# Data pipeline
npm run import:csv               # parse + load seed CSV, AI back-fill, embeddings, style mining
npm run import:csv -- --no-ai    # import without keyword back-fill/embeddings (no AI key yet)
npm run backfill:keywords        # AI-backfill keywords for rows missing them (separate from import)
npm run seed:style               # re-mine just the house-style bank
```

There is no test runner configured. `npm run check` (scripts/check-env.ts) is the closest thing to a smoke test — run it after touching DB or AI config.

First-time setup order matters: `db:init` (extension) → `db:push` (tables) → `import:csv` (seed).

## Environment

**API keys are browser-supplied first.** Users set their AI + data-source keys on `/settings`; the keys API route (`app/api/keys/route.ts`) saves them as httpOnly cookies (`seo_key_<NAME>`), and `lib/keys.ts#getApiKey(name)` resolves each key **per request — cookie first, then `process.env` fallback**. So nothing ships with keys: env vars are now a local-dev/scripts convenience, not the primary source. The managed (browser-settable) keys are listed in `MANAGED_KEYS` (lib/keys.ts): Gemini, OpenRouter, OpenAI, Perplexity, Serper, Brave. `DATABASE_URL` is intentionally NOT managed — it stays env-only (server infrastructure, not a per-user browser secret).

Because keys are per-request, the provider/selector accessors are **async** (see below). Standalone scripts have no request scope, so `getApiKey` transparently falls back to `.env.local`.

Secrets live in `.env.local` (see `.env.example`) for local dev. Two matter most:
- `DATABASE_URL` — Neon Postgres connection string (env-only).
- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini key (free tier covers both generation AND embeddings); settable in the browser too.

Optional: `OPENROUTER_API_KEY` + `AI_PROVIDER=openrouter` (chat only — embeddings still require a Google key). Model overrides: `SEO_DRAFT_MODEL`, `SEO_TAG_MODEL`, `SEO_EMBED_MODEL`. Other knobs: `EMBED_DIM` (default 768), `IMPORT_THROTTLE_MS` (default 6500), `SITE_ORIGIN`, `BRAND_NAME`.

Everything below is **optional and pluggable** — each unlocks a better data source for Phases 2–4 without any code change, and the app falls back to a free keyless default when absent (see the pluggable-provider convention). All have free tiers unless noted:
- `SERPER_API_KEY` (recommended) or `BRAVE_SEARCH_API_KEY` — real Google/Brave SERP for competitor discovery + rank checks. Default is keyless DuckDuckGo scraping, which rate-limits/blocks under load.
- `DATAFORSEO_API_KEY` — real keyword search volume (paid; adapter scaffolded, not yet implemented). Default is free Google Autocomplete (demand = suggestion breadth, directional only).
- `OPENAI_API_KEY` (+ `OPENAI_MODEL`), `PERPLEXITY_API_KEY` (+ `PERPLEXITY_MODEL`) — extra AI-visibility engines. Gemini (the Google key) is the default engine; these slots stay "not configured" until added.
- `GSC_SITE_URL` + (`GSC_SERVICE_ACCOUNT_JSON` | `GSC_REFRESH_TOKEN`) — Google Search Console for exact impressions/clicks/CTR (scaffolded, not yet implemented). Default rank path is SERP-based.
- `CRON_SECRET` — bearer token guarding the `/api/cron/recheck` endpoint in production.

Path alias: `@/*` maps to repo root.

## Architecture

### The memory model (3 layers)
This is the core concept; see `lib/db/schema.ts`.
1. **Structured records** (`courses` + versioned `seo_records`) — source of truth, one normalized row per course with derived facets (level/year/subject/batchType/group/isFree).
2. **Semantic recall** (`seo_embeddings`, pgvector HNSW index) — a new course retrieves its nearest past courses to ground the draft.
3. **House style** (`style_memory`) — mined phrase bank + curated brand/template rules so output sounds like 10MS.

The later-phase tables (`competitor_snapshots`, `keyword_research`, `rank_checks`, `ai_visibility_checks`, `validation_scores`) are now written by Phases 2–4. `validation_scores` keeps a per-version score history; `rank_checks` / `ai_visibility_checks` are append-only (recall reads the latest per keyword/engine via `lib/queries.ts`).

### Generation flow (Phase 1 MVP)
The pipeline for "new course → SEO bundle" lives in `lib/`:
1. `lib/actions.ts` (`generateForNewCourse`) is the Server Action entry point. It derives facets, suggests a slug, then pulls grounding from memory.
2. `lib/memory/recall.ts` does **facet-first + vector recall**: filter candidates by facets (subject/level/batchType, progressively relaxed) to build a pool, *then* rank by embedding cosine distance within it. Pure vector search over the small corpus (~20 rows) is too noisy. Falls back to facet ordering if embeddings/AI are unavailable.
3. `lib/generate/seo.ts` (`generateSeo`) runs a **generate → validate → repair loop** via AI SDK `generateObject` with a Zod schema. It does NOT trust the LLM to count characters — it measures `visibleLength` itself and re-prompts (up to `maxRepairs`, default 2) until length rules pass.
4. `lib/generate/buildSchema.ts` builds Product JSON-LD **deterministically** from stored fields — never AI-guessed — so the schema always matches the page. Missing fields (price/sku/image) are flagged in `missing[]`, not invented.
5. `lib/score/validate.ts` (`scoreRecord`) produces a weighted 0–100 validation score across 9 dimensions (title/desc length, keyword usage, bilingual completeness, OG, schema, image meta, slug sanity, uniqueness). `lib/actions.ts` (`saveCourse`) persists the course + seo_record (+ embedding) only on explicit save.

### Versioned writes (`lib/actions.ts`)
All persistence routes through one private helper, `writeSeoVersion`, shared by `saveCourse` (v1, `aiGenerated: true`) and `updateCourseSeo` (human edits → vN+1, `aiGenerated: false`). It always rebuilds the JSON-LD deterministically, re-scores, inserts a new `seo_records` row, **refreshes the single embedding per course** (delete + re-insert), and appends a `validation_scores` history row. Edits never mutate a prior version — every save is a new immutable version, which is what powers version history/diff (`lib/util/diff.ts`, `components/VersionHistory.tsx`). Read paths live in `lib/queries.ts` (server-only selects), separate from the `"use server"` mutations in `actions.ts`.

### Phase 2–4 pipelines (memory-grounded, all in `lib/`)
Each is a Server Action in `actions.ts` wrapping a module; each persists best-effort (a DB failure never fails the user-facing call) and degrades to a free keyless source when unconfigured:
- **Competitor analysis** (`lib/competitors/*`, `analyzeCompetitorsAction`): discover BD-watchlist URLs that rank for a keyword (`search.ts` over the SERP provider, against the curated domain list in `config.ts`) → `fetch.ts` → `parse.ts` (cheerio) → `score.ts`, sorted strongest-first, cached to `competitor_snapshots`. If the keyless DuckDuckGo path returns zero results it throws an actionable "set SERPER_API_KEY" error rather than a misleading "no competitors".
- **Keyword research** (`lib/keywords/*`, `keywordResearchAction`): free Google Autocomplete expansion (`autocomplete.ts`); demand is a directional *suggestion-breadth* proxy, **not** real volume. Cached to `keyword_research`.
- **Rank + AI-visibility tracking** (`lib/track.ts`, `trackCourseAction` and the cron): `trackCourse` runs web rank (`lib/rank/serp.ts`, finds the 10MS position in SERP results for up to 3 keywords) and AI-search/GEO visibility (`lib/aivis/check.ts`) together, persisting both. AI visibility queries Gemini **with Google Search grounding** (so it answers like a real answer engine), samples multiple queries, and reports a brand **mention rate**, not a single rank; ChatGPT/Perplexity engines speak the OpenAI `/chat/completions` shape and activate when their keys are present.

### Resilience: quota/overload retry
Free-tier Gemini caps requests-per-minute and any model can briefly return "high demand"/overloaded. Wrap provider calls that can spike in `withQuotaRetry` (`lib/util/throttle.ts`): it classifies 429 (honors the "retry in Ns" hint) vs overload (exponential backoff) and retries transient failures only. `generateForNewCourse` also maps a surfaced overload error to a friendly "model is busy, try again" message.

### CSV import pipeline
`lib/memory/parseCsv.ts` → `lib/memory/importCourses.ts`. The seed CSV (`csv/SEO Data - Sheet1.csv`) is a quirky vertical "block" layout with mislabeled/swapped Bangla-English rows, drifting columns, and incomplete blocks. The parser normalizes label variants, flags partial blocks (`completeness`), and — critically — assigns Bangla/English by **Unicode script, not by CSV label** (see below). Import mines style and creates embeddings; keyword back-fill is OFF by default during import (it's the free-tier rate-limit bottleneck) — use `npm run backfill:keywords` separately.

### Two cross-cutting conventions to respect
- **Language by script, not label** (`lib/util/lang.ts`): Bangla vs English is decided from actual Unicode characters (Bengali block U+0980–U+09FF), because the seed data routinely mislabels/swaps the two. Use `assignByScript` for title/desc pairs and `detectLang` for single strings.
- **Grapheme-aware length** (`visibleLength` in `lib/util/lang.ts`): SEO character limits are measured in user-perceived characters via `Intl.Segmenter`, NOT `string.length` — Bangla conjuncts/combining marks would otherwise overcount. Always use `visibleLength` for any character-limit logic; the limits live in `LIMITS` in `lib/score/validate.ts`.

### Graceful degradation when unconfigured
The app boots without a DB or AI key. `lib/db/index.ts` is a lazy singleton that only throws when actually used; `isDbConfigured()` / `isAiConfigured()` / `isEmbeddingConfigured()` gate behavior, and `lib/status.ts` + `components/SetupBanner.tsx` surface what's missing in the UI. Server Actions return `{ ok: false, error }` rather than throwing. Preserve this pattern — don't introduce import-time crashes when env is absent. Note `isEmbeddingConfigured()` (Google key) is distinct from `isAiConfigured()` (either provider): OpenRouter can do chat but not embeddings. **`isAiConfigured()` / `isEmbeddingConfigured()` are now `async`** (they resolve the per-request key) — `await` them.

### Provider layer
`lib/ai/models.ts` is the single place that resolves the AI provider + model ids. Default is Google Gemini; OpenRouter is chat-only. Always go through `draftModel()` / `tagModel()` / `embedModel()` rather than instantiating providers directly. Embeddings are Google-only. **Because keys are resolved per request (browser cookie → env, via `lib/keys.ts`), every accessor here is `async`** — `await draftModel()`, `await chatProviderOptions()`, `await activeProvider()`, `await draftModelId()`, etc. (`embedModelId()` is the lone sync one — the embed model id is provider-independent). `chatProviderOptions()` disables Gemini "thinking" on free-tier generation (reasoning tokens count against the TPM cap and our short fields don't need them); `googleSearchModel()` / `googleSearchTool()` add Search grounding for AI-visibility.

### Pluggable data providers (free default → paid swap)
Beyond AI, three external data sources follow the same shape: an **`async activeXProvider()`** key-sniffing selector (cookie → env, via `getApiKey`) + a single dispatch function, so a paid key can replace the free default with no caller change. The selectors are async — `await activeSerpProvider()` / `await activeKeywordProvider()`.
- SERP: `lib/serp/provider.ts` — `serper` | `brave` | `duckduckgo` (keyless default).
- Keywords: `lib/keywords/provider.ts` — `dataforseo` (scaffold) | `autocomplete` (default).
- Rank source: SERP (live default) vs Google Search Console (`lib/rank/gsc.ts`, scaffold gated by `isGscConfigured()`).

`lib/config.ts` (`systemConfig()`) is the read-only snapshot of which of these are active, surfaced on `/settings`. The DataForSEO and GSC adapters are deliberately stubbed (`TODO(phase4-...)`) and fall through to the free path — keep that fallthrough intact when implementing them.

### Standalone scripts
Scripts in `scripts/` run under `tsx` and don't get Next's auto env loading, so they (and `drizzle.config.ts`) import `lib/loadEnv.ts` first to load `.env.local`. Any new script that touches env must do the same.

### Routes / UI
App Router pages: `/` (dashboard), `/courses/new` (generate + edit), `/courses/[id]` (detail — embeds competitor/tracking/version-history/export panels), `/import` (CSV upload), `/keywords` (keyword research + competitor analysis), `/settings` (read-only provider status from `systemConfig()`). `app/api/cron/recheck/route.ts` runs the live 3-week rank + AI-visibility re-check, wired to a **daily** Vercel cron in `vercel.ts` — the handler only re-checks LIVE courses whose last check is >21 days old, so the 3-week cadence lives in code, not the cron string. Guarded by `CRON_SECRET` when set.

## Phase status
- ✅ Phase 0 — scaffold, schema, config.
- ✅ Phase 1 (MVP) — memory + CSV import + bilingual generation + deterministic schema + validation scorer + editor UI.
- ✅ Phase 2 — competitor analysis + keyword research (free keyless sources by default).
- ✅ Phase 3 — SERP rank checks + AI-search/GEO visibility + daily-fires/3-week-cadence cron.
- ✅ Phase 4 — versioned records + history/diff + exports; pluggable paid data sources **scaffolded** (DataForSEO keyword volume, Google Search Console rank) — selectors and env gates exist but the adapters fall through to the free path (`TODO(phase4-...)`).

The free/keyless defaults are the intended baseline; paid keys are pure upgrades. When implementing a scaffolded adapter, keep the free fallthrough so the app never hard-requires a paid key.

# SEO Agent for 10 Minute School — Build Plan

> **Status:** Phases 0–5 built and verified live on real Neon DB + Google Gemini.
> All planned phases are complete; remaining items are explicit optional scaffolds
> (paid keyword source, GSC) that activate behind keys.
> Last updated: 2026-06-30.
>
> This document is the canonical, **as-built** plan. It supersedes the original
> approved plan (`~/.claude/plans/i-am-trying-to-rustling-volcano.md`); the
> "Changes from the original plan" section below records every deliberate deviation.

## Context

10 Minute School needs an in-house "SEO agent" that behaves like a lightweight,
memory-backed Ahrefs tailored to course/program pages. Previously, SEO fields
(bilingual meta title/description, keywords, Open Graph tags, Product JSON-LD schema)
were written by hand per course with no memory of past work, no competitor
benchmarking, and no systematic rank tracking. The goal is a system that:

1. **Remembers** every past course's SEO record and house style.
2. **Generates** a complete, validated SEO bundle for a new course from a few inputs.
3. **Benchmarks** against competitor ed-tech platforms (keywords, titles, descriptions, schema).
4. **Tracks** how each page ranks on Google over time and re-checks every 3 weeks.
5. **Scores** each record so quality is measurable and comparable.

Decisions locked with the user:
- **Interface:** Next.js web app dashboard, deployable on Vercel.
- **Keyword/competitor data:** Free / Google-only sources (no paid API now), built so a
  paid source (DataForSEO/Ahrefs) can be added later behind one interface.
- **Memory seed:** Bulk import from a spreadsheet/CSV export of past courses.
- **Generation:** Full AI auto-draft (bilingual) with human review before publishing.

### Honest scope note on "free / Google-only" + AI search
- **Google web rank = via SERP checks.** No Search Console access today, so we read positions
  by querying the public SERP for target keywords and locating the 10MS URL. Directional and
  region/personalization-sensitive (we sample consistently). If GSC access is granted later, we
  add it for exact impressions/clicks/CTR (optional Phase 4).
- **AI search visibility = sampled, not a single rank.** AI answer engines (Google AI
  Overviews, ChatGPT, Perplexity, Gemini) are non-deterministic. We run a fixed set of student
  queries N times per engine and report a **visibility/citation rate + prominence**, not one
  fixed position. This is the modern "are we recommended by AI" signal (GEO).
- **Competitor on-page data = real.** Fetching a competitor's public course page lets us
  parse their `<title>`, meta description, OG tags, JSON-LD, headings, and keyword usage.
- **Search volume / keyword difficulty = approximated.** Without a paid API we proxy demand
  using Google Autocomplete breadth and "People also ask"/related searches. Directional, not
  Ahrefs-grade. The data layer is abstracted so swapping in a paid provider later is a config
  change, not a rewrite.

---

## Changes from the original plan (as-built)

These are deliberate deviations made during the build, kept here so the plan stays honest
about what shipped vs. what was originally proposed.

1. **AI provider: Vercel AI Gateway + Claude → Google Gemini free tier.**
   The original plan assumed Vercel AI Gateway with `claude-opus-4-8` (draft) /
   `claude-haiku-4-5` (tag). The user has **no paid API access**, so the build uses the
   **Google Gemini free tier** instead (key from aistudio.google.com/apikey, env
   `GOOGLE_GENERATIVE_AI_API_KEY`). Default models: draft `gemini-2.5-flash`, tag
   `gemini-2.5-flash-lite`, embeddings `text-embedding-004` (768 dims, `EMBED_DIM=768`).
   OpenRouter is supported for **chat only** (no embeddings) via `AI_PROVIDER=openrouter`.
   The provider layer lives in `lib/ai/models.ts` — go through `draftModel()` / `tagModel()` /
   `embedModel()`, never instantiate providers directly. Embeddings are Google-only.

2. **Keywords are deterministic by default, not AI-on-import.**
   The original plan AI-back-filled keywords + JSON-LD during import. To survive Gemini's
   free **daily** quota (exhausts after ~1–2 full imports), keywords are now generated
   **deterministically** from facts in `lib/util/keywords.ts` (bilingual, zero AI). `npm run
   import:csv` is fast (embeddings + deterministic keywords + style mining); AI keyword
   back-fill is a **separate, paced, resumable** script (`npm run backfill:keywords`, targets
   `aiGenerated=false`). JSON-LD remains deterministic as planned.

3. **SERP source is pluggable and keyless by default.**
   Web rank + competitor discovery default to **DuckDuckGo HTML** (free, no key) rather than
   scraping Google (which blocks bots). DDG IP-blocks under heavy load (202 anomaly), so a
   **free** `SERPER_API_KEY` (google.serper.dev, real Google results, recommended) or
   `BRAVE_SEARCH_API_KEY` can be set for reliability — the provider auto-switches with no code
   change (`lib/serp/provider.ts`).

4. **AI-visibility: Gemini wired, others stubbed.**
   AI-search visibility runs through **Gemini with Google Search grounding** (`lib/aivis/check.ts`,
   confirmed live — Gemini recognizes/recommends 10MS). ChatGPT/Perplexity slots are stubbed
   pending their API keys (Phase 4).

5. **`/settings` is a read-only status dashboard (Phase 4, built).**
   `/settings` (`app/settings/page.tsx` + `lib/config.ts`) surfaces what's configured — active
   AI provider + model ids, SERP provider, AI-visibility engines, keyword + rank sources, DB —
   advisory only (env changes are made in `.env.local`, not the UI). DB-backed editable config
   was intentionally not built. No GSC access exists, so rank tracking is SERP-only as designed.

6. **Env loading for scripts.**
   Standalone scripts and `drizzle.config.ts` import `lib/loadEnv.ts` first to load
   `.env.local` (Next auto-loads it for app code; tsx does not). `npm run check` verifies both
   credentials.

7. **Phase 4 paid/extra adapters auto-activate behind keys.**
   ChatGPT + Perplexity AI-visibility engines are wired (`lib/aivis/check.ts`, shared
   OpenAI-compatible sampler) and turn on when `OPENAI_API_KEY` / `PERPLEXITY_API_KEY` are set,
   falling back to the existing "not configured" slot otherwise — the free Gemini-only default
   is unchanged. The paid keyword source (`lib/keywords/provider.ts`, `DATAFORSEO_API_KEY`) and
   GSC rank adapter (`lib/rank/gsc.ts`, `GSC_*`) are real, gated **scaffolds** with clear TODOs:
   the provider interfaces exist and fall back to the free default, but the paid API calls are
   not yet implemented (untestable without keys).

---

## Architecture (as-built)

```
Next.js 16 (App Router, React 19) on Vercel
├── UI: dashboard, "New course" form, SEO editor, competitor panel, tracking panel,
│       PDP comparison (/compare)
├── Server Actions / Route Handlers (Node runtime, Fluid Compute)
├── AI layer  → Vercel AI SDK v6 via lib/ai/models.ts
│               → Google Gemini free tier (gemini-2.5-flash draft,
│                 gemini-2.5-flash-lite tag, text-embedding-004 embeddings).
│                 OpenRouter optional for chat only.
├── Data/Memory → Neon Postgres + pgvector (HNSW) via Drizzle ORM
├── Integrations
│   ├── SERP fetch — pluggable provider (DuckDuckGo default; Serper/Brave optional)
│   ├── AI answer engines — Gemini (Google-search grounded); ChatGPT/Perplexity stubbed
│   ├── Google Autocomplete — keyword ideas (free, EN+BN, a–z expansion)
│   └── Competitor page fetcher (fetch + cheerio) — on-page SEO extraction + PDP comparison
└── Scheduling → Vercel Cron (3-week re-check; cadence enforced in code, not the cron string)
```

---

## Memory: how past data is stored and used

"Memory" is **three cooperating layers**, seeded from the real CSV
(`csv/SEO Data - Sheet1.csv`) and grown automatically as new courses are published.
See `lib/db/schema.ts`.

### What the seed data actually looks like (and why parsing is non-trivial)
The CSV is **not a flat table** — it is a vertical "block" layout, one block per course,
separated by blank rows, each block a list of `Category, Sub-Category, Element` rows.

Real-world messiness the importer absorbs (`lib/memory/parseCsv.ts`):
- **Label variants** → normalize (`Og: Title`→`og_title`, trailing-space `Meta Title `→`meta_title`,
  `Url Suggestion`/`Course URL/ Slug`→`slug`, `Image Renaming`→`image_name`).
- **Bangla/English mislabeled or swapped** → **detect language by Unicode script** (Bengali
  block U+0980–U+09FF vs Latin), never trust the label (`lib/util/lang.ts`, `assignByScript`).
- **Course name column drifts** → take first non-empty.
- **Image CDN URL** sometimes in a far-right column → capture as `image_url`.
- **Missing fields are normal** (no keywords, no JSON-LD in the seed) → nullable; incomplete
  blocks flagged `completeness=partial` (recalled, but not used as style exemplars).

### Layer 1 — Structured record memory (source of truth)
One normalized row per course in Postgres (`courses` + versioned `seo_records`). Facets derived
from the course name: `level`, `year`, `subject`, `batch_type`, `group`, `is_free`
(`lib/util/facets.ts`). Facets make retrieval precise and power dashboard filters.

### Layer 2 — Semantic memory (similarity recall)
Each course's `name + descriptions + keywords` is embedded into pgvector (`seo_embeddings`,
HNSW index). A new course retrieves its nearest past neighbors to ground drafting.

### Layer 3 — Style / convention memory (the house voice)
Mined, editable patterns (`style_memory`, `lib/memory/styleMine.ts`): phrase/USP bank,
bilingual title/desc templates, slug pattern, brand name variants, observed char-length norms.

### How memory is consumed at generation time (`lib/memory/recall.ts`)
**Facet-first + vector recall:** filter candidates by facets (subject/level/batch_type,
progressively relaxed) to build a pool, *then* rank by embedding cosine distance within it
(pure vector search over ~20 rows is too noisy). Falls back to facet ordering if embeddings/AI
are unavailable. The assembled context (style guide + exemplars + phrase bank + hard
constraints) feeds the generator.

---

## Data model (Postgres) — `lib/db/schema.ts`

- `courses` — id, name, slug, facets (level/year/subject/batch_type/group/is_free), duration,
  price, currency, image_url, product_url, sku, status (draft/live), completeness (full/partial),
  source, launched_at.
- `seo_records` — course_id, meta_title_bn/en, meta_desc_bn/en, keywords[], og_*,
  image_name/alt (thumb + sqr), schema_jsonld (jsonb), version, validation_score, created_at.
- `seo_embeddings` — course_id, embedding(vector), source_text.
- `style_memory` — kind (phrase/template/brand_rule), language, value, subject_scope, frequency,
  is_curated, updated_at.
- `competitor_snapshots` — keyword, competitor_domain, url, title, meta_description,
  keywords_detected[], schema_present, schema_types[], word_count, fetched_at.
- `keyword_research` — seed_keyword, suggestions[], related[], paa[], approx_demand_signal,
  source, fetched_at.
- `rank_checks` — course_id, query, page_url, position, checked_at, source.
- `ai_visibility_checks` — course_id, query, engine, mentioned, prominence, citation_url,
  samples, mention_rate, raw, sampled_at.
- `validation_scores` — course_id, record_version, breakdown(jsonb), total, created_at.

---

## Core modules (as-built file map)

### 1. Memory + CSV seed (`lib/memory/`)
- `parseCsv.ts` — block segmenter + label normalizer + language-by-script detector + facet deriver.
- `importCourses.ts` — loads `courses` + `seo_records`, flags partial blocks, mines style,
  creates embeddings. Deterministic keywords; AI back-fill is separate (see change #2).
- `styleMine.ts` — extracts phrase/template/brand patterns into `style_memory`.
- `recall.ts` — facet-filtered vector search returning neighbors + style context.
- Embeddings: `lib/ai/embed.ts`. AI keyword back-fill: `lib/ai/backfill.ts` +
  `scripts/backfill-keywords.ts`.

### 2. SEO generator (`lib/generate/`)
- `seo.ts` (`generateSeo`) — **generate → validate → repair loop** via AI SDK `generateObject`
  + Zod schema. Measures `visibleLength` itself (does not trust the LLM to count Bangla
  graphemes); re-prompts up to `maxRepairs` (default 2) until length rules pass.
- `prompt.ts` — house-style prompt assembly; `types.ts` — shared types.
- `buildSchema.ts` — **deterministic** Product JSON-LD from stored fields (never AI-guessed).
  Missing price/sku/image flagged in `missing[]`, not invented.
- Entry point: `lib/actions.ts` (`generateForNewCourse`, `saveCourse`).

### 3. Validation scorer (`lib/score/validate.ts`)
- Deterministic weighted 0–100 rubric across 9 dimensions (title/desc length, keyword usage,
  bilingual completeness, OG, schema, image meta, slug sanity, uniqueness). `LIMITS` (title
  30–60, desc 70–160) live here. Persisted on explicit save.

### 4. Competitor analysis (`lib/competitors/`)
- BD ed-tech watchlist in `config.ts` (Shikho, ACS Future School, British Council BD, Udvash,
  Bohubrihi, Ostad).
- `search.ts` (DDG SERP discovery) → `fetch.ts` → `parse.ts` (cheerio: title/meta/OG/JSON-LD/
  headings/keyword usage/word count) → `score.ts` (per-platform score) → `analyze.ts`.
- Shown on course detail via `components/CompetitorPanel.tsx`.
- **Caveat:** SPA competitor pages (e.g. Shikho) under-report body word count from server HTML.

### 5. Keyword research (`lib/keywords/autocomplete.ts`)
- Google Autocomplete suggest endpoint, EN + BN, a–z expansion, breadth = demand proxy.
- Surfaced at `/keywords`.

### 6. PDP comparison (`lib/pdp/`)
Head-to-head Product Detail Page analysis. Entry point: `comparePdpsAction` in `lib/actions.ts`, surfaced at `/compare`.

- `compare.ts` (`comparePdps`) — orchestrator: fetch + parse our page and up to 5 competitor pages in parallel, derive keyword gap, run AI analysis. AI failure degrades to `analysis: null`; on-page comparison always works keyless.
- `parse.ts` (`parsePdp`) — extends the competitor `parsePage` extractor with an h1–h3 heading outline and a 1 500-char body excerpt (the two extra signals the LLM needs for content-gap analysis).
- `keywordGap.ts` (`computeKeywordGap`) — deterministic, keyless page-derived keyword gap: 1–3-grams from competitor titles + headings that don't appear on our page, deduped and annotated with which rivals use them. Optionally enriched with Autocomplete expansion.
- `analyze.ts` (`analyzePdpGap`) — `generateObject` with `PdpGapSchema`: on-page deficits, content gaps, keyword gaps, and a prioritized action list. Wrapped in `withQuotaRetry`.
- `prompt.ts` — system prompt (strict grounding, white-hat-only, bilingual awareness) + `buildPdpUserPrompt` (excerpt budget shrinks per-competitor to keep the prompt cheap).
- `types.ts` — `ParsedPdp`, `PdpSide`, `KeywordGapItem`, `PdpGapAnalysis`, `PdpComparisonResult`.

### 7. Rank + AI-visibility tracking (`lib/rank/`, `lib/aivis/`, `lib/serp/`, `lib/track.ts`)
- `lib/serp/provider.ts` — pluggable SERP (DDG default keyless; Serper/Brave via free key).
- `lib/rank/serp.ts` — web position of the 10MS URL → `rank_checks`.
- `lib/aivis/check.ts` — AI-search visibility via Gemini (Google-search grounded) → mention_rate
  in `ai_visibility_checks`. ChatGPT/Perplexity stubbed.
- `lib/track.ts` — orchestrates both + persists.
- `app/api/cron/recheck/route.ts` — live courses past 21 days, `CRON_SECRET`-protected, wired
  to a daily Vercel cron in `vercel.ts` (3-week cadence enforced in code).
- Shown on course detail via `components/TrackingPanel.tsx` ("Track now").

---

## UI surfaces (App Router) — as-built

- `/` Dashboard — all courses, validation scores, facets. ✅
- `/courses/new` — new-course form → generated SEO bundle editor with live char-limit counters. ✅
- `/courses/[id]` — detail: stored SEO record + JSON-LD, competitor panel, tracking panel,
  **inline SEO editor (saves a new version), version history + before/after diff, and exports
  (HTML+JSON-LD / JSON / plain fields)**. ✅
- `/keywords` — keyword research (Google Autocomplete). ✅
- `/import` — CSV upload to seed memory. ✅
- `/settings` — read-only data-source/provider status dashboard (Phase 4). ✅
- `/compare` — PDP head-to-head comparison: enter our URL + up to 5 competitor URLs + optional target keywords → on-page scoring + keyword gap + AI content-gap analysis with prioritized actions. ✅

---

## Validation review (prompt-engineering / RAG hardening)

1. **Multilingual embeddings are mandatory** — records mix Bangla + English; Google
   `text-embedding-004` handles Bangla. (#1 technical risk, mitigated.)
2. **Hybrid, facet-first retrieval** (not pure vector) — small corpus (~20–25) is noisy; filter
   by facets first, then rank by vector similarity.
3. **EN and BN are independently keyword-optimized variants, NOT translations** — encoded as a
   core house-style rule in the prompt + style memory.
4. **Generate → validate → auto-repair loop for length** — deterministic `visibleLength` check,
   never trust the LLM to count Bangla graphemes.
5. **Strict grounding guardrail** — only use user-provided course facts; unknown facts left
   blank and flagged, never hallucinated.
6. **Two-tier scoring** — deterministic rubric is the reliable core; optional LLM-as-judge
   dimension kept separate so a flaky judge never blocks publishing.
7. **Close the loop with real outcomes** — once rank data accrues, correlate validation score
   vs. actual rank to recalibrate rubric weights (future work).

---

## Build phases

- **Phase 0 — Scaffold** ✅ Done — Next.js 16, Drizzle/Neon schema, config.
- **Phase 1 — Memory + Generator (MVP)** ✅ Done & verified — CSV import, embeddings recall,
  bilingual generation, deterministic JSON-LD, validation scorer, editor UI. (21 courses
  imported + embedded; scores 84–90 on real DB + Gemini.)
- **Phase 2 — Competitor + Keywords** ✅ Done & verified — Google Autocomplete keyword research;
  DDG competitor discovery + cheerio parse + per-platform scoring.
- **Phase 3 — Rank + AI visibility** ✅ Done & verified — pluggable SERP rank checks, Gemini
  AI-visibility sampling, tracking panel, 3-week cron.
- **Phase 4 — Polish** ✅ Done & verified — version history + diff, exports, `/settings` status
  dashboard, ChatGPT/Perplexity engines wired behind keys, paid-keyword + GSC scaffolds.
- **Phase 5 — PDP comparison** ✅ Done — head-to-head page comparison at `/compare`: fetch +
  parse + deterministic keyword gap + AI content-gap analysis (on-page half always works keyless).

### Phase 4 — as-built
- **Version history + diff** — `updateCourseSeo` (`lib/actions.ts`) saves human edits as a new
  `seo_records` version (vN+1) via a shared `writeSeoVersion` helper: rebuilds JSON-LD
  deterministically, re-scores, refreshes the embedding, and writes the (previously dormant)
  `validation_scores` table. `getCourseVersions` (`lib/queries.ts`) + `diffRecords`
  (`lib/util/diff.ts`) power `components/VersionHistory.tsx`; `components/SeoEditor.tsx` is the
  inline editor (reuses `FieldEditor`). No schema migration was needed — `version` and
  `validation_scores` already existed.
- **Exports** — `components/ExportPanel.tsx`: copy-ready HTML head + JSON-LD, JSON, and plain
  BN/EN fields, with copy-to-clipboard + download (client-only, no server round-trip).
- **`/settings`** — `lib/config.ts` (`systemConfig()`) + `app/settings/page.tsx`: read-only
  provider/status dashboard. Nav link in `app/layout.tsx`.
- **ChatGPT / Perplexity AI-visibility** — wired in `lib/aivis/check.ts` (shared
  OpenAI-compatible sampler), auto-activate behind `OPENAI_API_KEY` / `PERPLEXITY_API_KEY`.

### Phase 5 — as-built
- **`lib/pdp/` module** — six-file pipeline: `compare.ts` (orchestrator) → `parse.ts` (extends
  competitor extractor with headings + body excerpt) → `keywordGap.ts` (deterministic n-gram gap)
  → `analyze.ts` (`generateObject` + Zod schema) → `prompt.ts` (system prompt + user prompt
  builder). Types in `types.ts`. `MAX_COMPETITORS = 5` caps the fan-out.
- **`comparePdpsAction`** added to `lib/actions.ts` — same `{ ok, error }` envelope; best-effort
  AI (degrades to `analysis: null` + `aiSkippedReason` when AI is absent or fails).
- **`/compare` route** — `app/compare/page.tsx` (client component): dynamic competitor URL list,
  comma-delimited target keywords, calls `comparePdpsAction`, renders `PdpComparePanel`.
- **`components/ErrorNote.tsx`** — shared inline error/warning component (used across panels).
  Accepts `tone="error"|"warning"`. Added as a general-purpose component, not PDP-specific.

### Remaining optional scaffolds (activate behind keys; API calls not yet implemented)
- Pluggable **paid** keyword source (`lib/keywords/provider.ts`, DataForSEO/Ahrefs) behind the
  existing interface — `DATAFORSEO_API_KEY` switches the provider; mapping is a documented TODO.
- **GSC adapter** (`lib/rank/gsc.ts`) if Search Console access is granted — exact
  impressions/clicks/CTR; then correlate score vs. rank to recalibrate rubric weights.
- DB-backed editable `/settings` (currently read-only) if runtime config editing is wanted.

---

## Verification status

- **Phase 1** ✅ — Real CSV imported; bn/en assigned by script (swapped rows spot-checked);
  partial blocks flagged; facets derived; embeddings + `style_memory` populated. Generation
  respects char limits, matches house phrases, deterministic schema matches Product JSON-LD;
  validation score renders with breakdown.
- **Phase 2** ✅ — Competitor analysis populates real titles/descriptions/schema; per-platform
  scores compute. Keyword research returns EN+BN suggestions with breadth signal.
- **Phase 3** ✅ — SERP check writes 10MS position to `rank_checks`; Gemini AI-visibility writes
  mention_rate to `ai_visibility_checks`; cron route responds (CRON_SECRET-protected). Note:
  seeded courses are `status='draft'`, so the cron shows 0 due until a course is set live.
- **Phase 4** ✅ — `npm run build` type-checks clean and registers `/settings`; `npm run check`
  passes (DB + pgvector + Gemini draft/embeddings). Dev-server smoke test: `/settings` renders
  the provider dashboard (Gemini active, ChatGPT/Perplexity "add key" notes, GSC scaffolded);
  course detail renders the inline editor + export panel, with version history hidden until a
  second version exists. The edit→save-new-version→diff flow (and `validation_scores` rows) is
  verified through the UI on a live course.
- **Phase 5** ✅ — `/compare` route renders; `comparePdpsAction` wired in `lib/actions.ts`;
  `lib/pdp/` pipeline type-checks clean. On-page comparison + deterministic keyword gap work
  keyless; AI content-gap analysis activates with a Gemini key and degrades gracefully without.

---

## Environment

Secrets live in `.env.local` (see `.env.example`).
- `DATABASE_URL` — Neon Postgres connection string. **Required.**
- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini key (free tier covers generation AND embeddings).
  **Required for full function.**
- Optional: `OPENROUTER_API_KEY` + `AI_PROVIDER=openrouter` (chat only — embeddings still need
  a Google key); `SERPER_API_KEY` or `BRAVE_SEARCH_API_KEY` (reliable SERP, free); `CRON_SECRET`
  (protects the cron route).
- Model overrides: `SEO_DRAFT_MODEL`, `SEO_TAG_MODEL`, `SEO_EMBED_MODEL`. Other knobs:
  `EMBED_DIM` (default 768), `IMPORT_THROTTLE_MS` (default 6500), `SITE_ORIGIN`, `BRAND_NAME`.

First-time setup order: `db:init` (pgvector extension) → `db:push` (tables) → `import:csv` (seed).

## Decisions locked
- Interface: Next.js web dashboard on Vercel. Data source: free SERP/Google + AI engines,
  pluggable for paid later.
- AI layer: **Google Gemini free tier** via AI SDK v6 (see change #1 — *not* Vercel AI Gateway /
  Claude). OpenRouter chat-only fallback. Multilingual embeddings via Google.
- Memory: 3-layer design seeded from `csv/SEO Data - Sheet1.csv`; deterministic keywords +
  JSON-LD, separate paced AI keyword back-fill.
- Generation: full bilingual AI auto-draft (EN & BN independently optimized, not translations)
  with human review; deterministic JSON-LD builder; generate→validate→repair loop for char limits.
- Tracking: two surfaces — Google web (SERP-based, no GSC) + AI search visibility. 3-week
  cadence. GSC optional later if access granted.
- Competitors: Bangladeshi ed-tech first (Shikho, ACS, British Council, Udvash, Bohubrihi, Ostad).
- Single-user tool — no auth/logins.
- Accounts on hand: Vercel ✓, Google Cloud ✓, Neon ✓.

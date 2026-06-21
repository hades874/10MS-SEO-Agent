# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A memory-backed SEO agent for 10 Minute School (10MS) course pages. It remembers past courses and auto-generates a full **bilingual (Bangla + English)** SEO bundle for a new course — meta title/description, keywords, Open Graph tags, and Product JSON-LD — then scores it. Later phases add competitor analysis, keyword research, and Google/AI-search visibility tracking.

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

Secrets live in `.env.local` (see `.env.example`). Two are required for full function:
- `DATABASE_URL` — Neon Postgres connection string.
- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini key (free tier covers both generation AND embeddings).

Optional: `OPENROUTER_API_KEY` + `AI_PROVIDER=openrouter` (chat only — embeddings still require a Google key). Model overrides: `SEO_DRAFT_MODEL`, `SEO_TAG_MODEL`, `SEO_EMBED_MODEL`. Other knobs: `EMBED_DIM` (default 768), `IMPORT_THROTTLE_MS` (default 6500), `SITE_ORIGIN`, `BRAND_NAME`.

Path alias: `@/*` maps to repo root.

## Architecture

### The memory model (3 layers)
This is the core concept; see `lib/db/schema.ts`.
1. **Structured records** (`courses` + versioned `seo_records`) — source of truth, one normalized row per course with derived facets (level/year/subject/batchType/group/isFree).
2. **Semantic recall** (`seo_embeddings`, pgvector HNSW index) — a new course retrieves its nearest past courses to ground the draft.
3. **House style** (`style_memory`) — mined phrase bank + curated brand/template rules so output sounds like 10MS.

Tables for later phases already exist in the schema (`competitor_snapshots`, `keyword_research`, `rank_checks`, `ai_visibility_checks`, `validation_scores`) but are not yet wired up.

### Generation flow (Phase 1 MVP)
The pipeline for "new course → SEO bundle" lives in `lib/`:
1. `lib/actions.ts` (`generateForNewCourse`) is the Server Action entry point. It derives facets, suggests a slug, then pulls grounding from memory.
2. `lib/memory/recall.ts` does **facet-first + vector recall**: filter candidates by facets (subject/level/batchType, progressively relaxed) to build a pool, *then* rank by embedding cosine distance within it. Pure vector search over the small corpus (~20 rows) is too noisy. Falls back to facet ordering if embeddings/AI are unavailable.
3. `lib/generate/seo.ts` (`generateSeo`) runs a **generate → validate → repair loop** via AI SDK `generateObject` with a Zod schema. It does NOT trust the LLM to count characters — it measures `visibleLength` itself and re-prompts (up to `maxRepairs`, default 2) until length rules pass.
4. `lib/generate/buildSchema.ts` builds Product JSON-LD **deterministically** from stored fields — never AI-guessed — so the schema always matches the page. Missing fields (price/sku/image) are flagged in `missing[]`, not invented.
5. `lib/score/validate.ts` (`scoreRecord`) produces a weighted 0–100 validation score across 9 dimensions (title/desc length, keyword usage, bilingual completeness, OG, schema, image meta, slug sanity, uniqueness). `lib/actions.ts` (`saveCourse`) persists the course + seo_record (+ embedding) only on explicit save.

### CSV import pipeline
`lib/memory/parseCsv.ts` → `lib/memory/importCourses.ts`. The seed CSV (`csv/SEO Data - Sheet1.csv`) is a quirky vertical "block" layout with mislabeled/swapped Bangla-English rows, drifting columns, and incomplete blocks. The parser normalizes label variants, flags partial blocks (`completeness`), and — critically — assigns Bangla/English by **Unicode script, not by CSV label** (see below). Import mines style and creates embeddings; keyword back-fill is OFF by default during import (it's the free-tier rate-limit bottleneck) — use `npm run backfill:keywords` separately.

### Two cross-cutting conventions to respect
- **Language by script, not label** (`lib/util/lang.ts`): Bangla vs English is decided from actual Unicode characters (Bengali block U+0980–U+09FF), because the seed data routinely mislabels/swaps the two. Use `assignByScript` for title/desc pairs and `detectLang` for single strings.
- **Grapheme-aware length** (`visibleLength` in `lib/util/lang.ts`): SEO character limits are measured in user-perceived characters via `Intl.Segmenter`, NOT `string.length` — Bangla conjuncts/combining marks would otherwise overcount. Always use `visibleLength` for any character-limit logic; the limits live in `LIMITS` in `lib/score/validate.ts`.

### Graceful degradation when unconfigured
The app boots without a DB or AI key. `lib/db/index.ts` is a lazy singleton that only throws when actually used; `isDbConfigured()` / `isAiConfigured()` / `isEmbeddingConfigured()` gate behavior, and `lib/status.ts` + `components/SetupBanner.tsx` surface what's missing in the UI. Server Actions return `{ ok: false, error }` rather than throwing. Preserve this pattern — don't introduce import-time crashes when env is absent. Note `isEmbeddingConfigured()` (Google key) is distinct from `isAiConfigured()` (either provider): OpenRouter can do chat but not embeddings.

### Provider layer
`lib/ai/models.ts` is the single place that resolves provider + model ids. Default is Google Gemini; OpenRouter is chat-only. Always go through `draftModel()` / `tagModel()` / `embedModel()` rather than instantiating providers directly. Embeddings are Google-only.

### Standalone scripts
Scripts in `scripts/` run under `tsx` and don't get Next's auto env loading, so they (and `drizzle.config.ts`) import `lib/loadEnv.ts` first to load `.env.local`. Any new script that touches env must do the same.

### Routes / UI
App Router pages: `/` (dashboard), `/courses/new` (generate + edit), `/courses/[id]` (detail), `/import` (CSV upload), `/keywords` (Phase 2 placeholder). `app/api/cron/recheck/route.ts` is a Phase 3 placeholder wired to a daily Vercel cron in `vercel.ts` — the 3-week cadence is enforced in code, not the cron string.

## Phase status
- ✅ Phase 0 — scaffold, schema, config.
- ✅ Phase 1 (MVP) — memory + CSV import + bilingual generation + deterministic schema + validation scorer + editor UI. **(current build)**
- ⏳ Phase 2 — competitor analysis + keyword research.
- ⏳ Phase 3 — SERP rank checks + AI-search visibility + 3-week cron.
- ⏳ Phase 4 — version history/diff, exports, pluggable paid data source.

Schema and the cron endpoint are stubbed ahead of their phase; treat empty/placeholder modules for Phases 2–4 as intentional.

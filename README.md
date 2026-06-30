# 10MS SEO Agent

A memory-backed SEO agent for 10 Minute School course pages. It remembers past
courses, auto-generates a full **bilingual (Bangla + English)** SEO bundle for a new
course (meta title/description, keywords, Open Graph tags, Product JSON-LD), scores it,
benchmarks competitors head-to-head, and tracks Google + AI-search visibility.

Built with Next.js 16 (App Router) + Vercel AI SDK v6 + Google Gemini + Neon Postgres (pgvector).

## How the memory works (3 layers)

1. **Structured records** — one normalized row per course in Postgres (source of truth,
   versioned, with derived facets: level / year / subject / batch type / group / free).
2. **Semantic recall** — pgvector embeddings (HNSW index); a new course retrieves its
   closest past courses to ground the draft.
3. **House style** — mined phrase bank + curated brand/template rules so generations
   sound like 10MS.

The seed CSV (`csv/SEO Data - Sheet1.csv`) is a vertical "block" layout. The importer
normalizes label variants, assigns Bangla/English **by Unicode script** (the CSV labels
are often swapped), derives facets, flags incomplete blocks, builds JSON-LD
deterministically, and mines the style bank.

## Setup

Requires Node 20+. You provide two secrets:

1. **Database** — a Neon Postgres connection string in `.env.local` as `DATABASE_URL`.
2. **AI key (Google Gemini, free)** — get one at https://aistudio.google.com/apikey and
   put it in `.env.local` as `GOOGLE_GENERATIVE_AI_API_KEY`. Gemini's free tier covers
   both generation and embeddings. (OpenRouter is supported for chat via
   `AI_PROVIDER=openrouter`, but embeddings still need a Google key.)

```bash
cp .env.example .env.local      # fill DATABASE_URL + GOOGLE_GENERATIVE_AI_API_KEY

npm install
npm run check                   # verify both credentials before going further
npm run db:init                 # enable pgvector extension
npm run db:push                 # create tables
npm run import:csv              # seed memory from csv/SEO Data - Sheet1.csv
npm run dev                     # http://localhost:3000
```

> `npm run import:csv -- --no-ai` imports without keyword back-fill/embeddings if you
> haven't set the AI key yet. Run `npm run backfill:keywords` separately once the key
> is in place to enrich those rows at a paced, rate-limit-safe rate.

### Scripts

| Script | What it does |
|---|---|
| `check` | Verify DATABASE_URL + AI key (connection, pgvector, tables, model calls) |
| `db:init` | `CREATE EXTENSION vector` (run before `db:push`) |
| `db:push` | Create/update tables from the Drizzle schema |
| `db:studio` | Browse the DB |
| `db:generate` | Generate SQL migrations into `./drizzle` |
| `import:csv` | Parse + load the seed CSV, embeddings, style mining |
| `backfill:keywords` | AI-backfill keywords for rows missing them (separate from import) |
| `seed:style` | Re-mine just the house-style bank |

## Using it

- **Dashboard** (`/`) — all courses with validation scores + facets.
- **New course** (`/courses/new`) — enter a course → generate the bilingual bundle →
  edit with live character-limit counters → save draft or publish.
- **Course detail** (`/courses/[id]`) — view the stored SEO record + JSON-LD, run
  **competitor analysis** (BD ed-tech, scored head-to-head), track rank + AI visibility,
  edit inline (saves a new version), browse **version history + before/after diff**, and
  **export** (HTML+JSON-LD / JSON / plain fields).
- **Keywords** (`/keywords`) — free keyword research via Google Autocomplete (EN + BN),
  with a–z expansion and a demand-breadth proxy.
- **PDP comparison** (`/compare`) — enter your course URL + up to 5 competitor URLs +
  optional target keywords → on-page scoring + deterministic keyword gap + AI content-gap
  analysis with a prioritized action list. The on-page half works without an AI key.
- **Settings** (`/settings`) — read-only snapshot of active providers (AI, SERP, keyword
  source, AI-visibility engines, DB).
- **Import** (`/import`) — upload the seed CSV.

### Rank-tracking reliability (free vs. keyed)

Web rank uses **DuckDuckGo** by default (free, no key) — but DDG rate-limits scrapers
under load and isn't Google. For reliable rank data, set a **free** key:
`SERPER_API_KEY` (google.serper.dev — actual Google results, recommended) or
`BRAVE_SEARCH_API_KEY`. The provider auto-switches with no code change. AI-search
visibility uses your Gemini key and works without any SERP key.

## Status (phased build)

- ✅ **Phase 0** — scaffold, DB schema, config.
- ✅ **Phase 1 (MVP)** — memory + CSV import + bilingual generation + deterministic
  JSON-LD + validation scorer + editor UI.
- ✅ **Phase 2** — keyword research (Google Autocomplete) + competitor analysis
  (BD ed-tech: Shikho / ACS / British Council / Udvash / Bohubrihi / Ostad via SERP +
  on-page parsing + per-platform scoring).
- ✅ **Phase 3** — web SERP rank checks (pluggable: DuckDuckGo default, Serper/Brave
  via free key), AI-search visibility (Gemini, Google-search grounded), per-course
  tracking panel, and the 3-week cron (`/api/cron/recheck`).
- ✅ **Phase 4** — version history/diff, exports, `/settings` status dashboard,
  ChatGPT/Perplexity AI-visibility engines wired behind keys, paid-keyword (DataForSEO)
  + GSC rank adapters scaffolded behind keys.
- ✅ **Phase 5** — PDP head-to-head comparison (`/compare`): fetch + parse + deterministic
  keyword gap + AI content-gap analysis with prioritized fixes; degrades gracefully when AI
  is not configured.

See `plan/seo-agent-plan.md` for the full as-built plan and architecture notes.

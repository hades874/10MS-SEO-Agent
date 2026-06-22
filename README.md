# 10MS SEO Agent

A memory-backed SEO agent for 10 Minute School course pages. It remembers past
courses, auto-generates a full **bilingual (Bangla + English)** SEO bundle for a new
course (meta title/description, keywords, Open Graph tags, Product JSON-LD), scores it,
and (later phases) benchmarks competitors and tracks Google + AI-search visibility.

Built with Next.js (App Router) + Vercel AI Gateway + Neon Postgres (pgvector).

## How the memory works (3 layers)

1. **Structured records** — one normalized row per course in Postgres (source of truth,
   versioned, with derived facets: level / year / subject / batch type / group / free).
2. **Semantic recall** — pgvector embeddings; a new course retrieves its closest past
   courses to ground the draft.
3. **House style** — mined phrase bank + curated brand/template rules so generations
   sound like 10MS.

The seed CSV (`csv/SEO Data - Sheet1.csv`) is a vertical "block" layout. The importer
normalizes label variants, assigns Bangla/English **by Unicode script** (the CSV labels
are often swapped), derives facets, flags incomplete blocks, AI-back-fills the missing
keywords, builds the JSON-LD deterministically, and mines the style bank.

## Setup

Requires Node 20+. You provide two secrets:

1. **Database** — a Neon Postgres connection string in `.env.local` as `DATABASE_URL`.
2. **AI key (Google Gemini, free)** — get one at https://aistudio.google.com/apikey and
   put it in `.env.local` as `GOOGLE_GENERATIVE_AI_API_KEY`. Gemini's free tier covers
   both generation and embeddings. (OpenRouter is supported for chat via `AI_PROVIDER=openrouter`,
   but embeddings still need a Google key.)

```bash
cp .env.example .env.local      # then fill DATABASE_URL + GOOGLE_GENERATIVE_AI_API_KEY

npm install
npm run check                   # verifies both credentials before you go further
npm run db:init                 # enable pgvector extension
npm run db:push                 # create tables
npm run import:csv              # seed memory from csv/SEO Data - Sheet1.csv
npm run dev                     # http://localhost:3000
```

> `npm run import:csv -- --no-ai` imports without keyword back-fill/embeddings if you
> haven't set the AI key yet. Re-run `import:csv` after adding the key to enrich memory.

### Scripts

| Script | What it does |
|---|---|
| `check` | Verify DATABASE_URL + AI key (connection, pgvector, tables, model calls) |
| `db:init` | `CREATE EXTENSION vector` (run before `db:push`) |
| `db:push` | Create/update tables from the Drizzle schema |
| `db:studio` | Browse the DB |
| `import:csv` | Parse + load the seed CSV, AI back-fill, embeddings, style mining |
| `seed:style` | Re-mine just the house-style bank |

## Using it

- **Dashboard** (`/`) — all courses with validation scores + facets.
- **New course** (`/courses/new`) — enter a course → generate the bilingual bundle →
  edit with live character-limit counters → Save draft / Publish.
- **Import** (`/import`) — upload the seed CSV.
- **Course detail** (`/courses/[id]`) — view the stored SEO record + JSON-LD, and run
  **competitor analysis** (BD ed-tech, scored head-to-head against yours).
- **Keywords** (`/keywords`) — free keyword research via Google Autocomplete (EN + BN),
  with a–z expansion and a demand-breadth proxy.
- **Tracking** (on course detail) — "Track now" runs a web SERP rank check + AI-search
  visibility (does Gemini recommend 10MS?). The 3-week cron re-checks `live` courses.

### Rank-tracking reliability (free vs. keyed)

Web rank uses **DuckDuckGo** by default (free, no key) — but DDG rate-limits scrapers
under load and isn't Google. For reliable rank data, set a **free** key (no paid plan):
`SERPER_API_KEY` (google.serper.dev — actual Google results, recommended) or
`BRAVE_SEARCH_API_KEY`. The provider auto-switches; no code change. AI-search visibility
uses your Gemini key and works without any SERP key.

## Status (phased build)

- ✅ **Phase 0** — scaffold, DB schema, config.
- ✅ **Phase 1 (MVP)** — memory + CSV import + bilingual generation + deterministic
  schema + validation scorer + editor UI.
- ✅ **Phase 2** — keyword research (Google Autocomplete) + competitor analysis
  (BD ed-tech: Shikho/ACS/British Council/Udvash/Bohubrihi/Ostad via DuckDuckGo SERP +
  on-page parsing + per-platform scoring). *(this build)*
- ✅ **Phase 3** — web SERP rank checks (pluggable provider: DuckDuckGo default,
  Serper/Brave optional via free key), AI-search visibility (Gemini, Google-search
  grounded), per-course tracking panel, and the 3-week cron (`/api/cron/recheck`). *(this build)*
- ⏳ **Phase 4** — version history/diff, exports, pluggable paid data source.

See `C:\Users\<you>\.claude\plans\i-am-trying-to-rustling-volcano.md` for the full plan.

import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  vector,
  real,
  index,
  unique,
} from "drizzle-orm/pg-core";
import type { ParsedPdp, PdpGapAnalysis } from "../pdp/types";

/**
 * Embedding dimensions. Default 768 matches Google's text-embedding-004 (the free
 * Gemini embedding model) and stays under pgvector's ANN index limit (2000). If you
 * switch embedding models, set EMBED_DIM in .env and re-run db:push + re-import.
 */
export const EMBED_DIM = Number(process.env.EMBED_DIM ?? 768);

/** Layer 1 — structured course memory (source of truth). */
export const courses = pgTable(
  "courses",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").unique(),
    // Derived facets (for facet-first retrieval + dashboard filters)
    level: text("level"), // SSC / HSC / Class 6 / Class 8 / ...
    year: text("year"), // 27 / 28 / 2026 ...
    subject: text("subject"), // Science / Bangla / ICT / Economics / All ...
    batchType: text("batch_type"), // Online Batch / Recorded Batch / Board Prep
    group: text("group"), // Science / Commerce / Arts / All
    isFree: boolean("is_free").default(false),
    // Commercial facts (not in CSV — collected in form / flagged on import)
    duration: text("duration"),
    price: text("price"),
    currency: text("currency").default("BDT"),
    sku: text("sku"),
    imageUrl: text("image_url"),
    productUrl: text("product_url"),
    status: text("status").default("draft"), // draft / live
    completeness: text("completeness").default("full"), // full / partial
    source: text("source").default("app"), // csv_seed / app
    launchedAt: timestamp("launched_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("courses_facets_idx").on(t.level, t.subject, t.batchType)]
);

/** Versioned SEO records per course. */
export const seoRecords = pgTable("seo_records", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .references(() => courses.id, { onDelete: "cascade" })
    .notNull(),
  version: integer("version").default(1).notNull(),
  metaTitleBn: text("meta_title_bn"),
  metaTitleEn: text("meta_title_en"),
  metaDescBn: text("meta_desc_bn"),
  metaDescEn: text("meta_desc_en"),
  keywords: jsonb("keywords").$type<string[]>(),
  ogTitleBn: text("og_title_bn"),
  ogTitleEn: text("og_title_en"),
  ogDescriptionBn: text("og_description_bn"),
  ogDescriptionEn: text("og_description_en"),
  ogImage: text("og_image"),
  ogImageAlt: text("og_image_alt"),
  imageNameThumb: text("image_name_thumb"),
  imageNameSqr: text("image_name_sqr"),
  imageAltThumb: text("image_alt_thumb"),
  imageAltSqr: text("image_alt_sqr"),
  schemaJsonld: jsonb("schema_jsonld").$type<Record<string, unknown>>(),
  validationScore: integer("validation_score"),
  aiGenerated: boolean("ai_generated").default(false),
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Layer 2 — semantic memory. */
export const seoEmbeddings = pgTable(
  "seo_embeddings",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    sourceText: text("source_text").notNull(),
    embedding: vector("embedding", { dimensions: EMBED_DIM }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("seo_embeddings_vec_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops")
    ),
    // One embedding per course — the refresh path upserts on this constraint.
    unique("seo_embeddings_course_id_key").on(t.courseId),
  ]
);

/** Layer 3 — mined house-style / phrase bank. */
export const styleMemory = pgTable("style_memory", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // phrase / template / brand_rule
  language: text("language"), // bn / en / mixed
  value: text("value").notNull(),
  subjectScope: text("subject_scope"), // optional facet scoping
  frequency: integer("frequency").default(1),
  isCurated: boolean("is_curated").default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Competitor on-page snapshots (Phase 2). */
export const competitorSnapshots = pgTable("competitor_snapshots", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull(),
  competitorDomain: text("competitor_domain").notNull(),
  url: text("url").notNull(),
  title: text("title"),
  metaDescription: text("meta_description"),
  keywordsDetected: jsonb("keywords_detected").$type<string[]>(),
  schemaPresent: boolean("schema_present").default(false),
  schemaTypes: jsonb("schema_types").$type<string[]>(),
  wordCount: integer("word_count"),
  validationScore: integer("validation_score"),
  rawHtmlRef: text("raw_html_ref"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

/**
 * PDP head-to-head comparisons (Phase 5). Unlike competitor_snapshots (which is
 * SERP-discovery driven, one row per ranking URL), this stores one row per
 * user-initiated comparison: our page vs a field of competitors, the parsed
 * on-page snapshots, all scores, and the AI gap analysis (null when AI is off).
 */
export const pdpComparisons = pgTable("pdp_comparisons", {
  id: serial("id").primaryKey(),
  ourUrl: text("our_url").notNull(),
  competitorUrls: jsonb("competitor_urls").$type<string[]>(),
  targetKeywords: jsonb("target_keywords").$type<string[]>(),
  ourSnapshot: jsonb("our_snapshot").$type<ParsedPdp>(),
  competitorSnapshots: jsonb("competitor_snapshots").$type<ParsedPdp[]>(),
  ourScore: integer("our_score"),
  competitorScores: jsonb("competitor_scores").$type<number[]>(),
  analysis: jsonb("analysis").$type<PdpGapAnalysis | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Keyword research cache (Phase 2). */
export const keywordResearch = pgTable("keyword_research", {
  id: serial("id").primaryKey(),
  seedKeyword: text("seed_keyword").notNull(),
  suggestions: jsonb("suggestions").$type<string[]>(),
  related: jsonb("related").$type<string[]>(),
  paa: jsonb("paa").$type<string[]>(),
  approxDemandSignal: real("approx_demand_signal"),
  source: text("source").default("autocomplete"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

/** Google web rank checks (Phase 3, SERP-based). */
export const rankChecks = pgTable("rank_checks", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id, {
    onDelete: "cascade",
  }),
  query: text("query").notNull(),
  pageUrl: text("page_url"),
  position: integer("position"), // null = not found in scanned results
  impressions: integer("impressions"),
  clicks: integer("clicks"),
  ctr: real("ctr"),
  source: text("source").default("serp"), // serp / gsc
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

/** AI-search visibility checks (Phase 3, GEO). */
export const aiVisibilityChecks = pgTable("ai_visibility_checks", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id, {
    onDelete: "cascade",
  }),
  query: text("query").notNull(),
  engine: text("engine").notNull(), // ai_overview / chatgpt / gemini
  mentioned: boolean("mentioned").default(false),
  prominence: text("prominence"), // top / mid / mention / none
  citationUrl: text("citation_url"),
  samples: integer("samples").default(1),
  mentionRate: real("mention_rate"),
  raw: jsonb("raw").$type<Record<string, unknown>>(),
  sampledAt: timestamp("sampled_at").defaultNow().notNull(),
});

/** Validation score history. */
export const validationScores = pgTable("validation_scores", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id, {
    onDelete: "cascade",
  }),
  recordVersion: integer("record_version"),
  breakdown: jsonb("breakdown").$type<Record<string, number>>(),
  total: integer("total").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type SeoRecord = typeof seoRecords.$inferSelect;
export type NewSeoRecord = typeof seoRecords.$inferInsert;
export type StyleMemory = typeof styleMemory.$inferSelect;

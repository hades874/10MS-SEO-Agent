export interface CourseInput {
  name: string;
  details?: string; // free-text description of the course, features, subjects
  level?: string | null;
  year?: string | null;
  subject?: string | null;
  batchType?: string | null;
  group?: string | null;
  isFree?: boolean;
  duration?: string | null;
  price?: string | null;
  sku?: string | null;
  slug?: string | null;
  imageUrl?: string | null;
  targetKeywords?: string[];
}

/** A past course used as a few-shot exemplar. */
export interface Exemplar {
  name: string;
  metaTitleBn?: string | null;
  metaTitleEn?: string | null;
  metaDescBn?: string | null;
  metaDescEn?: string | null;
  keywords?: string[] | null;
  slug?: string | null;
}

export interface StyleContext {
  phrases: string[];
  templates: string[];
  brandRules: string[];
}

/** The copy fields the LLM produces. Schema JSON-LD is built deterministically. */
export interface GeneratedCopy {
  metaTitleBn: string;
  metaTitleEn: string;
  metaDescBn: string;
  metaDescEn: string;
  keywords: string[];
  ogTitleBn: string;
  ogTitleEn: string;
  ogDescriptionBn: string;
  ogDescriptionEn: string;
  ogImageAlt: string;
  imageNameThumb: string;
  imageNameSqr: string;
  imageAltThumb: string;
  imageAltSqr: string;
}

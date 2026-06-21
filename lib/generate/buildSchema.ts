/**
 * Deterministic Product JSON-LD builder. The schema is DERIVED from the same fields
 * we already store — never AI-guessed — so it always matches the published page.
 * Shape mirrors the 10MS Product example (brand, sku, offers, availability...).
 */

const BRAND_NAME = process.env.BRAND_NAME ?? "10 Minute School";
const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "https://10minuteschool.com";

export interface SchemaInput {
  name: string;
  slug?: string | null;
  description?: string | null; // Bangla description preferred (matches example)
  imageUrl?: string | null;
  sku?: string | null;
  price?: string | null;
  currency?: string | null;
  isFree?: boolean;
}

export interface ProductSchema {
  "@context": "https://schema.org/";
  "@type": "Product";
  name: string;
  image?: string;
  description?: string;
  brand: { "@type": "Brand"; name: string };
  sku?: string;
  offers: {
    "@type": "Offer";
    url: string;
    priceCurrency: string;
    price: string;
    availability: "https://schema.org/InStock";
  };
}

export interface SchemaResult {
  schema: ProductSchema;
  /** Fields that are missing and should be filled/reviewed rather than invented. */
  missing: string[];
}

export function buildProductSchema(input: SchemaInput): SchemaResult {
  const missing: string[] = [];
  const url = input.slug
    ? `${SITE_ORIGIN}/product/${input.slug}`
    : SITE_ORIGIN;
  if (!input.slug) missing.push("slug");

  const price = input.isFree ? "0" : input.price ?? "";
  if (!input.isFree && !input.price) missing.push("price");
  if (!input.sku) missing.push("sku");
  if (!input.imageUrl) missing.push("image");
  if (!input.description) missing.push("description");

  const schema: ProductSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: input.name,
    brand: { "@type": "Brand", name: BRAND_NAME },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: input.currency ?? "BDT",
      price,
      availability: "https://schema.org/InStock",
    },
  };
  if (input.imageUrl) schema.image = input.imageUrl;
  if (input.description) schema.description = input.description;
  if (input.sku) schema.sku = input.sku;

  return { schema, missing };
}

/** Light structural validation of a JSON-LD object against the expected Product shape. */
export function validateProductSchema(obj: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!obj || typeof obj !== "object") {
    return { valid: false, errors: ["not an object"] };
  }
  const s = obj as Record<string, unknown>;
  if (s["@type"] !== "Product") errors.push("@type must be Product");
  if (!s.name) errors.push("missing name");
  const brand = s.brand as Record<string, unknown> | undefined;
  if (!brand || !brand.name) errors.push("missing brand.name");
  const offers = s.offers as Record<string, unknown> | undefined;
  if (!offers) errors.push("missing offers");
  else {
    if (!offers.url) errors.push("missing offers.url");
    if (!offers.priceCurrency) errors.push("missing offers.priceCurrency");
    if (offers.price === undefined || offers.price === null || offers.price === "")
      errors.push("missing offers.price");
    if (!offers.availability) errors.push("missing offers.availability");
  }
  return { valid: errors.length === 0, errors };
}

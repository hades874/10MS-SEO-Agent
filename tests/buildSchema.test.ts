import { describe, it, expect } from "vitest";
import {
  buildProductSchema,
  validateProductSchema,
} from "@/lib/generate/buildSchema";

describe("buildProductSchema", () => {
  const full = {
    name: "HSC 2026 Science Online Batch",
    slug: "hsc-2026-science-online-batch",
    description: "একটি সম্পূর্ণ কোর্স",
    imageUrl: "https://cdn.10minuteschool.com/x.jpg",
    sku: "SKU-1",
    price: "1500",
    currency: "BDT",
    isFree: false,
  };

  it("builds a valid Product schema from complete input with no missing fields", () => {
    const { schema, missing } = buildProductSchema(full);
    expect(missing).toEqual([]);
    expect(schema["@type"]).toBe("Product");
    expect(schema.offers.price).toBe("1500");
    expect(schema.offers.priceCurrency).toBe("BDT");
    expect(schema.offers.url).toContain("/product/hsc-2026-science-online-batch");
    expect(validateProductSchema(schema).valid).toBe(true);
  });

  it("forces price '0' and omits the price-missing flag for free courses", () => {
    const { schema, missing } = buildProductSchema({
      ...full,
      isFree: true,
      price: null,
    });
    expect(schema.offers.price).toBe("0");
    expect(missing).not.toContain("price");
  });

  it("flags missing price for a paid course without a price", () => {
    const { schema, missing } = buildProductSchema({
      ...full,
      isFree: false,
      price: null,
    });
    expect(missing).toContain("price");
    // An empty price string makes the schema structurally invalid.
    expect(validateProductSchema(schema).valid).toBe(false);
  });

  it("reports every missing optional field", () => {
    const { missing } = buildProductSchema({ name: "Bare Course" });
    expect(missing).toEqual(
      expect.arrayContaining(["slug", "price", "sku", "image", "description"])
    );
  });

  it("defaults currency to BDT", () => {
    const { schema } = buildProductSchema({ ...full, currency: null });
    expect(schema.offers.priceCurrency).toBe("BDT");
  });
});

describe("validateProductSchema", () => {
  it("rejects non-objects", () => {
    expect(validateProductSchema(null).valid).toBe(false);
    expect(validateProductSchema("nope").valid).toBe(false);
  });

  it("collects all structural errors", () => {
    const { valid, errors } = validateProductSchema({ "@type": "Thing" });
    expect(valid).toBe(false);
    expect(errors).toContain("@type must be Product");
    expect(errors).toContain("missing name");
    expect(errors).toContain("missing offers");
  });
});

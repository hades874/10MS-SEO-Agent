import { describe, it, expect } from "vitest";
import { isRelevant } from "@/lib/keywords/autocomplete";

describe("isRelevant (autocomplete drift filter)", () => {
  it("keeps genuine long-tail expansions that preserve every seed token", () => {
    expect(isRelevant(["hsc", "29"], "hsc 29 science book")).toBe(true);
  });

  it("rejects numeric drift where Google extends the number", () => {
    // "29" must match as a whole word, so "2924" / "293" are drift, not expansion.
    expect(isRelevant(["hsc", "29"], "hsc 2924")).toBe(false);
    expect(isRelevant(["hsc", "29"], "hsc 293")).toBe(false);
  });

  it("requires all seed words to be present", () => {
    expect(isRelevant(["english", "grammar"], "spoken english")).toBe(false);
    expect(isRelevant(["english", "grammar"], "english grammar book")).toBe(true);
  });

  it("allows inflection / joins on non-numeric tokens", () => {
    expect(isRelevant(["english", "grammar"], "englishh grammar rules")).toBe(true);
  });
});

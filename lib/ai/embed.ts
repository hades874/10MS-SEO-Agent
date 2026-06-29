import { embed, embedMany } from "ai";
import { embedModel, embedModelId } from "./models";
import { EMBED_DIM } from "../db/schema";

/**
 * gemini-embedding-001 supports a configurable output size (MRL); we pin it to
 * EMBED_DIM (768) so it matches the pgvector column. The older text-embedding-004
 * is fixed at 768 and ignores the option.
 */
function providerOptions() {
  if (embedModelId().includes("gemini-embedding")) {
    return { google: { outputDimensionality: EMBED_DIM } };
  }
  return undefined;
}

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: await embedModel(),
    value: text,
    providerOptions: providerOptions(),
  });
  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({
    model: await embedModel(),
    values: texts,
    providerOptions: providerOptions(),
  });
  return embeddings;
}

/**
 * Canonical text we embed for a course: name + both descriptions + keywords. This
 * is what semantic recall matches against when grounding a new course's draft.
 */
export function buildEmbedSourceText(parts: {
  name: string;
  metaDescBn?: string | null;
  metaDescEn?: string | null;
  keywords?: string[] | null;
}): string {
  return [
    parts.name,
    parts.metaDescBn ?? "",
    parts.metaDescEn ?? "",
    (parts.keywords ?? []).join(", "),
  ]
    .filter(Boolean)
    .join("\n");
}

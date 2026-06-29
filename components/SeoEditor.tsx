"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCourseSeo } from "@/lib/actions";
import { FieldEditor } from "@/components/FieldEditor";
import type { GeneratedCopy } from "@/lib/generate/types";

const LIMITS = { titleMin: 30, titleMax: 60, descMin: 70, descMax: 160 };

/** Inline editor that saves human edits as a NEW seo_record version. */
export function SeoEditor({
  courseId,
  initial,
}: {
  courseId: number;
  initial: GeneratedCopy;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState<GeneratedCopy>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function setField<K extends keyof GeneratedCopy>(k: K, v: GeneratedCopy[K]) {
    setCopy((c) => ({ ...c, [k]: v }));
    setDone(null);
  }

  async function save(publish: boolean) {
    setSaving(true);
    setError(null);
    const res = await updateCourseSeo(courseId, copy, publish);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Save failed");
      return;
    }
    setDone(`Saved as v${res.version} · score ${res.score}`);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase text-gray-500">
              Edit SEO fields
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Edits are saved as a new version — the history is kept.
            </p>
          </div>
          <button
            onClick={() => {
              setCopy(initial);
              setOpen(true);
            }}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Edit
          </button>
        </div>
        {done && <p className="mt-3 text-sm text-green-700">{done}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase text-gray-500">
        Edit SEO fields
      </h3>

      <FieldEditor label="Meta title (Bangla)" value={copy.metaTitleBn} onChange={(v) => setField("metaTitleBn", v)} min={LIMITS.titleMin} max={LIMITS.titleMax} />
      <FieldEditor label="Meta title (English)" value={copy.metaTitleEn} onChange={(v) => setField("metaTitleEn", v)} min={LIMITS.titleMin} max={LIMITS.titleMax} />
      <FieldEditor label="Meta description (Bangla)" value={copy.metaDescBn} onChange={(v) => setField("metaDescBn", v)} min={LIMITS.descMin} max={LIMITS.descMax} multiline />
      <FieldEditor label="Meta description (English)" value={copy.metaDescEn} onChange={(v) => setField("metaDescEn", v)} min={LIMITS.descMin} max={LIMITS.descMax} multiline />
      <FieldEditor label="Keywords (comma-separated)" value={copy.keywords.join(", ")} onChange={(v) => setField("keywords", v.split(",").map((s) => s.trim()).filter(Boolean))} hint="Each ≤ 50 chars" />
      <FieldEditor label="og:title (Bangla)" value={copy.ogTitleBn} onChange={(v) => setField("ogTitleBn", v)} />
      <FieldEditor label="og:title (English)" value={copy.ogTitleEn} onChange={(v) => setField("ogTitleEn", v)} />
      <FieldEditor label="og:description (Bangla)" value={copy.ogDescriptionBn} onChange={(v) => setField("ogDescriptionBn", v)} multiline />
      <FieldEditor label="og:description (English)" value={copy.ogDescriptionEn} onChange={(v) => setField("ogDescriptionEn", v)} multiline />
      <FieldEditor label="og:image alt" value={copy.ogImageAlt} onChange={(v) => setField("ogImageAlt", v)} />
      <FieldEditor label="Image name (thumbnail)" value={copy.imageNameThumb} onChange={(v) => setField("imageNameThumb", v)} />
      <FieldEditor label="Image name (square)" value={copy.imageNameSqr} onChange={(v) => setField("imageNameSqr", v)} />
      <FieldEditor label="Image alt (thumbnail)" value={copy.imageAltThumb} onChange={(v) => setField("imageAltThumb", v)} />
      <FieldEditor label="Image alt (square)" value={copy.imageAltSqr} onChange={(v) => setField("imageAltSqr", v)} />

      {error && (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <button onClick={() => setOpen(false)} disabled={saving} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
          Cancel
        </button>
        <button onClick={() => save(false)} disabled={saving} className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
          {saving ? "Saving…" : "Save as new version"}
        </button>
        <button onClick={() => save(true)} disabled={saving} className="flex-1 rounded-md bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
          {saving ? "Saving…" : "Save & publish"}
        </button>
      </div>
    </div>
  );
}

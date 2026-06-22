"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateForNewCourse, saveCourse } from "@/lib/actions";
import { FieldEditor } from "@/components/FieldEditor";
import { ScoreBadge } from "@/components/ScoreBadge";
import type { CourseInput, GeneratedCopy } from "@/lib/generate/types";

const LIMITS = { titleMin: 30, titleMax: 60, descMin: 70, descMax: 160 };

export default function NewCoursePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    details: "",
    price: "",
    sku: "",
    slug: "",
    imageUrl: "",
    targetKeywords: "",
    isFree: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState<CourseInput | null>(null);
  const [copy, setCopy] = useState<GeneratedCopy | null>(null);
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [exemplars, setExemplars] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function setCopyField<K extends keyof GeneratedCopy>(k: K, v: GeneratedCopy[K]) {
    setCopy((c) => (c ? { ...c, [k]: v } : c));
  }

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    const res = await generateForNewCourse({
      name: form.name,
      details: form.details || undefined,
      price: form.price || undefined,
      sku: form.sku || undefined,
      slug: form.slug || undefined,
      imageUrl: form.imageUrl || undefined,
      isFree: form.isFree,
      targetKeywords: form.targetKeywords
        ? form.targetKeywords.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    });
    setBusy(false);
    if (!res.ok || !res.result || !res.input) {
      setError(res.error ?? "Generation failed");
      return;
    }
    setInput(res.input);
    setCopy(res.result.copy);
    setSchema(res.result.schema as unknown as Record<string, unknown>);
    setScore(res.result.score.total);
    setExemplars(res.exemplarNames ?? []);
  }

  async function handleSave(publish: boolean) {
    if (!input || !copy || !schema) return;
    setSaving(true);
    const res = await saveCourse(input, copy, publish);
    setSaving(false);
    if (res.ok && res.courseId) router.push(`/courses/${res.courseId}`);
    else setError(res.error ?? "Save failed");
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Input form */}
      <div>
        <h1 className="text-2xl font-semibold">New course</h1>
        <p className="mt-1 text-sm text-gray-500">
          Describe the course. The agent grounds the draft on your most similar past
          courses + house style.
        </p>

        <div className="mt-5 space-y-3">
          <Labeled label="Course name *">
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. HSC 28 Recorded Batch (Science)"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </Labeled>
          <Labeled label="Details / features">
            <textarea
              value={form.details}
              onChange={(e) => set("details", e.target.value)}
              rows={4}
              placeholder="One Shot classes, MCQ exams, AI Doubt Solver TenTen, 7 subjects, playlists…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </Labeled>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Price (BDT)">
              <input
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                disabled={form.isFree}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
              />
            </Labeled>
            <Labeled label="SKU">
              <input
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </Labeled>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={form.isFree}
              onChange={(e) => set("isFree", e.target.checked)}
            />
            Free course
          </label>
          <Labeled label="Slug (optional — auto-suggested)">
            <input
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="hsc-28-science-recorded-batch"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Labeled>
          <Labeled label="Thumbnail URL (optional)">
            <input
              value={form.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Labeled>
          <Labeled label="Target keywords (comma-separated, optional)">
            <input
              value={form.targetKeywords}
              onChange={(e) => set("targetKeywords", e.target.value)}
              placeholder="HSC 2028 Science, এইচএসসি বিজ্ঞান"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Labeled>

          <button
            onClick={handleGenerate}
            disabled={busy || !form.name.trim()}
            className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Generating…" : "Generate SEO bundle"}
          </button>
          {error && (
            <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Generated / editable output */}
      <div>
        {copy ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Generated bundle</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                Score <ScoreBadge score={score} />
              </div>
            </div>
            {exemplars.length > 0 && (
              <p className="mb-4 text-xs text-gray-500">
                Grounded on: {exemplars.join(", ")}
              </p>
            )}

            <FieldEditor label="Meta title (Bangla)" value={copy.metaTitleBn} onChange={(v) => setCopyField("metaTitleBn", v)} min={LIMITS.titleMin} max={LIMITS.titleMax} />
            <FieldEditor label="Meta title (English)" value={copy.metaTitleEn} onChange={(v) => setCopyField("metaTitleEn", v)} min={LIMITS.titleMin} max={LIMITS.titleMax} />
            <FieldEditor label="Meta description (Bangla)" value={copy.metaDescBn} onChange={(v) => setCopyField("metaDescBn", v)} min={LIMITS.descMin} max={LIMITS.descMax} multiline />
            <FieldEditor label="Meta description (English)" value={copy.metaDescEn} onChange={(v) => setCopyField("metaDescEn", v)} min={LIMITS.descMin} max={LIMITS.descMax} multiline />
            <FieldEditor label="Keywords (comma-separated)" value={copy.keywords.join(", ")} onChange={(v) => setCopyField("keywords", v.split(",").map((s) => s.trim()).filter(Boolean))} hint="Each ≤ 50 chars" />
            <FieldEditor label="og:title" value={copy.ogTitle} onChange={(v) => setCopyField("ogTitle", v)} />
            <FieldEditor label="og:description" value={copy.ogDescription} onChange={(v) => setCopyField("ogDescription", v)} multiline />
            <FieldEditor label="og:image alt" value={copy.ogImageAlt} onChange={(v) => setCopyField("ogImageAlt", v)} />
            <FieldEditor label="Image name (thumbnail)" value={copy.imageNameThumb} onChange={(v) => setCopyField("imageNameThumb", v)} />
            <FieldEditor label="Image name (square)" value={copy.imageNameSqr} onChange={(v) => setCopyField("imageNameSqr", v)} />
            <FieldEditor label="Image alt (thumbnail)" value={copy.imageAltThumb} onChange={(v) => setCopyField("imageAltThumb", v)} />
            <FieldEditor label="Image alt (square)" value={copy.imageAltSqr} onChange={(v) => setCopyField("imageAltSqr", v)} />

            <details className="mt-4 rounded-md border border-gray-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium">Product JSON-LD schema</summary>
              <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-3 text-xs">
                {JSON.stringify(schema, null, 2)}
              </pre>
            </details>

            <div className="mt-5 flex gap-3">
              <button onClick={() => handleSave(false)} disabled={saving} className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
                {saving ? "Saving…" : "Save draft"}
              </button>
              <button onClick={() => handleSave(true)} disabled={saving} className="flex-1 rounded-md bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                Publish
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
            Generated SEO fields will appear here.
          </div>
        )}
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

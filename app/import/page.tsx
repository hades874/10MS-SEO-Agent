"use client";

import { useState } from "react";
import Link from "next/link";
import { runImport, type ImportActionResult } from "@/lib/actions";

export default function ImportPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportActionResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    setResult(null);
    const text = await file.text();
    const res = await runImport(text);
    setResult(res);
    setBusy(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Import SEO CSV</h1>
      <p className="mt-1 text-sm text-gray-500">
        Upload the 10MS SEO seed CSV (block layout). Each course block is parsed,
        Bangla/English assigned by script, facets derived, keywords + embeddings
        AI-back-filled, and house phrases mined. This replaces previously imported
        seed rows.
      </p>

      <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-10 hover:border-brand">
        <input type="file" accept=".csv" className="hidden" onChange={handleFile} disabled={busy} />
        <span className="text-sm text-gray-600">
          {busy ? "Importing…" : fileName ? `Selected: ${fileName}` : "Click to choose a .csv file"}
        </span>
      </label>

      {result && (
        <div className="mt-6">
          {result.ok ? (
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
              <p className="font-semibold">Import complete</p>
              <ul className="mt-2 space-y-0.5">
                <li>Courses imported: {result.summary?.inserted}</li>
                <li>Keywords back-filled: {result.summary?.aiBackfilled}</li>
                <li>Embeddings created: {result.summary?.embedded}</li>
                <li>Style phrases mined: {result.summary?.stylePhrases}</li>
                <li>Skipped: {result.summary?.skipped}</li>
              </ul>
              <Link href="/" className="mt-3 inline-block text-brand underline">
                View dashboard →
              </Link>
            </div>
          ) : (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

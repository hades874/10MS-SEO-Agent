"use client";

import { useState } from "react";
import { keywordResearchAction } from "@/lib/actions";
import type { KeywordResearch } from "@/lib/keywords/autocomplete";

export default function KeywordsPage() {
  const [seed, setSeed] = useState("");
  const [expand, setExpand] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [research, setResearch] = useState<KeywordResearch | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await keywordResearchAction(seed, expand);
    setBusy(false);
    if (res.ok && res.research) setResearch(res.research);
    else setError(res.error ?? "Failed");
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Keyword research</h1>
      <p className="mt-1 text-sm text-gray-500">
        Free, via Google Autocomplete (English + Bangla, Bangladesh). The demand
        signal is a breadth proxy — directional, not true search volume.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && run()}
          placeholder="e.g. hsc 2028 science"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={expand} onChange={(e) => setExpand(e.target.checked)} />
          a–z expansion
        </label>
        <button
          onClick={run}
          disabled={busy || !seed.trim()}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Researching…" : "Research"}
        </button>
      </div>
      {expand && (
        <p className="mt-1 text-xs text-gray-400">a–z expansion makes ~70 requests; takes a few seconds.</p>
      )}

      {error && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {research && (
        <div className="mt-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm text-gray-500">Demand signal</span>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full bg-brand" style={{ width: `${research.demandSignal}%` }} />
            </div>
            <span className="text-sm font-medium">{research.demandSignal}/100</span>
          </div>

          <KeywordList title={`Direct suggestions (${research.suggestions.length})`} items={research.suggestions} />
          {research.related.length > 0 && (
            <KeywordList title={`Related / expanded (${research.related.length})`} items={research.related} />
          )}
        </div>
      )}
    </div>
  );
}

function KeywordList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((k) => (
          <span key={k} className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-sm text-gray-700">
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

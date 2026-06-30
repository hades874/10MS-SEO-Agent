"use client";

import { useState } from "react";
import { comparePdpsAction } from "@/lib/actions";
import { PdpComparePanel } from "@/components/PdpComparePanel";
import { ErrorNote } from "@/components/ErrorNote";
import { MAX_COMPETITORS } from "@/lib/pdp/compare";
import type { PdpComparisonResult } from "@/lib/pdp/types";

export default function ComparePage() {
  const [ourUrl, setOurUrl] = useState("");
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([""]);
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<PdpComparisonResult | null>(null);

  function setCompetitorAt(i: number, value: string) {
    setCompetitorUrls((prev) => prev.map((u, idx) => (idx === i ? value : u)));
  }
  function addCompetitor() {
    setCompetitorUrls((prev) =>
      prev.length < MAX_COMPETITORS ? [...prev, ""] : prev
    );
  }
  function removeCompetitor(i: number) {
    setCompetitorUrls((prev) =>
      prev.length === 1 ? [""] : prev.filter((_, idx) => idx !== i)
    );
  }

  async function run() {
    setBusy(true);
    setError(null);
    const targetKeywords = keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    const rivals = competitorUrls.map((u) => u.trim()).filter(Boolean);
    const res = await comparePdpsAction(ourUrl, rivals, targetKeywords);
    setBusy(false);
    if (res.ok && res.comparison) setComparison(res.comparison);
    else setError(res.error ?? "Comparison failed");
  }

  const canRun =
    !!ourUrl.trim() && competitorUrls.some((u) => u.trim()) && !busy;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">PDP comparison</h1>
        <p className="mt-1 text-sm text-gray-500">
          Compare your course page head-to-head against a competitor&apos;s and get SEO insights
          and prioritized fixes to outrank them.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <label className="block">
          <span className="text-xs font-medium uppercase text-gray-500">Your page URL</span>
          <input
            value={ourUrl}
            onChange={(e) => setOurUrl(e.target.value)}
            placeholder="https://10minuteschool.com/..."
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </label>
        <div>
          <span className="text-xs font-medium uppercase text-gray-500">Competitor page URLs</span>
          <div className="mt-1 space-y-2">
            {competitorUrls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) => setCompetitorAt(i, e.target.value)}
                  placeholder={`https://competitor${i + 1}.com/...`}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeCompetitor(i)}
                  disabled={competitorUrls.length === 1 && !url.trim()}
                  aria-label="Remove competitor"
                  className="rounded-md border border-gray-300 px-3 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addCompetitor}
            disabled={competitorUrls.length >= MAX_COMPETITORS}
            className="mt-2 text-sm font-medium text-brand-dark hover:underline disabled:text-gray-400 disabled:no-underline"
          >
            + Add competitor{competitorUrls.length >= MAX_COMPETITORS ? ` (max ${MAX_COMPETITORS})` : ""}
          </button>
        </div>
        <label className="block">
          <span className="text-xs font-medium uppercase text-gray-500">
            Target keywords <span className="font-normal normal-case text-gray-400">(optional, comma-separated)</span>
          </span>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="hsc 26 physics, এইচএসসি পদার্থবিজ্ঞান"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </label>
        <button
          onClick={run}
          disabled={!canRun}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Comparing…" : "Compare"}
        </button>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>

      {comparison && <PdpComparePanel comparison={comparison} />}
    </div>
  );
}

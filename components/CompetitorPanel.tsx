"use client";

import { useState } from "react";
import { analyzeCompetitorsAction } from "@/lib/actions";
import { ScoreBadge } from "./ScoreBadge";
import type { AnalyzeResult } from "@/lib/competitors/analyze";

interface Props {
  defaultKeyword: string;
  targetKeywords: string[];
  ourName: string;
  ourScore: number | null;
}

export function CompetitorPanel({
  defaultKeyword,
  targetKeywords,
  ourName,
  ourScore,
}: Props) {
  const [keyword, setKeyword] = useState(defaultKeyword);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await analyzeCompetitorsAction(keyword, targetKeywords);
    setBusy(false);
    if (res.ok && res.result) setResult(res.result);
    else setError(res.error ?? "Analysis failed");
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">
        Competitor analysis (Bangladeshi ed-tech)
      </h3>
      <p className="mb-3 text-xs text-gray-400">
        Discovers Shikho / ACS / British Council / Udvash / Bohubrihi / Ostad pages
        ranking for the keyword, then scores their on-page SEO against yours. If none of
        them rank, it falls back to the top-ranking pages so you still see who does.
      </p>
      <div className="flex gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <button
          onClick={run}
          disabled={busy || !keyword.trim()}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Analyzing…" : "Analyze"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-4 overflow-x-auto">
          {result.competitors.length === 0 ? (
            <p className="text-sm text-gray-500">
              No watchlist competitors found ranking for “{result.keyword}”. Try a
              broader keyword.
            </p>
          ) : (
            <>
            {result.source === "discovered" && (
              <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-sm text-amber-700">
                None of your watchlist domains rank for “{result.keyword}” — showing the
                top-ranking pages instead.
              </p>
            )}
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Platform</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">Schema</th>
                  <th className="py-2 pr-3">Words</th>
                  <th className="py-2 pr-3">KW hits</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 bg-green-50/50">
                  <td className="py-2 pr-3 font-medium">{ourName} (you)</td>
                  <td className="py-2 pr-3"><ScoreBadge score={ourScore} /></td>
                  <td className="py-2 pr-3 text-gray-500">—</td>
                  <td className="py-2 pr-3 text-gray-500">—</td>
                  <td className="py-2 pr-3 text-gray-500">—</td>
                </tr>
                {result.competitors.map((c) => (
                  <tr key={c.page.url} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3">
                      <a href={c.page.url} target="_blank" rel="noreferrer" className="text-brand-dark hover:underline">
                        {c.competitorName}
                      </a>
                      <div className="max-w-xs truncate text-xs text-gray-400">{c.page.title}</div>
                    </td>
                    <td className="py-2 pr-3"><ScoreBadge score={c.score.total} /></td>
                    <td className="py-2 pr-3 text-gray-600">
                      {c.page.schemaPresent ? c.page.schemaTypes.slice(0, 2).join(", ") : "—"}
                    </td>
                    <td className="py-2 pr-3 text-gray-600">{c.page.wordCount}</td>
                    <td className="py-2 pr-3 text-gray-600">{c.page.keywordsDetected.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
          <p className="mt-2 text-xs text-gray-400">
            Checked {result.checkedDomains} domain(s). Note: SPA competitor pages may
            under-report word count (server HTML only).
          </p>
        </div>
      )}
    </div>
  );
}

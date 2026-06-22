"use client";

import { useState } from "react";
import { trackCourseAction } from "@/lib/actions";
import type { TrackResult } from "@/lib/track";

interface StoredRank {
  query: string;
  position: number | null;
  checkedAt: Date | string | null;
}
interface StoredAivis {
  engine: string;
  mentioned: boolean | null;
  prominence: string | null;
  mentionRate: number | null;
  sampledAt: Date | string | null;
}

interface Props {
  courseId: number;
  hasKeywords: boolean;
  initialRanks: StoredRank[];
  initialAivis: StoredAivis[];
}

export function TrackingPanel({ courseId, hasKeywords, initialRanks, initialAivis }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<TrackResult | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await trackCourseAction(courseId);
    setBusy(false);
    if (res.ok && res.result) setLive(res.result);
    else setError(res.error ?? "Tracking failed");
  }

  const ranks = live
    ? live.ranks.map((r) => ({ query: r.keyword, position: r.position, checkedAt: new Date() }))
    : initialRanks;
  const aivis = live
    ? live.aivis.engines.map((e) => ({
        engine: e.engine,
        mentioned: e.mentioned,
        prominence: e.prominence,
        mentionRate: e.mentionRate,
        sampledAt: e.configured ? new Date() : null,
        configured: e.configured,
        note: e.note,
      }))
    : initialAivis.map((a) => ({ ...a, configured: true, note: undefined as string | undefined }));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-gray-500">
          Rank &amp; AI-search visibility
        </h3>
        <button
          onClick={run}
          disabled={busy || !hasKeywords}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          title={hasKeywords ? "" : "Add keywords first"}
        >
          {busy ? "Tracking…" : "Track now"}
        </button>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        Web rank is a DuckDuckGo SERP proxy (Google blocks scrapers). AI visibility
        asks Gemini (Google-search grounded) and reports a mention rate. Takes ~10–20s.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {/* Web rank */}
      <div className="mb-4">
        <h4 className="mb-1 text-xs font-medium text-gray-600">Web SERP rank</h4>
        {ranks.length === 0 ? (
          <p className="text-sm text-gray-400">No checks yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {ranks.map((r) => (
                <tr key={r.query} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-3">{r.query}</td>
                  <td className="py-1.5 text-right">
                    {r.position == null ? (
                      <span className="text-gray-400">not in top results</span>
                    ) : (
                      <span className="font-medium">#{r.position}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* AI visibility */}
      <div>
        <h4 className="mb-1 text-xs font-medium text-gray-600">AI-search visibility</h4>
        {aivis.length === 0 ? (
          <p className="text-sm text-gray-400">No checks yet.</p>
        ) : (
          <div className="space-y-1.5">
            {aivis.map((a) => (
              <div key={a.engine} className="flex items-center justify-between text-sm">
                <span className="capitalize">{a.engine.replace("_", " ")}</span>
                {a.configured === false ? (
                  <span className="text-xs text-gray-400">{a.note ?? "not configured"}</span>
                ) : a.mentioned ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                    {a.prominence === "top" ? "recommended (top)" : "mentioned"}
                    {a.mentionRate != null && ` · ${Math.round((a.mentionRate ?? 0) * 100)}%`}
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    not mentioned
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

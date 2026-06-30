"use client";

import { useState } from "react";
import { trackCourseAction } from "@/lib/actions";
import { ErrorNote } from "./ErrorNote";
import type { TrackResult } from "@/lib/track";

interface StoredRank {
  query: string;
  position: number | null;
  scanned?: number;
  pageUrl?: string | null;
  topResults?: { position: number; url: string; host: string }[];
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

  const ranks: StoredRank[] = live
    ? live.ranks.map((r) => ({
        query: r.keyword,
        position: r.position,
        scanned: r.scanned,
        pageUrl: r.pageUrl,
        topResults: r.topResults,
        checkedAt: new Date(),
      }))
    : initialRanks;

  // Warn immediately after a live run when every keyword returned 0 SERP results —
  // that indicates an API key issue rather than a genuine absence of ranking.
  const serpFailed = live != null && ranks.every((r) => (r.scanned ?? 1) === 0);
  // A quota/overload error cut AI-visibility sampling short — surface it so the empty
  // result reads as "rate limited", not "not mentioned".
  const rateLimited = live?.rateLimited ?? false;
  const aivis = live
    ? live.aivis.engines.map((e) => ({
        engine: e.engine,
        mentioned: e.mentioned,
        prominence: e.prominence,
        mentionRate: e.mentionRate,
        sampledAt: e.configured ? new Date() : null,
        configured: e.configured,
        note: e.note,
        rateLimited: e.rateLimited ?? false,
      }))
    : initialAivis.map((a) => ({
        ...a,
        configured: true,
        note: undefined as string | undefined,
        rateLimited: false,
      }));

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
        Web rank checks where 10MS appears in the top 20 search results for each keyword
        via the configured SERP provider (Serper or DuckDuckGo). AI visibility asks Gemini
        (Google-search grounded) and reports a mention rate. Takes ~10–20s.
      </p>

      {error && <ErrorNote className="mb-3">{error}</ErrorNote>}
      {rateLimited && (
        <ErrorNote tone="warning" className="mb-3">
          API quota / rate limit reached while checking AI-search visibility — results
          may be incomplete. Wait about a minute and run it again.
        </ErrorNote>
      )}
      {serpFailed && (
        <ErrorNote tone="warning" className="mb-3">
          SERP returned 0 results for all keywords — your API key may be invalid or the
          provider is unreachable. Check Settings.
        </ErrorNote>
      )}

      {/* Web rank */}
      <div className="mb-4">
        <h4 className="mb-1 text-xs font-medium text-gray-600">Web SERP rank</h4>
        {ranks.length === 0 ? (
          <p className="text-sm text-gray-400">No checks yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {ranks.map((r) => {
                const top = r.topResults?.[0];
                return (
                  <tr key={r.query} className="border-b border-gray-100 last:border-0 align-top">
                    <td className="py-1.5 pr-3">{r.query}</td>
                    <td className="py-1.5 text-right">
                      {r.position != null ? (
                        r.pageUrl ? (
                          <a
                            href={r.pageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-brand-dark hover:underline"
                            title={r.pageUrl}
                          >
                            #{r.position} ↗
                          </a>
                        ) : (
                          <span className="font-medium text-green-700">#{r.position}</span>
                        )
                      ) : r.scanned === 0 ? (
                        <span className="text-amber-700">search unavailable</span>
                      ) : (
                        <div>
                          <span className="text-gray-500">
                            not in top {r.scanned ?? 20}
                          </span>
                          {top && (
                            <div className="text-xs text-gray-400">
                              #1 is {top.host || top.url}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
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
                ) : a.rateLimited ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    rate limited
                  </span>
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

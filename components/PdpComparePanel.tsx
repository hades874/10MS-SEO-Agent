import { ScoreBadge } from "./ScoreBadge";
import type { PdpComparisonResult } from "@/lib/pdp/types";
import type { CompetitorScore } from "@/lib/competitors/score";

const DIM_LABELS: Record<keyof CompetitorScore["breakdown"], string> = {
  title: "Title",
  description: "Description",
  keywordUsage: "Keyword usage",
  schema: "Schema",
  og: "Open Graph",
  content: "Content depth",
};

const SEV_COLOR: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  med: "bg-yellow-100 text-yellow-800",
  low: "bg-gray-100 text-gray-600",
};

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        SEV_COLOR[value] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {label}: {value}
    </span>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function PdpComparePanel({ comparison }: { comparison: PdpComparisonResult }) {
  const { ours, competitors, keywordGap, analysis, aiSkippedReason } = comparison;
  const dims = Object.keys(DIM_LABELS) as (keyof CompetitorScore["breakdown"])[];

  return (
    <div className="space-y-6">
      {/* Scorecards */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase text-gray-500">
          On-page SEO scorecard
        </h3>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="py-2 pr-3">Dimension</th>
              <th className="py-2 pr-3">You</th>
              {competitors.map((c) => (
                <th key={c.url} className="py-2 pr-3">
                  <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline" title={c.url}>
                    {hostOf(c.url)}
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 bg-green-50/50 font-medium">
              <td className="py-2 pr-3">Total</td>
              <td className="py-2 pr-3"><ScoreBadge score={ours.score.total} /></td>
              {competitors.map((c) => (
                <td key={c.url} className="py-2 pr-3"><ScoreBadge score={c.score.total} /></td>
              ))}
            </tr>
            {dims.map((d) => {
              const us = ours.score.breakdown[d];
              const bestRival = Math.max(...competitors.map((c) => c.score.breakdown[d]));
              return (
                <tr key={d} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3 text-gray-600">{DIM_LABELS[d]}</td>
                  <td className={`py-2 pr-3 ${us < bestRival ? "text-red-600 font-medium" : "text-gray-700"}`}>{us}</td>
                  {competitors.map((c) => {
                    const them = c.score.breakdown[d];
                    return (
                      <td key={c.url} className={`py-2 pr-3 ${them > us ? "text-green-700" : "text-gray-700"}`}>{them}</td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-gray-400">
          You: <a href={ours.url} target="_blank" rel="noreferrer" className="hover:underline">{ours.url}</a> ·{" "}
          {competitors.length} competitor{competitors.length === 1 ? "" : "s"} compared.
        </p>
      </div>

      {aiSkippedReason && (
        <p className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          {aiSkippedReason}
        </p>
      )}

      {analysis?.summary && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">Verdict</h3>
          <p className="text-sm text-gray-700">{analysis.summary}</p>
        </div>
      )}

      {/* Prioritized actions — lead with these */}
      {analysis && analysis.prioritizedActions.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase text-gray-500">
            Prioritized actions to outrank them
          </h3>
          <ol className="space-y-3">
            {analysis.prioritizedActions.map((a, i) => (
              <li key={i} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{i + 1}. {a.action}</span>
                  <Pill label="Impact" value={a.impact} />
                  <Pill label="Effort" value={a.effort} />
                </div>
                <p className="mt-1 text-xs text-gray-500">{a.rationale}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* On-page deficits */}
      {analysis && analysis.onPageDeficits.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase text-gray-500">On-page deficits</h3>
          <ul className="space-y-3 text-sm">
            {analysis.onPageDeficits.map((d, i) => (
              <li key={i} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{d.dimension}</span>
                  <Pill label="Severity" value={d.severity} />
                </div>
                <p className="mt-1 text-xs text-gray-500">You: {d.ours} · Them: {d.competitor}</p>
                <p className="mt-1 text-gray-700">→ {d.fix}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Content gaps */}
      {analysis && analysis.contentGaps.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase text-gray-500">
            Content gaps (they cover, you don&apos;t)
          </h3>
          <ul className="space-y-3 text-sm">
            {analysis.contentGaps.map((g, i) => (
              <li key={i} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <span className="font-medium text-gray-800">{g.topic}</span>
                <p className="mt-1 text-gray-700">{g.suggestion}</p>
                <p className="mt-1 text-xs text-gray-500">Why: {g.whyItMatters}</p>
                {g.evidenceFromCompetitor && (
                  <p className="mt-1 text-xs italic text-gray-400">“{g.evidenceFromCompetitor}”</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Keyword gap */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">Keyword gap</h3>
        <p className="mb-3 text-xs text-gray-400">
          Phrases the competitor emphasises on-page that your page doesn&apos;t mention. Directional, not search volume.
        </p>
        {keywordGap.length === 0 ? (
          <p className="text-sm text-gray-500">No page-derived keyword gap found — good coverage.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywordGap.map((k) => (
              <span
                key={k.keyword}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                title={k.competitorUrls?.join(", ") ?? k.source}
              >
                {k.keyword}
                {(k.competitorUrls?.length ?? 0) > 1 && (
                  <span className="text-gray-400">·{k.competitorUrls!.length}</span>
                )}
                {k.source === "autocomplete" && <span className="text-gray-400">·auto</span>}
              </span>
            ))}
          </div>
        )}
        {analysis && analysis.keywordGaps.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm">
            {analysis.keywordGaps.map((k, i) => (
              <li key={i} className="text-gray-700">
                <span className="font-medium">{k.keyword}</span> — {k.recommendation}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

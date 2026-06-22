"use client";

import { useState } from "react";
import { ScoreBadge } from "@/components/ScoreBadge";
import { diffRecords } from "@/lib/util/diff";
import type { SeoRecord } from "@/lib/db/schema";

function fmtDate(d: Date | string | null) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString();
}

/** Version list + before/after diff between any two SEO record versions. */
export function VersionHistory({ versions }: { versions: SeoRecord[] }) {
  // Newest first. Default: compare latest (after) against previous (before).
  const [afterId, setAfterId] = useState(versions[0]?.id ?? 0);
  const [beforeId, setBeforeId] = useState(versions[1]?.id ?? versions[0]?.id ?? 0);

  if (versions.length < 2) return null;

  const after = versions.find((v) => v.id === afterId) ?? versions[0];
  const before = versions.find((v) => v.id === beforeId) ?? versions[1];
  const diff = diffRecords(before, after).filter((d) => d.changed);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase text-gray-500">
        Version history
      </h3>

      <ul className="mb-4 space-y-1 text-sm">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center gap-2 text-gray-600">
            <span className="font-medium">v{v.version}</span>
            <ScoreBadge score={v.validationScore} />
            <span className="text-xs text-gray-400">{fmtDate(v.createdAt)}</span>
            {v.aiGenerated ? (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">AI</span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">edited</span>
            )}
            {v.isPublished && (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">published</span>
            )}
          </li>
        ))}
      </ul>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">Compare</span>
        <select
          value={beforeId}
          onChange={(e) => setBeforeId(Number(e.target.value))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>v{v.version} (before)</option>
          ))}
        </select>
        <span className="text-gray-400">→</span>
        <select
          value={afterId}
          onChange={(e) => setAfterId(Number(e.target.value))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>v{v.version} (after)</option>
          ))}
        </select>
      </div>

      {diff.length === 0 ? (
        <p className="text-sm text-gray-400">No differences in the compared fields.</p>
      ) : (
        <div className="space-y-3">
          {diff.map((d) => (
            <div key={d.field} className="text-sm">
              <div className="mb-1 text-xs font-medium text-gray-500">{d.label}</div>
              <div className="rounded bg-red-50 px-2 py-1 text-red-800">
                <span className="mr-1 text-xs text-red-400">−</span>
                {d.before || <span className="text-gray-400">(empty)</span>}
              </div>
              <div className="mt-1 rounded bg-green-50 px-2 py-1 text-green-800">
                <span className="mr-1 text-xs text-green-500">+</span>
                {d.after || <span className="text-gray-400">(empty)</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

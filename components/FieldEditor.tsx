"use client";

import { visibleLength } from "@/lib/util/lang";

interface FieldEditorProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  multiline?: boolean;
  hint?: string;
}

export function FieldEditor({
  label,
  value,
  onChange,
  min,
  max,
  multiline,
  hint,
}: FieldEditorProps) {
  const len = visibleLength(value);
  const hasLimit = min != null && max != null;
  const ok = !hasLimit || (len >= min! && len <= max!);

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        {hasLimit && (
          <span className={`text-xs ${ok ? "text-gray-400" : "text-red-600 font-medium"}`}>
            {len}/{min}–{max}
          </span>
        )}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`w-full rounded-md border px-3 py-2 text-sm ${
            ok ? "border-gray-300" : "border-red-400"
          } focus:border-brand focus:outline-none`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-md border px-3 py-2 text-sm ${
            ok ? "border-gray-300" : "border-red-400"
          } focus:border-brand focus:outline-none`}
        />
      )}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

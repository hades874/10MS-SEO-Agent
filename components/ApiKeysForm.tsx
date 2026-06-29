"use client";

import { useEffect, useState } from "react";

interface ManagedKey {
  name: string;
  label: string;
  help: string;
}

/**
 * Browser-side API key manager. Keys are stored as httpOnly cookies on the server
 * (via /api/keys), so we can never read their values back — we only show whether
 * each key is "configured". Saving sends only the fields the user actually typed.
 */
export function ApiKeysForm({ managed }: { managed: ManagedKey[] }) {
  const [status, setStatus] = useState<Record<string, "custom" | "default" | "none">>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/keys", { cache: "no-store" });
        const data = await res.json();
        if (active) setStatus(data.keys ?? {});
      } catch {
        /* leave status as-is */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    // Only send fields the user typed into (non-empty edits become sets;
    // an explicitly cleared field is sent as "" to delete that cookie).
    const payload = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(payload).length === 0) {
      setMsg("Nothing to save — type a key first.");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setStatus(data.keys ?? {});
      setValues({});
      setMsg("Saved. Keys are stored in your browser.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function clearAll() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/keys", { method: "DELETE" });
      const data = await res.json();
      setStatus(data.keys ?? {});
      setValues({});
      setMsg("Cleared all saved keys.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Enter your API keys below. They&apos;re saved in your browser (httpOnly cookies)
        and sent only to this app&apos;s server — never shown back to you and not stored in
        the system by default.
      </p>

      {managed.map((k) => (
        <div key={k.name} className="border-b border-gray-100 py-2 last:border-0">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-800">{k.label}</label>
            {loading ? (
              <span className="text-xs text-gray-400">…</span>
            ) : status[k.name] === "custom" ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                configured (custom)
              </span>
            ) : status[k.name] === "default" ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                configured (default)
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                not set
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{k.help}</p>
          <input
            type="password"
            autoComplete="off"
            value={values[k.name] ?? ""}
            onChange={(e) =>
              setValues((v) => ({ ...v, [k.name]: e.target.value }))
            }
            placeholder={status[k.name] === "custom" ? "•••••••• (custom set — type to replace)" : status[k.name] === "default" ? "•••••••• (default set — type to override)" : "Paste key…"}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
        </div>
      ))}

      {msg && <p className="text-sm text-gray-600">{msg}</p>}

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save keys"}
        </button>
        <button
          onClick={clearAll}
          disabled={saving}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

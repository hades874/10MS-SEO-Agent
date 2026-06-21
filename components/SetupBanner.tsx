import type { SystemStatus } from "@/lib/status";

export function SetupBanner({ status }: { status: SystemStatus }) {
  if (status.db && status.ai) return null;
  return (
    <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
      <p className="font-semibold">Setup needed</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {!status.db && (
          <li>
            <span className="font-medium">Database:</span> set{" "}
            <code className="rounded bg-yellow-100 px-1">DATABASE_URL</code> in{" "}
            <code className="rounded bg-yellow-100 px-1">.env.local</code> (Neon via
            Vercel Marketplace), then run{" "}
            <code className="rounded bg-yellow-100 px-1">npm run db:push</code>.
          </li>
        )}
        {!status.ai && (
          <li>
            <span className="font-medium">AI key:</span> set{" "}
            <code className="rounded bg-yellow-100 px-1">GOOGLE_GENERATIVE_AI_API_KEY</code>{" "}
            (free Gemini key at aistudio.google.com/apikey). Powers generation,
            keyword back-fill, and semantic recall.
          </li>
        )}
      </ul>
    </div>
  );
}

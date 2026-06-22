import { systemConfig, type ProviderStatus } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const cfg = systemConfig();

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Read-only view of what&apos;s configured. Change these by editing{" "}
          <code className="rounded bg-gray-100 px-1">.env.local</code> and restarting.
        </p>
      </div>

      <Card title="Database">
        <Row status={cfg.db} />
      </Card>

      <Card title="AI provider">
        <p className="mb-2 text-xs text-gray-500">
          Active provider: <span className="font-medium">{cfg.ai.provider}</span>
        </p>
        <Row status={cfg.ai.chat} />
        <Row status={cfg.ai.embeddings} />
      </Card>

      <Card title="Search (SERP) provider">
        <Row status={cfg.serp} />
      </Card>

      <Card title="Keyword research">
        <Row status={cfg.keywords} />
      </Card>

      <Card title="AI-search visibility engines">
        {cfg.aiVisibility.map((s) => (
          <Row key={s.name} status={s} />
        ))}
      </Card>

      <Card title="Rank tracking">
        {cfg.rank.map((s) => (
          <Row key={s.name} status={s} />
        ))}
      </Card>

      <Card title="Brand">
        <p className="text-sm text-gray-600">
          {cfg.brand.name} · {cfg.brand.siteOrigin}
        </p>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">{title}</h3>
      {children}
    </div>
  );
}

function Row({ status }: { status: ProviderStatus }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 py-2 text-sm last:border-0">
      <Pill configured={status.configured} />
      <span className="font-medium text-gray-800">{status.name}</span>
      {status.detail && <span className="text-xs text-gray-500">· {status.detail}</span>}
      {status.note && (
        <span className="ml-auto rounded bg-yellow-50 px-2 py-0.5 text-xs text-yellow-800">
          {status.note}
        </span>
      )}
    </div>
  );
}

function Pill({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      configured
    </span>
  ) : (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      not configured
    </span>
  );
}

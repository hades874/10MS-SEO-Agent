import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseDetail, getTracking, getCourseVersions } from "@/lib/queries";
import { ScoreBadge } from "@/components/ScoreBadge";
import { CompetitorPanel } from "@/components/CompetitorPanel";
import { TrackingPanel } from "@/components/TrackingPanel";
import { SeoEditor } from "@/components/SeoEditor";
import { VersionHistory } from "@/components/VersionHistory";
import { ExportPanel } from "@/components/ExportPanel";
import type { GeneratedCopy } from "@/lib/generate/types";

export const dynamic = "force-dynamic";

export default async function CourseDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isFinite(courseId)) notFound();

  const data = await getCourseDetail(courseId);
  if (!data) notFound();
  const { course, record } = data;
  const [tracking, versions] = await Promise.all([
    getTracking(courseId),
    getCourseVersions(courseId),
  ]);

  const editorInitial: GeneratedCopy | null = record
    ? {
        metaTitleBn: record.metaTitleBn ?? "",
        metaTitleEn: record.metaTitleEn ?? "",
        metaDescBn: record.metaDescBn ?? "",
        metaDescEn: record.metaDescEn ?? "",
        keywords: record.keywords ?? [],
        ogTitleBn: record.ogTitleBn ?? "",
        ogTitleEn: record.ogTitleEn ?? "",
        ogDescriptionBn: record.ogDescriptionBn ?? "",
        ogDescriptionEn: record.ogDescriptionEn ?? "",
        ogImageAlt: record.ogImageAlt ?? "",
        imageNameThumb: record.imageNameThumb ?? "",
        imageNameSqr: record.imageNameSqr ?? "",
        imageAltThumb: record.imageAltThumb ?? "",
        imageAltSqr: record.imageAltSqr ?? "",
      }
    : null;

  return (
    <div className="max-w-3xl">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← Dashboard
      </Link>
      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{course.name}</h1>
          <p className="text-sm text-gray-500">
            {[course.level, course.subject, course.batchType].filter(Boolean).join(" · ")}
            {course.slug && <> · /{course.slug}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          Score <ScoreBadge score={record?.validationScore ?? null} />
        </div>
      </div>

      {course.completeness === "partial" && (
        <div className="mt-4 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800">
          This course was imported with incomplete data — some fields are missing.
        </div>
      )}

      {!record ? (
        <p className="mt-6 text-gray-500">No SEO record for this course.</p>
      ) : (
        <div className="mt-6 space-y-4">
          <Section title="Meta title">
            <Bilingual bn={record.metaTitleBn} en={record.metaTitleEn} />
          </Section>
          <Section title="Meta description">
            <Bilingual bn={record.metaDescBn} en={record.metaDescEn} />
          </Section>
          <Section title="Keywords">
            <div className="flex flex-wrap gap-2">
              {(record.keywords ?? []).length ? (
                record.keywords!.map((k) => (
                  <span key={k} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                    {k}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">none</span>
              )}
              {record.aiGenerated && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                  AI-generated · review
                </span>
              )}
            </div>
          </Section>
          <Section title="Open Graph">
            <div className="mb-3">
              <p className="mb-1 text-xs text-gray-400">og:title</p>
              <div className="text-sm">{record.ogTitleBn ?? <span className="text-gray-400">—</span>}</div>
            </div>
            <div className="mb-3">
              <p className="mb-1 text-xs text-gray-400">og:description</p>
              <div className="text-sm">{record.ogDescriptionBn ?? <span className="text-gray-400">—</span>}</div>
            </div>
            <Field label="og:image" value={record.ogImage} />
          </Section>
          <Section title="Images">
            <Field label="thumbnail name" value={record.imageNameThumb} />
            <Field label="square name" value={record.imageNameSqr} />
            <Field label="thumbnail alt" value={record.imageAltThumb} />
            <Field label="square alt" value={record.imageAltSqr} />
          </Section>
          <Section title="Product JSON-LD">
            <pre className="overflow-x-auto rounded bg-gray-50 p-3 text-xs">
              {JSON.stringify(record.schemaJsonld, null, 2)}
            </pre>
          </Section>

          <TrackingPanel
            courseId={course.id}
            hasKeywords={(record.keywords ?? []).length > 0}
            initialRanks={tracking.ranks.map((r) => ({
              query: r.query,
              position: r.position,
              checkedAt: r.checkedAt,
            }))}
            initialAivis={tracking.aivis.map((a) => ({
              engine: a.engine,
              mentioned: a.mentioned,
              prominence: a.prominence,
              mentionRate: a.mentionRate,
              sampledAt: a.sampledAt,
            }))}
          />

          <CompetitorPanel
            defaultKeyword={
              (record.keywords ?? [])[0] ??
              [course.level, course.subject, "course"].filter(Boolean).join(" ")
            }
            targetKeywords={record.keywords ?? []}
            ourName={course.name}
            ourScore={record.validationScore ?? null}
          />

          {editorInitial && (
            <SeoEditor courseId={course.id} initial={editorInitial} />
          )}

          <VersionHistory versions={versions} />

          <ExportPanel
            data={{
              name: course.name,
              productUrl: course.productUrl,
              metaTitleBn: record.metaTitleBn,
              metaTitleEn: record.metaTitleEn,
              metaDescBn: record.metaDescBn,
              metaDescEn: record.metaDescEn,
              keywords: record.keywords,
              ogTitleBn: record.ogTitleBn,
              ogTitleEn: record.ogTitleEn,
              ogDescriptionBn: record.ogDescriptionBn,
              ogDescriptionEn: record.ogDescriptionEn,
              ogImage: record.ogImage,
              ogImageAlt: record.ogImageAlt,
              schemaJsonld: record.schemaJsonld,
            }}
          />
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">{title}</h3>
      {children}
    </div>
  );
}

function Bilingual({ bn, en }: { bn: string | null; en: string | null }) {
  return (
    <div className="space-y-2 text-sm">
      <div>
        <span className="mr-2 rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">BN</span>
        {bn ?? <span className="text-gray-400">—</span>}
      </div>
      <div>
        <span className="mr-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">EN</span>
        {en ?? <span className="text-gray-400">—</span>}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="mb-1 text-sm">
      <span className="text-gray-400">{label}:</span>{" "}
      {value ? <span className="break-all">{value}</span> : <span className="text-gray-300">—</span>}
    </div>
  );
}

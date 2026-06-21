import Link from "next/link";
import { systemStatus } from "@/lib/status";
import { listCourses, type CourseListItem } from "@/lib/queries";
import { SetupBanner } from "@/components/SetupBanner";
import { ScoreBadge } from "@/components/ScoreBadge";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const status = systemStatus();
  let coursesList: CourseListItem[] = [];
  let loadError: string | null = null;
  try {
    coursesList = await listCourses();
  } catch (e) {
    loadError = (e as Error).message;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Course SEO Dashboard</h1>
          <p className="text-sm text-gray-500">
            {coursesList.length} course{coursesList.length === 1 ? "" : "s"} in memory
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/import"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Import CSV
          </Link>
          <Link
            href="/courses/new"
            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            + New course
          </Link>
        </div>
      </div>

      <SetupBanner status={status} />

      {loadError && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Could not load courses: {loadError}
        </div>
      )}

      {coursesList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500">
          No courses yet. <Link href="/import" className="text-brand underline">Import the seed CSV</Link>{" "}
          or <Link href="/courses/new" className="text-brand underline">add a course</Link>.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Course</th>
                <th className="px-4 py-2">Level</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {coursesList.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/courses/${c.id}`} className="font-medium text-brand-dark hover:underline">
                      {c.name}
                    </Link>
                    {c.completeness === "partial" && (
                      <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700">
                        partial
                      </span>
                    )}
                    {c.slug && <div className="text-xs text-gray-400">/{c.slug}</div>}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{c.level ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-600">{c.subject ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-600">{c.batchType ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-600">{c.status}</td>
                  <td className="px-4 py-2"><ScoreBadge score={c.score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { systemStatus } from "@/lib/status";
import { listCourses, type CourseListItem } from "@/lib/queries";
import { SetupBanner } from "@/components/SetupBanner";
import { CourseList } from "@/components/CourseList";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const status = await systemStatus();
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
        <CourseList courses={coursesList} />
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Error boundary for the course detail route (DB/record load or panel failure). */
export default function CourseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Course detail error:", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-xl font-semibold text-gray-900">
        Couldn’t load this course
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        There was a problem loading the course detail.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button
          onClick={reset}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCourse } from "@/lib/actions";

export function DeleteCourseButton({ courseId }: { courseId: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    const res = await deleteCourse(courseId);
    setPending(false);
    if (res.ok) {
      router.push("/");
    } else {
      setConfirming(false);
      setError(res.error ?? "Failed to delete course.");
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Delete this course?</span>
        <button
          onClick={handleDelete}
          disabled={pending}
          className="rounded px-3 py-1.5 text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null); }}
          disabled={pending}
          className="rounded px-3 py-1.5 text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setConfirming(true)}
        className="rounded px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
      >
        Delete course
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

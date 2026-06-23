"use client";

import { useEffect } from "react";

/** Error boundary for the keyword research / competitor analysis route. */
export default function KeywordsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Keywords page error:", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-600">
        The keyword tools hit an unexpected error.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}

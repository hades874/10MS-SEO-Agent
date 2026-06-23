"use client";

import { useEffect } from "react";

/**
 * Root error boundary. Catches render/runtime errors in any segment that lacks a
 * closer boundary, so users get a recoverable message instead of a blank screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled UI error:", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-600">
        An unexpected error occurred while rendering this page.
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-gray-400">Reference: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-6 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}

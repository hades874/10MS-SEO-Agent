/**
 * Inline error/warning note with a clear sign. Used across panels so a failed action
 * (especially an API quota / rate-limit hit) shows an obvious warning instead of a
 * cryptic message or a spinner that never resolves.
 */
export function ErrorNote({
  children,
  tone = "error",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "error" | "warning";
  className?: string;
}) {
  const styles =
    tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : "border-red-300 bg-red-50 text-red-700";
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-md border p-3 text-sm ${styles} ${className}`}
    >
      <span aria-hidden className="mt-px shrink-0 font-semibold">
        ⚠
      </span>
      <span>{children}</span>
    </div>
  );
}

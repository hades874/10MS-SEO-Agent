/** Root loading fallback shown while a server segment streams in. */
export default function Loading() {
  return (
    <div className="py-16 text-center text-sm text-gray-500" aria-busy="true">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand align-middle" />
      <span className="ml-3 align-middle">Loading…</span>
    </div>
  );
}

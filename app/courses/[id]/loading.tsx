/** Loading fallback for the course detail route (it fetches the record + panels). */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <div className="h-7 w-1/2 rounded bg-gray-200" />
      <div className="h-4 w-1/3 rounded bg-gray-200" />
      <div className="h-40 w-full rounded bg-gray-100" />
      <div className="h-40 w-full rounded bg-gray-100" />
    </div>
  );
}

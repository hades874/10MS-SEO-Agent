export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
        —
      </span>
    );
  }
  const color =
    score >= 85
      ? "bg-green-100 text-green-800"
      : score >= 65
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {score}
    </span>
  );
}

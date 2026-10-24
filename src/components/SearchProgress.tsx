import { Progress } from "@/components/ui/progress";
import type { SourceRun } from "@/types/medicine";
import { STATE_LABEL } from "./sourceLabels";

interface SearchProgressProps {
  isSearching: boolean;
  sources: SourceRun[];
}

export const SearchProgressComponent = ({ isSearching, sources }: SearchProgressProps) => {
  if (!isSearching || sources.length === 0) return null;
  const done = sources.filter((s) => s.state !== "pending").length;
  const pct = Math.round((done / sources.length) * 100);

  return (
    <div className="max-w-4xl mx-auto mb-6 p-4 bg-white rounded-lg border border-gray-200" aria-live="polite">
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="font-medium text-gray-800">
          Searching sources ({done}/{sources.length})
        </span>
        <span className="text-gray-600">{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" aria-label="Search progress" />
      <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-700">
        {sources.map((s) => (
          <li key={s.id} className="flex justify-between gap-2">
            <span className="truncate">{s.name}</span>
            <span className={s.state === "error" || s.state === "unavailable" ? "text-amber-800" : "text-gray-600"}>
              {s.state === "ok" ? `${s.count} found` : STATE_LABEL[s.state]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

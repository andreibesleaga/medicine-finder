import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import type { SourceRun } from "@/types/medicine";
import { STATE_LABEL } from "./sourceLabels";

interface SearchProgressProps {
  isSearching: boolean;
  sources: SourceRun[];
}

// the server sleeps when idle (Railway); its first answer after a pause takes 10-20 s
export const WAKE_HINT_AFTER_MS = 4000;

export const SearchProgressComponent = ({ isSearching, sources }: SearchProgressProps) => {
  const serverPending = sources.some((s) => s.id === "server" && s.state === "pending");
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!isSearching || !serverPending) return;
    const timer = setTimeout(() => setSlow(true), WAKE_HINT_AFTER_MS);
    return () => clearTimeout(timer);
  }, [isSearching, serverPending]);

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
      {slow && serverPending && (
        <p className="mt-2 text-sm text-gray-700">Waking the search server; the first search after a pause takes 10 to 20 seconds…</p>
      )}
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

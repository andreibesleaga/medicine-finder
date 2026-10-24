import type { SourceKind, SourceState } from "@/types/medicine";

export const KIND_LABEL: Record<SourceKind, string> = {
  official: "Official database",
  reference: "Open reference",
  curated: "Curated sample",
  ai: "AI suggestion",
};

export const KIND_CLASS: Record<SourceKind, string> = {
  official: "bg-green-100 text-green-900 border-green-300",
  reference: "bg-blue-100 text-blue-900 border-blue-300",
  curated: "bg-amber-100 text-amber-900 border-amber-300",
  ai: "bg-purple-100 text-purple-900 border-purple-300",
};

export const STATE_LABEL: Record<SourceState | string, string> = {
  pending: "searching",
  ok: "done",
  error: "failed",
  disabled: "off",
  skipped: "skipped",
  unavailable: "not available",
  ready: "ready",
  loading: "loading",
  live: "live",
};

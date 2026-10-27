import type { SourceKind } from "@/types/medicine";

// labels of kinds and states are in the dictionaries (src/i18n/locales, "kind.*" and "state.*")
export const KIND_CLASS: Record<SourceKind, string> = {
  official: "bg-green-100 text-green-900 border-green-300",
  reference: "bg-blue-100 text-blue-900 border-blue-300",
  curated: "bg-amber-100 text-amber-900 border-amber-300",
  ai: "bg-purple-100 text-purple-900 border-purple-300",
};

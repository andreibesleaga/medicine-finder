/** Where a result comes from. */
export type SourceKind =
  /** a regulator's or official public database */
  | "official"
  /** an open reference database (RxNorm, openFDA labels, Wikidata, PubChem) */
  | "reference"
  /** a static list typed into this app, not from a regulator */
  | "curated"
  /** a language model's suggestion, not verified */
  | "ai";

export interface MedicineResult {
  id: string;
  brandName: string;
  activeIngredient: string;
  country: string;
  manufacturer?: string;
  strength?: string;
  dosageForm?: string;
  status?: string;
  /** the record at the source, when the source has one */
  url?: string;
  sourceId: string;
  sourceName: string;
  kind: SourceKind;
  /** other sources that list the same brand for the same country */
  alsoIn?: string[];
}

export type SourceState = "pending" | "ok" | "error" | "disabled" | "skipped" | "unavailable";

export interface SourceRun {
  id: string;
  name: string;
  kind: SourceKind;
  state: SourceState;
  /** results the source found (results shown may be capped) */
  count: number;
  detail?: string;
}

export interface TrialsInfo {
  count: number;
  url: string;
}

export interface SearchOutcome {
  term: string;
  country?: string;
  results: MedicineResult[];
  sources: SourceRun[];
  trials?: TrialsInfo;
}

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
  /** the source's site, terms of use and condition of reuse (server sources; copied into downloads) */
  homepage?: string;
  terms?: string;
  reuse?: string;
}

export interface TrialsInfo {
  count: number;
  url: string;
}

/** Set when the search term is a brand name: the ingredient it stands for, searched instead. */
export interface BrandMatch {
  /** the brand as a register writes it */
  name: string;
  ingredient: string;
  /** what every source was asked for */
  searchFor: string;
  /** other ingredients the same brand name stands for in other countries */
  others: { ingredient: string; countries: string[] }[];
}

export interface SearchOutcome {
  term: string;
  brand?: BrandMatch;
  /** the country or region chosen ("region:Asia"), if any */
  country?: string;
  results: MedicineResult[];
  sources: SourceRun[];
  trials?: TrialsInfo;
  /** set when results come from a wider area than the one chosen */
  note?: string;
  /** true while AI suggestions are still on their way */
  aiPending?: boolean;
  /** when the outcome was read from this browser's cache: the time it was saved */
  savedAt?: number;
}

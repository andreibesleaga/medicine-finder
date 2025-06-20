
export interface RxNormConcept {
  rxcui: string;
  name: string;
  synonym?: string;
  tty?: string;
  language?: string;
  suppress?: string;
  umlscui?: string;
}

export interface RxNormGroup {
  name?: string;
  conceptGroup?: {
    tty?: string;
    conceptProperties?: RxNormConcept[];
  }[];
}

export interface RxNormResponse {
  drugGroup?: RxNormGroup;
  approximateGroup?: RxNormGroup;
}

export interface MedicineResult {
  id: string;
  brandName: string;
  activeIngredient: string;
  country: string;
  manufacturer?: string;
  rxNormData?: RxNormConcept;
  dosageForm?: string;
  strength?: string;
  source: 'rxnorm' | 'ai' | 'both';
  relevanceScore?: number;
}

export interface SearchResponse {
  results: MedicineResult[];
  totalFound: number;
  searchTerm: string;
}

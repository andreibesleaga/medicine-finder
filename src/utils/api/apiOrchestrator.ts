
import { MedicineResult } from "@/types/medicine";
import { searchRxNorm } from "./rxnormApi";
import { searchOpenFDA } from "./fdaApi";
import { searchEMA } from "./emaApi";
import { searchOpenAI, searchPerplexity, searchDeepSeek, queryDrugBankAPI, queryChemSpiderAPI } from "./aiServices";
import { searchWHO, searchClinicalTrials, queryPubChemAPI, queryWikidataAPI } from "./publicApis";
import { performComprehensiveGlobalSearch } from "./comprehensiveSearch";
import { getCachedResult, setCachedResult } from "./searchCache";
import { searchProgressTracker } from "./searchProgressTracker";

export const queryAIEngines = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Querying AI engines for:", term, "in country:", country || "worldwide");

  // Check cache first
  const cacheKey = `ai-${term}-${country || 'all'}`;
  const cached = getCachedResult(cacheKey);
  if (cached) {
    console.log("Returning cached AI results");
    return cached;
  }

  const results: MedicineResult[] = [];

  try {
    // Standard APIs with better error handling
    const standardApiQueries = [
      { name: "OpenFDA", fn: () => searchOpenFDA(term).catch(() => []) },
      { name: "EMA", fn: () => searchEMA(term).catch(() => []) },
      { name: "WHO", fn: () => searchWHO(term).catch(() => []) },
      { name: "ClinicalTrials", fn: () => searchClinicalTrials(term).catch(() => []) },
      { name: "PubChem", fn: () => queryPubChemAPI(term, country).catch(() => []) },
      { name: "Wikidata", fn: () => queryWikidataAPI(term, country).catch(() => []) }
    ];

    // AI Services with fallbacks
    const aiServiceQueries = [
      { name: "OpenAI", fn: () => searchOpenAI(term, country).catch(() => []) },
      { name: "Perplexity", fn: () => searchPerplexity(term, country).catch(() => []) },
      { name: "DeepSeek", fn: () => searchDeepSeek(term, country).catch(() => []) },
      { name: "DrugBank", fn: () => queryDrugBankAPI(term, country).catch(() => []) },
      { name: "ChemSpider", fn: () => queryChemSpiderAPI(term, country).catch(() => []) }
    ];

    const allQueries = [...standardApiQueries, ...aiServiceQueries];
    searchProgressTracker.setTotal(allQueries.length);

    // Execute queries with proper progress tracking
    const apiPromises = allQueries.map(async (api) => {
      try {
        searchProgressTracker.updateProgress(api.name);
        const result = await api.fn();
        searchProgressTracker.updateProgress(api.name, true);
        return { name: api.name, data: result };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        searchProgressTracker.updateProgress(api.name, true, errorMsg);
        console.warn(`${api.name} API failed:`, error);
        return { name: api.name, data: [] };
      }
    });

    const apiResults = await Promise.allSettled(apiPromises);

    apiResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(...result.value.data);
        console.log(`${result.value.name} returned ${result.value.data.length} results`);
      }
    });

    // Enhanced deduplication
    const uniqueResults = results.filter((result, index, array) =>
      array.findIndex(r =>
        r.brandName.toLowerCase().trim() === result.brandName.toLowerCase().trim() &&
        r.country === result.country &&
        r.activeIngredient.toLowerCase() === result.activeIngredient.toLowerCase()
      ) === index
    );

    console.log("Total unique AI results:", uniqueResults.length);
    
    // Cache the results with 1 hour expiry
    setCachedResult(cacheKey, uniqueResults);
    
    return uniqueResults;

  } catch (error) {
    console.error("AI engines query error:", error);
    return [];
  }
};

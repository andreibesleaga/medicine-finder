
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
    // Standard APIs
    const standardApiQueries = [
      { name: "OpenFDA", fn: () => searchOpenFDA(term) },
      { name: "EMA", fn: () => searchEMA(term) },
      { name: "WHO", fn: () => searchWHO(term) },
      { name: "ClinicalTrials", fn: () => searchClinicalTrials(term) },
      { name: "PubChem", fn: () => queryPubChemAPI(term, country) },
      { name: "Wikidata", fn: () => queryWikidataAPI(term, country) }
    ];

    // AI Services
    const aiServiceQueries = [
      { name: "OpenAI", fn: () => searchOpenAI(term, country) },
      { name: "Perplexity", fn: () => searchPerplexity(term, country) },
      { name: "DeepSeek", fn: () => searchDeepSeek(term, country) },
      { name: "DrugBank", fn: () => queryDrugBankAPI(term, country) },
      { name: "ChemSpider", fn: () => queryChemSpiderAPI(term, country) }
    ];

    // Comprehensive Global Search
    const comprehensiveQuery = {
      name: "Comprehensive Global",
      fn: () => performComprehensiveGlobalSearch(term, country)
    };

    const allQueries = [...standardApiQueries, ...aiServiceQueries, comprehensiveQuery];
    searchProgressTracker.setTotal(allQueries.length);

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

    const uniqueResults = results.filter((result, index, array) =>
      array.findIndex(r =>
        r.brandName.toLowerCase() === result.brandName.toLowerCase() &&
        r.country === result.country
      ) === index
    );

    console.log("Total unique AI results:", uniqueResults.length);
    
    // Cache the results
    setCachedResult(cacheKey, uniqueResults);
    
    return uniqueResults;

  } catch (error) {
    console.error("AI engines query error:", error);
    return [];
  }
};

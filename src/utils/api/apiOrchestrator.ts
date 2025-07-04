
import { MedicineResult } from "@/types/medicine";
import { searchRxNorm } from "./rxnormApi";
import { searchOpenFDA } from "./fdaApi";
import { searchEMA } from "./emaApi";
import { searchOpenAI, searchPerplexity, searchDeepSeek, queryDrugBankAPI, queryChemSpiderAPI } from "./aiServices";
import { searchWHO, searchClinicalTrials, queryPubChemAPI, queryWikidataAPI } from "./publicApis";
import { performComprehensiveGlobalSearch } from "./comprehensiveSearch";
import { getCachedResult, setCachedResult } from "./searchCache";
import { searchProgressTracker } from "./searchProgressTracker";
import { SecureApiWrapper } from "./secureApiWrapper";

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
      { name: "OpenFDA", fn: () => searchOpenFDA(term), timeout: 5000 },
      { name: "EMA", fn: () => searchEMA(term), timeout: 5000 },
      { name: "WHO", fn: () => searchWHO(term), timeout: 8000 },
      { name: "ClinicalTrials", fn: () => searchClinicalTrials(term), timeout: 8000 },
      { name: "PubChem", fn: () => queryPubChemAPI(term, country), timeout: 6000 },
      { name: "Wikidata", fn: () => queryWikidataAPI(term, country), timeout: 6000 }
    ];

    // Use secure API wrapper if available, otherwise fallback to direct calls
    const useSecureApis = SecureApiWrapper.isSecureApiAvailable();
    console.log("Using secure APIs:", useSecureApis);

    const aiServiceQueries = useSecureApis ? [
      { name: "OpenAI (Secure)", fn: () => SecureApiWrapper.searchOpenAISecure(term, country), timeout: 10000 },
      { name: "Perplexity (Secure)", fn: () => SecureApiWrapper.searchPerplexitySecure(term, country), timeout: 10000 },
      { name: "DeepSeek (Secure)", fn: () => SecureApiWrapper.searchDeepSeekSecure(term, country), timeout: 10000 },
      { name: "DrugBank (Secure)", fn: () => SecureApiWrapper.queryDrugBankSecure(term, country), timeout: 8000 },
      { name: "ChemSpider (Secure)", fn: () => SecureApiWrapper.queryChemSpiderSecure(term, country), timeout: 8000 }
    ] : [
      { name: "OpenAI", fn: () => searchOpenAI(term, country), timeout: 10000 },
      { name: "Perplexity", fn: () => searchPerplexity(term, country), timeout: 10000 },
      { name: "DeepSeek", fn: () => searchDeepSeek(term, country), timeout: 10000 },
      { name: "DrugBank", fn: () => queryDrugBankAPI(term), timeout: 8000 },
      { name: "ChemSpider", fn: () => queryChemSpiderAPI(term), timeout: 8000 }
    ];

    const allQueries = [...standardApiQueries, ...aiServiceQueries];
    searchProgressTracker.setTotal(allQueries.length);

    // Execute queries with timeout and proper error handling
    const executeWithTimeout = async (query: typeof allQueries[0]) => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${query.timeout}ms`)), query.timeout)
      );

      try {
        searchProgressTracker.updateProgress(query.name);
        const result = await Promise.race([query.fn(), timeoutPromise]);
        searchProgressTracker.updateProgress(query.name, true);
        return { name: query.name, data: result as MedicineResult[], success: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        searchProgressTracker.updateProgress(query.name, true, errorMsg);
        console.warn(`${query.name} API failed:`, error);
        return { name: query.name, data: [], success: false, error: errorMsg };
      }
    };

    const apiResults = await Promise.allSettled(
      allQueries.map(query => executeWithTimeout(query))
    );

    let successCount = 0;
    let errorCount = 0;

    apiResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          results.push(...result.value.data);
          successCount++;
          console.log(`${result.value.name} returned ${result.value.data.length} results`);
        } else {
          errorCount++;
        }
      } else {
        errorCount++;
      }
    });

    console.log(`API Summary: ${successCount} successful, ${errorCount} failed out of ${allQueries.length} total`);

    // Enhanced deduplication with better unique key generation
    const uniqueResults = results.filter((result, index, array) => {
      const key = `${result.brandName.toLowerCase().trim()}-${result.country.toLowerCase()}-${result.activeIngredient.toLowerCase()}`;
      return array.findIndex(r => 
        `${r.brandName.toLowerCase().trim()}-${r.country.toLowerCase()}-${r.activeIngredient.toLowerCase()}` === key
      ) === index;
    });

    console.log("Total unique AI results:", uniqueResults.length);
    
    // Cache the results with 1 hour expiry
    setCachedResult(cacheKey, uniqueResults);
    
    return uniqueResults;

  } catch (error) {
    console.error("AI engines query error:", error);
    return [];
  }
};

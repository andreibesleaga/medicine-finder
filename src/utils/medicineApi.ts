
import { MedicineResult } from "@/types/medicine";
import { searchRxNorm } from "./api/rxnormApi";
import { queryAIEngines } from "./api/apiOrchestrator";
import { performComprehensiveGlobalSearch } from "./api/comprehensiveSearch";
import { enhanceMedicineData } from "./api/medicineDataEnhancer";
import { localMedicineDb } from "./database/localMedicineDb";

export const searchMedicines = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Starting comprehensive global search for:", term, "in country:", country || "worldwide");

  try {
    // First search local database
    console.log("Searching local database...");
    const localResults = await localMedicineDb.searchLocal(term, country);
    console.log("Local database results:", localResults.length);

    // If we have sufficient local results, prioritize them but still get some remote results
    const shouldSearchRemote = localResults.length < 20; // Threshold for remote search
    
    let remoteResults: MedicineResult[] = [];
    
    if (shouldSearchRemote) {
      // Parallel search execution for remote sources
      const [rxNormResults, aiResults, comprehensiveResults] = await Promise.all([
        searchRxNorm(term),
        queryAIEngines(term, country),
        performComprehensiveGlobalSearch(term, country)
      ]);

      console.log("Remote search results breakdown:");
      console.log("RxNorm results:", rxNormResults.length);
      console.log("AI results:", aiResults.length);
      console.log("Comprehensive results:", comprehensiveResults.length);

      // Combine remote results
      remoteResults = [...rxNormResults, ...aiResults, ...comprehensiveResults];
    }

    // Combine local and remote results
    let allResults = [...localResults, ...remoteResults];

    // Filter by country if specified
    if (country && country !== 'all') {
      allResults = allResults.filter(result =>
        result.country.toLowerCase().includes(country.toLowerCase()) ||
        result.country === 'Global' ||
        result.country === 'European Union' ||
        result.country.includes('WHO') ||
        result.country.includes('Region')
      );
    }

    // Remove duplicates with enhanced deduplication
    const uniqueResults = allResults.filter((result, index, array) => {
      const firstIndex = array.findIndex(r =>
        r.brandName.toLowerCase().trim() === result.brandName.toLowerCase().trim() &&
        r.country === result.country &&
        r.activeIngredient.toLowerCase() === result.activeIngredient.toLowerCase()
      );
      return firstIndex === index;
    });

    // Sort results with enhanced prioritization (local results first)
    const sortedResults = uniqueResults.sort((a, b) => {
      // Prioritize local database results
      const aIsLocal = localResults.some(lr => lr.id === a.id);
      const bIsLocal = localResults.some(lr => lr.id === b.id);
      
      if (aIsLocal && !bIsLocal) return -1;
      if (bIsLocal && !aIsLocal) return 1;

      // Exact brand name matches
      const aExactMatch = a.brandName.toLowerCase() === term.toLowerCase() ? 2 : 0;
      const bExactMatch = b.brandName.toLowerCase() === term.toLowerCase() ? 2 : 0;
      
      // Partial matches
      const aPartialMatch = a.brandName.toLowerCase().includes(term.toLowerCase()) ? 1 : 0;
      const bPartialMatch = b.brandName.toLowerCase().includes(term.toLowerCase()) ? 1 : 0;
      
      const aScore = aExactMatch + aPartialMatch;
      const bScore = bExactMatch + bPartialMatch;

      if (aScore !== bScore) {
        return bScore - aScore;
      }

      // Prioritize by source reliability
      const sourceOrder = { 'rxnorm': 3, 'ai': 2, 'both': 1 };
      const aSourceScore = sourceOrder[a.source] || 0;
      const bSourceScore = sourceOrder[b.source] || 0;
      
      if (aSourceScore !== bSourceScore) {
        return bSourceScore - aSourceScore;
      }

      // Country prioritization
      if (country && country !== 'all') {
        if (a.country.toLowerCase().includes(country.toLowerCase()) && 
            !b.country.toLowerCase().includes(country.toLowerCase())) return -1;
        if (b.country.toLowerCase().includes(country.toLowerCase()) && 
            !a.country.toLowerCase().includes(country.toLowerCase())) return 1;
      }

      // US results priority for global searches
      if (a.country === "United States" && b.country !== "United States") return -1;
      if (b.country === "United States" && a.country !== "United States") return 1;

      return a.country.localeCompare(b.country);
    });

    console.log("Total unique sorted results:", sortedResults.length);
    console.log("Local vs Remote breakdown:", {
      local: localResults.length,
      remote: remoteResults.length,
      total: sortedResults.length
    });

    return sortedResults;

  } catch (error) {
    console.error("Search medicines error:", error);
    throw new Error("Failed to search medicines");
  }
};

// Re-export individual functions for backward compatibility
export { searchRxNorm } from "./api/rxnormApi";
export { searchOpenFDA } from "./api/fdaApi";
export { searchEMA } from "./api/emaApi";
export { searchOpenAI, searchPerplexity, searchDeepSeek } from "./api/aiServices";
export { searchWHO, searchClinicalTrials } from "./api/publicApis";
export { performComprehensiveGlobalSearch } from "./api/comprehensiveSearch";
export { enhanceMedicineData, findAlternativeNames } from "./api/medicineDataEnhancer";

// Export database functions
export { localMedicineDb } from "./database/localMedicineDb";
export { officialDatabaseSources, downloadAndImportDatabase, importAllDatabases } from "./database/databaseImporter";

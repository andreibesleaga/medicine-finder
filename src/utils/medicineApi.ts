
import { MedicineResult } from "@/types/medicine";
import { searchRxNorm } from "./api/rxnormApi";
import { queryAIEngines } from "./api/apiOrchestrator";
import { performComprehensiveGlobalSearch } from "./api/comprehensiveSearch";
import { enhanceMedicineData } from "./api/medicineDataEnhancer";

export const searchMedicines = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Starting comprehensive global search for:", term, "in country:", country || "worldwide");

  try {
    // Parallel search execution
    const [rxNormResults, aiResults, comprehensiveResults] = await Promise.all([
      searchRxNorm(term),
      queryAIEngines(term, country),
      performComprehensiveGlobalSearch(term, country)
    ]);

    console.log("Search results breakdown:");
    console.log("RxNorm results:", rxNormResults.length);
    console.log("AI results:", aiResults.length);
    console.log("Comprehensive results:", comprehensiveResults.length);

    // Combine all results
    let allResults = [...rxNormResults, ...aiResults, ...comprehensiveResults];

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

    // Sort results with enhanced prioritization
    const sortedResults = uniqueResults.sort((a, b) => {
      // Exact brand name matches first
      const aExactMatch = a.brandName.toLowerCase() === term.toLowerCase() ? 2 : 0;
      const bExactMatch = b.brandName.toLowerCase() === term.toLowerCase() ? 2 : 0;
      
      // Partial matches second
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

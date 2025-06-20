
import { MedicineResult } from "@/types/medicine";
import { searchRxNorm } from "./api/rxnormApi";
import { queryAIEngines } from "./api/apiOrchestrator";

export const searchMedicines = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Starting comprehensive global search for:", term, "in country:", country || "worldwide");

  try {
    const rxNormResults = await searchRxNorm(term);
    console.log("RxNorm results count:", rxNormResults.length);

    const aiResults = await queryAIEngines(term, country);
    console.log("AI results count:", aiResults.length);

    let allResults = [...rxNormResults, ...aiResults];

    if (country && country !== 'all') {
      allResults = allResults.filter(result =>
        result.country.toLowerCase().includes(country.toLowerCase()) ||
        result.country === 'Global' ||
        result.country === 'European Union'
      );
    }

    const uniqueResults = allResults.filter((result, index, array) =>
      array.findIndex(r =>
        r.brandName.toLowerCase() === result.brandName.toLowerCase() &&
        r.country === result.country
      ) === index
    );

    const sortedResults = uniqueResults.sort((a, b) => {
      const aExactMatch = a.brandName.toLowerCase() === term.toLowerCase() ? 1 : 0;
      const bExactMatch = b.brandName.toLowerCase() === term.toLowerCase() ? 1 : 0;

      if (aExactMatch !== bExactMatch) {
        return bExactMatch - aExactMatch;
      }

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
export { searchOpenAI, searchPerplexity } from "./api/aiServices";
export { searchWHO, searchClinicalTrials } from "./api/publicApis";

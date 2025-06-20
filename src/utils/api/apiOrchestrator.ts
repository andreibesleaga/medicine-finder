
import { MedicineResult } from "@/types/medicine";
import { searchRxNorm } from "./rxnormApi";
import { searchOpenFDA } from "./fdaApi";
import { searchEMA } from "./emaApi";
import { searchOpenAI, searchPerplexity, searchDeepSeek, queryDrugBankAPI, queryChemSpiderAPI } from "./aiServices";
import { searchWHO, searchClinicalTrials, queryPubChemAPI, queryWikidataAPI } from "./publicApis";

export const queryAIEngines = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Querying AI engines for:", term, "in country:", country || "worldwide");

  const results: MedicineResult[] = [];

  try {
    const apiQueries = [
      searchOpenFDA(term),
      searchEMA(term),
      searchWHO(term),
      searchClinicalTrials(term),
      searchOpenAI(term, country),
      searchPerplexity(term, country),
      searchDeepSeek(term, country),
      queryDrugBankAPI(term, country),
      queryPubChemAPI(term, country),
      queryChemSpiderAPI(term, country),
      queryWikidataAPI(term, country)
    ];

    const apiResults = await Promise.allSettled(apiQueries);

    apiResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
        console.log(`API ${index + 1} returned ${result.value.length} results`);
      } else {
        console.warn(`API ${index + 1} failed:`, result.reason);
      }
    });

    const uniqueResults = results.filter((result, index, array) =>
      array.findIndex(r =>
        r.brandName.toLowerCase() === result.brandName.toLowerCase() &&
        r.country === result.country
      ) === index
    );

    console.log("Total unique API results:", uniqueResults.length);
    return uniqueResults;

  } catch (error) {
    console.error("AI engines query error:", error);
    return [];
  }
};


import { MedicineResult } from "@/types/medicine";
import { searchRxNorm } from "./api/rxnormApi";
import { queryAIEngines } from "./api/apiOrchestrator";
import { performComprehensiveGlobalSearch } from "./api/comprehensiveSearch";
import { enhanceMedicineData } from "./api/medicineDataEnhancer";
import { localMedicineDb } from "./database/localMedicineDb";

export const searchMedicines = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Starting comprehensive global search for:", term, "in country:", country || "worldwide");

  try {
    // Initialize local database if needed
    await localMedicineDb.initialize();

    // Search local database first for fast results
    console.log("Searching local database...");
    const localResults = await localMedicineDb.searchLocal(term, country);
    console.log("Local database results:", localResults.length);

    // Always perform remote searches for comprehensive coverage
    console.log("Starting remote searches...");
    
    // Execute all remote searches in parallel for better performance
    const searchPromises = [
      searchRxNorm(term).catch(error => {
        console.warn("RxNorm search failed:", error);
        return [];
      }),
      queryAIEngines(term, country).catch(error => {
        console.warn("AI engines search failed:", error);
        return [];
      }),
      performComprehensiveGlobalSearch(term, country).catch(error => {
        console.warn("Comprehensive search failed:", error);
        return [];
      })
    ];

    const [rxNormResults, aiResults, comprehensiveResults] = await Promise.all(searchPromises);

    console.log("Remote search results breakdown:");
    console.log("RxNorm results:", rxNormResults.length);
    console.log("AI results:", aiResults.length);
    console.log("Comprehensive results:", comprehensiveResults.length);

    // Combine all results
    let allResults = [...localResults, ...rxNormResults, ...aiResults, ...comprehensiveResults];

    // Filter by country if specified with improved matching
    if (country && country !== 'all') {
      const countryLower = country.toLowerCase();
      allResults = allResults.filter(result => {
        const resultCountry = result.country.toLowerCase();
        return (
          resultCountry.includes(countryLower) ||
          resultCountry === 'global' ||
          resultCountry === 'european union' ||
          resultCountry.includes('who') ||
          resultCountry.includes('region') ||
          resultCountry.includes('worldwide')
        );
      });
    }

    // Enhanced deduplication with better matching and unique IDs
    const uniqueResults = allResults.filter((result, index, array) => {
      const normalizedBrand = result.brandName.toLowerCase().trim().replace(/[^\w\s]/g, '');
      const normalizedIngredient = result.activeIngredient.toLowerCase().trim();
      const normalizedCountry = result.country.toLowerCase().trim();
      
      const firstIndex = array.findIndex(r => {
        const rBrand = r.brandName.toLowerCase().trim().replace(/[^\w\s]/g, '');
        const rIngredient = r.activeIngredient.toLowerCase().trim();
        const rCountry = r.country.toLowerCase().trim();
        
        return rBrand === normalizedBrand && 
               rIngredient === normalizedIngredient && 
               rCountry === normalizedCountry;
      });
      
      return firstIndex === index;
    });

    // Ensure unique IDs for React keys
    const resultsWithUniqueIds = uniqueResults.map((result, index) => ({
      ...result,
      id: `${result.source}-${result.brandName.toLowerCase().replace(/[^\w]/g, '-')}-${result.country.toLowerCase().replace(/[^\w]/g, '-')}-${index}`
    }));

    // Enhanced sorting with better prioritization
    const sortedResults = resultsWithUniqueIds.sort((a, b) => {
      // Prioritize local database results
      const aIsLocal = localResults.some(lr => lr.brandName === a.brandName && lr.country === a.country);
      const bIsLocal = localResults.some(lr => lr.brandName === b.brandName && lr.country === b.country);
      
      if (aIsLocal && !bIsLocal) return -1;
      if (bIsLocal && !aIsLocal) return 1;

      // Exact brand name matches get highest priority
      const termLower = term.toLowerCase();
      const aExactMatch = a.brandName.toLowerCase() === termLower ? 3 : 0;
      const bExactMatch = b.brandName.toLowerCase() === termLower ? 3 : 0;
      
      // Brand name starts with search term
      const aStartsMatch = a.brandName.toLowerCase().startsWith(termLower) ? 2 : 0;
      const bStartsMatch = b.brandName.toLowerCase().startsWith(termLower) ? 2 : 0;
      
      // Brand name contains search term
      const aContainsMatch = a.brandName.toLowerCase().includes(termLower) ? 1 : 0;
      const bContainsMatch = b.brandName.toLowerCase().includes(termLower) ? 1 : 0;
      
      const aScore = aExactMatch + aStartsMatch + aContainsMatch;
      const bScore = bExactMatch + bStartsMatch + bContainsMatch;

      if (aScore !== bScore) {
        return bScore - aScore;
      }

      // Source reliability priority
      const sourceOrder = { 'rxnorm': 4, 'both': 3, 'ai': 2 };
      const aSourceScore = sourceOrder[a.source] || 1;
      const bSourceScore = sourceOrder[b.source] || 1;
      
      if (aSourceScore !== bSourceScore) {
        return bSourceScore - aSourceScore;
      }

      // Country-specific prioritization
      if (country && country !== 'all') {
        const countryLower = country.toLowerCase();
        const aCountryMatch = a.country.toLowerCase().includes(countryLower);
        const bCountryMatch = b.country.toLowerCase().includes(countryLower);
        
        if (aCountryMatch && !bCountryMatch) return -1;
        if (bCountryMatch && !aCountryMatch) return 1;
      }

      // US and major countries priority for global searches
      const majorCountries = ['united states', 'united kingdom', 'germany', 'france', 'canada', 'australia'];
      const aMajor = majorCountries.includes(a.country.toLowerCase());
      const bMajor = majorCountries.includes(b.country.toLowerCase());
      
      if (aMajor && !bMajor) return -1;
      if (bMajor && !aMajor) return 1;

      // Alphabetical by country as final sort
      return a.country.localeCompare(b.country);
    });

    console.log("Search completed successfully:");
    console.log(`- Local results: ${localResults.length}`);
    console.log(`- Remote results: ${rxNormResults.length + aiResults.length + comprehensiveResults.length}`);
    console.log(`- Total unique results: ${sortedResults.length}`);
    console.log(`- Countries represented: ${new Set(sortedResults.map(r => r.country)).size}`);

    return sortedResults;

  } catch (error) {
    console.error("Search medicines error:", error);
    throw new Error(`Failed to search medicines: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Re-export individual functions for backward compatibility
export { searchRxNorm } from "./api/rxnormApi";
export { searchOpenFDA } from "./api/fdaApi";
export { searchEMA } from "./api/emaApi";
export { searchOpenAI, searchPerplexity, searchDeepSeek, searchOpenRouter } from "./api/aiServices";
export { searchWHO, searchClinicalTrials } from "./api/publicApis";
export { performComprehensiveGlobalSearch } from "./api/comprehensiveSearch";
export { enhanceMedicineData, findAlternativeNames } from "./api/medicineDataEnhancer";

// Export database functions
export { localMedicineDb } from "./database/localMedicineDb";
export { officialDatabaseSources, downloadAndImportDatabase, importAllDatabases } from "./database/databaseImporter";


import { MedicineResult } from "@/types/medicine";
import { 
  searchHealthCanada, 
  searchCDSCO, 
  searchTGA, 
  searchANVISA, 
  searchPMDA, 
  searchNMPA,
  searchWHOMedRegistry,
  searchGenericDatabase 
} from "./globalMedicineApis";
import { searchAllEUDatabases } from "./euMedicineApis";
import { enhanceMedicineData, findAlternativeNames } from "./medicineDataEnhancer";
import { getCachedResult, setCachedResult } from "./searchCache";
import { searchProgressTracker } from "./searchProgressTracker";

export const performComprehensiveGlobalSearch = async (
  term: string, 
  country?: string
): Promise<MedicineResult[]> => {
  console.log("Starting comprehensive global medicine search for:", term);
  
  // Check cache first
  const cacheKey = `comprehensive-${term}-${country || 'all'}`;
  const cached = getCachedResult(cacheKey);
  if (cached) {
    console.log("Returning cached comprehensive results");
    return cached;
  }
  
  const results: MedicineResult[] = [];
  
  try {
    // Search alternative names first
    const alternativeNames = await findAlternativeNames(term);
    const searchTerms = [term, ...alternativeNames];
    
    console.log("Searching for terms:", searchTerms);
    
    // Global regulatory agencies including comprehensive EU coverage
    const globalApis = [
      { name: "EU Databases", fn: () => searchAllEUDatabases(term) },
      { name: "Health Canada", fn: () => searchHealthCanada(term) },
      { name: "India CDSCO", fn: () => searchCDSCO(term) },
      { name: "Australia TGA", fn: () => searchTGA(term) },
      { name: "Brazil ANVISA", fn: () => searchANVISA(term) },
      { name: "Japan PMDA", fn: () => searchPMDA(term) },
      { name: "China NMPA", fn: () => searchNMPA(term) },
      { name: "WHO Registry", fn: () => searchWHOMedRegistry(term) },
      { name: "Generic Database", fn: () => searchGenericDatabase(term) }
    ];
    
    searchProgressTracker.setTotal(globalApis.length);
    
    // Execute all searches in parallel
    const searchPromises = globalApis.map(async (api) => {
      try {
        searchProgressTracker.updateProgress(api.name);
        const result = await api.fn();
        searchProgressTracker.updateProgress(api.name, true);
        return { name: api.name, data: result };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        searchProgressTracker.updateProgress(api.name, true, errorMsg);
        console.warn(`${api.name} failed:`, error);
        return { name: api.name, data: [] };
      }
    });
    
    const searchResults = await Promise.allSettled(searchPromises);
    
    // Collect all results
    searchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(...result.value.data);
        console.log(`${result.value.name} returned ${result.value.data.length} results`);
      }
    });
    
    // Remove duplicates
    const uniqueResults = results.filter((result, index, array) =>
      array.findIndex(r =>
        r.brandName.toLowerCase() === result.brandName.toLowerCase() &&
        r.country === result.country
      ) === index
    );
    
    // Filter by country if specified
    let filteredResults = uniqueResults;
    if (country && country !== 'all') {
      filteredResults = uniqueResults.filter(result =>
        result.country.toLowerCase().includes(country.toLowerCase()) ||
        result.country === 'Global' ||
        result.country === 'European Union' ||
        result.country.includes('WHO')
      );
    }
    
    console.log("Total comprehensive results:", filteredResults.length);
    
    // Cache the results
    setCachedResult(cacheKey, filteredResults);
    
    return filteredResults;
    
  } catch (error) {
    console.error("Comprehensive search error:", error);
    return [];
  }
};

// Country-specific search optimization
export const getCountrySpecificSources = (country: string): string[] => {
  const countrySourceMap: Record<string, string[]> = {
    "United States": ["FDA", "Orange Book", "Purple Book", "RxNorm"],
    "Canada": ["Health Canada DPD", "Drug Product Database"],
    "United Kingdom": ["MHRA", "BNF", "EMC"],
    "India": ["CDSCO", "Drug Controller General", "Indian Pharmacopoeia"],
    "Australia": ["TGA", "ARTG", "PBS"],
    "Brazil": ["ANVISA", "Brazilian Health Ministry"],
    "Japan": ["PMDA", "Japanese Pharmacopoeia"],
    "China": ["NMPA", "CFDA", "Chinese Pharmacopoeia"],
    "Germany": ["BfArM", "European Medicines Database"],
    "France": ["ANSM", "Theriaque", "Vidal"]
  };
  
  return countrySourceMap[country] || ["WHO", "Global Database"];
};

// Medicine availability checker
export const checkMedicineAvailabilityByCountry = async (
  medicine: string, 
  countries: string[]
): Promise<Record<string, boolean>> => {
  const availability: Record<string, boolean> = {};
  
  for (const country of countries) {
    // Simulate availability check - in production would use real APIs
    const sources = getCountrySpecificSources(country);
    availability[country] = sources.length > 0;
  }
  
  return availability;
};

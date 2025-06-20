
import { MedicineResult, RxNormResponse } from "@/types/medicine";

const RXNORM_BASE_URL = "https://rxnav.nlm.nih.gov/REST";

// RxNorm API functions
export const searchRxNorm = async (term: string): Promise<MedicineResult[]> => {
  console.log("Searching RxNorm for:", term);
  
  try {
    // Search for drugs containing the term
    const searchUrl = `${RXNORM_BASE_URL}/drugs.json?name=${encodeURIComponent(term)}`;
    console.log("RxNorm search URL:", searchUrl);
    
    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`RxNorm API error: ${response.status}`);
    }
    
    const data: RxNormResponse = await response.json();
    console.log("RxNorm raw response:", data);
    
    const results: MedicineResult[] = [];
    
    // Process drug groups
    if (data.drugGroup?.conceptGroup) {
      for (const group of data.drugGroup.conceptGroup) {
        if (group.conceptProperties) {
          for (const concept of group.conceptProperties) {
            // Skip generic concepts, focus on brand names
            if (concept.tty && !['IN', 'PIN', 'MIN'].includes(concept.tty)) {
              results.push({
                id: `rxnorm-${concept.rxcui}`,
                brandName: concept.name,
                activeIngredient: term,
                country: "United States", // RxNorm is primarily US-focused
                rxNormData: concept,
                source: 'rxnorm'
              });
            }
          }
        }
      }
    }
    
    console.log("Processed RxNorm results:", results.length);
    return results;
    
  } catch (error) {
    console.error("RxNorm API error:", error);
    return [];
  }
};

// AI-enhanced search to supplement RxNorm data
export const enhanceWithAI = async (term: string, rxNormResults: MedicineResult[]): Promise<MedicineResult[]> => {
  console.log("Enhancing results with AI for:", term);
  
  // Simulate AI enhancement with common international brand names
  // In a real implementation, this would call an AI API
  const commonBrands: { [key: string]: MedicineResult[] } = {
    acetaminophen: [
      {
        id: "ai-tylenol-ca",
        brandName: "Tylenol",
        activeIngredient: "acetaminophen",
        country: "Canada",
        manufacturer: "Johnson & Johnson",
        source: 'ai'
      },
      {
        id: "ai-panadol-uk",
        brandName: "Panadol",
        activeIngredient: "acetaminophen",
        country: "United Kingdom",
        manufacturer: "GSK",
        source: 'ai'
      },
      {
        id: "ai-paracetamol-de",
        brandName: "Ben-u-ron",
        activeIngredient: "acetaminophen",
        country: "Germany",
        manufacturer: "bene-Arzneimittel",
        source: 'ai'
      }
    ],
    ibuprofen: [
      {
        id: "ai-advil-ca",
        brandName: "Advil",
        activeIngredient: "ibuprofen",
        country: "Canada",
        manufacturer: "Pfizer",
        source: 'ai'
      },
      {
        id: "ai-nurofen-uk",
        brandName: "Nurofen",
        activeIngredient: "ibuprofen",
        country: "United Kingdom",
        manufacturer: "Reckitt",
        source: 'ai'
      },
      {
        id: "ai-brufen-de",
        brandName: "Brufen",
        activeIngredient: "ibuprofen",
        country: "Germany",
        manufacturer: "Abbott",
        source: 'ai'
      }
    ],
    aspirin: [
      {
        id: "ai-bayer-de",
        brandName: "Bayer Aspirin",
        activeIngredient: "aspirin",
        country: "Germany",
        manufacturer: "Bayer",
        source: 'ai'
      },
      {
        id: "ai-dispirin-uk",
        brandName: "Dispirin",
        activeIngredient: "aspirin",
        country: "United Kingdom",
        manufacturer: "Reckitt",
        source: 'ai'
      }
    ]
  };
  
  const lowerTerm = term.toLowerCase();
  const aiResults = commonBrands[lowerTerm] || [];
  
  console.log("AI enhanced results:", aiResults.length);
  return aiResults;
};

// Main search function that combines RxNorm and AI results
export const searchMedicines = async (term: string): Promise<MedicineResult[]> => {
  console.log("Starting comprehensive search for:", term);
  
  try {
    // Search RxNorm first
    const rxNormResults = await searchRxNorm(term);
    console.log("RxNorm results count:", rxNormResults.length);
    
    // Enhance with AI
    const aiResults = await enhanceWithAI(term, rxNormResults);
    console.log("AI results count:", aiResults.length);
    
    // Combine and deduplicate results
    const allResults = [...rxNormResults, ...aiResults];
    
    // Remove duplicates based on brand name and country
    const uniqueResults = allResults.filter((result, index, array) => 
      array.findIndex(r => 
        r.brandName.toLowerCase() === result.brandName.toLowerCase() && 
        r.country === result.country
      ) === index
    );
    
    console.log("Total unique results:", uniqueResults.length);
    return uniqueResults;
    
  } catch (error) {
    console.error("Search medicines error:", error);
    throw new Error("Failed to search medicines");
  }
};

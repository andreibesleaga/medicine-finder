
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

// Query free AI engines for worldwide medicine brands
export const queryAIEngines = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Querying AI engines for:", term, "in country:", country || "worldwide");
  
  const results: MedicineResult[] = [];
  
  try {
    // Query multiple free AI endpoints
    const aiQueries = [
      queryHuggingFaceAPI(term, country),
      queryOpenAICompatibleAPI(term, country),
      queryLocalKnowledgeBase(term, country)
    ];
    
    const aiResults = await Promise.allSettled(aiQueries);
    
    aiResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
        console.log(`AI engine ${index + 1} returned ${result.value.length} results`);
      } else {
        console.warn(`AI engine ${index + 1} failed:`, result.reason);
      }
    });
    
    // Remove duplicates
    const uniqueResults = results.filter((result, index, array) => 
      array.findIndex(r => 
        r.brandName.toLowerCase() === result.brandName.toLowerCase() && 
        r.country === result.country
      ) === index
    );
    
    console.log("Total unique AI results:", uniqueResults.length);
    return uniqueResults;
    
  } catch (error) {
    console.error("AI engines query error:", error);
    return [];
  }
};

// Simulate HuggingFace API query (using local knowledge for demo)
const queryHuggingFaceAPI = async (term: string, country?: string): Promise<MedicineResult[]> => {
  // In a real implementation, this would call HuggingFace's free inference API
  // For now, using enhanced local knowledge base
  
  const worldwideBrands: { [key: string]: MedicineResult[] } = {
    acetaminophen: [
      { id: "ai-tylenol-us", brandName: "Tylenol", activeIngredient: "acetaminophen", country: "United States", manufacturer: "Johnson & Johnson", source: 'ai' },
      { id: "ai-tylenol-ca", brandName: "Tylenol", activeIngredient: "acetaminophen", country: "Canada", manufacturer: "Johnson & Johnson", source: 'ai' },
      { id: "ai-panadol-uk", brandName: "Panadol", activeIngredient: "acetaminophen", country: "United Kingdom", manufacturer: "GSK", source: 'ai' },
      { id: "ai-panadol-au", brandName: "Panadol", activeIngredient: "acetaminophen", country: "Australia", manufacturer: "GSK", source: 'ai' },
      { id: "ai-ben-u-ron-de", brandName: "Ben-u-ron", activeIngredient: "acetaminophen", country: "Germany", manufacturer: "bene-Arzneimittel", source: 'ai' },
      { id: "ai-doliprane-fr", brandName: "Doliprane", activeIngredient: "acetaminophen", country: "France", manufacturer: "Sanofi", source: 'ai' },
      { id: "ai-crocin-in", brandName: "Crocin", activeIngredient: "acetaminophen", country: "India", manufacturer: "GSK", source: 'ai' },
      { id: "ai-paracetamol-br", brandName: "Tylenol", activeIngredient: "acetaminophen", country: "Brazil", manufacturer: "Johnson & Johnson", source: 'ai' }
    ],
    ibuprofen: [
      { id: "ai-advil-us", brandName: "Advil", activeIngredient: "ibuprofen", country: "United States", manufacturer: "Pfizer", source: 'ai' },
      { id: "ai-advil-ca", brandName: "Advil", activeIngredient: "ibuprofen", country: "Canada", manufacturer: "Pfizer", source: 'ai' },
      { id: "ai-nurofen-uk", brandName: "Nurofen", activeIngredient: "ibuprofen", country: "United Kingdom", manufacturer: "Reckitt", source: 'ai' },
      { id: "ai-nurofen-au", brandName: "Nurofen", activeIngredient: "ibuprofen", country: "Australia", manufacturer: "Reckitt", source: 'ai' },
      { id: "ai-brufen-de", brandName: "Brufen", activeIngredient: "ibuprofen", country: "Germany", manufacturer: "Abbott", source: 'ai' },
      { id: "ai-spidifen-fr", brandName: "Spidifen", activeIngredient: "ibuprofen", country: "France", manufacturer: "Zambon", source: 'ai' },
      { id: "ai-combiflam-in", brandName: "Combiflam", activeIngredient: "ibuprofen", country: "India", manufacturer: "Sanofi", source: 'ai' },
      { id: "ai-alivium-br", brandName: "Alivium", activeIngredient: "ibuprofen", country: "Brazil", manufacturer: "Mantecorp", source: 'ai' }
    ],
    aspirin: [
      { id: "ai-bayer-us", brandName: "Bayer Aspirin", activeIngredient: "aspirin", country: "United States", manufacturer: "Bayer", source: 'ai' },
      { id: "ai-bayer-de", brandName: "Bayer Aspirin", activeIngredient: "aspirin", country: "Germany", manufacturer: "Bayer", source: 'ai' },
      { id: "ai-dispirin-uk", brandName: "Dispirin", activeIngredient: "aspirin", country: "United Kingdom", manufacturer: "Reckitt", source: 'ai' },
      { id: "ai-aspro-au", brandName: "Aspro", activeIngredient: "aspirin", country: "Australia", manufacturer: "Bayer", source: 'ai' },
      { id: "ai-kardegic-fr", brandName: "Kardégic", activeIngredient: "aspirin", country: "France", manufacturer: "Sanofi", source: 'ai' },
      { id: "ai-disprin-in", brandName: "Disprin", activeIngredient: "aspirin", country: "India", manufacturer: "Reckitt", source: 'ai' }
    ]
  };
  
  const lowerTerm = term.toLowerCase();
  let results = worldwideBrands[lowerTerm] || [];
  
  // Filter by country if specified
  if (country && country !== 'all') {
    results = results.filter(r => r.country.toLowerCase().includes(country.toLowerCase()));
  }
  
  return results;
};

// Simulate OpenAI-compatible API query
const queryOpenAICompatibleAPI = async (term: string, country?: string): Promise<MedicineResult[]> => {
  // This would typically call a free OpenAI-compatible endpoint
  // For demo purposes, returning additional results
  
  const additionalBrands: { [key: string]: MedicineResult[] } = {
    acetaminophen: [
      { id: "ai-efferalgan-fr", brandName: "Efferalgan", activeIngredient: "acetaminophen", country: "France", manufacturer: "Bristol Myers Squibb", source: 'ai' },
      { id: "ai-tachipirina-it", brandName: "Tachipirina", activeIngredient: "acetaminophen", country: "Italy", manufacturer: "Angelini", source: 'ai' },
      { id: "ai-tempra-mx", brandName: "Tempra", activeIngredient: "acetaminophen", country: "Mexico", manufacturer: "Bristol Myers Squibb", source: 'ai' }
    ],
    ibuprofen: [
      { id: "ai-ibupril-za", brandName: "Ibupril", activeIngredient: "ibuprofen", country: "South Africa", manufacturer: "Pharma Dynamics", source: 'ai' },
      { id: "ai-neobrufen-es", brandName: "Neobrufen", activeIngredient: "ibuprofen", country: "Spain", manufacturer: "Abbott", source: 'ai' },
      { id: "ai-moment-it", brandName: "Moment", activeIngredient: "ibuprofen", country: "Italy", manufacturer: "Angelini", source: 'ai' }
    ]
  };
  
  const lowerTerm = term.toLowerCase();
  let results = additionalBrands[lowerTerm] || [];
  
  if (country && country !== 'all') {
    results = results.filter(r => r.country.toLowerCase().includes(country.toLowerCase()));
  }
  
  return results;
};

// Local knowledge base for additional worldwide brands
const queryLocalKnowledgeBase = async (term: string, country?: string): Promise<MedicineResult[]> => {
  const knowledgeBase: { [key: string]: MedicineResult[] } = {
    acetaminophen: [
      { id: "ai-fevadol-ae", brandName: "Fevadol", activeIngredient: "acetaminophen", country: "United Arab Emirates", manufacturer: "Spimaco", source: 'ai' },
      { id: "ai-adol-eg", brandName: "Adol", activeIngredient: "acetaminophen", country: "Egypt", manufacturer: "Pfizer", source: 'ai' },
      { id: "ai-panadol-pk", brandName: "Panadol", activeIngredient: "acetaminophen", country: "Pakistan", manufacturer: "GSK", source: 'ai' }
    ],
    ibuprofen: [
      { id: "ai-brufen-pk", brandName: "Brufen", activeIngredient: "ibuprofen", country: "Pakistan", manufacturer: "Abbott", source: 'ai' },
      { id: "ai-ponstyl-th", brandName: "Ponstyl", activeIngredient: "ibuprofen", country: "Thailand", manufacturer: "Pfizer", source: 'ai' },
      { id: "ai-ibucold-in", brandName: "Ibucold", activeIngredient: "ibuprofen", country: "India", manufacturer: "Cipla", source: 'ai' }
    ]
  };
  
  const lowerTerm = term.toLowerCase();
  let results = knowledgeBase[lowerTerm] || [];
  
  if (country && country !== 'all') {
    results = results.filter(r => r.country.toLowerCase().includes(country.toLowerCase()));
  }
  
  return results;
};

// Enhanced main search function with country filtering
export const searchMedicines = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Starting comprehensive search for:", term, "in country:", country || "worldwide");
  
  try {
    // Search RxNorm first
    const rxNormResults = await searchRxNorm(term);
    console.log("RxNorm results count:", rxNormResults.length);
    
    // Query AI engines for worldwide results
    const aiResults = await queryAIEngines(term, country);
    console.log("AI results count:", aiResults.length);
    
    // Combine results
    let allResults = [...rxNormResults, ...aiResults];
    
    // Filter by country if specified
    if (country && country !== 'all') {
      allResults = allResults.filter(result => 
        result.country.toLowerCase().includes(country.toLowerCase())
      );
    }
    
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

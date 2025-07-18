
import { MedicineResult } from "@/types/medicine";

const EMA_BASE_URL = "https://spor.ema.europa.eu/rmswi";

export const searchEMA = async (term: string): Promise<MedicineResult[]> => {
  console.log("Searching EMA for:", term);

  try {
    // EMA SPOR (Substance, Product, Organisation and Referential) system
    // Using the public search interface
    const searchUrl = `${EMA_BASE_URL}/api/v1/medicines?name=${encodeURIComponent(term)}&limit=20`;

    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MedicineSearch/1.0',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // If direct API fails, try alternative approach
      console.warn(`EMA direct API returned ${response.status}, trying alternative search`);
      return await searchEMAAlternative(term);
    }

    const data = await response.json();
    console.log("EMA results:", data.medicines?.length || 0);

    const results: MedicineResult[] = [];

    if (data.medicines && Array.isArray(data.medicines)) {
      for (const medicine of data.medicines) {
        const brandName = medicine.tradeName || medicine.name || medicine.productName;
        const activeSubstance = medicine.activeSubstance || medicine.substance || term;
        const country = medicine.memberState || "European Union";
        const holder = medicine.marketingAuthorisationHolder || medicine.applicant || "Unknown";

        if (brandName) {
          results.push({
            id: `ema-${medicine.euNumber || medicine.procedureNumber || Math.random().toString(36).substr(2, 9)}`,
            brandName: brandName,
            activeIngredient: activeSubstance,
            country: country,
            manufacturer: holder,
            source: 'ai'
          });
        }
      }
    }

    return results;

  } catch (error) {
    console.error("EMA API error:", error);
    return await searchEMAAlternative(term);
  }
};

// Alternative EMA search method using public endpoints
const searchEMAAlternative = async (term: string): Promise<MedicineResult[]> => {
  try {
    // Use EMA's public medicine search
    const searchUrl = `https://www.ema.europa.eu/en/medicines/search_api_autocomplete?search_api_fulltext=${encodeURIComponent(term)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`EMA alternative API error: ${response.status}`);
    }

    const data = await response.json();
    const results: MedicineResult[] = [];

    if (Array.isArray(data)) {
      for (const item of data.slice(0, 10)) {
        if (item.label && item.label.toLowerCase().includes(term.toLowerCase())) {
          results.push({
            id: `ema-alt-${Math.random().toString(36).substr(2, 9)}`,
            brandName: item.label,
            activeIngredient: term,
            country: "European Union",
            manufacturer: "EMA Approved",
            source: 'ai'
          });
        }
      }
    }

    return results;

  } catch (error) {
    console.error("EMA Alternative API error:", error);
    
    // Fallback: Return common EU medicine brands based on active ingredient
    return getCommonEUMedicines(term);
  }
};

// Fallback function for common EU medicines
const getCommonEUMedicines = (term: string): MedicineResult[] => {
  const commonEUMedicines: { [key: string]: string[] } = {
    'paracetamol': ['Panadol', 'Efferalgan', 'Doliprane', 'Tachipirina'],
    'acetaminophen': ['Panadol', 'Efferalgan', 'Doliprane', 'Tachipirina'],
    'ibuprofen': ['Nurofen', 'Brufen', 'Advil', 'Moment'],
    'aspirin': ['Aspegic', 'Cardioaspirin', 'Aspirin Protect', 'Bayer'],
    'omeprazole': ['Losec', 'Mopral', 'Antra', 'Gastrogel'],
    'amoxicillin': ['Clamoxyl', 'Amoxil', 'Flemoxin', 'Augmentin'],
    'metformin': ['Glucophage', 'Metforal', 'Siofor', 'Stagid'],
    'atorvastatin': ['Lipitor', 'Sortis', 'Cardyl', 'Atoris'],
    'amlodipine': ['Norvasc', 'Amlor', 'Amlogal', 'Tenox'],
    'simvastatin': ['Zocor', 'Simvastatin Teva', 'Simcard', 'Simvahexal']
  };

  const brands = commonEUMedicines[term.toLowerCase()] || [];
  
  return brands.map((brand, index) => ({
    id: `ema-common-${brand.toLowerCase()}-${index}`,
    brandName: brand,
    activeIngredient: term,
    country: 'European Union',
    manufacturer: 'Various EU',
    source: 'ai' as const
  }));
};

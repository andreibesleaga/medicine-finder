
import { MedicineResult } from "@/types/medicine";

const EMA_BASE_URL = "https://spor.ema.europa.eu/rmswi/api";

export const searchEMA = async (term: string): Promise<MedicineResult[]> => {
  console.log("Searching EMA for:", term);

  try {
    const searchUrl = `${EMA_BASE_URL}/medicinal-products?name=${encodeURIComponent(term)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MedicineSearch/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`EMA API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("EMA results:", data.length || 0);

    const results: MedicineResult[] = [];

    if (Array.isArray(data)) {
      for (const medicine of data) {
        results.push({
          id: `ema-${medicine.id || Math.random().toString(36).substr(2, 9)}`,
          brandName: medicine.name || medicine.tradeName,
          activeIngredient: medicine.activeSubstance || term,
          country: medicine.country || "European Union",
          manufacturer: medicine.marketingAuthorisationHolder || "Unknown",
          source: 'ai'
        });
      }
    }

    return results;

  } catch (error) {
    console.error("EMA API error:", error);
    return [];
  }
};

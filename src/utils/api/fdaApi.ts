
import { MedicineResult } from "@/types/medicine";

const OPENFDA_BASE_URL = "https://api.fda.gov/drug";

export const searchOpenFDA = async (term: string): Promise<MedicineResult[]> => {
  console.log("Searching OpenFDA for:", term);

  try {
    const searchUrl = `${OPENFDA_BASE_URL}/label.json?search=openfda.brand_name:"${encodeURIComponent(term)}"&limit=100`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`OpenFDA API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("OpenFDA results:", data.results?.length || 0);

    const results: MedicineResult[] = [];

    if (data.results) {
      for (const result of data.results) {
        if (result.openfda?.brand_name) {
          const brandNames = Array.isArray(result.openfda.brand_name)
            ? result.openfda.brand_name
            : [result.openfda.brand_name];

          for (const brandName of brandNames) {
            results.push({
              id: `openfda-${brandName.toLowerCase().replace(/\s+/g, '-')}`,
              brandName: brandName,
              activeIngredient: result.openfda?.generic_name?.[0] || term,
              country: "United States",
              manufacturer: result.openfda?.manufacturer_name?.[0] || "Unknown",
              source: 'ai'
            });
          }
        }
      }
    }

    return results;

  } catch (error) {
    console.error("OpenFDA API error:", error);
    return [];
  }
};

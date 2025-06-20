
import { MedicineResult, RxNormResponse } from "@/types/medicine";

const RXNORM_BASE_URL = "https://rxnav.nlm.nih.gov/REST";

export const searchRxNorm = async (term: string): Promise<MedicineResult[]> => {
  console.log("Searching RxNorm for:", term);

  try {
    const searchUrl = `${RXNORM_BASE_URL}/drugs.json?name=${encodeURIComponent(term)}`;
    console.log("RxNorm search URL:", searchUrl);

    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`RxNorm API error: ${response.status}`);
    }

    const data: RxNormResponse = await response.json();
    console.log("RxNorm raw response:", data);

    const results: MedicineResult[] = [];

    if (data.drugGroup?.conceptGroup) {
      for (const group of data.drugGroup.conceptGroup) {
        if (group.conceptProperties) {
          for (const concept of group.conceptProperties) {
            if (concept.tty && !['IN', 'PIN', 'MIN'].includes(concept.tty)) {
              results.push({
                id: `rxnorm-${concept.rxcui}`,
                brandName: concept.name,
                activeIngredient: term,
                country: "United States",
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

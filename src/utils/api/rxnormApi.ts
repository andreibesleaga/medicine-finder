
import { MedicineResult, RxNormResponse } from "@/types/medicine";
import { ApiSecurity } from "../security/apiSecurity";

const RXNORM_BASE_URL = "https://rxnav.nlm.nih.gov/REST";

export const searchRxNorm = async (term: string): Promise<MedicineResult[]> => {
  console.log("Searching RxNorm for:", term);

  try {
    const searchUrl = `${RXNORM_BASE_URL}/drugs.json?name=${encodeURIComponent(term)}`;
    console.log("RxNorm search URL:", searchUrl);

    const response = await ApiSecurity.secureApiRequest(searchUrl);
    if (!response.ok) {
      throw new Error(`RxNorm API error: ${response.status}`);
    }

    const rawData = await response.json();
    const data: RxNormResponse = ApiSecurity.sanitizeApiResponse(rawData);
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
    ApiSecurity.logSecurityEvent('RXNORM_API_ERROR', { error: error?.toString(), term });
    console.error("RxNorm API error:", error);
    return [];
  }
};

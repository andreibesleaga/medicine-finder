
import { MedicineResult } from "@/types/medicine";
import { getCountryName } from "../helpers/countryUtils";

export const searchWHO = async (term: string): Promise<MedicineResult[]> => {
  console.log("Searching WHO database for:", term);

  try {
    // WHO Global Health Observatory API
    const searchUrl = `https://ghoapi.azureedge.net/api/DIMENSION/COUNTRY/DimensionValues`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`WHO API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("WHO countries data received");

    const results: MedicineResult[] = [];

    // Use WHO country data to simulate medicine availability
    if (data.value && Array.isArray(data.value)) {
      const countries = data.value.slice(0, 20); // Limit results

      for (const country of countries) {
        // Simulate medicine brands based on common international names
        const commonBrands = generateCommonBrands(term, country.Title);
        results.push(...commonBrands);
      }
    }

    return results;

  } catch (error) {
    console.error("WHO API error:", error);
    return [];
  }
};

export const searchClinicalTrials = async (term: string): Promise<MedicineResult[]> => {
  console.log("Searching ClinicalTrials.gov for:", term);

  try {
    const searchUrl = `https://clinicaltrials.gov/api/query/study_fields?expr=${encodeURIComponent(term)}&fields=BriefTitle,InterventionName,LocationCountry&min_rnk=1&max_rnk=50&fmt=json`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`ClinicalTrials API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("ClinicalTrials results:", data.StudyFieldsResponse?.NStudiesFound || 0);

    const results: MedicineResult[] = [];

    if (data.StudyFieldsResponse?.StudyFields) {
      for (const study of data.StudyFieldsResponse.StudyFields) {
        if (study.InterventionName) {
          const interventions = Array.isArray(study.InterventionName)
            ? study.InterventionName
            : [study.InterventionName];

          for (const intervention of interventions) {
            if (intervention.toLowerCase().includes(term.toLowerCase())) {
              results.push({
                id: `clinicaltrials-${Math.random().toString(36).substr(2, 9)}`,
                brandName: intervention,
                activeIngredient: term,
                country: study.LocationCountry?.[0] || "Global",
                manufacturer: "Clinical Trial",
                source: 'ai'
              });
            }
          }
        }
      }
    }

    return results;

  } catch (error) {
    console.error("ClinicalTrials API error:", error);
    return [];
  }
};

export const queryPubChemAPI = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Querying PubChem API for:", term);

  try {
    const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(term)}/synonyms/JSON`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`PubChem API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("PubChem synonyms found:", data.InformationList?.Information?.[0]?.Synonym?.length || 0);

    const results: MedicineResult[] = [];

    if (data.InformationList?.Information?.[0]?.Synonym) {
      const synonyms = data.InformationList.Information[0].Synonym;

      const brandNames = synonyms.filter((synonym: string) =>
        /^[A-Z][a-z]/.test(synonym) &&
        synonym.length < 20 &&
        !synonym.includes('-') &&
        !synonym.includes('(') &&
        !synonym.toLowerCase().includes('acid')
      ).slice(0, 10);

      for (const brandName of brandNames) {
        results.push({
          id: `pubchem-${brandName.toLowerCase().replace(/\s+/g, '-')}`,
          brandName: brandName,
          activeIngredient: term,
          country: "Global",
          manufacturer: "Various",
          source: 'ai'
        });
      }
    }

    return results;

  } catch (error) {
    console.error("PubChem API error:", error);
    return [];
  }
};

export const queryWikidataAPI = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Querying Wikidata API for:", term);

  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(term)}&language=en&format=json&origin=*`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`Wikidata API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Wikidata entities found:", data.search?.length || 0);

    const results: MedicineResult[] = [];

    if (data.search) {
      for (const entity of data.search.slice(0, 5)) {
        if (entity.description && entity.description.toLowerCase().includes('drug')) {
          results.push({
            id: `wikidata-${entity.id}`,
            brandName: entity.label,
            activeIngredient: term,
            country: "Global",
            manufacturer: "Various",
            source: 'ai'
          });
        }
      }
    }

    return results;

  } catch (error) {
    console.error("Wikidata API error:", error);
    return [];
  }
};

// Helper function to generate common medicine brands
const generateCommonBrands = (term: string, countryName: string): MedicineResult[] => {
  const commonMedicines: { [key: string]: string[] } = {
    'acetaminophen': ['Tylenol', 'Panadol', 'Calpol', 'Doliprane'],
    'ibuprofen': ['Advil', 'Motrin', 'Nurofen', 'Brufen'],
    'aspirin': ['Bayer', 'Bufferin', 'Ecotrin', 'Aspegic'],
    'amoxicillin': ['Amoxil', 'Trimox', 'Wymox', 'Clamoxyl'],
    'omeprazole': ['Prilosec', 'Losec', 'Omez', 'Gastrogel']
  };

  const brands = commonMedicines[term.toLowerCase()] || [];
  
  return brands.map((brand, index) => ({
    id: `who-${countryName}-${brand}-${index}`,
    brandName: brand,
    activeIngredient: term,
    country: countryName,
    manufacturer: 'Various',
    source: 'ai' as const
  }));
};

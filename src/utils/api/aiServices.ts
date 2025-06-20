
import { MedicineResult } from "@/types/medicine";

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const PERPLEXITY_API_KEY = import.meta.env.VITE_PERPLEXITY_API_KEY;
const DRUGBANK_API_KEY = import.meta.env.VITE_DRUGBANK_API_KEY;
const CHEMSPIDER_API_KEY = import.meta.env.VITE_CHEMSPIDER_API_KEY;

export const searchOpenAI = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Searching OpenAI for medicine brands:", term);

  if (!OPENAI_API_KEY) {
    console.warn("OpenAI API key not configured, skipping search");
    return [];
  }

  try {
    const prompt = `List brand names for the medicine "${term}" available in ${country || 'worldwide'}. Return a JSON array with objects containing: brandName, country, manufacturer. Limit to 10 results.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
      try {
        const brands = JSON.parse(content);
        return brands.map((brand: any, index: number) => ({
          id: `openai-${term}-${index}`,
          brandName: brand.brandName || brand.name,
          activeIngredient: term,
          country: brand.country || country || "Global",
          manufacturer: brand.manufacturer || "Various",
          source: 'ai' as const
        }));
      } catch (parseError) {
        console.error("Failed to parse OpenAI response:", parseError);
      }
    }

    return [];

  } catch (error) {
    console.error("OpenAI API error:", error);
    return [];
  }
};

export const searchPerplexity = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Searching Perplexity AI for:", term);

  if (!PERPLEXITY_API_KEY) {
    console.warn("Perplexity API key not configured, skipping search");
    return [];
  }

  try {
    const query = `What are the brand names for the medicine "${term}" ${country ? `in ${country}` : 'worldwide'}? List brand name, country, and manufacturer.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'Return medicine brand information in JSON format with brandName, country, manufacturer fields.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.2,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
      try {
        const brands = JSON.parse(content);
        return brands.map((brand: any, index: number) => ({
          id: `perplexity-${term}-${index}`,
          brandName: brand.brandName,
          activeIngredient: term,
          country: brand.country || "Global",
          manufacturer: brand.manufacturer || "Various",
          source: 'ai' as const
        }));
      } catch (parseError) {
        console.error("Failed to parse Perplexity response:", parseError);
      }
    }

    return [];

  } catch (error) {
    console.error("Perplexity API error:", error);
    return [];
  }
};

export const queryDrugBankAPI = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Querying DrugBank API for:", term);

  if (!DRUGBANK_API_KEY) {
    console.warn("DrugBank API key not configured, skipping search");
    return [];
  }

  try {
    const searchUrl = `https://go.drugbank.com/api/v1/drugs.json?q=${encodeURIComponent(term)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${DRUGBANK_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`DrugBank API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("DrugBank results:", data.length || 0);

    const results: MedicineResult[] = [];

    if (Array.isArray(data)) {
      for (const drug of data.slice(0, 10)) {
        if (drug.name) {
          results.push({
            id: `drugbank-${drug.drugbank_id || Math.random().toString(36).substr(2, 9)}`,
            brandName: drug.name,
            activeIngredient: term,
            country: country || "Global",
            manufacturer: drug.manufacturers?.[0]?.name || "Various",
            source: 'ai'
          });
        }
      }
    }

    return results;

  } catch (error) {
    console.error("DrugBank API error:", error);
    return [];
  }
};

export const queryChemSpiderAPI = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Querying ChemSpider API for:", term);

  if (!CHEMSPIDER_API_KEY) {
    console.warn("ChemSpider API key not configured, skipping search");
    return [];
  }

  try {
    const searchUrl = `https://www.chemspider.com/Search.asmx/SimpleSearch?query=${encodeURIComponent(term)}&token=${CHEMSPIDER_API_KEY}`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`ChemSpider API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("ChemSpider results:", data.length || 0);

    const results: MedicineResult[] = [];

    if (Array.isArray(data)) {
      for (const compound of data.slice(0, 5)) {
        results.push({
          id: `chemspider-${compound.csid || Math.random().toString(36).substr(2, 9)}`,
          brandName: compound.name || `Compound ${compound.csid}`,
          activeIngredient: term,
          country: "Global",
          manufacturer: "Various",
          source: 'ai'
        });
      }
    }

    return results;

  } catch (error) {
    console.error("ChemSpider API error:", error);
    return [];
  }
};

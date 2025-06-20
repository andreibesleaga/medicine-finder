const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const PERPLEXITY_API_KEY = import.meta.env.VITE_PERPLEXITY_API_KEY;
const DRUGBANK_API_KEY = import.meta.env.VITE_DRUGBANK_API_KEY;
const CHEMSPIDER_API_KEY = import.meta.env.VITE_CHEMSPIDER_API_KEY;
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;

import { MedicineResult } from "@/types/medicine";

export const searchOpenAI = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Searching OpenAI for medicine brands:", term, "in", country || "worldwide");

  if (!OPENAI_API_KEY) {
    console.warn("OpenAI API key not configured, skipping search");
    return [];
  }

  try {
    const countryFilter = country && country !== 'all' ? ` available in ${country}` : ' available worldwide';
    const prompt = `List real brand names for the active pharmaceutical ingredient "${term}"${countryFilter}. 
    Return ONLY a valid JSON array with objects containing exactly these fields:
    - brandName (string): The commercial brand name
    - country (string): Country where it's available
    - manufacturer (string): Company that makes it
    
    Example format: [{"brandName":"Tylenol","country":"United States","manufacturer":"Johnson & Johnson"}]
    
    Limit to maximum 8 results. Return only real, existing medicines.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a pharmaceutical database expert. Provide only factual, real medicine information in valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (content) {
      try {
        // Clean the response to extract JSON
        let jsonStr = content;
        if (content.includes('```json')) {
          jsonStr = content.split('```json')[1].split('```')[0].trim();
        } else if (content.includes('```')) {
          jsonStr = content.split('```')[1].trim();
        }

        const brands = JSON.parse(jsonStr);
        
        if (Array.isArray(brands)) {
          return brands.map((brand: any, index: number) => ({
            id: `openai-${term}-${index}-${Math.random().toString(36).substr(2, 6)}`,
            brandName: brand.brandName || brand.name || 'Unknown',
            activeIngredient: term,
            country: brand.country || country || "Global",
            manufacturer: brand.manufacturer || "Various",
            source: 'ai' as const
          })).filter(result => result.brandName !== 'Unknown');
        }
      } catch (parseError) {
        console.error("Failed to parse OpenAI response:", parseError, "Content:", content);
      }
    }

    return [];

  } catch (error) {
    console.error("OpenAI API error:", error);
    return [];
  }
};

export const searchPerplexity = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Searching Perplexity AI for:", term, "in", country || "worldwide");

  if (!PERPLEXITY_API_KEY) {
    console.warn("Perplexity API key not configured, skipping search");
    return [];
  }

  try {
    const countryFilter = country && country !== 'all' ? ` in ${country}` : ' worldwide';
    const query = `List real brand names for the medicine with active ingredient "${term}"${countryFilter}. Include the manufacturer and country for each brand. Provide factual information only.`;

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
            content: 'You are a pharmaceutical expert. Provide factual medicine information in structured format. Return results as JSON array with brandName, country, manufacturer fields.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
        return_related_questions: false,
        return_images: false
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
      try {
        // Try to extract JSON from the response
        let jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const brands = JSON.parse(jsonMatch[0]);
          return brands.map((brand: any, index: number) => ({
            id: `perplexity-${term}-${index}-${Math.random().toString(36).substr(2, 6)}`,
            brandName: brand.brandName || brand.name,
            activeIngredient: term,
            country: brand.country || country || "Global",
            manufacturer: brand.manufacturer || "Various",
            source: 'ai' as const
          })).filter((result: any) => result.brandName);
        } else {
          // Parse structured text response
          const lines = content.split('\n').filter(line => line.trim());
          const results: MedicineResult[] = [];
          
          for (const line of lines) {
            if (line.includes(':') || line.includes('-')) {
              const brandMatch = line.match(/([A-Z][a-zA-Z]+)/);
              if (brandMatch) {
                results.push({
                  id: `perplexity-text-${Math.random().toString(36).substr(2, 9)}`,
                  brandName: brandMatch[1],
                  activeIngredient: term,
                  country: country || "Global",
                  manufacturer: "Various",
                  source: 'ai'
                });
              }
            }
          }
          
          return results.slice(0, 5);
        }
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

export const searchDeepSeek = async (term: string, country?: string): Promise<MedicineResult[]> => {
  console.log("Searching DeepSeek AI for medicine brands:", term, "in", country || "worldwide");

  if (!DEEPSEEK_API_KEY) {
    console.warn("DeepSeek API key not configured, skipping search");
    return [];
  }

  try {
    const countryFilter = country && country !== 'all' ? ` available in ${country}` : ' available worldwide';
    const prompt = `List real brand names for the active pharmaceutical ingredient "${term}"${countryFilter}. 
    Return ONLY a valid JSON array with objects containing exactly these fields:
    - brandName (string): The commercial brand name
    - country (string): Country where it's available
    - manufacturer (string): Company that makes it
    
    Example format: [{"brandName":"Tylenol","country":"United States","manufacturer":"Johnson & Johnson"}]
    
    Limit to maximum 8 results. Return only real, existing medicines.`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a pharmaceutical database expert. Provide only factual, real medicine information in valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (content) {
      try {
        // Clean the response to extract JSON
        let jsonStr = content;
        if (content.includes('```json')) {
          jsonStr = content.split('```json')[1].split('```')[0].trim();
        } else if (content.includes('```')) {
          jsonStr = content.split('```')[1].trim();
        }

        const brands = JSON.parse(jsonStr);
        
        if (Array.isArray(brands)) {
          return brands.map((brand: any, index: number) => ({
            id: `deepseek-${term}-${index}-${Math.random().toString(36).substr(2, 6)}`,
            brandName: brand.brandName || brand.name || 'Unknown',
            activeIngredient: term,
            country: brand.country || country || "Global",
            manufacturer: brand.manufacturer || "Various",
            source: 'ai' as const
          })).filter(result => result.brandName !== 'Unknown');
        }
      } catch (parseError) {
        console.error("Failed to parse DeepSeek response:", parseError, "Content:", content);
      }
    }

    return [];

  } catch (error) {
    console.error("DeepSeek API error:", error);
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
    // DrugBank API v1 endpoint for drug search
    const searchUrl = `https://go.drugbank.com/api/v1/drugs.json?q=${encodeURIComponent(term)}&exact_match=false`;

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${DRUGBANK_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`DrugBank API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log("DrugBank results:", data.length || 0);

    const results: MedicineResult[] = [];

    if (Array.isArray(data)) {
      for (const drug of data.slice(0, 10)) {
        // Parse drug information
        const brandName = drug.name || drug.brand_names?.[0] || drug.synonyms?.[0];
        const manufacturer = drug.manufacturers?.[0]?.name || 
                           drug.companies?.[0]?.name || 
                           "Various";
        
        if (brandName && brandName.toLowerCase().includes(term.toLowerCase())) {
          results.push({
            id: `drugbank-${drug.drugbank_id || Math.random().toString(36).substr(2, 9)}`,
            brandName: brandName,
            activeIngredient: drug.generic_name || term,
            country: country || "Global",
            manufacturer: manufacturer,
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
    // ChemSpider REST API v1 - Simple Search
    const searchUrl = `https://www.chemspider.com/Search.asmx/SimpleSearch`;

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `query=${encodeURIComponent(term)}&token=${CHEMSPIDER_API_KEY}`
    });

    if (!response.ok) {
      throw new Error(`ChemSpider API error: ${response.status}`);
    }

    const xmlText = await response.text();
    
    // Parse XML response
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const csids = Array.from(xmlDoc.getElementsByTagName('int')).map(el => el.textContent);

    const results: MedicineResult[] = [];

    // Get compound details for each CSID (limit to first 5)
    for (const csid of csids.slice(0, 5)) {
      if (csid) {
        try {
          const detailUrl = `https://www.chemspider.com/Search.asmx/GetCompoundInfo`;
          const detailResponse = await fetch(detailUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `CSID=${csid}&token=${CHEMSPIDER_API_KEY}`
          });

          if (detailResponse.ok) {
            const detailXml = await detailResponse.text();
            const detailDoc = parser.parseFromString(detailXml, 'text/xml');
            const commonName = detailDoc.getElementsByTagName('CommonName')[0]?.textContent;
            
            if (commonName) {
              results.push({
                id: `chemspider-${csid}`,
                brandName: commonName,
                activeIngredient: term,
                country: country || "Global",
                manufacturer: "Various",
                source: 'ai'
              });
            }
          }
        } catch (detailError) {
          console.warn("Error getting ChemSpider compound details:", detailError);
        }
      }
    }

    return results;

  } catch (error) {
    console.error("ChemSpider API error:", error);
    return [];
  }
};


import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { term, country } = await req.json();
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');

    if (!deepseekApiKey) {
      throw new Error('DeepSeek API key not configured');
    }

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
        'Authorization': `Bearer ${deepseekApiKey}`,
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
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    let results = [];
    if (content) {
      try {
        let jsonStr = content;
        if (content.includes('```json')) {
          jsonStr = content.split('```json')[1].split('```')[0].trim();
        } else if (content.includes('```')) {
          jsonStr = content.split('```')[1].trim();
        }

        const brands = JSON.parse(jsonStr);
        
        if (Array.isArray(brands)) {
          results = brands.map((brand, index) => ({
            id: `deepseek-${term}-${index}-${Math.random().toString(36).substr(2, 6)}`,
            brandName: brand.brandName || brand.name || 'Unknown',
            activeIngredient: term,
            country: brand.country || country || "Global",
            manufacturer: brand.manufacturer || "Various",
            source: 'ai'
          })).filter(result => result.brandName !== 'Unknown');
        }
      } catch (parseError) {
        console.error("Failed to parse DeepSeek response:", parseError);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('DeepSeek search error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

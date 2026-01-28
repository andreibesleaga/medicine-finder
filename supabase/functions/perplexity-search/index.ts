
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
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');

    if (!perplexityApiKey) {
      throw new Error('Perplexity API key not configured');
    }

    const countryFilter = country && country !== 'all' ? ` in ${country}` : ' worldwide';
    const query = `List real brand names for the medicine with active ingredient "${term}"${countryFilter}. Include the manufacturer and country for each brand. Provide factual information only.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
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
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let results = [];
    if (content) {
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const brands = JSON.parse(jsonMatch[0]);
          results = brands.map((brand, index) => ({
            id: `perplexity-${term}-${index}-${Math.random().toString(36).substr(2, 6)}`,
            brandName: brand.brandName || brand.name,
            activeIngredient: term,
            country: brand.country || country || "Global",
            manufacturer: brand.manufacturer || "Various",
            source: 'ai'
          })).filter(result => result.brandName);
        }
      } catch (parseError) {
        console.error("Failed to parse Perplexity response:", parseError);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Perplexity search error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

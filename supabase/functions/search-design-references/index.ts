import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Searching design references for:', prompt);

    // Use AI to search and curate design references
    const searchPrompt = `You are a streetwear design curator. Based on the prompt "${prompt}", provide 6 design reference suggestions that would inspire a t-shirt design.

For each suggestion, provide:
1. A title (short, catchy name)
2. A description (what makes this design style appealing)
3. Key visual elements (colors, shapes, typography style)
4. A search query that would find similar designs online
5. Style tags (e.g., "minimalist", "retro", "bold", etc.)

Return as JSON array:
[
  {
    "title": "Design Name",
    "description": "Brief description",
    "visualElements": ["element1", "element2"],
    "searchQuery": "search terms for finding similar designs",
    "tags": ["tag1", "tag2"],
    "colorScheme": ["#hex1", "#hex2", "#hex3"]
  }
]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: searchPrompt
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    console.log('Search references response:', content.substring(0, 200));

    // Parse JSON from response
    let references;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1] || content;
      // Find the array in the response
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        references = JSON.parse(arrayMatch[0]);
      } else {
        references = JSON.parse(jsonStr);
      }
    } catch (parseError) {
      console.error('Failed to parse references:', parseError);
      references = [{
        title: "Custom Design",
        description: content,
        visualElements: ["custom"],
        searchQuery: prompt,
        tags: ["custom"],
        colorScheme: ["#84cc16", "#facc15", "#ec4899"]
      }];
    }

    return new Response(JSON.stringify({ references }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-design-references function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

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

    console.log('Generating design graphic for prompt:', prompt);

    // CRITICAL: Ask for isolated graphic only, NOT a t-shirt mockup
    const enhancedPrompt = `Create an ISOLATED graphic design element for: ${prompt}

IMPORTANT REQUIREMENTS:
- Generate ONLY the graphic/artwork itself - NO t-shirt, NO clothing, NO mockup
- The design should be a standalone illustration, logo, typography, or artwork
- Use a plain solid dark background (dark gray or black) - NOT transparent
- High contrast colors that pop
- Bold, urban streetwear aesthetic
- Clean edges suitable for print
- DO NOT show any clothing items, mannequins, or product mockups
- Just the raw graphic design element that can be placed on apparel

Think of this as creating a sticker, patch, or graphic that would go ON a shirt, not a picture OF a shirt.`;


    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        modalities: ['image', 'text']
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
    console.log('AI response received');

    // Extract images from the response
    const images = data.choices?.[0]?.message?.images || [];
    const textContent = data.choices?.[0]?.message?.content || '';

    if (images.length === 0) {
      console.log('No images generated, returning text response');
      return new Response(JSON.stringify({ 
        images: [],
        description: textContent 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return the generated images
    const imageUrls = images.map((img: any) => img.image_url?.url || '').filter(Boolean);

    return new Response(JSON.stringify({ 
      images: imageUrls,
      description: textContent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-design-image function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

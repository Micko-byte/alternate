-- Create design_templates table for storing community/admin templates
CREATE TABLE public.design_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  preview_url TEXT,
  config JSONB NOT NULL,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.design_templates ENABLE ROW LEVEL SECURITY;

-- Public read access - all users can view templates
CREATE POLICY "Anyone can view templates" 
ON public.design_templates 
FOR SELECT 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_design_templates_updated_at
BEFORE UPDATE ON public.design_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert starter templates
INSERT INTO public.design_templates (name, description, category, config) VALUES
('Minimal', 'Clean centered text', 'streetwear', '{"version":"6.0.0","objects":[{"type":"i-text","left":180,"top":280,"text":"ALTERNATE","fill":"#ffffff","fontFamily":"Bebas Neue","fontSize":56}],"background":"#1a1a1a"}'),
('Bold Stack', 'Stacked bold text', 'streetwear', '{"version":"6.0.0","objects":[{"type":"i-text","left":150,"top":200,"text":"STAY","fill":"#84cc16","fontFamily":"Bebas Neue","fontSize":72},{"type":"i-text","left":150,"top":280,"text":"FRESH","fill":"#ffffff","fontFamily":"Bebas Neue","fontSize":72}],"background":"#1a1a1a"}'),
('Neon Vibe', 'Neon accent style', 'streetwear', '{"version":"6.0.0","objects":[{"type":"rect","left":125,"top":220,"width":250,"height":120,"fill":"transparent","stroke":"#ec4899","strokeWidth":3},{"type":"i-text","left":175,"top":255,"text":"LIMITED","fill":"#ec4899","fontFamily":"Bebas Neue","fontSize":48}],"background":"#1a1a1a"}'),
('Street Badge', 'Urban badge look', 'streetwear', '{"version":"6.0.0","objects":[{"type":"circle","left":175,"top":175,"radius":100,"fill":"transparent","stroke":"#facc15","strokeWidth":4},{"type":"i-text","left":185,"top":250,"text":"AUTHENTIC","fill":"#facc15","fontFamily":"Bebas Neue","fontSize":32},{"type":"i-text","left":215,"top":290,"text":"2024","fill":"#ffffff","fontFamily":"Bebas Neue","fontSize":24}],"background":"#1a1a1a"}'),
('Urban Split', 'Contrast split design', 'streetwear', '{"version":"6.0.0","objects":[{"type":"rect","left":50,"top":200,"width":200,"height":150,"fill":"#84cc16"},{"type":"i-text","left":80,"top":250,"text":"URBAN","fill":"#000000","fontFamily":"Bebas Neue","fontSize":48},{"type":"i-text","left":280,"top":250,"text":"EDGE","fill":"#ffffff","fontFamily":"Bebas Neue","fontSize":48}],"background":"#1a1a1a"}');
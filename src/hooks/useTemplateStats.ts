import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TemplateStats {
  totalTemplates: number;
  premiumCount: number;
  categoryCounts: Record<string, number>;
}

export const useTemplateStats = () => {
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('design_templates')
        .select('*');

      if (error) throw error;

      const categoryCounts: Record<string, number> = {};
      let premiumCount = 0;

      data.forEach(template => {
        categoryCounts[template.category] = (categoryCounts[template.category] || 0) + 1;
        if (template.is_premium) premiumCount++;
      });

      setStats({
        totalTemplates: data.length,
        premiumCount,
        categoryCounts
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, refetch: fetchStats };
};

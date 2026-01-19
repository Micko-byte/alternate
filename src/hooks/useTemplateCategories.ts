import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TemplateCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export const useTemplateCategories = () => {
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('design_templates')
        .select('category');

      if (error) throw error;

      const categoryMap = new Map<string, number>();
      data.forEach(item => {
        const current = categoryMap.get(item.category) || 0;
        categoryMap.set(item.category, current + 1);
      });

      const categoryIcons: Record<string, string> = {
        'streetwear': '👕',
        'minimal': '⚪',
        'vintage': '📻',
        'modern': '⚡',
        'badge': '🏆',
        'text': '📝',
        'geometric': '🔷',
        'nature': '🌿',
        'abstract': '🎨',
        'general': '📦'
      };

      const categoriesArray: TemplateCategory[] = [
        { id: 'all', name: 'All Templates', icon: '🎨', count: data.length }
      ];

      categoryMap.forEach((count, category) => {
        categoriesArray.push({
          id: category,
          name: category.charAt(0).toUpperCase() + category.slice(1),
          icon: categoryIcons[category] || '📦',
          count
        });
      });

      setCategories(categoriesArray);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  return { categories, loading, refetch: fetchCategories };
};

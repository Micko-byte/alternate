import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Template = Tables<'design_templates'>;

export interface TemplateFilters {
  category?: string | null;
  searchQuery?: string;
  premium?: boolean;
  sortBy?: 'recent' | 'name';
}

export const useTemplateFilters = (initialFilters?: TemplateFilters) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<TemplateFilters>({
    category: null,
    searchQuery: '',
    premium: undefined,
    sortBy: 'recent',
    ...initialFilters
  });

  useEffect(() => {
    fetchTemplates();
  }, [
    filters.category,
    filters.searchQuery,
    filters.premium,
    filters.sortBy
  ]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('design_templates')
        .select('*');

      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }
      
      if (filters.premium !== undefined) {
        query = query.eq('is_premium', filters.premium);
      }
      
      if (filters.searchQuery && filters.searchQuery.trim() !== '') {
        query = query.or(`name.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`);
      }

      switch (filters.sortBy) {
        case 'recent':
          query = query.order('created_at', { ascending: false });
          break;
        case 'name':
          query = query.order('name', { ascending: true });
          break;
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      
      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = <K extends keyof TemplateFilters>(
    key: K,
    value: TemplateFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const updateFilters = (newFilters: Partial<TemplateFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters({
      category: null,
      searchQuery: '',
      premium: undefined,
      sortBy: 'recent'
    });
  };

  const categories = useMemo(() => {
    const uniqueCategories = new Set(templates.map(t => t.category));
    return Array.from(uniqueCategories);
  }, [templates]);

  return {
    templates,
    loading,
    error,
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
    refetch: fetchTemplates,
    categories
  };
};

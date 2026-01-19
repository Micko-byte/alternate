import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Json } from '@/integrations/supabase/types';

type SavedDesign = Tables<'saved_designs'>;

export interface DesignObject {
  id: number;
  type: 'text' | 'shape' | 'icon' | 'image';
  x: number;
  y: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  shape?: 'rect' | 'circle';
  width?: number;
  height?: number;
  radius?: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  icon?: string;
  size?: number;
}

export interface ZoneDesigns {
  front?: DesignObject[];
  back?: DesignObject[];
  leftSleeve?: DesignObject[];
  rightSleeve?: DesignObject[];
  shirtColor?: string;
  shirtStyle?: string;
}

export const useMyDesigns = () => {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMyDesigns();
  }, []);

  const loadMyDesigns = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDesigns([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('saved_designs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      setDesigns(data || []);
    } catch (err) {
      console.error('Error loading designs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load designs');
    } finally {
      setLoading(false);
    }
  };

  const saveDesign = async (
    name: string,
    zoneDesigns: ZoneDesigns
  ): Promise<SavedDesign> => {
    try {
      setSaving(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Must be logged in to save designs');

      const { data, error } = await supabase
        .from('saved_designs')
        .insert({
          user_id: user.id,
          name,
          design_json: JSON.parse(JSON.stringify(zoneDesigns)) as Json
        })
        .select()
        .single();

      if (error) throw error;

      setDesigns(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Error saving design:', err);
      setError(err instanceof Error ? err.message : 'Failed to save design');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const updateDesign = async (
    designId: string,
    updates: { name?: string; design_json?: ZoneDesigns }
  ): Promise<void> => {
    try {
      setSaving(true);
      setError(null);

      const updateData: Record<string, unknown> = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.design_json) updateData.design_json = updates.design_json;

      const { error } = await supabase
        .from('saved_designs')
        .update(updateData)
        .eq('id', designId);

      if (error) throw error;

      setDesigns(prev => 
        prev.map(d => d.id === designId ? { ...d, ...updateData } as SavedDesign : d)
      );
    } catch (err) {
      console.error('Error updating design:', err);
      setError(err instanceof Error ? err.message : 'Failed to update design');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const deleteDesign = async (designId: string): Promise<void> => {
    try {
      setError(null);

      const { error } = await supabase
        .from('saved_designs')
        .delete()
        .eq('id', designId);

      if (error) throw error;

      setDesigns(prev => prev.filter(d => d.id !== designId));
    } catch (err) {
      console.error('Error deleting design:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete design');
      throw err;
    }
  };

  const duplicateDesign = async (designId: string): Promise<SavedDesign> => {
    try {
      setSaving(true);
      setError(null);

      const original = designs.find(d => d.id === designId);
      if (!original) throw new Error('Design not found');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Must be logged in');

      const { data, error } = await supabase
        .from('saved_designs')
        .insert({
          user_id: user.id,
          name: `${original.name} (Copy)`,
          design_json: original.design_json as Json
        })
        .select()
        .single();

      if (error) throw error;

      setDesigns(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Error duplicating design:', err);
      setError(err instanceof Error ? err.message : 'Failed to duplicate design');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const loadDesign = async (designId: string): Promise<SavedDesign> => {
    try {
      const { data, error } = await supabase
        .from('saved_designs')
        .select('*')
        .eq('id', designId)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error loading design:', err);
      throw err;
    }
  };

  const getDesignZones = (design: SavedDesign): ZoneDesigns => {
    return design.design_json as unknown as ZoneDesigns;
  };

  return {
    designs,
    loading,
    saving,
    error,
    saveDesign,
    updateDesign,
    deleteDesign,
    duplicateDesign,
    loadDesign,
    getDesignZones,
    refetch: loadMyDesigns
  };
};

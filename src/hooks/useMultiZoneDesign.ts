import { useState, useCallback } from 'react';

export type ShirtZone = 'front' | 'back' | 'leftSleeve' | 'rightSleeve';

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
  imageUrl?: string;
}

interface ZoneDesigns {
  front: DesignObject[];
  back: DesignObject[];
  leftSleeve: DesignObject[];
  rightSleeve: DesignObject[];
}

export const useMultiZoneDesign = () => {
  const [activeZone, setActiveZone] = useState<ShirtZone>('front');
  const [zoneDesigns, setZoneDesigns] = useState<ZoneDesigns>({
    front: [],
    back: [],
    leftSleeve: [],
    rightSleeve: []
  });

  const currentDesign = zoneDesigns[activeZone];

  const updateCurrentZone = useCallback((objects: DesignObject[]) => {
    setZoneDesigns(prev => ({
      ...prev,
      [activeZone]: objects
    }));
  }, [activeZone]);

  const updateZone = useCallback((zone: ShirtZone, objects: DesignObject[]) => {
    setZoneDesigns(prev => ({
      ...prev,
      [zone]: objects
    }));
  }, []);

  const clearCurrentZone = useCallback(() => {
    updateCurrentZone([]);
  }, [updateCurrentZone]);

  const clearAllZones = useCallback(() => {
    setZoneDesigns({
      front: [],
      back: [],
      leftSleeve: [],
      rightSleeve: []
    });
  }, []);

  const copyZone = useCallback((fromZone: ShirtZone, toZone: ShirtZone) => {
    setZoneDesigns(prev => ({
      ...prev,
      [toZone]: [...prev[fromZone]]
    }));
  }, []);

  const hasAnyContent = Object.values(zoneDesigns).some(design => design.length > 0);

  const zoneHasContent = (zone: ShirtZone) => zoneDesigns[zone].length > 0;

  const contentZoneCount = Object.values(zoneDesigns).filter(d => d.length > 0).length;

  return {
    activeZone,
    setActiveZone,
    zoneDesigns,
    currentDesign,
    updateCurrentZone,
    updateZone,
    clearCurrentZone,
    clearAllZones,
    copyZone,
    hasAnyContent,
    zoneHasContent,
    contentZoneCount
  };
};

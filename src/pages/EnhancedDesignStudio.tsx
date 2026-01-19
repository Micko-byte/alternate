import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Type, Image, Palette, Layout, Save, Download, Shirt, Copy, Trash2, 
  ArrowUp, ArrowDown, Undo2, Redo2, Plus, Circle, Square, Search,
  Filter, X, Star, RotateCw, AlignCenter, AlignLeft, AlignRight,
  ZoomIn, ZoomOut, Grid3x3, Lock, Unlock, Eye, EyeOff, Layers
} from 'lucide-react';

import { useTemplateFilters } from '@/hooks/useTemplateFilters';
import { useTemplateCategories } from '@/hooks/useTemplateCategories';
import { useMyDesigns } from '@/hooks/useMyDesigns';
import { useTemplateActions } from '@/hooks/useTemplateActions';
import { useMultiZoneDesign } from '@/hooks/useMultiZoneDesign';
import type { DesignObject } from '@/hooks/useMultiZoneDesign';

const EnhancedDesignStudio = () => {
  // UI State
  const [activeTab, setActiveTab] = useState('templates');
  const [activeColor, setActiveColor] = useState('#84cc16');
  const [shirtColor, setShirtColor] = useState('#1a1a1a');
  const [showLayers, setShowLayers] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(1);
  
  // Canvas State
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasContext, setCanvasContext] = useState<CanvasRenderingContext2D | null>(null);
  const [selectedObject, setSelectedObject] = useState<DesignObject | null>(null);
  const [hoveredObject, setHoveredObject] = useState<DesignObject | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // History
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // API Hooks
  const multiZone = useMultiZoneDesign();
  const { categories } = useTemplateCategories();
  const { 
    templates, 
    loading: templatesLoading, 
    filters,
    updateFilter,
  } = useTemplateFilters();
  
  const {
    saveDesign,
  } = useMyDesigns();

  const { useTemplate } = useTemplateActions();

  const zoneDimensions = {
    front: { width: 500, height: 600, label: 'Front' },
    back: { width: 500, height: 600, label: 'Back' },
    leftSleeve: { width: 300, height: 400, label: 'Left Sleeve' },
    rightSleeve: { width: 300, height: 400, label: 'Right Sleeve' }
  };

  const currentDimensions = zoneDimensions[multiZone.activeZone];
  const objects = multiZone.currentDesign;

  // Initialize canvas
  useEffect(() => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    canvas.width = currentDimensions.width;
    canvas.height = currentDimensions.height;
    
    const ctx = canvas.getContext('2d');
    setCanvasContext(ctx);

    if (ctx) {
      renderCanvas(ctx);
    }
  }, [multiZone.activeZone, showGrid]);

  // Render objects
  useEffect(() => {
    if (canvasContext && activeCanvasRef.current) {
      renderCanvas(canvasContext);
    }
  }, [objects, selectedObject, hoveredObject, canvasContext, showGrid]);

  const renderCanvas = (ctx: CanvasRenderingContext2D) => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (showGrid) {
      drawGrid(ctx, canvas.width, canvas.height);
    }

    drawCenterGuides(ctx, canvas.width, canvas.height);

    objects.forEach(obj => {
      const isSelected = obj.id === selectedObject?.id;
      const isHovered = obj.id === hoveredObject?.id;
      drawObject(ctx, obj, isSelected, isHovered);
    });

    if (selectedObject) {
      drawSelectionHandles(ctx, selectedObject);
    }
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= width; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  const drawCenterGuides = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = 'rgba(132, 204, 22, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    ctx.setLineDash([]);
  };

  const drawObject = (
    ctx: CanvasRenderingContext2D, 
    obj: DesignObject, 
    isSelected: boolean,
    isHovered: boolean
  ) => {
    ctx.save();

    if (obj.type === 'text' && obj.text) {
      ctx.font = `${obj.fontSize || 48}px ${obj.fontFamily || 'Arial Black'}`;
      ctx.fillStyle = obj.fill;
      ctx.textAlign = 'left';
      ctx.fillText(obj.text, obj.x, obj.y);

      if (isSelected || isHovered) {
        const metrics = ctx.measureText(obj.text);
        const width = metrics.width;
        const height = obj.fontSize || 48;
        ctx.strokeStyle = isSelected ? '#84cc16' : 'rgba(132, 204, 22, 0.5)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(obj.x - 5, obj.y - height - 5, width + 10, height + 10);
      }
    } else if (obj.type === 'shape') {
      ctx.fillStyle = obj.fill;
      ctx.strokeStyle = obj.stroke || obj.fill;
      ctx.lineWidth = obj.strokeWidth || 0;

      if (obj.shape === 'circle' && obj.radius) {
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
        ctx.fill();
        if (obj.strokeWidth) ctx.stroke();

        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? '#84cc16' : 'rgba(132, 204, 22, 0.5)';
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, obj.radius + 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (obj.shape === 'rect' && obj.width && obj.height) {
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        if (obj.strokeWidth) ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? '#84cc16' : 'rgba(132, 204, 22, 0.5)';
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.strokeRect(obj.x - 5, obj.y - 5, obj.width + 10, obj.height + 10);
        }
      }
    } else if (obj.type === 'icon' && obj.icon) {
      const iconSize = obj.size || 100;
      ctx.fillStyle = obj.fill;
      ctx.font = `${iconSize}px Arial`;
      ctx.fillText(obj.icon, obj.x, obj.y);

      if (isSelected || isHovered) {
        ctx.strokeStyle = isSelected ? '#84cc16' : 'rgba(132, 204, 22, 0.5)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(obj.x - 5, obj.y - iconSize - 5, iconSize + 10, iconSize + 10);
      }
    }

    ctx.restore();
  };

  const drawSelectionHandles = (ctx: CanvasRenderingContext2D, obj: DesignObject) => {
    const bounds = getObjectBounds(obj);
    if (!bounds) return;

    const handleSize = 8;
    const handles = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x, y: bounds.y + bounds.height },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    ];

    ctx.fillStyle = '#84cc16';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;

    handles.forEach(handle => {
      ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    });
  };

  const getObjectBounds = (obj: DesignObject) => {
    if (!canvasContext) return null;

    if (obj.type === 'text' && obj.text) {
      canvasContext.font = `${obj.fontSize || 48}px ${obj.fontFamily || 'Arial Black'}`;
      const metrics = canvasContext.measureText(obj.text);
      return {
        x: obj.x,
        y: obj.y - (obj.fontSize || 48),
        width: metrics.width,
        height: obj.fontSize || 48
      };
    } else if (obj.type === 'shape' && obj.shape === 'rect') {
      return {
        x: obj.x,
        y: obj.y,
        width: obj.width || 100,
        height: obj.height || 100
      };
    } else if (obj.type === 'shape' && obj.shape === 'circle') {
      return {
        x: obj.x - (obj.radius || 50),
        y: obj.y - (obj.radius || 50),
        width: (obj.radius || 50) * 2,
        height: (obj.radius || 50) * 2
      };
    }
    return null;
  };

  const addText = (text = 'ALTERNATE') => {
    const newObj: DesignObject = {
      id: Date.now(),
      type: 'text',
      text,
      x: currentDimensions.width / 2 - 100,
      y: currentDimensions.height / 2,
      fontSize: 56,
      fontFamily: 'Arial Black',
      fill: activeColor
    };
    multiZone.updateCurrentZone([...objects, newObj]);
    setSelectedObject(newObj);
    saveHistory();
  };

  const addShape = (shape: 'rect' | 'circle') => {
    const newObj: DesignObject = {
      id: Date.now(),
      type: 'shape',
      shape,
      x: currentDimensions.width / 2 - 50,
      y: currentDimensions.height / 2 - 50,
      width: shape === 'rect' ? 100 : undefined,
      height: shape === 'rect' ? 100 : undefined,
      radius: shape === 'circle' ? 50 : undefined,
      fill: activeColor,
      stroke: activeColor,
      strokeWidth: 0
    };
    multiZone.updateCurrentZone([...objects, newObj]);
    setSelectedObject(newObj);
    saveHistory();
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const canvas = activeCanvasRef.current;
    if (!canvas || !canvasContext) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / canvasZoom;
    const y = (e.clientY - rect.top) / canvasZoom;

    const clicked = [...objects].reverse().find(obj => isPointInObject(x, y, obj));

    if (clicked) {
      setSelectedObject(clicked);
      setIsDragging(true);
      setDragOffset({
        x: x - clicked.x,
        y: y - clicked.y
      });
    } else {
      setSelectedObject(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / canvasZoom;
    const y = (e.clientY - rect.top) / canvasZoom;

    const hovered = [...objects].reverse().find(obj => isPointInObject(x, y, obj));
    setHoveredObject(hovered || null);
    canvas.style.cursor = hovered ? 'move' : 'default';

    if (!isDragging || !selectedObject) return;

    const snappedX = showGrid ? Math.round((x - dragOffset.x) / 25) * 25 : x - dragOffset.x;
    const snappedY = showGrid ? Math.round((y - dragOffset.y) / 25) * 25 : y - dragOffset.y;

    multiZone.updateCurrentZone(
      objects.map(obj => 
        obj.id === selectedObject.id 
          ? { ...obj, x: snappedX, y: snappedY }
          : obj
      )
    );
  };

  const handleCanvasMouseUp = () => {
    if (isDragging) {
      saveHistory();
    }
    setIsDragging(false);
  };

  const isPointInObject = (x: number, y: number, obj: DesignObject): boolean => {
    const bounds = getObjectBounds(obj);
    if (!bounds) return false;

    return x >= bounds.x && x <= bounds.x + bounds.width &&
           y >= bounds.y && y <= bounds.y + bounds.height;
  };

  const deleteSelected = () => {
    if (!selectedObject) return;
    multiZone.updateCurrentZone(objects.filter(obj => obj.id !== selectedObject.id));
    setSelectedObject(null);
    saveHistory();
  };

  const duplicateSelected = () => {
    if (!selectedObject) return;
    const newObj: DesignObject = {
      ...selectedObject,
      id: Date.now(),
      x: selectedObject.x + 20,
      y: selectedObject.y + 20
    };
    multiZone.updateCurrentZone([...objects, newObj]);
    setSelectedObject(newObj);
    saveHistory();
  };

  const bringToFront = () => {
    if (!selectedObject) return;
    const filtered = objects.filter(obj => obj.id !== selectedObject.id);
    multiZone.updateCurrentZone([...filtered, selectedObject]);
    saveHistory();
  };

  const sendToBack = () => {
    if (!selectedObject) return;
    const filtered = objects.filter(obj => obj.id !== selectedObject.id);
    multiZone.updateCurrentZone([selectedObject, ...filtered]);
    saveHistory();
  };

  const alignCenter = () => {
    if (!selectedObject) return;
    const bounds = getObjectBounds(selectedObject);
    if (!bounds) return;
    
    multiZone.updateCurrentZone(
      objects.map(obj => 
        obj.id === selectedObject.id 
          ? { ...obj, x: currentDimensions.width / 2 - bounds.width / 2 }
          : obj
      )
    );
    saveHistory();
  };

  const saveHistory = () => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(JSON.stringify(objects));
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      multiZone.updateCurrentZone(JSON.parse(history[historyStep - 1]));
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      multiZone.updateCurrentZone(JSON.parse(history[historyStep + 1]));
    }
  };

  const loadTemplateHandler = async (template: any) => {
    if (template.config) {
      multiZone.updateCurrentZone(template.config);
    }
    setSelectedObject(null);
    await useTemplate(template.id);
    saveHistory();
  };

  const handleSaveDesign = async () => {
    const name = prompt('Enter a name for your design:');
    if (!name) return;

    try {
      await saveDesign(name, multiZone.zoneDesigns);
      alert('Design saved!');
    } catch (error) {
      alert('Failed to save. Please sign in.');
    }
  };

  const colorPalettes = {
    'Streetwear': ['#84CC16', '#000000', '#FFFFFF', '#EF4444', '#F97316'],
    'Neon': ['#FF0099', '#00F5FF', '#FFFF00', '#FF6600', '#9D00FF'],
    'Pastel': ['#FFB5E8', '#B5DEFF', '#85E3FF', '#BFFCC6', '#FFC9DE'],
  };

  const shirtColors = [
    { id: 'black', name: 'Black', hex: '#1a1a1a' },
    { id: 'white', name: 'White', hex: '#f5f5f5' },
    { id: 'grey', name: 'Grey', hex: '#6b7280' },
    { id: 'navy', name: 'Navy', hex: '#1e3a5f' },
    { id: 'lime', name: 'Lime', hex: '#84cc16' },
  ];

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
      {/* Top Nav */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-lime-500 rounded-lg flex items-center justify-center">
              <span className="font-black text-black text-sm">A</span>
            </div>
            <span className="font-bold">ALTERNATE</span>
          </Link>
          <span className="text-zinc-500 text-sm">Design Studio Pro</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDesign}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center gap-2 text-sm"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          <button className="px-4 py-2 bg-lime-500 hover:bg-lime-400 text-black rounded-lg flex items-center gap-2 text-sm font-medium">
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-72 border-r border-zinc-800 bg-zinc-900 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
              {[
                { id: 'templates', icon: Layout, label: 'Templates' },
                { id: 'text', icon: Type, label: 'Text' },
                { id: 'graphics', icon: Image, label: 'Graphics' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center gap-1 py-2 px-3 rounded flex-1 text-xs ${
                    activeTab === tab.id ? 'bg-zinc-950' : 'hover:bg-zinc-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'templates' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={filters.searchQuery || ''}
                    onChange={(e) => updateFilter('searchQuery', e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm"
                  />
                </div>

                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => updateFilter('category', cat.id === 'all' ? null : cat.id)}
                        className={`px-2 py-1.5 rounded text-xs ${
                          (filters.category === cat.id || (!filters.category && cat.id === 'all'))
                            ? 'bg-lime-500 text-black'
                            : 'bg-zinc-800 hover:bg-zinc-700'
                        }`}
                      >
                        {cat.icon} {cat.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {templatesLoading ? (
                    <p className="col-span-2 text-center text-zinc-500 py-8">Loading...</p>
                  ) : templates.length === 0 ? (
                    <div className="col-span-2 text-center text-zinc-500 py-8">
                      No templates
                    </div>
                  ) : (
                    templates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => loadTemplateHandler(template)}
                        className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 hover:border-lime-500"
                      >
                        <div className="aspect-square bg-zinc-900 rounded mb-2 flex items-center justify-center text-2xl">
                          🎨
                        </div>
                        <p className="text-xs truncate">{template.name}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'text' && (
              <div className="space-y-3">
                <button
                  onClick={() => addText()}
                  className="w-full py-3 bg-lime-500 text-black hover:bg-lime-400 rounded-lg flex items-center justify-center gap-2 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Text
                </button>

                {selectedObject?.type === 'text' && (
                  <div className="space-y-3 p-3 bg-zinc-800 rounded-lg">
                    <input
                      value={selectedObject.text || ''}
                      onChange={(e) => {
                        multiZone.updateCurrentZone(
                          objects.map(obj => 
                            obj.id === selectedObject.id 
                              ? { ...obj, text: e.target.value }
                              : obj
                          )
                        );
                      }}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-sm"
                      placeholder="Enter text..."
                    />
                    
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-zinc-400">Size</label>
                        <input
                          type="range"
                          min="12"
                          max="120"
                          value={selectedObject.fontSize || 48}
                          onChange={(e) => {
                            multiZone.updateCurrentZone(
                              objects.map(obj => 
                                obj.id === selectedObject.id 
                                  ? { ...obj, fontSize: parseInt(e.target.value) }
                                  : obj
                              )
                            );
                          }}
                          className="w-full"
                        />
                        <span className="text-xs text-zinc-500">{selectedObject.fontSize}px</span>
                      </div>
                      
                      <div>
                        <label className="text-xs text-zinc-400">Font</label>
                        <select
                          value={selectedObject.fontFamily || 'Arial Black'}
                          onChange={(e) => {
                            multiZone.updateCurrentZone(
                              objects.map(obj => 
                                obj.id === selectedObject.id 
                                  ? { ...obj, fontFamily: e.target.value }
                                  : obj
                              )
                            );
                          }}
                          className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-xs"
                        >
                          <option>Arial Black</option>
                          <option>Impact</option>
                          <option>Georgia</option>
                          <option>Courier New</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'graphics' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => addShape('rect')}
                    className="aspect-square flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700"
                  >
                    <Square className="w-8 h-8" />
                  </button>
                  <button
                    onClick={() => addShape('circle')}
                    className="aspect-square flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700"
                  >
                    <Circle className="w-8 h-8" />
                  </button>
                </div>
              </div>
            )}

            {/* Colors */}
            <div className="border-t border-zinc-800 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Palette className="w-4 h-4 text-lime-500" />
                <span className="text-sm font-medium">Colors</span>
              </div>
              {Object.entries(colorPalettes).map(([name, colors]) => (
                <div key={name} className="mb-3">
                  <p className="text-xs text-zinc-500 mb-1">{name}</p>
                  <div className="flex gap-1">
                    {colors.map(color => (
                      <button
                        key={color}
                        onClick={() => {
                          setActiveColor(color);
                          if (selectedObject) {
                            multiZone.updateCurrentZone(
                              objects.map(obj => 
                                obj.id === selectedObject.id 
                                  ? { ...obj, fill: color }
                                  : obj
                              )
                            );
                          }
                        }}
                        className={`flex-1 h-8 rounded border-2 ${
                          activeColor === color ? 'border-lime-400' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 flex flex-col bg-zinc-950">
          {/* Toolbar */}
          <div className="h-12 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-4">
            <div className="flex items-center gap-1">
              <button
                onClick={undo}
                disabled={historyStep <= 0}
                className="p-2 hover:bg-zinc-800 rounded disabled:opacity-30"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={redo}
                disabled={historyStep >= history.length - 1}
                className="p-2 hover:bg-zinc-800 rounded disabled:opacity-30"
              >
                <Redo2 className="w-4 h-4" />
              </button>

              <div className="w-px h-6 bg-zinc-700 mx-2" />

              {selectedObject && (
                <>
                  <button onClick={duplicateSelected} className="p-2 hover:bg-zinc-800 rounded" title="Duplicate">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={deleteSelected} className="p-2 hover:bg-zinc-800 rounded" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  
                  <div className="w-px h-6 bg-zinc-700 mx-2" />
                  
                  <button onClick={bringToFront} className="p-2 hover:bg-zinc-800 rounded" title="Bring to Front">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button onClick={sendToBack} className="p-2 hover:bg-zinc-800 rounded" title="Send to Back">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  
                  <div className="w-px h-6 bg-zinc-700 mx-2" />
                  
                  <button onClick={alignCenter} className="p-2 hover:bg-zinc-800 rounded" title="Center">
                    <AlignCenter className="w-4 h-4" />
                  </button>
                </>
              )}

              <div className="w-px h-6 bg-zinc-700 mx-2" />

              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-2 rounded ${showGrid ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`}
                title="Toggle Grid"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
            </div>

            {/* Zone Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Zone:</span>
              {Object.entries(zoneDimensions).map(([zone, { label }]) => (
                <button
                  key={zone}
                  onClick={() => multiZone.setActiveZone(zone as any)}
                  className={`px-3 py-1.5 text-xs rounded ${
                    multiZone.activeZone === zone
                      ? 'bg-lime-500 text-black'
                      : 'bg-zinc-800 hover:bg-zinc-700'
                  }`}
                >
                  {label}
                  {multiZone.zoneHasContent(zone as any) && ' ✓'}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 p-8 overflow-auto bg-zinc-900/50 flex items-center justify-center">
            <div className="relative">
              <canvas
                ref={activeCanvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                className="rounded-lg shadow-2xl border border-zinc-700"
                style={{
                  backgroundColor: '#1a1a1a',
                  transform: `scale(${canvasZoom})`,
                  transformOrigin: 'center center'
                }}
              />
              
              <div className="absolute -bottom-8 left-0 right-0 text-center text-xs text-zinc-500">
                {currentDimensions.width} × {currentDimensions.height}px • {currentDimensions.label}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-zinc-800 bg-zinc-900 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Layers Panel */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Layers ({objects.length})
                </h3>
                <button
                  onClick={() => setShowLayers(!showLayers)}
                  className="p-1 hover:bg-zinc-800 rounded"
                >
                  {showLayers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
              {showLayers && (
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {objects.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-4">No layers yet</p>
                  ) : (
                    [...objects].reverse().map((obj, index) => (
                      <button
                        key={obj.id}
                        onClick={() => setSelectedObject(obj)}
                        className={`w-full p-2 text-left rounded text-sm ${
                          selectedObject?.id === obj.id
                            ? 'bg-lime-500 text-black'
                            : 'bg-zinc-800 hover:bg-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {obj.type === 'text' && <Type className="w-3 h-3" />}
                          {obj.type === 'shape' && <Square className="w-3 h-3" />}
                          {obj.type === 'icon' && <Star className="w-3 h-3" />}
                          <span className="flex-1 truncate">
                            {obj.type === 'text' ? obj.text : `${obj.type} ${objects.length - index}`}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="border-t border-zinc-800 pt-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Shirt className="w-4 h-4" />
                Preview
              </h3>
              
              <div
                className="relative aspect-square rounded-lg border border-zinc-700 mb-3"
                style={{ backgroundColor: shirtColor }}
              >
                <svg viewBox="0 0 200 220" className="absolute inset-0 w-full h-full opacity-20">
                  <path d="M60 30 L30 50 L30 80 L50 80 L50 200 L150 200 L150 80 L170 80 L170 50 L140 30 L120 40 L80 40 L60 30" fill="none" stroke="currentColor" strokeWidth="1" />
                </svg>
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-2 block">T-Shirt Color</label>
                <div className="flex gap-2">
                  {shirtColors.map(color => (
                    <button
                      key={color.id}
                      onClick={() => setShirtColor(color.hex)}
                      className={`w-10 h-10 rounded-full border-2 ${
                        shirtColor === color.hex ? 'border-lime-400' : 'border-zinc-700'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-3 p-3 bg-zinc-800 rounded text-xs">
                <p className="text-zinc-400">
                  Zones with content: <span className="text-lime-400 font-bold">{multiZone.contentZoneCount}/4</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedDesignStudio;

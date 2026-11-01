import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  QuadripolePoint,
  estimate2DInversion,
  getCalibratedColor,
  getContourTickValues,
  ColorScaleConfig,
  MiningTargetAnomaly,
} from '../utils/ert-math';
import { FieldNote } from './FieldNotesModal';
import { IPDecayCurveView } from './IPDecayCurveView';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  Zap,
  Mountain,
  Palette,
  Target,
  Sparkles,
  Gauge,
  Sliders,
  Crosshair,
  Compass,
} from 'lucide-react';
import { beeper } from '../utils/audio-beeper';

interface PseudosectionProps {
  points: QuadripolePoint[];
  totalElectrodes: number;
  spacing: number;
  activeElectrodes: { tx: number[]; rx: number[] };
  selectedPoint: QuadripolePoint | null;
  onSelectPoint: (p: QuadripolePoint | null) => void;
  viewMode: 'rho' | 'ip';
  onToggleViewMode: (mode: 'rho' | 'ip') => void;
  errorThreshold: number;
  isSunlightMode: boolean;
  fieldNotes?: FieldNote[];
  lastBatch?: QuadripolePoint[];
}

export const Pseudosection: React.FC<PseudosectionProps> = ({
  points,
  totalElectrodes,
  spacing,
  activeElectrodes,
  selectedPoint,
  onSelectPoint,
  viewMode,
  onToggleViewMode,
  errorThreshold,
  isSunlightMode,
  fieldNotes = [],
  lastBatch = [],
}) => {
  const [zoom, setZoom] = useState(1);
  const [filterHighError, setFilterHighError] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<QuadripolePoint | null>(null);

  // Visualization modes: 'points' | 'mesh' | 'inversion'
  const [displayMode, setDisplayMode] = useState<'points' | 'mesh' | 'inversion'>('inversion');
  // Variable: 'rho' (Resistivity) | 'ip' (Chargeability) | 'sp' (Self Potential)
  const [activeVariable, setActiveVariable] = useState<'rho' | 'ip' | 'sp'>(viewMode === 'ip' ? 'ip' : 'rho');

  // Exact Color Calibration State
  const [paletteType, setPaletteType] = useState<'geophysical_mining' | 'sulfide_metallic' | 'turbo' | 'viridis'>('geophysical_mining');
  const [contourMode, setContourMode] = useState<'discrete' | 'smooth'>('discrete');
  const [rangePreset, setRangePreset] = useState<'auto' | 'sulfides' | 'veins' | 'porphyry' | 'custom'>('auto');
  const [customMin, setCustomMin] = useState<number>(1);
  const [customMax, setCustomMax] = useState<number>(5000);
  const [showColorControls, setShowColorControls] = useState(false);

  // Inversion parameters
  const [inversionIters, setInversionIters] = useState<1 | 3 | 5>(3);
  const [showMiningTargets, setShowMiningTargets] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState<MiningTargetAnomaly | null>(null);

  const [withTopography, setWithTopography] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isIPDecayOpen, setIsIPDecayOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 750, height: 280 });

  useEffect(() => {
    beeper.enabled = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    setActiveVariable(viewMode === 'ip' ? 'ip' : 'rho');
  }, [viewMode]);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          setDimensions({ width: w, height: h });
        }
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const lineLength = (totalElectrodes - 1) * spacing;

  const filteredPoints = useMemo(() => {
    if (!filterHighError) return points;
    return points.filter((p) => p.err <= errorThreshold);
  }, [points, filterHighError, errorThreshold]);

  // Full 2D Inversion computation with iterative Gauss-Newton L2 solver
  const inversionResult = useMemo(() => {
    return estimate2DInversion(filteredPoints, { iterations: inversionIters });
  }, [filteredPoints, inversionIters]);

  const inversionPoints = inversionResult.points;
  const miningTargets = inversionResult.targets;

  const maxZ = useMemo(() => {
    if (points.length === 0) return 35;
    const baseZ = Math.max(...points.map((p) => p.z), 25);
    return displayMode === 'inversion' ? baseZ * 1.15 : baseZ;
  }, [points, displayMode]);

  // Dynamic vs Preset Min/Max Calculation for EXACT color reproduction
  const { minBound, maxBound, isLogScale } = useMemo(() => {
    if (activeVariable === 'sp') {
      return { minBound: -100, maxBound: 20, isLogScale: false };
    }

    if (activeVariable === 'ip') {
      if (rangePreset === 'custom') return { minBound: customMin, maxBound: customMax, isLogScale: false };
      return { minBound: 0, maxBound: 65, isLogScale: false };
    }

    // Resistivity (Rho)
    if (rangePreset === 'sulfides') {
      return { minBound: 0.5, maxBound: 2500, isLogScale: true };
    }
    if (rangePreset === 'veins') {
      return { minBound: 10, maxBound: 15000, isLogScale: true };
    }
    if (rangePreset === 'porphyry') {
      return { minBound: 5, maxBound: 4500, isLogScale: true };
    }
    if (rangePreset === 'custom') {
      return { minBound: Math.max(0.1, customMin), maxBound: Math.max(customMin * 1.5, customMax), isLogScale: true };
    }

    // AUTO RANGE: Use 2nd and 98th percentile to prevent extreme single outliers from crushing the color palette
    const values = displayMode === 'inversion'
      ? inversionPoints.map((p) => p.trueRho).filter((v) => v > 0)
      : filteredPoints.map((p) => p.rho).filter((v) => v > 0);

    if (values.length === 0) {
      return { minBound: 1, maxBound: 5000, isLogScale: true };
    }

    values.sort((a, b) => a - b);
    const p2Idx = Math.floor(values.length * 0.02);
    const p98Idx = Math.floor(values.length * 0.98);
    const p2 = Math.max(0.2, values[p2Idx] ?? values[0]);
    const p98 = Math.max(p2 * 2, values[p98Idx] ?? values[values.length - 1]);

    return { minBound: p2, maxBound: p98, isLogScale: true };
  }, [activeVariable, rangePreset, customMin, customMax, displayMode, inversionPoints, filteredPoints]);

  const colorConfig: ColorScaleConfig = useMemo(() => ({
    palette: paletteType,
    isLog: isLogScale,
    minVal: minBound,
    maxVal: maxBound,
    discreteSteps: contourMode === 'discrete' ? 10 : 0,
  }), [paletteType, isLogScale, minBound, maxBound, contourMode]);

  const colorTicks = useMemo(() => {
    return getContourTickValues(minBound, maxBound, 8, isLogScale);
  }, [minBound, maxBound, isLogScale]);

  const getColor = (val: number) => {
    return getCalibratedColor(val, colorConfig, isSunlightMode);
  };

  const padLeft = dimensions.width < 500 ? 30 : 54;
  const padRight = dimensions.width < 500 ? 12 : 36;
  const padTop = dimensions.height < 240 ? 14 : 28;
  const padBottom = dimensions.height < 240 ? 16 : 30;

  const plotW = Math.max(100, dimensions.width - padLeft - padRight);
  const plotH = Math.max(60, dimensions.height - padTop - padBottom);

  const scaleX = (x: number) => padLeft + (x / Math.max(10, lineLength)) * plotW;
  const scaleY = (z: number, topoOffset = 0) => {
    const base = padTop + (z / Math.max(5, maxZ)) * plotH;
    return withTopography ? base + topoOffset : base;
  };

  // 2D Continuous Geological Contour Mesh Generator
  const contourCells = useMemo(() => {
    if (displayMode === 'points' || filteredPoints.length < 8) return [];
    const cols = dimensions.width < 500 ? 24 : 44;
    const rows = dimensions.height < 240 ? 8 : 14;
    const cellW = plotW / cols;
    const cellH = plotH / rows;
    const cells: { x: number; y: number; w: number; h: number; color: string; val: number }[] = [];

    const activeDataset = displayMode === 'inversion' ? inversionPoints : filteredPoints;

    for (let c = 0; c < cols; c++) {
      const realX = ((c + 0.5) / cols) * lineLength;
      for (let r = 0; r < rows; r++) {
        const realZ = ((r + 0.5) / rows) * maxZ;

        let weightSum = 0;
        let valSum = 0;
        for (let i = 0; i < activeDataset.length; i++) {
          const pt = activeDataset[i];
          const ptZ = displayMode === 'inversion' ? (pt as any).depthZ : pt.z;
          const distSq = Math.pow(pt.x - realX, 2) + Math.pow((ptZ - realZ) * 2.2, 2);
          if (distSq < 1e-4) {
            valSum = displayMode === 'inversion'
              ? activeVariable === 'rho' ? (pt as any).trueRho : activeVariable === 'ip' ? (pt as any).trueIP : (pt.sp || 0)
              : activeVariable === 'rho' ? pt.rho : activeVariable === 'ip' ? (pt.ip ?? 0) : (pt.sp || 0);
            weightSum = 1;
            break;
          }
          const w = 1 / Math.pow(distSq, 1.25);
          weightSum += w;
          const v = displayMode === 'inversion'
            ? activeVariable === 'rho' ? (pt as any).trueRho : activeVariable === 'ip' ? (pt as any).trueIP : (pt.sp || 0)
            : activeVariable === 'rho' ? pt.rho : activeVariable === 'ip' ? (pt.ip ?? 0) : (pt.sp || 0);
          valSum += w * v;
        }

        const interpolatedVal = weightSum > 0 ? valSum / weightSum : 100;

        cells.push({
          x: padLeft + c * cellW,
          y: padTop + r * cellH,
          w: cellW + 0.5,
          h: cellH + 0.5,
          color: getColor(interpolatedVal),
          val: interpolatedVal,
        });
      }
    }
    return cells;
  }, [displayMode, filteredPoints, inversionPoints, dimensions, plotW, plotH, lineLength, maxZ, activeVariable, colorConfig, isSunlightMode]);

  const activeInspection = hoveredPoint || selectedPoint;

  // Quadripole electrode positions on cable for the inspected point
  const inspectedElectrodes = useMemo(() => {
    if (!activeInspection || !activeInspection.p || activeInspection.p.length < 4) return null;
    const [a, b, m, n] = activeInspection.p;
    return {
      aX: a > 0 ? scaleX((a - 1) * spacing) : null,
      bX: b > 0 ? scaleX((b - 1) * spacing) : null,
      mX: scaleX((m - 1) * spacing),
      nX: scaleX((n - 1) * spacing),
      a, b, m, n,
    };
  }, [activeInspection, spacing, padLeft, plotW, lineLength]);

  return (
    <div
      className={`flex-1 min-h-0 flex flex-col rounded-xl border transition-colors shadow-2xl overflow-hidden select-none ${
        isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#070b13] border-[#18273d] text-[#e2ecf8]'
      }`}
    >
      {/* 1. Precision Top Control Strip */}
      <div
        className={`px-2 sm:px-3 py-1 flex items-center justify-between gap-1 sm:gap-2 border-b shrink-0 overflow-x-auto no-scrollbar ${
          isSunlightMode ? 'border-black bg-slate-100' : 'border-[#152338] bg-[#09111c]'
        }`}
      >
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Active Variable Switcher */}
          <div
            className={`flex rounded-md p-0.5 border ${
              isSunlightMode ? 'bg-slate-200 border-black' : 'bg-[#0d1624] border-[#1b2b41]'
            }`}
          >
            <button
              onClick={() => {
                setActiveVariable('rho');
                onToggleViewMode('rho');
              }}
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold transition-all cursor-pointer ${
                activeVariable === 'rho'
                  ? isSunlightMode
                    ? 'bg-black text-white'
                    : 'bg-cyan-600 text-white shadow-sm'
                  : 'opacity-70 hover:opacity-100'
              }`}
              title="Resistividad Eléctrica (Ohm-m)"
            >
              ρ <span className="hidden xs:inline">Resist</span>
            </button>
            <button
              onClick={() => {
                setActiveVariable('ip');
                onToggleViewMode('ip');
              }}
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold transition-all cursor-pointer ${
                activeVariable === 'ip'
                  ? isSunlightMode
                    ? 'bg-black text-white'
                    : 'bg-purple-600 text-white shadow-sm'
                  : 'opacity-70 hover:opacity-100'
              }`}
              title="Polarización Inducida / Cargabilidad (mV/V)"
            >
              Ma <span className="hidden xs:inline">IP</span>
            </button>
            <button
              onClick={() => setActiveVariable('sp')}
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold transition-all cursor-pointer ${
                activeVariable === 'sp'
                  ? isSunlightMode
                    ? 'bg-black text-white'
                    : 'bg-emerald-600 text-white shadow-sm'
                  : 'opacity-70 hover:opacity-100'
              }`}
              title="Auto-Potencial Natural (mV)"
            >
              SP
            </button>
          </div>

          {/* Model Status Pill */}
          <span
            className={`hidden md:flex text-[9px] font-mono px-2 py-0.5 rounded border font-bold items-center gap-1 ${
              isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#101b2c] border-[#1d2f4a] text-cyan-300'
            }`}
          >
            <Compass className="w-2.5 h-2.5 text-cyan-400" />
            <span>
              {displayMode === 'inversion'
                ? `RMS: ${inversionResult.rmsError}%`
                : displayMode === 'mesh'
                ? 'Malla'
                : 'Puntos'}
            </span>
          </span>
        </div>

        {/* Toolbar Segmented Controls */}
        <div className="flex items-center gap-1 shrink-0 text-[10px] font-mono">
          {/* Display Mode: Ptos / Malla / Inversión 2D */}
          <div
            className={`flex rounded-md p-0.5 border ${
              isSunlightMode ? 'bg-slate-200 border-black' : 'bg-[#0d1624] border-[#1b2b41]'
            }`}
          >
            <button
              onClick={() => setDisplayMode('points')}
              className={`px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-bold transition-all cursor-pointer ${
                displayMode === 'points'
                  ? isSunlightMode ? 'bg-black text-white' : 'bg-sky-600 text-white'
                  : 'opacity-70 hover:opacity-100'
              }`}
              title="Puntos de medición cuadripolar discretos"
            >
              Ptos
            </button>
            <button
              onClick={() => setDisplayMode('mesh')}
              className={`px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-bold transition-all cursor-pointer ${
                displayMode === 'mesh'
                  ? isSunlightMode ? 'bg-black text-white' : 'bg-emerald-600 text-white'
                  : 'opacity-70 hover:opacity-100'
              }`}
              title="Malla continua 2D interpolada"
            >
              Malla
            </button>
            <button
              onClick={() => setDisplayMode('inversion')}
              className={`px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-bold transition-all cursor-pointer flex items-center gap-0.5 ${
                displayMode === 'inversion'
                  ? isSunlightMode ? 'bg-black text-white' : 'bg-purple-600 text-white'
                  : 'opacity-70 hover:opacity-100'
              }`}
              title="Inversión Gauss-Newton L2"
            >
              <Sparkles className="w-2.5 h-2.5 text-amber-300" />
              <span>Inv</span>
            </button>
          </div>

          {/* Iteration Selector when in Inversion Mode */}
          {displayMode === 'inversion' && (
            <div
              className={`flex items-center rounded-md border p-0.5 ${
                isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1624] border-[#1b2b41]'
              }`}
            >
              {[1, 3, 5].map((it) => (
                <button
                  key={it}
                  onClick={() => setInversionIters(it as 1 | 3 | 5)}
                  className={`px-1 py-0.5 rounded text-[8.5px] font-bold ${
                    inversionIters === it
                      ? isSunlightMode ? 'bg-black text-white' : 'bg-amber-600 text-white'
                      : 'opacity-60'
                  }`}
                  title={`${it} iteraciones`}
                >
                  {it}
                </button>
              ))}
            </div>
          )}

          {/* Mining Target Anomaly Toggle */}
          <button
            onClick={() => setShowMiningTargets(!showMiningTargets)}
            className={`px-1.5 py-0.5 rounded border text-[8.5px] sm:text-[9px] font-bold flex items-center gap-0.5 cursor-pointer transition-colors ${
              showMiningTargets
                ? isSunlightMode
                  ? 'bg-amber-400 text-black border-black font-extrabold'
                  : 'bg-amber-500/30 text-amber-300 border-amber-500'
                : 'opacity-70 hover:opacity-100'
            }`}
            title="Blancos Mineros"
          >
            <Target className="w-2.5 h-2.5 text-amber-400" />
            <span>({miningTargets.length})</span>
          </button>

          {/* Color & Calibration Settings Drawer Toggle */}
          <button
            onClick={() => setShowColorControls(!showColorControls)}
            className={`px-1.5 py-0.5 rounded border text-[8.5px] sm:text-[9px] font-bold flex items-center gap-0.5 cursor-pointer transition-colors ${
              showColorControls
                ? isSunlightMode ? 'bg-black text-white border-black' : 'bg-cyan-600 text-white border-cyan-400'
                : 'opacity-70 hover:opacity-100'
            }`}
            title="Ajuste de Paleta y Escala"
          >
            <Palette className="w-2.5 h-2.5 text-cyan-400" />
            <span className="hidden sm:inline">Colores</span>
          </button>

          {/* Stepper Zoom */}
          <div
            className={`flex items-center gap-0.5 border rounded-md px-1 py-0.5 ${
              isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1624] border-[#1b2b41]'
            }`}
          >
            <button
              onClick={() => setZoom((z) => Math.max(0.8, Number((z - 0.2).toFixed(1))))}
              className="px-0.5 font-bold hover:text-cyan-400 cursor-pointer"
            >
              -
            </button>
            <span className="text-[8px] sm:text-[8.5px] font-bold min-w-[22px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.2).toFixed(1))))}
              className="px-0.5 font-bold hover:text-cyan-400 cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      </div>


      {/* 2. Color Calibration Panel (When Opened) */}
      {showColorControls && (
        <div
          className={`px-3 py-2 border-b text-[10px] font-mono flex flex-wrap items-center justify-between gap-3 shrink-0 transition-all ${
            isSunlightMode ? 'bg-slate-200 border-black text-black' : 'bg-[#0c1424] border-[#1b2e49] text-slate-200'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-cyan-400 uppercase">Paleta Geocientífica:</span>
            <select
              value={paletteType}
              onChange={(e) => setPaletteType(e.target.value as any)}
              className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#080e18] border-[#22395b] text-white'
              }`}
            >
              <option value="geophysical_mining">Geofísica Minera Estándar (EarthImager/Res2DInv)</option>
              <option value="sulfide_metallic">Sulfuros & Metálicos (Alto Contraste)</option>
              <option value="turbo">Turbo Geocientífico (Uniforme)</option>
              <option value="viridis">Viridis Calibrado (Daltónicos/Técnico)</option>
            </select>

            <span className="opacity-40">│</span>

            <span className="font-bold text-cyan-400 uppercase">Intervalos:</span>
            <div
              className={`flex rounded border p-0.5 ${
                isSunlightMode ? 'bg-white border-black' : 'bg-[#080e18] border-[#22395b]'
              }`}
            >
              <button
                onClick={() => setContourMode('discrete')}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  contourMode === 'discrete'
                    ? isSunlightMode ? 'bg-black text-white' : 'bg-cyan-600 text-white'
                    : 'opacity-70 hover:opacity-100'
                }`}
                title="10 escalones de contorno discretos calibrados con etiquetas exactas"
              >
                10 Contornos
              </button>
              <button
                onClick={() => setContourMode('smooth')}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  contourMode === 'smooth'
                    ? isSunlightMode ? 'bg-black text-white' : 'bg-cyan-600 text-white'
                    : 'opacity-70 hover:opacity-100'
                }`}
                title="Gradiente continuo continuo"
              >
                Continuo
              </button>
            </div>

            <span className="opacity-40">│</span>

            <span className="font-bold text-cyan-400 uppercase">Rango Escala:</span>
            <select
              value={rangePreset}
              onChange={(e) => setRangePreset(e.target.value as any)}
              className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#080e18] border-[#22395b] text-white'
              }`}
            >
              <option value="auto">Auto (Percentil P2 - P98 de datos)</option>
              <option value="sulfides">Sulfuros & Masivos (0.5 - 2,500 Ω·m)</option>
              <option value="veins">Vetas & Silicificación (10 - 15,000 Ω·m)</option>
              <option value="porphyry">Pórfidos Cu-Au (5 - 4,500 Ω·m)</option>
              <option value="custom">Rango Manual Libre</option>
            </select>

            {rangePreset === 'custom' && (
              <div className="flex items-center gap-1">
                <span>Min:</span>
                <input
                  type="number"
                  value={customMin}
                  onChange={(e) => setCustomMin(Number(e.target.value))}
                  className="w-16 px-1 rounded border bg-black text-white text-[9px]"
                />
                <span>Max:</span>
                <input
                  type="number"
                  value={customMax}
                  onChange={(e) => setCustomMax(Number(e.target.value))}
                  className="w-16 px-1 rounded border bg-black text-white text-[9px]"
                />
              </div>
            )}
          </div>

          <button
            onClick={() => setShowColorControls(false)}
            className="text-[9px] underline opacity-75 hover:opacity-100 cursor-pointer"
          >
            Ocultar Ajustes
          </button>
        </div>
      )}

      {/* 3. Surface Multi-Conductor Cable & Electrode Status Line */}
      <div
        className={`px-2 sm:px-3 py-0.5 sm:py-1 border-b flex items-center justify-between text-[8.5px] sm:text-[9px] font-mono shrink-0 overflow-hidden whitespace-nowrap ${
          isSunlightMode ? 'bg-slate-200 border-black text-black' : 'bg-[#070b13] border-[#131f31] text-[#93a7c2]'
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-3 truncate">
          <div className="flex items-center gap-1 font-bold shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse inline-block" />
            <span className="hidden sm:inline">CABLE {totalElectrodes}P (Δa={spacing}m):</span>
            <span className="sm:hidden">{totalElectrodes}P:</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-[8px] sm:text-[8.5px]">
            <span className="flex items-center gap-0.5 text-red-500 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              Tx
            </span>
            <span className="flex items-center gap-0.5 text-cyan-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
              Rx
            </span>
            {displayMode === 'inversion' && (
              <span className="text-purple-400 font-bold truncate">
                ● L2 (RMS {inversionResult.rmsError}%)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 font-bold shrink-0 text-[8px] sm:text-[9px]">
          <span className="text-amber-400">{lineLength}m</span>
        </div>
      </div>

      {/* 4. Main Tomogram Graph Stage */}
      <div ref={containerRef} className="flex-1 min-h-0 relative w-full h-full overflow-hidden bg-carbon-texture">
        {/* Floating Precision Telemetry HUD Card */}
        {activeInspection && (
          <div
            className={`absolute top-2 right-2 z-20 p-2 sm:p-2.5 rounded-xl border text-[9px] sm:text-[10px] font-mono shadow-2xl transition-all max-w-[280px] ${
              isSunlightMode
                ? 'bg-white/95 border-black text-black ring-1 ring-black/10'
                : 'bg-[#080e18]/95 backdrop-blur-md border-cyan-500/50 text-slate-100 shadow-cyan-950/60 ring-1 ring-cyan-500/20'
            }`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-cyan-500/30 pb-1 mb-1 font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-cyan-400 uppercase">Pto #{activeInspection.id}</span>
              </div>
              <span className="text-amber-400 text-xs font-black">
                {activeVariable === 'rho'
                  ? displayMode === 'inversion'
                    ? `${(activeInspection as any).trueRho ?? activeInspection.rho} Ω·m`
                    : `${activeInspection.rho} Ω·m`
                  : activeVariable === 'ip'
                  ? `${displayMode === 'inversion' ? (activeInspection as any).trueIP ?? activeInspection.ip : activeInspection.ip || 0} mV/V`
                  : `${activeInspection.sp || 0} mV`}
              </span>
              {selectedPoint && (
                <button
                  onClick={() => onSelectPoint(null)}
                  className="opacity-70 hover:opacity-100 p-0.5 hover:bg-slate-700/50 rounded cursor-pointer"
                  title="Cerrar inspección"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
              <div>
                <span className="opacity-60">X:</span> <strong>{activeInspection.x}m</strong>
              </div>
              <div>
                <span className="opacity-60">Z:</span>{' '}
                <strong>-{displayMode === 'inversion' ? (activeInspection as any).depthZ ?? activeInspection.z : activeInspection.z}m</strong>
              </div>
              <div>
                <span className="opacity-60">Vp:</span> <strong>{activeInspection.v} mV</strong>
              </div>
              <div>
                <span className="opacity-60">In:</span> <strong>{activeInspection.i} mA</strong>
              </div>
              <div>
                <span className="opacity-60">Picas:</span>{' '}
                <strong className="text-cyan-300">
                  {activeInspection.p ? `${activeInspection.p[0]}-${activeInspection.p[1]} / ${activeInspection.p[2]}-${activeInspection.p[3]}` : '--'}
                </strong>
              </div>
              <div>
                <span className="opacity-60">Error:</span>{' '}
                <strong className={activeInspection.err > errorThreshold ? 'text-rose-400' : 'text-emerald-400'}>
                  {activeInspection.err}%
                </strong>
              </div>
            </div>

            {/* Mining Diagnosis Badge in HUD */}
            {activeInspection.anomalyTag && (
              <div className="mt-1.5 pt-1 border-t border-cyan-500/20 text-[9px]">
                <span className="text-amber-400 font-bold block">{activeInspection.anomalyTag}</span>
              </div>
            )}
          </div>
        )}

        {/* Selected Mining Target Details Overlay Card */}
        {selectedTarget && (
          <div
            className={`absolute bottom-2 left-2 z-20 p-3 rounded-xl border text-[10px] font-mono shadow-2xl max-w-sm ${
              isSunlightMode ? 'bg-amber-50 border-black text-black' : 'bg-[#0f1728]/95 border-amber-500/50 text-white shadow-amber-950/40'
            }`}
          >
            <div className="flex items-center justify-between pb-1 border-b border-amber-500/30 mb-1.5 font-bold">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Target className="w-3.5 h-3.5" />
                {selectedTarget.title}
              </span>
              <button onClick={() => setSelectedTarget(null)} className="p-0.5 hover:bg-slate-700/50 rounded">
                ✕
              </button>
            </div>
            <div className="space-y-1 text-[9px]">
              <div className="flex justify-between">
                <span className="opacity-70">Ubicación X:</span>
                <strong>{selectedTarget.xRange[0]}m a {selectedTarget.xRange[1]}m</strong>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Profundidad Z:</span>
                <strong>-{selectedTarget.zRange[0]}m a -{selectedTarget.zRange[1]}m</strong>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Pico de Respuesta:</span>
                <strong>{selectedTarget.peakRho} Ω·m {selectedTarget.peakIP ? `· ${selectedTarget.peakIP} mV/V` : ''}</strong>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Certeza Geológica:</span>
                <strong className="text-emerald-400">{selectedTarget.confidence}%</strong>
              </div>
              <p className="text-[9px] opacity-90 mt-1 italic leading-tight text-amber-200">
                {selectedTarget.drillRecommendation}
              </p>
            </div>
          </div>
        )}

        {/* SVG Container with zoom transform */}
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: '100%', height: '100%' }}
          className="transition-transform duration-100"
        >
          <svg
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="w-full h-full cursor-crosshair"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              {/* Inverted trapezoid theoretical depth coverage mask */}
              <clipPath id="coverageClip">
                <polygon
                  points={`
                    ${padLeft},${padTop}
                    ${dimensions.width - padRight},${padTop}
                    ${dimensions.width - padRight - plotW * 0.18},${dimensions.height - padBottom}
                    ${padLeft + plotW * 0.18},${dimensions.height - padBottom}
                  `}
                />
              </clipPath>
            </defs>

            {/* Base Background */}
            <rect
              x="0"
              y="0"
              width={dimensions.width}
              height={dimensions.height}
              fill={isSunlightMode ? '#ffffff' : '#070b13'}
            />

            {/* Continuous Contour Mesh with theoretical depth clipping */}
            {displayMode !== 'points' && (
              <g clipPath="url(#coverageClip)" opacity="0.94">
                {contourCells.map((cell, idx) => (
                  <rect key={idx} x={cell.x} y={cell.y} width={cell.w} height={cell.h} fill={cell.color} />
                ))}
              </g>
            )}

            {/* Inverted Trapezoid Boundary Outline */}
            <polygon
              points={`
                ${padLeft},${padTop}
                ${dimensions.width - padRight},${padTop}
                ${dimensions.width - padRight - plotW * 0.18},${dimensions.height - padBottom}
                ${padLeft + plotW * 0.18},${dimensions.height - padBottom}
              `}
              fill="none"
              stroke={isSunlightMode ? '#94a3b8' : '#1a283e'}
              strokeDasharray="4 4"
              strokeWidth="1.2"
            />

            {/* Depth Lines (Z) */}
            {[5, 10, 15, 20, 25, 30].map((zVal) => {
              if (zVal > maxZ + 2) return null;
              const y = scaleY(zVal);
              return (
                <g key={`z-${zVal}`}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={dimensions.width - padRight}
                    y2={y}
                    stroke={isSunlightMode ? '#cbd5e1' : '#142033'}
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill={isSunlightMode ? '#000000' : '#718ba8'}
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="600"
                  >
                    -{zVal}m
                  </text>
                </g>
              );
            })}

            {/* Distance Gridlines (X) */}
            {Array.from({ length: Math.floor(lineLength / (dimensions.width < 500 ? 50 : 25)) + 1 }).map((_, i) => {
              const xVal = i * (dimensions.width < 500 ? 50 : 25);
              const x = scaleX(xVal);
              return (
                <g key={`x-${xVal}`}>
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={dimensions.height - padBottom}
                    stroke={isSunlightMode ? '#cbd5e1' : '#142033'}
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={dimensions.height - padBottom + 12}
                    textAnchor="middle"
                    fill={isSunlightMode ? '#000000' : '#718ba8'}
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="600"
                  >
                    {xVal}m
                  </text>
                </g>
              );
            })}

            {/* Mining Target Anomaly Bounding Overlays */}
            {showMiningTargets &&
              miningTargets.map((target) => {
                const x1 = scaleX(target.xRange[0]);
                const x2 = scaleX(target.xRange[1]);
                const y1 = scaleY(target.zRange[0]);
                const y2 = scaleY(target.zRange[1]);
                const w = Math.max(14, x2 - x1);
                const h = Math.max(12, y2 - y1);
                const isTargetSelected = selectedTarget?.id === target.id;

                return (
                  <g
                    key={target.id}
                    onClick={() => setSelectedTarget(isTargetSelected ? null : target)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={x1}
                      y={y1}
                      width={w}
                      height={h}
                      fill="none"
                      stroke={isTargetSelected ? '#fbbf24' : '#f59e0b'}
                      strokeWidth={isTargetSelected ? 2.5 : 1.5}
                      strokeDasharray="3 3"
                      rx="4"
                    />
                    {/* Drill Target Crosshair */}
                    <circle cx={x1 + w / 2} cy={y1 + h / 2} r="5" fill="#f59e0b" fillOpacity="0.25" stroke="#f59e0b" strokeWidth="1.2" />
                    <line x1={x1 + w / 2 - 8} y1={y1 + h / 2} x2={x1 + w / 2 + 8} y2={y1 + h / 2} stroke="#f59e0b" strokeWidth="1.2" />
                    <line x1={x1 + w / 2} y1={y1 + h / 2 - 8} x2={x1 + w / 2} y2={y1 + h / 2 + 8} stroke="#f59e0b" strokeWidth="1.2" />

                    <text
                      x={x1 + w / 2}
                      y={y1 - 3}
                      textAnchor="middle"
                      fill="#f59e0b"
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      🎯 {target.type === 'massive_sulfide' ? 'SULFURO' : target.type === 'quartz_vein' ? 'VETA' : 'PÓRFIDO'}
                    </text>
                  </g>
                );
              })}

            {/* Surface Line with physical Cable rendering */}
            <line
              x1={padLeft}
              y1={padTop}
              x2={dimensions.width - padRight}
              y2={padTop}
              stroke={isSunlightMode ? '#000000' : '#38bdf8'}
              strokeWidth="2.5"
            />
            <text
              x={padLeft - 6}
              y={padTop + 3}
              textAnchor="end"
              fill={isSunlightMode ? '#000000' : '#38bdf8'}
              fontSize="8.5"
              fontWeight="bold"
              fontFamily="monospace"
            >
              0.0m
            </text>

            {/* Electrodes on Cable */}
            {Array.from({ length: totalElectrodes }).map((_, idx) => {
              const elNum = idx + 1;
              const elX = scaleX(idx * spacing);
              const isTx = activeElectrodes.tx.includes(elNum);
              const isRx = activeElectrodes.rx.includes(elNum);
              const isInspected =
                inspectedElectrodes &&
                (inspectedElectrodes.a === elNum ||
                  inspectedElectrodes.b === elNum ||
                  inspectedElectrodes.m === elNum ||
                  inspectedElectrodes.n === elNum);

              let fillColor = isSunlightMode ? '#475569' : '#334155';
              let r = 2;
              if (isTx) {
                fillColor = '#ef4444';
                r = 4;
              } else if (isRx) {
                fillColor = '#38bdf8';
                r = 3.5;
              } else if (isInspected) {
                fillColor = '#f59e0b';
                r = 3.5;
              }

              return (
                <g key={`el-${elNum}`}>
                  <circle
                    cx={elX}
                    cy={padTop}
                    r={r}
                    fill={fillColor}
                    stroke={isSunlightMode ? '#000000' : '#080d16'}
                    strokeWidth="1"
                  />
                  {(elNum === 1 || elNum === totalElectrodes || elNum % 10 === 0) && (
                    <text
                      x={elX}
                      y={padTop - 6}
                      textAnchor="middle"
                      fill={isSunlightMode ? '#000000' : '#718ba8'}
                      fontSize="7.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {elNum}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Quadripole Geometric Ray Paths to Inspected Point */}
            {inspectedElectrodes && activeInspection && (
              <g opacity="0.85">
                {inspectedElectrodes.aX !== null && (
                  <line
                    x1={inspectedElectrodes.aX}
                    y1={padTop}
                    x2={scaleX(activeInspection.x)}
                    y2={scaleY(displayMode === 'inversion' ? (activeInspection as any).depthZ ?? activeInspection.z : activeInspection.z)}
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                )}
                {inspectedElectrodes.bX !== null && (
                  <line
                    x1={inspectedElectrodes.bX}
                    y1={padTop}
                    x2={scaleX(activeInspection.x)}
                    y2={scaleY(displayMode === 'inversion' ? (activeInspection as any).depthZ ?? activeInspection.z : activeInspection.z)}
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                )}
                <line
                  x1={inspectedElectrodes.mX}
                  y1={padTop}
                  x2={scaleX(activeInspection.x)}
                  y2={scaleY(displayMode === 'inversion' ? (activeInspection as any).depthZ ?? activeInspection.z : activeInspection.z)}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <line
                  x1={inspectedElectrodes.nX}
                  y1={padTop}
                  x2={scaleX(activeInspection.x)}
                  y2={scaleY(displayMode === 'inversion' ? (activeInspection as any).depthZ ?? activeInspection.z : activeInspection.z)}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              </g>
            )}

            {/* Measured Quadripole Data Points (When in Points or Inversion Overlay) */}
            {displayMode !== 'mesh' &&
              (displayMode === 'inversion' ? inversionPoints : filteredPoints).map((pt) => {
                const cx = scaleX(pt.x);
                const cy = scaleY(displayMode === 'inversion' ? (pt as any).depthZ ?? pt.z : pt.z);
                const isSelected = selectedPoint?.id === pt.id;
                const isHighErr = pt.err > errorThreshold;

                const valToColor =
                  activeVariable === 'rho'
                    ? displayMode === 'inversion' ? (pt as any).trueRho ?? pt.rho : pt.rho
                    : activeVariable === 'ip'
                    ? displayMode === 'inversion' ? (pt as any).trueIP ?? pt.ip : (pt.ip ?? 0)
                    : (pt.sp || 0);

                const color = getColor(valToColor);

                return (
                  <g
                    key={pt.id}
                    onClick={() => onSelectPoint(isSelected ? null : pt)}
                    onMouseEnter={() => setHoveredPoint(pt)}
                    className="cursor-pointer"
                  >
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={dimensions.width < 500 ? 7 : 9}
                        fill="none"
                        stroke={isSunlightMode ? '#000000' : '#38bdf8'}
                        strokeWidth="2.5"
                      />
                    )}

                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? (dimensions.width < 500 ? 4.5 : 6) : dimensions.width < 500 ? 3.2 : 4.4}
                      fill={color}
                      stroke={isHighErr ? '#ef4444' : isSunlightMode ? '#000000' : '#070b13'}
                      strokeWidth={isHighErr || isSunlightMode ? 1.5 : 0.8}
                    />

                    {!isSunlightMode && (
                      <circle
                        cx={cx - 1}
                        cy={cy - 1}
                        r={dimensions.width < 500 ? 1 : 1.5}
                        fill="#ffffff"
                        opacity="0.6"
                      />
                    )}
                  </g>
                );
              })}
          </svg>
        </div>
      </div>

      {/* 5. Precision Geophysical Colorbar & Calibration Strip (Single-line mobile-fitted) */}
      <div
        className={`px-2 py-1 sm:px-3 sm:py-1.5 border-t flex items-center justify-between text-[8px] sm:text-[9px] font-mono shrink-0 gap-1.5 overflow-x-auto no-scrollbar ${
          isSunlightMode ? 'bg-slate-200 border-black text-black' : 'bg-[#070b13] border-[#131f31] text-[#93a7c2]'
        }`}
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-bold tracking-tight text-slate-300 whitespace-nowrap">
            {activeVariable === 'rho'
              ? displayMode === 'inversion' ? 'ρtrue (Ω·m):' : 'ρa (Ω·m):'
              : activeVariable === 'ip'
              ? displayMode === 'inversion' ? 'IP true (mV/V):' : 'IP app (mV/V):'
              : 'SP (mV):'}
          </span>

          {/* Stepped Exact Contours Bar */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <span className="text-sky-400 font-bold">{colorTicks[0]}</span>
            <div className="flex h-2.5 sm:h-3 rounded border border-slate-700 overflow-hidden shadow-inner">
              {colorTicks.slice(0, -1).map((tick, i) => {
                const nextTick = colorTicks[i + 1];
                const midVal = (tick + nextTick) / 2;
                return (
                  <div
                    key={i}
                    style={{ backgroundColor: getColor(midVal) }}
                    className="w-3 xs:w-4 sm:w-6 h-full flex items-center justify-center border-r border-black/30 last:border-r-0"
                    title={`Intervalo: ${tick} a ${nextTick}`}
                  />
                );
              })}
            </div>
            <span className="text-purple-400 font-bold">{colorTicks[colorTicks.length - 1]}</span>
          </div>

          <span className="text-[7.5px] sm:text-[8px] opacity-70 hidden xs:inline">
            ({contourMode === 'discrete' ? '10 Contornos' : 'Gradiente'})
          </span>
        </div>

        {/* Lithological Mining Indicators (Compact on mobile) */}
        <div className="hidden sm:flex items-center gap-2 font-semibold text-[8px] sm:text-[8.5px] shrink-0">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0a228c] inline-block shadow-sm" />
            Sulfuros (&lt;15 Ω·m)
          </span>
          <span className="opacity-30">│</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] inline-block" />
            Alteración
          </span>
          <span className="opacity-30">│</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] inline-block shadow-sm" />
            Intrusivo
          </span>
          <span className="opacity-30">│</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9333ea] inline-block shadow-sm" />
            Cuarzo (&gt;3500 Ω·m)
          </span>
        </div>
      </div>

      {/* IP Decay Curve Modal */}
      {isIPDecayOpen && (
        <IPDecayCurveView
          batch={lastBatch.length > 0 ? lastBatch : points.slice(-8)}
          isSunlightMode={isSunlightMode}
          onClose={() => setIsIPDecayOpen(false)}
        />
      )}
    </div>
  );
};

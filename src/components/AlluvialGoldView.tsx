import React, { useState, useMemo, useRef, useEffect } from 'react';
import { QuadripolePoint, estimate2DInversion } from '../utils/ert-math';
import {
  Pickaxe,
  Waves,
  Mountain,
  Compass,
  Layers,
  Sparkles,
  Target,
  Calculator,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Info,
  Maximize2,
  Minimize2,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface AlluvialGoldViewProps {
  points: QuadripolePoint[];
  totalElectrodes: number;
  spacing: number;
  isSunlightMode: boolean;
  jobName: string;
}

export const AlluvialGoldView: React.FC<AlluvialGoldViewProps> = ({
  points,
  totalElectrodes,
  spacing,
  isSunlightMode,
  jobName,
}) => {
  const [selectedPothole, setSelectedPothole] = useState<number | null>(null);
  const [estimatedGradeGPerM3, setEstimatedGradeGPerM3] = useState<number>(0.85); // Grams per m3 baseline
  const [trenchWidthM, setTrenchWidthM] = useState<number>(20); // Width of mining cut
  const [selectedStation, setSelectedStation] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 850, height: 320 });

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

  // Run 2D inversion to get true resistivities
  const inversion = useMemo(() => {
    return estimate2DInversion(points, { iterations: 3 });
  }, [points]);

  const activePoints = inversion.points.length > 0 ? inversion.points : points;

  // 1. Calculate Alluvial Facies & Bedrock Topography Profile
  // Stratigraphic Facies:
  // - Overburden (Sobrecarga de Limo y Arcilla): 15 - 55 Ohm-m (Shallow)
  // - Gold-bearing Gravels (Gravas y Arenas Gruesas del Paleocanal): 120 - 750 Ohm-m (Medium depth)
  // - Bedrock Floor (Piso de Roca Madre / Esquistos o Granito): > 900 Ohm-m or sudden resistivity boundary
  const profileStations = useMemo(() => {
    const numStations = Math.min(60, Math.floor(lineLength / Math.max(2, spacing)));
    const stations: {
      x: number;
      overburdenDepth: number;
      gravelBaseDepth: number;
      bedrockDepth: number;
      gravelThickness: number;
      hasHeavySandTrap: boolean;
      potholeScour: boolean;
      trapQuality: 'ALTA' | 'MEDIA' | 'BAJA';
      suggestedPits: boolean;
    }[] = [];

    for (let i = 0; i < numStations; i++) {
      const x = (i / (numStations - 1)) * lineLength;
      const normX = lineLength > 0 ? x / lineLength : 0.5;

      // Realistic bedrock topography with ancient river paleomeander channels and potholes
      // Main channel scour around 30% - 48% of the valley and 70% - 82%
      const channel1Dist = Math.abs(normX - 0.38);
      const channel2Dist = Math.abs(normX - 0.74);

      let bedrockD = 12 + 6 * Math.sin(normX * 6.28);
      if (channel1Dist < 0.18) {
        // Deep ancient thalweg / paleocanal
        bedrockD += 11.5 * Math.exp(-(channel1Dist * channel1Dist) / 0.008);
      }
      if (channel2Dist < 0.12) {
        // Secondary terrace paleochannel
        bedrockD += 8.2 * Math.exp(-(channel2Dist * channel2Dist) / 0.005);
      }

      // Overburden (silt and clay cap) thickness
      const overD = Math.max(1.8, 3.5 + 2.0 * Math.cos(normX * 4) + (channel1Dist < 0.1 ? 1.5 : 0));
      const gravelThick = Math.max(1.2, bedrockD - overD);

      // Traps (potholes and bedrock riffles where heavy gold deposits)
      const potholeScour = channel1Dist < 0.06 || channel2Dist < 0.04;
      const hasHeavySandTrap = potholeScour || (normX > 0.35 && normX < 0.42);
      const trapQuality: 'ALTA' | 'MEDIA' | 'BAJA' = potholeScour ? 'ALTA' : hasHeavySandTrap ? 'MEDIA' : 'BAJA';

      stations.push({
        x: Number(x.toFixed(1)),
        overburdenDepth: Number(overD.toFixed(1)),
        gravelBaseDepth: Number(bedrockD.toFixed(1)),
        bedrockDepth: Number(bedrockD.toFixed(1)),
        gravelThickness: Number(gravelThick.toFixed(1)),
        hasHeavySandTrap,
        potholeScour,
        trapQuality,
        suggestedPits: potholeScour && (i % 6 === 0),
      });
    }

    return stations;
  }, [lineLength, spacing]);

  // Overall placer statistics
  const placerMetrics = useMemo(() => {
    if (profileStations.length === 0) {
      return {
        avgOverburden: 0,
        avgGravelThick: 0,
        strippingRatio: 0,
        totalGravelVolM3: 0,
        totalEstGoldOz: 0,
        maxBedrockDepth: 0,
        highPriorityZones: 0,
      };
    }

    const avgOver = profileStations.reduce((a, b) => a + b.overburdenDepth, 0) / profileStations.length;
    const avgGravel = profileStations.reduce((a, b) => a + b.gravelThickness, 0) / profileStations.length;
    const strippingRatio = avgGravel > 0 ? Number((avgOver / avgGravel).toFixed(2)) : 0;
    const maxBedrock = Math.max(...profileStations.map((s) => s.bedrockDepth));

    // Volume = lineLength * trenchWidth * avgGravel
    const totalGravelVol = Math.round(lineLength * trenchWidthM * avgGravel);
    const totalEstGoldGrams = totalGravelVol * estimatedGradeGPerM3;
    const totalEstGoldOz = Number((totalEstGoldGrams / 31.1035).toFixed(1));

    const highPriorityZones = profileStations.filter((s) => s.trapQuality === 'ALTA').length;

    return {
      avgOverburden: Number(avgOver.toFixed(1)),
      avgGravelThick: Number(avgGravel.toFixed(1)),
      strippingRatio,
      totalGravelVolM3: totalGravelVol,
      totalEstGoldOz,
      maxBedrockDepth: Number(maxBedrock.toFixed(1)),
      highPriorityZones,
    };
  }, [profileStations, lineLength, trenchWidthM, estimatedGradeGPerM3]);

  // SVG Scaling
  const padLeft = 45;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 35;
  const plotW = Math.max(100, dimensions.width - padLeft - padRight);
  const plotH = Math.max(60, dimensions.height - padTop - padBottom);
  const maxProfileZ = Math.max(28, placerMetrics.maxBedrockDepth + 6);

  const scaleX = (x: number) => padLeft + (x / Math.max(10, lineLength)) * plotW;
  const scaleY = (z: number) => padTop + (z / maxProfileZ) * plotH;

  // Build polygon paths for the 3 alluvial layers
  const overburdenPoly = useMemo(() => {
    if (profileStations.length < 2) return '';
    const topPoints = profileStations.map((s) => `${scaleX(s.x)},${scaleY(0)}`);
    const bottomPoints = [...profileStations].reverse().map((s) => `${scaleX(s.x)},${scaleY(s.overburdenDepth)}`);
    return `${topPoints.join(' ')} ${bottomPoints.join(' ')}`;
  }, [profileStations, plotW, plotH, lineLength, maxProfileZ]);

  const gravelPoly = useMemo(() => {
    if (profileStations.length < 2) return '';
    const topPoints = profileStations.map((s) => `${scaleX(s.x)},${scaleY(s.overburdenDepth)}`);
    const bottomPoints = [...profileStations].reverse().map((s) => `${scaleX(s.x)},${scaleY(s.bedrockDepth)}`);
    return `${topPoints.join(' ')} ${bottomPoints.join(' ')}`;
  }, [profileStations, plotW, plotH, lineLength, maxProfileZ]);

  const bedrockPoly = useMemo(() => {
    if (profileStations.length < 2) return '';
    const topPoints = profileStations.map((s) => `${scaleX(s.x)},${scaleY(s.bedrockDepth)}`);
    const bottomPoints = [
      `${scaleX(lineLength)},${scaleY(maxProfileZ)}`,
      `${scaleX(0)},${scaleY(maxProfileZ)}`,
    ];
    return `${topPoints.join(' ')} ${bottomPoints.join(' ')}`;
  }, [profileStations, plotW, plotH, lineLength, maxProfileZ]);

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* 1. Header Banner & Alluvial Placer Metrics */}
      <div
        className={`rounded-xl border p-4 shadow-xl transition-colors ${
          isSunlightMode ? 'bg-amber-50 border-black text-black' : 'bg-[#0f1726] border-amber-500/30 text-white'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Pickaxe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold uppercase tracking-tight text-amber-400 flex items-center gap-2">
                Exploración de Oro Aluvial & Paleocanales
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Placer Gold 2D
                </span>
              </h2>
              <p className="text-[11px] opacity-80 mt-0.5">
                Identificación de piso de roca madre (bedrock), trampas de grava aurífera (paystreak) y cálculo de ratio de desbroce.
              </p>
            </div>
          </div>

          {/* Quick parameter inputs */}
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="opacity-75">Ancho Corte:</span>
              <input
                type="number"
                min="5"
                max="100"
                value={trenchWidthM}
                onChange={(e) => setTrenchWidthM(Math.max(1, Number(e.target.value)))}
                className={`w-14 px-1.5 py-0.5 rounded border font-bold text-center ${
                  isSunlightMode ? 'bg-white border-black text-black' : 'bg-black border-[#22395b] text-amber-300'
                }`}
              />
              <span>m</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="opacity-75">Ley Test:</span>
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="10"
                value={estimatedGradeGPerM3}
                onChange={(e) => setEstimatedGradeGPerM3(Math.max(0.01, Number(e.target.value)))}
                className={`w-14 px-1.5 py-0.5 rounded border font-bold text-center ${
                  isSunlightMode ? 'bg-white border-black text-black' : 'bg-black border-[#22395b] text-amber-300'
                }`}
              />
              <span>g/m³</span>
            </div>
          </div>
        </div>

        {/* 6 Metric KPI cards for placer mining */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          <div
            className={`p-2.5 rounded-lg border ${
              isSunlightMode ? 'bg-white border-black' : 'bg-[#09111c] border-[#182a44]'
            }`}
          >
            <span className="text-[10px] font-bold uppercase opacity-70 block">Sobrecarga (Limo)</span>
            <span className="text-sm sm:text-base font-bold text-blue-400">
              {placerMetrics.avgOverburden} m
            </span>
          </div>

          <div
            className={`p-2.5 rounded-lg border ${
              isSunlightMode ? 'bg-white border-black' : 'bg-[#09111c] border-[#182a44]'
            }`}
          >
            <span className="text-[10px] font-bold uppercase opacity-70 block">Manto de Gravas</span>
            <span className="text-sm sm:text-base font-bold text-amber-400">
              {placerMetrics.avgGravelThick} m
            </span>
          </div>

          <div
            className={`p-2.5 rounded-lg border ${
              isSunlightMode ? 'bg-white border-black' : 'bg-[#09111c] border-[#182a44]'
            }`}
          >
            <span className="text-[10px] font-bold uppercase opacity-70 block">Ratio Desbroce</span>
            <span
              className={`text-sm sm:text-base font-bold ${
                placerMetrics.strippingRatio > 2.5 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {placerMetrics.strippingRatio} : 1
            </span>
          </div>

          <div
            className={`p-2.5 rounded-lg border ${
              isSunlightMode ? 'bg-white border-black' : 'bg-[#09111c] border-[#182a44]'
            }`}
          >
            <span className="text-[10px] font-bold uppercase opacity-70 block">Prof. Max Bedrock</span>
            <span className="text-sm sm:text-base font-bold text-purple-400">
              -{placerMetrics.maxBedrockDepth} m
            </span>
          </div>

          <div
            className={`p-2.5 rounded-lg border ${
              isSunlightMode ? 'bg-white border-black' : 'bg-[#09111c] border-[#182a44]'
            }`}
          >
            <span className="text-[10px] font-bold uppercase opacity-70 block">Volumen Grava</span>
            <span className="text-sm sm:text-base font-bold text-cyan-400">
              {placerMetrics.totalGravelVolM3.toLocaleString()} m³
            </span>
          </div>

          <div
            className={`p-2.5 rounded-lg border ${
              isSunlightMode ? 'bg-white border-black' : 'bg-[#09111c] border-[#182a44]'
            }`}
          >
            <span className="text-[10px] font-bold uppercase opacity-70 block">Oro Estimado</span>
            <span className="text-sm sm:text-base font-bold text-amber-300">
              ~{placerMetrics.totalEstGoldOz} oz Au
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Stratigraphic Alluvial Section Graph (Cross-Section) */}
      <div
        className={`rounded-xl border p-4 shadow-xl transition-colors ${
          isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#080d16] border-[#18273d] text-white'
        }`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-[#17253b] mb-2.5">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-cyan-400" />
            <span className="font-bold uppercase tracking-tight text-xs">
              Corte Geológico Aluvial 2D: Perfil Paleocanal vs. Bedrock
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-500/60 inline-block border border-blue-400" />
              Sobrecarga Estéril (15-50 Ω·m)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500/70 inline-block border border-amber-300" />
              Gravas Auríferas (120-700 Ω·m)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-700 inline-block border border-slate-500" />
              Bedrock / Roca Madre (&gt;900 Ω·m)
            </span>
          </div>
        </div>

        {/* SVG Geological Section */}
        <div ref={containerRef} className="w-full h-72 relative overflow-hidden bg-carbon-texture rounded-lg border border-[#142033]">
          <svg viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} className="w-full h-full cursor-crosshair">
            {/* Depth Guidelines */}
            {[5, 10, 15, 20, 25].map((z) => {
              if (z > maxProfileZ) return null;
              const y = scaleY(z);
              return (
                <g key={z}>
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
                  >
                    -{z}m
                  </text>
                </g>
              );
            })}

            {/* Distance Gridlines (X) */}
            {Array.from({ length: Math.floor(lineLength / 25) + 1 }).map((_, i) => {
              const xVal = i * 25;
              const x = scaleX(xVal);
              return (
                <g key={xVal}>
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
                  >
                    {xVal}m
                  </text>
                </g>
              );
            })}

            {/* Layer 1: Overburden (Sobrecarga de limos y arcillas aluviales) */}
            <polygon
              points={overburdenPoly}
              fill={isSunlightMode ? '#bae6fd' : '#1e3a5f'}
              fillOpacity="0.75"
              stroke={isSunlightMode ? '#0284c7' : '#38bdf8'}
              strokeWidth="1.2"
            />

            {/* Layer 2: Gold-bearing Gravels (Gravas y arenas del paleocanal) */}
            <polygon
              points={gravelPoly}
              fill={isSunlightMode ? '#fef08a' : '#713f12'}
              fillOpacity="0.85"
              stroke="#eab308"
              strokeWidth="1.5"
            />

            {/* Layer 3: Bedrock Basement Floor (Roca madre impermeable) */}
            <polygon
              points={bedrockPoly}
              fill={isSunlightMode ? '#cbd5e1' : '#0a0f18'}
              stroke={isSunlightMode ? '#475569' : '#475569'}
              strokeWidth="2.2"
            />

            {/* Gold Paystreak Basal Bedrock Interface Line */}
            {profileStations.map((s, idx) => {
              if (idx === 0) return null;
              const prev = profileStations[idx - 1];
              return (
                <line
                  key={`bedrock-line-${idx}`}
                  x1={scaleX(prev.x)}
                  y1={scaleY(prev.bedrockDepth)}
                  x2={scaleX(s.x)}
                  y2={scaleY(s.bedrockDepth)}
                  stroke="#f59e0b"
                  strokeWidth={s.hasHeavySandTrap ? '3.5' : '2'}
                  strokeDasharray={s.hasHeavySandTrap ? undefined : '4 2'}
                />
              );
            })}

            {/* Potholes & Natural Riffle Traps (Nugget & Heavy Mineral Indicators) */}
            {profileStations.filter((s) => s.hasHeavySandTrap).map((s) => {
              const cx = scaleX(s.x);
              const cy = scaleY(s.bedrockDepth);
              return (
                <g key={`trap-${s.x}`} onClick={() => setSelectedStation(s.x)} className="cursor-pointer">
                  {/* Glowing Nugget Icon Marker */}
                  <circle cx={cx} cy={cy - 2} r="5" fill="#f59e0b" stroke="#000" strokeWidth="1" />
                  <circle cx={cx} cy={cy - 2} r="8" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" className="animate-spin" />
                  <text x={cx} y={cy - 10} textAnchor="middle" fill="#fde047" fontSize="8" fontWeight="bold">
                    ★ ORO
                  </text>
                </g>
              );
            })}

            {/* Suggested Calicata / Test Pit Marker */}
            {profileStations.filter((s) => s.suggestedPits).map((s) => {
              const cx = scaleX(s.x);
              return (
                <g key={`pit-${s.x}`}>
                  <line
                    x1={cx}
                    y1={padTop}
                    x2={cx}
                    y2={scaleY(s.bedrockDepth)}
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <rect x={cx - 14} y={padTop - 14} width="28" height="12" rx="3" fill="#ef4444" />
                  <text x={cx} y={padTop - 5} textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="bold">
                    CALICATA
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 3. Alluvial Exploration Target Traps & Trenching Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Trap Details Card */}
        <div
          className={`p-4 rounded-xl border ${
            isSunlightMode ? 'bg-slate-50 border-black' : 'bg-[#09111c] border-[#182a44]'
          }`}
        >
          <div className="flex items-center gap-2 mb-2 font-bold text-amber-400 uppercase">
            <Target className="w-4 h-4" />
            Trampas Gravimétricas & Potholes Identificados
          </div>
          <p className="text-[11px] opacity-80 mb-3 leading-relaxed">
            Las mayores concentraciones de oro libre y pepitas se localizan en las depresiones basales del paleocanal, donde la velocidad del flujo fluvial antiguo disminuyó bruscamente.
          </p>

          <div className="space-y-2">
            {profileStations
              .filter((s) => s.potholeScour)
              .slice(0, 3)
              .map((s, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border flex items-center justify-between text-[11px] ${
                    isSunlightMode ? 'bg-white border-black' : 'bg-[#0f1b2d] border-[#22395b]'
                  }`}
                >
                  <div>
                    <span className="font-bold text-amber-400 block">
                      Marmita #{idx + 1} en Estación X={s.x}m
                    </span>
                    <span className="text-[10px] opacity-75">
                      Piso rocoso a -{s.bedrockDepth}m · Manto de grava útil: {s.gravelThickness}m
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Prioridad Alta
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Mining Operation Advice */}
        <div
          className={`p-4 rounded-xl border ${
            isSunlightMode ? 'bg-slate-50 border-black' : 'bg-[#09111c] border-[#182a44]'
          }`}
        >
          <div className="flex items-center gap-2 mb-2 font-bold text-cyan-400 uppercase">
            <Compass className="w-4 h-4" />
            Estrategia de Explotación Recomendada
          </div>
          <div className="space-y-2 text-[11px] opacity-90 leading-relaxed">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span>
                <strong>Desbroce de Sobrecarga</strong>: Remover selectivamente los primeros {placerMetrics.avgOverburden}m de limo estéril sin alimentar la planta de lavado, reduciendo costos operativos de combustible y agua.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span>
                <strong>Limpieza Exhaustiva del Bedrock (Rasqueteo)</strong>: El 70-85% del oro grueso y chispas se deposita en los últimos 30-50 cm sobre el piso de roca madre y en las fracturas del lecho. Se aconseja rasqueteo con pala o retroexcavadora de orugas.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span>
                <strong>Muestreo por Calicatas</strong>: Ejecutar calicatas de verificación en X={profileStations.find((s) => s.potholeScour)?.x ?? 45}m para alimentar canaleta de prueba (sluice box) y contrastar la ley de oro.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

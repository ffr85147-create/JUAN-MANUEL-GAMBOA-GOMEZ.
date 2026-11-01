import React, { useState, useEffect } from 'react';
import { SequenceConfig } from '../utils/ert-math';
import { Sliders, Play, Calculator, FileUp, CheckCircle, Pickaxe, Zap, Shield, Target } from 'lucide-react';

interface SurveyConfigViewProps {
  config: SequenceConfig & { jobName: string };
  onSaveConfig: (cfg: SequenceConfig & { jobName: string }) => Promise<void>;
  onStartSurveyAfterConfig: () => void;
  isConnected: boolean;
  isSunlightMode: boolean;
}

export const SurveyConfigView: React.FC<SurveyConfigViewProps> = ({
  config,
  onSaveConfig,
  onStartSurveyAfterConfig,
  isConnected,
  isSunlightMode,
}) => {
  const [form, setForm] = useState(config);
  const [previewSummary, setPreviewSummary] = useState<any | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [cmdFileContent, setCmdFileContent] = useState('');
  const [cmdFileName, setCmdFileName] = useState('CUSTOM.cmd');
  const [cmdUploadMsg, setCmdUploadMsg] = useState<string | null>(null);

  const calculateSequence = async (targetCfg: typeof form) => {
    try {
      const res = await fetch('/api/survey/sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetCfg),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setPreviewSummary(data.summary);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setForm(config);
    calculateSequence(config);
  }, [config]);

  const handleChange = (field: string, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    calculateSequence(updated);
  };

  const applyMiningPreset = (preset: 'epithermal_veins' | 'porphyry_deep' | 'massive_sulfides' | 'structural_faults') => {
    let presetCfg: Partial<typeof form> = {};
    if (preset === 'epithermal_veins') {
      presetCfg = {
        miningPreset: 'epithermal_veins',
        arrayType: 'dd',
        spacing: 5,
        nMax: 8,
        stackCycles: 4,
        maxCurrent: 1000,
        measureTime: 1.2,
        isIP: true,
        ipCycle: 2,
        targetMineralization: 'gold_silver_veins',
      };
    } else if (preset === 'porphyry_deep') {
      presetCfg = {
        miningPreset: 'porphyry_deep',
        arrayType: 'pole-dipole',
        spacing: 10,
        nMax: 14,
        stackCycles: 6,
        maxCurrent: 2000,
        measureTime: 2.0,
        isIP: true,
        ipCycle: 4,
        targetMineralization: 'porphyry_copper',
      };
    } else if (preset === 'massive_sulfides') {
      presetCfg = {
        miningPreset: 'massive_sulfides',
        arrayType: 'schlumberger',
        spacing: 5,
        nMax: 8,
        stackCycles: 6,
        maxCurrent: 1000,
        measureTime: 1.2,
        isIP: true,
        ipCycle: 2,
        targetMineralization: 'vms_massive_sulfides',
      };
    } else if (preset === 'structural_faults') {
      presetCfg = {
        miningPreset: 'structural_faults',
        arrayType: 'gradient',
        spacing: 5,
        nMax: 10,
        stackCycles: 4,
        maxCurrent: 500,
        measureTime: 1.2,
        isIP: false,
        targetMineralization: 'general',
      };
    }

    const updated = { ...form, ...presetCfg };
    setForm(updated);
    calculateSequence(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveConfig(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleUploadCmd = async () => {
    if (!cmdFileContent.trim()) return;
    try {
      const res = await fetch('/api/files/upload-cmd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: cmdFileName, content: cmdFileContent }),
      });
      const data = await res.json();
      setCmdUploadMsg(data.message || 'Comandos guardados en el R8');
      setTimeout(() => setCmdUploadMsg(null), 3500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mining Presets Quick-Selector Ribbon */}
      <div
        className={`rounded-xl border p-4 shadow-xl transition-colors ${
          isSunlightMode ? 'bg-amber-50 border-black text-black' : 'bg-[#0f1726] border-amber-500/30 text-white'
        }`}
      >
        <div className="flex items-center justify-between mb-3 border-b border-amber-500/20 pb-2">
          <div className="flex items-center gap-2">
            <Pickaxe className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-tight text-amber-400">
              Plantillas de Adquisición para Exploración Minera
            </h3>
          </div>
          <span className="text-[10px] font-mono opacity-80">
            Optimizadas para AGI SuperSting R8/IP (Tx Interno 200W / PowerSting 5-15kW)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 font-mono text-xs">
          <button
            type="button"
            onClick={() => applyMiningPreset('epithermal_veins')}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              form.miningPreset === 'epithermal_veins'
                ? isSunlightMode
                  ? 'bg-amber-400 text-black border-black font-bold ring-2 ring-black'
                  : 'bg-amber-600/30 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                : isSunlightMode
                ? 'bg-white border-black hover:bg-slate-100'
                : 'bg-[#080d16] border-[#182a44] hover:border-amber-400/50'
            }`}
          >
            <div className="font-bold flex items-center justify-between text-xs mb-1">
              <span>Vetas Epitermales (Au-Ag)</span>
              <span className="text-[10px] opacity-75">DD-56</span>
            </div>
            <p className="text-[10px] opacity-80 leading-snug">
              Dipolo-Dipolo alta resolución lateral. Detecta silicificación &gt;2500 Ω·m y halos de sulfuros.
            </p>
          </button>

          <button
            type="button"
            onClick={() => applyMiningPreset('porphyry_deep')}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              form.miningPreset === 'porphyry_deep'
                ? isSunlightMode
                  ? 'bg-amber-400 text-black border-black font-bold ring-2 ring-black'
                  : 'bg-purple-600/30 border-purple-400 text-purple-200 ring-1 ring-purple-400'
                : isSunlightMode
                ? 'bg-white border-black hover:bg-slate-100'
                : 'bg-[#080d16] border-[#182a44] hover:border-purple-400/50'
            }`}
          >
            <div className="font-bold flex items-center justify-between text-xs mb-1">
              <span>Pórfidos Cupríferos (Cu-Au)</span>
              <span className="text-[10px] opacity-75">P-DD</span>
            </div>
            <p className="text-[10px] opacity-80 leading-snug">
              Polo-Dipolo profundo (a=10m, nMax=14). Inyección 2.0A (lazo ≤50 Ω a 200W o PowerSting) para alta IP.
            </p>
          </button>

          <button
            type="button"
            onClick={() => applyMiningPreset('massive_sulfides')}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              form.miningPreset === 'massive_sulfides'
                ? isSunlightMode
                  ? 'bg-amber-400 text-black border-black font-bold ring-2 ring-black'
                  : 'bg-blue-600/30 border-blue-400 text-blue-200 ring-1 ring-blue-400'
                : isSunlightMode
                ? 'bg-white border-black hover:bg-slate-100'
                : 'bg-[#080d16] border-[#182a44] hover:border-blue-400/50'
            }`}
          >
            <div className="font-bold flex items-center justify-between text-xs mb-1">
              <span>Sulfuros Masivos (VMS/Skarn)</span>
              <span className="text-[10px] opacity-75">SCHL-IP</span>
            </div>
            <p className="text-[10px] opacity-80 leading-snug">
              Wenner-Schlumberger. Contraste de baja resistividad (&lt;15 Ω·m) y auto-potencial (SP).
            </p>
          </button>

          <button
            type="button"
            onClick={() => applyMiningPreset('structural_faults')}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              form.miningPreset === 'structural_faults'
                ? isSunlightMode
                  ? 'bg-amber-400 text-black border-black font-bold ring-2 ring-black'
                  : 'bg-emerald-600/30 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400'
                : isSunlightMode
                ? 'bg-white border-black hover:bg-slate-100'
                : 'bg-[#080d16] border-[#182a44] hover:border-emerald-400/50'
            }`}
          >
            <div className="font-bold flex items-center justify-between text-xs mb-1">
              <span>Control Lito-Estructural</span>
              <span className="text-[10px] opacity-75">GRAD</span>
            </div>
            <p className="text-[10px] opacity-80 leading-snug">
              Gradiente rápido de reconocimiento de fallas, contactos litológicos y zonas de cizalle.
            </p>
          </button>
        </div>
      </div>

      {/* Configuration Form Card */}
      <form
        onSubmit={handleSave}
        className={`rounded-xl border p-5 shadow-xl transition-colors ${
          isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0b1320] border-[#1e2e46] text-white'
        }`}
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-4 border-b pb-4 mb-4 ${
            isSunlightMode ? 'border-black' : 'border-[#1b2b41]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-bold uppercase tracking-tight">
              Parámetros de Adquisición Minera y Geometría de Tendido
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                Guardado en Memoria SuperSting
              </span>
            )}
            <button
              type="submit"
              className={`px-4 py-2.5 rounded-lg text-xs font-bold shadow transition-all min-h-[40px] border cursor-pointer ${
                isSunlightMode
                  ? 'bg-black text-white border-black hover:bg-slate-800'
                  : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
              }`}
            >
              Aplicar a Memoria R8
            </button>
            <button
              type="button"
              onClick={onStartSurveyAfterConfig}
              disabled={!isConnected}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold min-h-[40px] transition-all border cursor-pointer ${
                !isConnected
                  ? 'bg-slate-300 text-slate-500 border-slate-400 cursor-not-allowed'
                  : isSunlightMode
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-black'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Iniciar Adquisición
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
              Nombre de Línea / Malla
            </label>
            <input
              type="text"
              value={form.jobName}
              onChange={(e) => handleChange('jobName', e.target.value.toUpperCase())}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black focus:border-blue-700'
                  : 'bg-[#070e17] border-[#1b2e49] text-white focus:border-blue-500'
              }`}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
              Arreglo Geofísico
            </label>
            <select
              value={form.arrayType}
              onChange={(e) => handleChange('arrayType', e.target.value)}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            >
              <option value="dd">Dipole-Dipole (Multicanal 8CH - Vetas)</option>
              <option value="pole-dipole">Pole-Dipole (Polo-Dipolo Minero - Máx Penetración)</option>
              <option value="schlumberger">Wenner-Schlumberger (Estratigrafía / Skarn)</option>
              <option value="wenner">Wenner Alpha (Capas Horizontales)</option>
              <option value="gradient">Gradient Array (Reconocimiento de Bloques)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
              Cantidad de Picas
            </label>
            <select
              value={form.electrodes}
              onChange={(e) => handleChange('electrodes', Number(e.target.value))}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            >
              <option value={28}>28 Electrodos (1 Carrete)</option>
              <option value={56}>56 Electrodos (2 Carretes estándar)</option>
              <option value={84}>84 Electrodos (3 Carretes)</option>
              <option value={112}>112 Electrodos (4 Carretes de Exploración)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold tracking-wider mb-1 opacity-80">
              <span className="uppercase">Espaciamiento Unitario "a"</span> (m)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="25"
              value={form.spacing}
              onChange={(e) => handleChange('spacing', Number(e.target.value))}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold tracking-wider mb-1 opacity-80">
              <span className="uppercase">Separación Máxima</span> n-Factor
            </label>
            <input
              type="number"
              min="2"
              max="14"
              value={form.nMax || 8}
              onChange={(e) => handleChange('nMax', Number(e.target.value))}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold tracking-wider mb-1 opacity-80">
              <span className="uppercase">Transmisor / Potencia Tx</span> (W)
            </label>
            <select
              value={form.transmitterPowerW || 200}
              onChange={(e) => handleChange('transmitterPowerW', Number(e.target.value))}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            >
              <option value={200}>Interno SuperSting R8 (200 W / 800 Vp-p)</option>
              <option value={5000}>Externo PowerSting (5 kW)</option>
              <option value={10000}>Externo PowerSting (10 kW)</option>
              <option value={15000}>Externo PowerSting (15 kW)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold tracking-wider mb-1 opacity-80">
              <span className="uppercase">Corriente de Inyección Máx</span> (mA)
            </label>
            <select
              value={form.maxCurrent || 500}
              onChange={(e) => handleChange('maxCurrent', Number(e.target.value))}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            >
              <option value={200}>200 mA (Lazo ≤ 4.0 kΩ @ 800V)</option>
              <option value={500}>500 mA (Lazo ≤ 1.6 kΩ @ 800V, P=200W)</option>
              <option value={1000}>1000 mA / 1.0 A (Exige lazo ≤ 200 Ω @ 200W o PowerSting)</option>
              <option value={1500}>1500 mA / 1.5 A (Exige lazo ≤ 88 Ω @ 200W o PowerSting)</option>
              <option value={2000}>2000 mA / 2.0 A (Máx corriente R8, lazo ≤ 50 Ω @ 200W)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold tracking-wider mb-1 opacity-80">
              <span className="uppercase">Tiempo Medición / Integración</span> (s)
            </label>
            <select
              value={form.measureTime || 1.2}
              onChange={(e) => handleChange('measureTime', Number(e.target.value))}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            >
              <option value={0.8}>0.8 s (Rápido)</option>
              <option value={1.2}>1.2 s (Estándar)</option>
              <option value={2.0}>2.0 s (Alta precisión mineral)</option>
              <option value={3.6}>3.6 s (Filtro 50/60 Hz industrial)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
              Ciclos de Stack (Promediado)
            </label>
            <select
              value={form.stackCycles || 4}
              onChange={(e) => handleChange('stackCycles', Number(e.target.value))}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            >
              <option value={2}>2 Stacks</option>
              <option value={4}>4 Stacks (Estándar)</option>
              <option value={6}>6 Stacks (Bajo Ruido Minero)</option>
              <option value={8}>8 Stacks (Máxima Relación S/R)</option>
            </select>
          </div>

          {/* IP Mode Checkbox */}
          <div
            className={`sm:col-span-2 flex items-center gap-3 p-3 rounded-lg border ${
              isSunlightMode ? 'bg-slate-100 border-black' : 'bg-[#070e17] border-[#1b2e49]'
            }`}
          >
            <input
              type="checkbox"
              id="isIPCheck"
              checked={Boolean(form.isIP)}
              onChange={(e) => handleChange('isIP', e.target.checked)}
              className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
            <label htmlFor="isIPCheck" className="text-xs cursor-pointer select-none">
              <span className="font-bold block text-purple-700 dark:text-purple-300">
                Activar Polarización Inducida en Dominio de Tiempo (TDIP)
              </span>
              <span className="opacity-80">
                Imprescindible en minería: registra decaimiento transitorio en ventanas M1-M6 para sulfuros metálicos.
              </span>
            </label>
          </div>

          {/* Target Mineralization */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
              Tipo de Yacimiento / Blanco Primario
            </label>
            <select
              value={form.targetMineralization || 'gold_silver_veins'}
              onChange={(e) => handleChange('targetMineralization', e.target.value)}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            >
              <option value="gold_silver_veins">Vetas Epitermales de Cuarzo Au-Ag (Silicificación)</option>
              <option value="porphyry_copper">Pórfido Cuprífero Cu-Au-Mo (Diseminado Stockwork)</option>
              <option value="vms_massive_sulfides">Sulfuros Masivos Vulcanogénicos VMS (Cu-Pb-Zn-Ag)</option>
              <option value="polymetallic_skarn">Cuerpos de Reemplazo y Skarn Polimetálico</option>
              <option value="general">Exploración Geológica General</option>
            </select>
          </div>
        </div>

        {/* Live Calculation Strip */}
        {previewSummary && (
          <div
            className={`mt-5 p-4 rounded-xl border ${
              isSunlightMode ? 'bg-slate-50 border-black' : 'bg-[#08101a] border-[#16273e]'
            }`}
          >
            <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider">
              <Calculator className="w-4 h-4 text-emerald-500" />
              Pre-cálculo de Adquisición Minera & Cobertura
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 font-mono text-xs">
              <div
                className={`p-2.5 rounded border ${
                  isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1829] border-[#1a2d48]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase opacity-70 block">Puntos Totales</span>
                <span className="text-base font-bold text-cyan-600 dark:text-cyan-300">
                  {previewSummary.totalPoints}
                </span>
              </div>
              <div
                className={`p-2.5 rounded border ${
                  isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1829] border-[#1a2d48]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase opacity-70 block">Disparos (8CH)</span>
                <span className="text-base font-bold">{previewSummary.groupsOf8}</span>
              </div>
              <div
                className={`p-2.5 rounded border ${
                  isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1829] border-[#1a2d48]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase opacity-70 block">Longitud Línea</span>
                <span className="text-base font-bold">{previewSummary.lineLengthM} m</span>
              </div>
              <div
                className={`p-2.5 rounded border ${
                  isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1829] border-[#1a2d48]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase opacity-70 block">Prof. Investigación</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  ~{previewSummary.maxPseudoDepthM} m
                </span>
              </div>
              <div
                className={`p-2.5 rounded border ${
                  isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1829] border-[#1a2d48]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase opacity-70 block">Tiempo Estimado</span>
                <span className="text-base font-bold">{previewSummary.estimatedMinutes} min</span>
              </div>
              <div
                className={`p-2.5 rounded border ${
                  isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1829] border-[#1a2d48]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase opacity-70 block">Uso Memoria R8</span>
                <span className="text-base font-bold text-amber-500">{previewSummary.memoryPct}%</span>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

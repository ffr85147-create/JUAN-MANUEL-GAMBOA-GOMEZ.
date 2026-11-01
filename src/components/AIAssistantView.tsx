import React, { useState } from 'react';
import { Sparkles, Bot, RefreshCw, Pickaxe, Target } from 'lucide-react';
import { estimate2DInversion } from '../utils/ert-math';

interface AIAssistantViewProps {
  surveyConfig: any;
  pointsCount: number;
  contactSummary: any;
  points: any[];
  isSunlightMode: boolean;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  surveyConfig,
  pointsCount,
  contactSummary,
  points,
  isSunlightMode,
}) => {
  const [report, setReport] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const rhos = points.map((p) => p.rho).filter((r) => r > 0);
      const minRho = rhos.length ? Math.min(...rhos) : 0;
      const maxRho = rhos.length ? Math.max(...rhos) : 0;
      const avgRho = rhos.length ? Math.round(rhos.reduce((a, b) => a + b, 0) / rhos.length) : 0;

      const ips = points.map((p) => p.ip).filter((v) => v !== undefined && v > 0);
      const maxIP = ips.length ? Math.max(...ips) : undefined;

      const inversion = estimate2DInversion(points, { iterations: 3 });

      const payload = {
        summary: {
          jobName: surveyConfig.jobName,
          arrayType: surveyConfig.arrayType,
          electrodes: surveyConfig.electrodes,
          spacing: surveyConfig.spacing,
          measuredPoints: pointsCount,
          totalLineMeters: (surveyConfig.electrodes - 1) * surveyConfig.spacing,
          targetMineralization: surveyConfig.targetMineralization,
          maxCurrentMA: surveyConfig.maxCurrent,
        },
        anomalies: {
          minResistivity: minRho,
          maxResistivity: maxRho,
          averageResistivity: avgRho,
          maxChargeability: maxIP,
          inversionRMS: inversion.rmsError,
        },
        badElectrodes: contactSummary?.badElectrodes || [],
        miningTargets: inversion.targets,
      };

      const res = await fetch('/api/assistant/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.status === 'ok') {
        setReport(data.interpretation);
        setSource(data.source);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border p-5 shadow-xl transition-colors ${
          isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0b1320] border-[#1e2e46] text-white'
        }`}
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-4 border-b pb-4 mb-4 ${
            isSunlightMode ? 'border-black' : 'border-[#1b2b41]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-lg border ${
                isSunlightMode
                  ? 'bg-amber-100 border-black text-amber-900'
                  : 'bg-amber-600/20 text-amber-400 border-amber-500/30'
              }`}
            >
              <Pickaxe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                Asistente Geofísico de Exploración Minera
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    isSunlightMode
                      ? 'bg-amber-200 border-black text-amber-950'
                      : 'bg-amber-900/50 text-amber-300 border-amber-800'
                  }`}
                >
                  Consultor Minero AI
                </span>
              </h2>
              <p className="text-xs opacity-80 mt-0.5">
                Interpretación litológica, detección de sulfuros metálicos, vetas silíceas y sugerencias de sondajes.
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={isLoading || pointsCount === 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-lg min-h-[44px] border cursor-pointer ${
              pointsCount === 0
                ? isSunlightMode
                  ? 'bg-slate-200 text-slate-500 border-slate-400 cursor-not-allowed'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700'
                : isLoading
                ? 'bg-amber-800 text-white animate-pulse'
                : isSunlightMode
                ? 'bg-amber-900 hover:bg-amber-950 text-white border-black shadow-xl'
                : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500 shadow-amber-950/40'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analizando Datos de Terreno & Inversión...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-200" />
                Interpretar Perfil Minero ({pointsCount} Puntos)
              </>
            )}
          </button>
        </div>

        {pointsCount === 0 && (
          <div className="p-4 rounded-lg text-xs opacity-70 text-center font-medium">
            Inicia disparos en "Adquisición en Vivo" para que el modelo interprete las resistividades y cargabilidades medidas.
          </div>
        )}

        {report && (
          <div
            className={`mt-4 p-5 rounded-xl border ${
              isSunlightMode ? 'bg-slate-50 border-black text-black' : 'bg-[#070e17] border-amber-500/40 text-slate-200'
            }`}
          >
            <div
              className={`flex items-center justify-between mb-3 border-b pb-2 text-xs font-bold ${
                isSunlightMode ? 'border-black' : 'border-[#17273e]'
              }`}
            >
              <span className="flex items-center gap-1.5 text-amber-500">
                <Target className="w-4 h-4 text-amber-400" />
                Informe Geológico-Minero & Blancos de Sondaje
              </span>
              <span className="text-[10px] font-mono opacity-70">
                {source === 'gemini' ? 'Google Gemini 2.5 Flash' : 'Motor Geofísico-Minero de Reglas'}
              </span>
            </div>

            <div className="text-xs leading-relaxed space-y-2 whitespace-pre-wrap font-sans font-medium">
              {report}
            </div>
          </div>
        )}

        {/* Mining Lithological Reference Card */}
        <div
          className={`mt-5 p-4 rounded-xl border ${
            isSunlightMode ? 'bg-slate-100 border-black' : 'bg-[#08111d] border-[#16253b]'
          }`}
        >
          <span className="text-xs font-bold uppercase tracking-wider block mb-3 opacity-90">
            Escalas Geofísico-Mineras Típicas de Resistividad & Cargabilidad (IP)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
            <div
              className={`p-2.5 rounded border ${
                isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0c1626] border-[#182944]'
              }`}
            >
              <span className="text-blue-500 font-bold block">0.5 - 15 Ω·m · M &gt; 45 mV/V</span>
              <span className="text-[11px] opacity-80">Sulfuros Masivos (Calcopirita, Galena, Pirita VMS)</span>
            </div>
            <div
              className={`p-2.5 rounded border ${
                isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0c1626] border-[#182944]'
              }`}
            >
              <span className="text-teal-400 font-bold block">15 - 50 Ω·m · M 5-15 mV/V</span>
              <span className="text-[11px] opacity-80">Alteración Argílica / Fallas y Arcillas</span>
            </div>
            <div
              className={`p-2.5 rounded border ${
                isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0c1626] border-[#182944]'
              }`}
            >
              <span className="text-amber-400 font-bold block">80 - 450 Ω·m · M &gt; 28 mV/V</span>
              <span className="text-[11px] opacity-80">Pórfido Cu-Au Diseminado (Stockwork)</span>
            </div>
            <div
              className={`p-2.5 rounded border ${
                isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0c1626] border-[#182944]'
              }`}
            >
              <span className="text-purple-400 font-bold block">&gt; 3,500 Ω·m · Halo IP</span>
              <span className="text-[11px] opacity-80">Vetas de Cuarzo Epitermal (Au-Ag) / Silicificación</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

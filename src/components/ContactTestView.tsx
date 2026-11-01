import React, { useState } from 'react';
import { Activity, ShieldCheck, AlertCircle, Gauge, Cpu, Zap } from 'lucide-react';

interface ContactTestSummary {
  totalElectrodes: number;
  medianKohm: number;
  maxKohm: number;
  under2k: number;
  between2and5k: number;
  between5and10k: number;
  over10k: number;
  badElectrodes: { electrode: number; resistanceKohm: number }[];
  values: number[];
}

interface ContactTestViewProps {
  isConnected: boolean;
  contactSummary: ContactTestSummary | null;
  onRunContactTest: () => Promise<void>;
  isLoadingContact: boolean;
  isSunlightMode: boolean;
}

export const ContactTestView: React.FC<ContactTestViewProps> = ({
  isConnected,
  contactSummary,
  onRunContactTest,
  isLoadingContact,
  isSunlightMode,
}) => {
  const [receiverResult, setReceiverResult] = useState<any | null>(null);
  const [ipTestResult, setIpTestResult] = useState<any | null>(null);
  const [spTestResult, setSpTestResult] = useState<any | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState<string | null>(null);

  const runReceiverTest = async () => {
    try {
      setDiagnosticLoading('receiver');
      const res = await fetch('/api/instrument/receiver-test', { method: 'POST' });
      const data = await res.json();
      setReceiverResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setDiagnosticLoading(null);
    }
  };

  const runIPTest = async () => {
    try {
      setDiagnosticLoading('ip');
      const res = await fetch('/api/instrument/ip-test', { method: 'POST' });
      const data = await res.json();
      setIpTestResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setDiagnosticLoading(null);
    }
  };

  const runSPTest = async () => {
    try {
      setDiagnosticLoading('sp');
      const res = await fetch('/api/instrument/sp-test', { method: 'POST' });
      const data = await res.json();
      setSpTestResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setDiagnosticLoading(null);
    }
  };

  const getBarColor = (val: number) => {
    if (val < 1.8) return isSunlightMode ? 'bg-emerald-600' : 'bg-emerald-500';
    if (val <= 5.0) return isSunlightMode ? 'bg-yellow-500' : 'bg-yellow-500';
    return isSunlightMode ? 'bg-red-700' : 'bg-rose-600 animate-pulse';
  };

  const getTextColor = (val: number) => {
    if (val < 1.8) return isSunlightMode ? 'text-emerald-800' : 'text-emerald-400';
    if (val <= 5.0) return isSunlightMode ? 'text-yellow-800' : 'text-yellow-400';
    return isSunlightMode ? 'text-red-700 font-black' : 'text-rose-400 font-bold';
  };

  return (
    <div className="space-y-4">
      {/* Top Banner and Test Action */}
      <div
        className={`rounded-xl border p-5 shadow-xl transition-colors ${
          isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0b1320] border-[#1e2e46] text-white'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-500" />
              <h2 className="text-base font-bold tracking-tight">
                Control de Calidad: Resistencia de Contacto (Estándar AGI)
              </h2>
            </div>
            <p
              className={`text-xs mt-1 leading-relaxed ${
                isSunlightMode ? 'text-slate-700 font-medium' : 'text-[#8299b8]'
              }`}
            >
              Mide el acoplamiento eléctrico entre cada electrodo y el terreno. Según AGI, se recomienda una resistencia inferior a <strong>5.0 kΩ</strong> para operar y, de ser posible, inferior a <strong>1.8 kΩ</strong> para aprovechar la potencia completa de 200 W del transmisor sin limitaciones de voltaje.
            </p>
          </div>

          <button
            onClick={onRunContactTest}
            disabled={!isConnected || isLoadingContact}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold min-h-[44px] transition-all shadow-lg ${
              !isConnected
                ? isSunlightMode
                  ? 'bg-slate-200 text-slate-500 border border-slate-400 cursor-not-allowed'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : isLoadingContact
                ? 'bg-amber-600 text-white animate-pulse'
                : isSunlightMode
                ? 'bg-black hover:bg-slate-800 text-white shadow-xl'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
            }`}
          >
            <Gauge className="w-4 h-4" />
            {isLoadingContact
              ? 'Midiendo 56 Electrodos...'
              : !isConnected
              ? 'Equipo Desconectado'
              : 'Ejecutar Contact Test Completo'}
          </button>
        </div>

        {/* Contact Test Statistics */}
        {contactSummary && (
          <div
            className={`mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 ${
              isSunlightMode ? 'border-black' : 'border-[#18283e]'
            }`}
          >
            <div
              className={`p-3 rounded-lg border ${
                isSunlightMode ? 'bg-slate-100 border-black' : 'bg-[#0e1929] border-[#1a2d48]'
              }`}
            >
              <span className="text-[10px] font-bold block opacity-70">Mediana de Red</span>
              <span className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-300">
                {contactSummary.medianKohm} kΩ
              </span>
            </div>
            <div
              className={`p-3 rounded-lg border ${
                isSunlightMode ? 'bg-slate-100 border-black' : 'bg-[#0e1929] border-[#1a2d48]'
              }`}
            >
              <span className="text-[10px] font-bold block opacity-70">Resistencia Máxima</span>
              <span
                className={`text-xl font-bold font-mono ${
                  contactSummary.maxKohm > 5 ? 'text-red-500' : 'text-amber-500'
                }`}
              >
                {contactSummary.maxKohm} kΩ
              </span>
            </div>
            <div
              className={`p-3 rounded-lg border ${
                isSunlightMode ? 'bg-emerald-50 border-emerald-800' : 'bg-[#0e1929] border-emerald-900/40'
              }`}
            >
              <span className="text-[10px] font-bold block text-emerald-700 dark:text-emerald-400">
                &lt; 1.8 kΩ (Óptimo Tx 200W)
              </span>
              <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
                {contactSummary.under1_8k ?? contactSummary.under2k} ({Math.round(((contactSummary.under1_8k ?? contactSummary.under2k) / contactSummary.totalElectrodes) * 100)}%)
              </span>
            </div>
            <div
              className={`p-3 rounded-lg border ${
                isSunlightMode ? 'bg-yellow-50 border-yellow-800' : 'bg-[#0e1929] border-yellow-900/40'
              }`}
            >
              <span className="text-[10px] font-bold block text-yellow-800 dark:text-yellow-400">
                1.8 - 5.0 kΩ (Aceptable AGI)
              </span>
              <span className="text-xl font-bold font-mono text-yellow-700 dark:text-yellow-300">
                {contactSummary.between1_8and5k ?? contactSummary.between2and5k}
              </span>
            </div>
            <div
              className={`p-3 rounded-lg border ${
                isSunlightMode ? 'bg-red-50 border-red-800' : 'bg-[#0e1929] border-rose-900/40'
              }`}
            >
              <span className="text-[10px] font-bold block text-red-800 dark:text-rose-400">
                &gt; 5.0 kΩ (Crítico / Humectar)
              </span>
              <span className="text-xl font-bold font-mono text-red-700 dark:text-rose-300">
                {contactSummary.over5k ?? (contactSummary.between5and10k + contactSummary.over10k)}
              </span>
            </div>
          </div>
        )}

        {/* Warning Alert if bad electrodes exist */}
        {contactSummary && contactSummary.badElectrodes.length > 0 && (
          <div
            className={`mt-4 p-3.5 rounded-lg border flex items-start gap-3 text-xs ${
              isSunlightMode
                ? 'bg-amber-100 border-black text-black font-medium'
                : 'bg-amber-950/50 border-amber-600/60 text-amber-200'
            }`}
          >
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-sm">
                Instrucción de Terreno ({contactSummary.badElectrodes.length} electrodos con resistencia crítica):
              </strong>
              Para evitar saturación del transmisor o mediciones con alto ruido instrumental, aplicar agua con salmuera o enterrar más profundamente las picas identificadas:{' '}
              <span className="font-mono font-bold underline">
                {contactSummary.badElectrodes.map((e) => `#${e.electrode} (${e.resistanceKohm} kΩ)`).join(', ')}
              </span>.
            </div>
          </div>
        )}
      </div>

      {/* Graphical Bar Chart of All Electrodes */}
      {contactSummary && contactSummary.values.length > 0 && (
        <div
          className={`rounded-xl border p-5 shadow-xl transition-colors ${
            isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0b1320] border-[#1e2e46] text-white'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">
              Perfil de Contacto Electrodo 1 al {contactSummary.totalElectrodes}
            </span>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-black/20" />
                &lt;2kΩ
              </span>
              <span className="flex items-center gap-1 text-yellow-700 dark:text-yellow-400">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block border border-black/20" />
                2-5kΩ
              </span>
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block border border-black/20" />
                5-10kΩ
              </span>
              <span className="flex items-center gap-1 text-red-700 dark:text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block border border-black/20" />
                &gt;10kΩ
              </span>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div
            className={`h-48 rounded-lg p-3 flex items-end gap-1.5 overflow-x-auto border ${
              isSunlightMode ? 'bg-slate-100 border-black' : 'bg-[#070d16] border-[#152338]'
            }`}
          >
            {contactSummary.values.map((val, idx) => {
              const elNum = idx + 1;
              const heightPct = Math.min(100, Math.max(10, (val / 15) * 100));
              return (
                <div
                  key={elNum}
                  className="flex-1 min-w-[12px] max-w-[22px] flex flex-col items-center group relative h-full justify-end cursor-pointer"
                >
                  {/* Tooltip on hover/touch */}
                  <div
                    className={`absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-30 font-mono font-bold shadow-md border ${
                      isSunlightMode
                        ? 'bg-black text-white border-black'
                        : 'bg-slate-900 border-slate-700 text-white'
                    }`}
                  >
                    #{elNum}: {val} kΩ
                  </div>
                  {/* Bar element */}
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t transition-all border ${
                      isSunlightMode ? 'border-black' : 'border-black/30'
                    } ${getBarColor(val)}`}
                  />
                  {elNum % 5 === 0 && (
                    <span
                      className={`text-[9px] font-mono mt-1 font-bold ${
                        isSunlightMode ? 'text-black' : 'text-[#7189a8]'
                      }`}
                    >
                      {elNum}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Numerical Values Matrix */}
          <div className="mt-4">
            <span className="text-xs font-bold uppercase tracking-wider block mb-2 opacity-80">
              Lecturas Numéricas de Impedancia
            </span>
            <div
              className={`grid grid-cols-4 sm:grid-cols-7 md:grid-cols-14 gap-1.5 max-h-52 overflow-y-auto p-2 rounded-lg font-mono text-xs border ${
                isSunlightMode ? 'bg-slate-100 border-black' : 'bg-[#070d16] border-[#152338]'
              }`}
            >
              {contactSummary.values.map((val, idx) => (
                <div
                  key={idx}
                  className={`p-1.5 rounded text-center border ${
                    isSunlightMode
                      ? 'bg-white border-black'
                      : 'bg-[#0d1829] border-[#182a44]'
                  }`}
                >
                  <span className="text-[10px] block opacity-70">#{idx + 1}</span>
                  <span className={`font-bold ${getTextColor(val)}`}>{val}k</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Additional Hardware Calibrations */}
      <div
        className={`rounded-xl border p-5 shadow-xl transition-colors ${
          isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0b1320] border-[#1e2e46] text-white'
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-cyan-500" />
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Autocalibraciones de Hardware SuperSting R8
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            className={`p-3.5 rounded-lg border flex flex-col justify-between ${
              isSunlightMode ? 'bg-slate-100 border-black' : 'bg-[#0d1829] border-[#182942]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-blue-500" />
                  Test de Receptores (8CH)
                </span>
                {receiverResult && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-700 text-white font-bold">
                    PASÓ
                  </span>
                )}
              </div>
              <p className="text-xs opacity-80 mb-3">
                Comprueba ganancia (&lt; 0.1%) y fase (&lt; 0.2 mrad) en los 8 canales simultáneos.
              </p>
            </div>
            <button
              onClick={runReceiverTest}
              disabled={diagnosticLoading === 'receiver'}
              className={`w-full py-2 px-3 text-xs font-bold rounded-lg transition-colors border ${
                isSunlightMode
                  ? 'bg-black text-white border-black hover:bg-slate-800'
                  : 'bg-[#162740] text-blue-300 border-blue-500/30 hover:bg-[#1f375a]'
              }`}
            >
              {diagnosticLoading === 'receiver' ? 'Verificando...' : 'Test Receptores (8CH)'}
            </button>
          </div>

          <div
            className={`p-3.5 rounded-lg border flex flex-col justify-between ${
              isSunlightMode ? 'bg-slate-100 border-black' : 'bg-[#0d1829] border-[#182942]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-purple-500" />
                  Ventanas de Decaimiento IP
                </span>
                {ipTestResult && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-700 text-white font-bold">
                    CAL OK
                  </span>
                )}
              </div>
              <p className="text-xs opacity-80 mb-3">
                Calibración de la integral de descarga en ventanas M1 a M6 de Polarización Inducida.
              </p>
            </div>
            <button
              onClick={runIPTest}
              disabled={diagnosticLoading === 'ip'}
              className={`w-full py-2 px-3 text-xs font-bold rounded-lg transition-colors border ${
                isSunlightMode
                  ? 'bg-black text-white border-black hover:bg-slate-800'
                  : 'bg-[#1e1c36] text-purple-300 border-purple-500/30 hover:bg-[#2d2a52]'
              }`}
            >
              {diagnosticLoading === 'ip' ? 'Calibrando...' : 'Calibrar Ventanas IP'}
            </button>
          </div>

          <div
            className={`p-3.5 rounded-lg border flex flex-col justify-between ${
              isSunlightMode ? 'bg-slate-100 border-black' : 'bg-[#0d1829] border-[#182942]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-amber-500" />
                  Ruido de Auto-Potencial SP
                </span>
                {spTestResult && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-700 text-white font-bold">
                    RUIDO OK
                  </span>
                )}
              </div>
              <p className="text-xs opacity-80 mb-3">
                Mide potencial natural y corrientes telúricas antes de inyectar corriente forzada.
              </p>
            </div>
            <button
              onClick={runSPTest}
              disabled={diagnosticLoading === 'sp'}
              className={`w-full py-2 px-3 text-xs font-bold rounded-lg transition-colors border ${
                isSunlightMode
                  ? 'bg-black text-white border-black hover:bg-slate-800'
                  : 'bg-[#262116] text-amber-300 border-amber-500/30 hover:bg-[#3d3420]'
              }`}
            >
              {diagnosticLoading === 'sp' ? 'Midiendo...' : 'Medir Auto-Potencial SP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

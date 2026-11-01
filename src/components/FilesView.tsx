import React, { useState, useEffect } from 'react';
import { FolderArchive, Download, FileText, RefreshCw, Eye } from 'lucide-react';

interface StoredFile {
  name: string;
  type: 'stg' | 'cmd' | 'csv' | 'z2d';
  pointsCount: number;
  createdAt: string;
  sizeBytes: number;
}

interface FilesViewProps {
  isSunlightMode: boolean;
}

export const FilesView: React.FC<FilesViewProps> = ({ isSunlightMode }) => {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      if (data.status === 'ok') {
        setFiles(data.files || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleDownload = (filename: string, format: string) => {
    const url = `/api/files/${encodeURIComponent(filename)}/export?format=${format}`;
    window.open(url, '_blank');
  };

  const handlePreview = async (filename: string, format: string = 'z2d') => {
    try {
      setPreviewFilename(`${filename}.${format}`);
      const res = await fetch(`/api/files/${encodeURIComponent(filename)}/export?format=${format}`);
      const text = await res.text();
      setPreviewContent(text);
    } catch (e) {
      console.error(e);
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
          <div className="flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold uppercase tracking-tight">
              Exportación y Almacenamiento de Perfiles
            </h2>
          </div>

          <button
            onClick={loadFiles}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors border min-h-[40px] ${
              isSunlightMode
                ? 'bg-slate-100 border-black hover:bg-slate-200 text-black'
                : 'bg-[#142338] border-[#203657] hover:bg-[#1f3757] text-white'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar Almacenamiento
          </button>
        </div>

        {files.length === 0 ? (
          <div className="text-center py-10 text-xs opacity-70">
            No se han registrado archivos de levantamiento aún. Ejecuta un disparo para exportar en .stg y .z2d.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className={`border-b opacity-80 ${isSunlightMode ? 'border-black' : 'border-[#1b2b41]'}`}>
                  <th className="py-2.5 px-3">Archivo</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Puntos</th>
                  <th className="py-2.5 px-3">Tamaño</th>
                  <th className="py-2.5 px-3">Creación</th>
                  <th className="py-2.5 px-3 text-right">Descargas de Gabinete</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isSunlightMode ? 'divide-slate-200' : 'divide-[#152338]'}`}>
                {files.map((file) => (
                  <tr
                    key={file.name}
                    className={`transition-colors ${
                      isSunlightMode ? 'hover:bg-slate-50' : 'hover:bg-[#0e192a]'
                    }`}
                  >
                    <td className="py-3 px-3 font-bold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      {file.name}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded uppercase text-[10px] font-bold border ${
                          isSunlightMode
                            ? 'bg-slate-200 border-black text-black'
                            : 'bg-[#162740] border-[#213757] text-cyan-300'
                        }`}
                      >
                        {file.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold">{file.pointsCount}</td>
                    <td className="py-3 px-3 opacity-80">{(file.sizeBytes / 1024).toFixed(1)} KB</td>
                    <td className="py-3 px-3 opacity-80">{new Date(file.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handlePreview(file.name, 'z2d')}
                          className={`px-2.5 py-1.5 rounded flex items-center gap-1 text-[11px] font-bold border transition-colors ${
                            isSunlightMode
                              ? 'bg-slate-200 border-black text-black hover:bg-slate-300'
                              : 'bg-[#17273f] border-[#223654] text-[#93b0d4] hover:text-white'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver
                        </button>
                        <button
                          onClick={() => handleDownload(file.name, 'z2d')}
                          className={`px-2.5 py-1.5 rounded flex items-center gap-1 text-[11px] font-bold border transition-colors ${
                            isSunlightMode
                              ? 'bg-blue-100 border-black text-blue-900 hover:bg-blue-200'
                              : 'bg-blue-600/30 border-blue-500/40 text-blue-300 hover:bg-blue-600/50'
                          }`}
                          title="Formato EarthImager 2D (.z2d)"
                        >
                          <Download className="w-3.5 h-3.5" />
                          .z2d
                        </button>
                        <button
                          onClick={() => handleDownload(file.name, 'stg')}
                          className={`px-2.5 py-1.5 rounded flex items-center gap-1 text-[11px] font-bold border transition-colors ${
                            isSunlightMode
                              ? 'bg-emerald-100 border-black text-emerald-900 hover:bg-emerald-200'
                              : 'bg-emerald-600/30 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/50'
                          }`}
                          title="SuperSting Nativo (.stg)"
                        >
                          <Download className="w-3.5 h-3.5" />
                          .stg
                        </button>
                        <button
                          onClick={() => handleDownload(file.name, 'csv')}
                          className={`px-2.5 py-1.5 rounded flex items-center gap-1 text-[11px] font-bold border transition-colors ${
                            isSunlightMode
                              ? 'bg-amber-100 border-black text-amber-900 hover:bg-amber-200'
                              : 'bg-amber-600/30 border-amber-500/40 text-amber-300 hover:bg-amber-600/50'
                          }`}
                          title="CSV con coordenadas y voltajes"
                        >
                          <Download className="w-3.5 h-3.5" />
                          .csv
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Raw Preview Modal */}
      {previewContent && (
        <div
          className={`rounded-xl border p-4 shadow-xl transition-colors ${
            isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0b1320] border-[#1e2e46] text-white'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold font-mono flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-500" />
              Vista Previa de Gabinete: {previewFilename}
            </span>
            <button
              onClick={() => setPreviewContent(null)}
              className={`text-xs px-2.5 py-1 rounded border font-bold ${
                isSunlightMode
                  ? 'border-black hover:bg-slate-200 text-black'
                  : 'border-slate-700 hover:bg-slate-800 text-slate-300'
              }`}
            >
              ✕ Cerrar
            </button>
          </div>
          <pre
            className={`p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto border ${
              isSunlightMode ? 'bg-slate-50 border-black text-black' : 'bg-[#070d16] border-[#152338] text-slate-300'
            }`}
          >
            {previewContent}
          </pre>
        </div>
      )}
    </div>
  );
};

/**
 * SITREP v6 - Carga Masiva Page
 * =============================
 * Importacion masiva de datos via API
 */

import React, { useState } from 'react';
import {
  Upload,
  FileText,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { toast } from '../../components/ui/Toast';
import api from '../../services/api';

// Type for upload results
interface CargaResultado {
  id: number;
  archivo: string;
  fecha: string;
  registros: number;
  exitosos: number;
  fallidos: number;
  estado: string;
}

// Historial starts empty - populated by actual uploads

// Template types for download — match backend routes in notification.routes.ts
const TEMPLATE_TYPES = [
  { tipo: 'generadores', label: 'Generadores', version: 'v2.0', color: 'primary', bgColor: 'bg-primary-100', textColor: 'text-primary-600' },
  { tipo: 'transportistas', label: 'Transportistas', version: 'v1.5', color: 'purple', bgColor: 'bg-purple-100', textColor: 'text-purple-600' },
  { tipo: 'operadores', label: 'Operadores', version: 'v1.0', color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-600' },
];

const CargaMasivaPage: React.FC = () => {
  const [dragActive, setDragActive] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [tipoSeleccionado, setTipoSeleccionado] = useState('generadores');
  const [historial, setHistorial] = useState<CargaResultado[]>([]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setArchivo(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setArchivo(e.target.files[0]);
    }
  };

  const descargarPlantilla = async (tipo: string) => {
    try {
      const { data } = await api.get(`/carga-masiva/plantilla/${tipo}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_${tipo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Descargado', `Plantilla de ${tipo} descargada`);
    } catch {
      toast.info('Plantilla', 'Descarga disponible cuando el API este conectado');
    }
  };

  const procesarArchivo = async () => {
    if (!archivo) return;
    setProcesando(true);
    setProgreso(0);

    try {
      // Build FormData for real upload
      const formData = new FormData();
      formData.append('archivo', archivo);

      // Use XMLHttpRequest for progress tracking
      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 90); // reserve 10% for server processing
            setProgreso(percent);
          }
        });

        xhr.addEventListener('load', () => {
          setProgreso(100);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              resolve({ data: null });
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

        // Add auth token
        const token = localStorage.getItem('sitrep_access_token');
        const apiBase = import.meta.env.VITE_API_URL || '/api';
        xhr.open('POST', `${apiBase}/carga-masiva/${tipoSeleccionado}`);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(formData);
      });

      // Process response
      const resultData = result?.data;
      const nuevoRegistro: CargaResultado = {
        id: historial.length + 1,
        archivo: archivo.name,
        fecha: new Date().toLocaleString('es-AR'),
        registros: resultData?.total || 0,
        exitosos: resultData?.exitosos || resultData?.total || 0,
        fallidos: resultData?.fallidos || 0,
        estado: resultData?.fallidos > 0 ? 'parcial' : 'completado',
      };

      setHistorial(prev => [nuevoRegistro, ...prev]);
      toast.success('Carga completada', `Se procesaron ${nuevoRegistro.registros} registros de ${archivo.name}`);
    } catch {
      toast.error('Error de carga', `No se pudo procesar el archivo ${archivo.name}. Verifica el formato e intenta nuevamente.`);
    } finally {
      setProcesando(false);
      setArchivo(null);
      setProgreso(0);
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'completado':
        return <Badge variant="soft" color="success"><CheckCircle size={12} className="mr-1" /> Completado</Badge>;
      case 'parcial':
        return <Badge variant="soft" color="warning"><AlertTriangle size={12} className="mr-1" /> Parcial</Badge>;
      case 'error':
        return <Badge variant="soft" color="error"><XCircle size={12} className="mr-1" /> Error</Badge>;
      default:
        return <Badge variant="soft" color="neutral">{estado}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Carga Masiva</h2>
        <p className="text-neutral-600 mt-1">
          Importa datos masivamente mediante archivos Excel o CSV
        </p>
      </div>

      {/* Plantillas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TEMPLATE_TYPES.map(tmpl => (
          <Card key={tmpl.tipo} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 ${tmpl.bgColor} rounded-lg`}>
                  <FileSpreadsheet size={20} className={tmpl.textColor} />
                </div>
                <div>
                  <h4 className="font-semibold text-neutral-900">{tmpl.label}</h4>
                  <p className="text-xs text-neutral-500">Template {tmpl.version}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                fullWidth
                leftIcon={<Download size={14} />}
                onClick={() => descargarPlantilla(tmpl.tipo)}
              >
                Descargar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Area de carga */}
      <Card>
        <CardHeader title="Subir Archivo" />
        <CardContent>
          {/* Tipo selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Tipo de carga</label>
            <select
              value={tipoSeleccionado}
              onChange={(e) => setTipoSeleccionado(e.target.value)}
              className="px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="generadores">Generadores</option>
              <option value="transportistas">Transportistas</option>
              <option value="operadores">Operadores</option>
            </select>
          </div>

          <div
            className={`
              border-2 border-dashed rounded-2xl p-8 text-center transition-colors
              ${dragActive ? 'border-primary-500 bg-primary-50' : 'border-neutral-300 bg-neutral-50'}
              ${archivo ? 'bg-success-50 border-success-300' : ''}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={handleChange}
            />

            {!archivo ? (
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Upload size={28} className="text-primary-500" />
                </div>
                <h4 className="text-lg font-semibold text-neutral-900 mb-2">
                  Arrastra y suelta tu archivo aqui
                </h4>
                <p className="text-neutral-600 mb-4">
                  o <span className="text-primary-600 font-medium">haz clic para seleccionar</span>
                </p>
                <p className="text-sm text-neutral-500">
                  Formatos soportados: .xlsx, .xls, .csv (Max. 10MB)
                </p>
              </label>
            ) : (
              <div>
                <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText size={28} className="text-success-600" />
                </div>
                <h4 className="text-lg font-semibold text-neutral-900 mb-1">{archivo.name}</h4>
                <p className="text-neutral-600 mb-4">
                  {(archivo.size / 1024 / 1024).toFixed(2)} MB
                </p>

                {procesando ? (
                  <div className="max-w-xs mx-auto">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-neutral-600 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Procesando...
                      </span>
                      <span className="font-medium">{progreso}%</span>
                    </div>
                    <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-all duration-300"
                        style={{ width: `${progreso}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={() => setArchivo(null)} leftIcon={<Trash2 size={16} />}>
                      Eliminar
                    </Button>
                    <Button onClick={procesarArchivo} leftIcon={<RefreshCw size={16} />}>
                      Procesar
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Historial */}
      <Card>
        <CardHeader title="Historial de Cargas" icon={<FileText size={20} />} />
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full table-fixed">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: "30%" }}>Archivo</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: "18%" }}>Fecha</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: "12%" }}>Registros</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: "22%" }}>Resultado</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: "18%" }}>Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {historial.map((carga) => (
                  <tr key={carga.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={18} className="text-success-600" />
                        <span className="font-medium text-neutral-900 truncate">{carga.archivo}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-neutral-600 hidden md:table-cell">{carga.fecha}</td>
                    <td className="px-3 py-2.5 text-sm text-neutral-900 hidden md:table-cell">{carga.registros}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-success-600 font-medium">{carga.exitosos} OK</span>
                        {carga.fallidos > 0 && (
                          <>
                            <span className="text-neutral-400">|</span>
                            <span className="text-error-600 font-medium">{carga.fallidos} Fallidos</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {getEstadoBadge(carga.estado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CargaMasivaPage;

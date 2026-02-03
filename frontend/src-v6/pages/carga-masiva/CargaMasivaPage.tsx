/**
 * SITREP v6 - Carga Masiva Page
 * =============================
 * Importación masiva de datos
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
  RefreshCw
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { toast } from '../../components/ui/Toast';

// Mock data de historial
const historialCargas = [
  { id: 1, archivo: 'manifiestos_enero_2025.xlsx', fecha: '2025-01-31 14:30', registros: 45, exitosos: 45, fallidos: 0, estado: 'completado' },
  { id: 2, archivo: 'generadores_nuevos.xlsx', fecha: '2025-01-30 10:15', registros: 12, exitosos: 10, fallidos: 2, estado: 'parcial' },
  { id: 3, archivo: 'transportistas_q1.xlsx', fecha: '2025-01-28 16:45', registros: 8, exitosos: 0, fallidos: 8, estado: 'error' },
  { id: 4, archivo: 'residuos_catalogo.xlsx', fecha: '2025-01-25 09:00', registros: 156, exitosos: 156, fallidos: 0, estado: 'completado' },
];

const CargaMasivaPage: React.FC = () => {
  const [dragActive, setDragActive] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);

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

  const procesarArchivo = async () => {
    if (!archivo) return;
    setProcesando(true);
    setProgreso(0);

    // Simular progreso
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setProgreso(i);
    }

    setProcesando(false);
    toast.success('Carga completada', `Se procesaron los datos de ${archivo.name}`);
    setArchivo(null);
    setProgreso(0);
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
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <FileSpreadsheet size={20} className="text-primary-600" />
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900">Manifiestos</h4>
                <p className="text-xs text-neutral-500">Template v2.0</p>
              </div>
            </div>
            <Button variant="outline" size="sm" fullWidth leftIcon={<Download size={14} />}>
              Descargar
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileSpreadsheet size={20} className="text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900">Actores</h4>
                <p className="text-xs text-neutral-500">Template v1.5</p>
              </div>
            </div>
            <Button variant="outline" size="sm" fullWidth leftIcon={<Download size={14} />}>
              Descargar
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <FileSpreadsheet size={20} className="text-orange-600" />
              </div>
              <div>
                <h4 className="font-semibold text-neutral-900">Residuos</h4>
                <p className="text-xs text-neutral-500">Template v1.0</p>
              </div>
            </div>
            <Button variant="outline" size="sm" fullWidth leftIcon={<Download size={14} />}>
              Descargar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Área de carga */}
      <Card>
        <CardHeader title="Subir Archivo" />
        <CardContent>
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
                  Arrastra y suelta tu archivo aquí
                </h4>
                <p className="text-neutral-600 mb-4">
                  o <span className="text-primary-600 font-medium">haz clic para seleccionar</span>
                </p>
                <p className="text-sm text-neutral-500">
                  Formatos soportados: .xlsx, .xls, .csv (Máx. 10MB)
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
                      <span className="text-neutral-600">Procesando...</span>
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
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase">Archivo</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase">Fecha</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase">Registros</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase">Resultado</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {historialCargas.map((carga) => (
                  <tr key={carga.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={18} className="text-success-600" />
                        <span className="font-medium text-neutral-900">{carga.archivo}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{carga.fecha}</td>
                    <td className="px-6 py-4 text-sm text-neutral-900">{carga.registros}</td>
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4">
                      {getEstadoBadge(carga.estado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CargaMasivaPage;

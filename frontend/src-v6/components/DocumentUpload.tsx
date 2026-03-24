import React, { useRef, useState } from 'react';
import { Upload, FileText, Download, CheckCircle, XCircle, Clock, Trash2, Eye } from 'lucide-react';
import { Button } from './ui/ButtonV2';
import { Badge } from './ui/BadgeV2';
import type { Documento } from '../services/generador-fiscal.service';

const TIPO_LABELS: Record<string, string> = {
  CERTIFICADO_AMBIENTAL: 'Certificado Ambiental',
  DDJJ_ANUAL: 'DDJJ Anual',
  INFORME_TECNICO: 'Informe Tecnico',
  LIBRO_OPERATORIA: 'Libro de Operatoria',
  COMPROBANTE_PAGO: 'Comprobante de Pago',
  OTRO: 'Otro',
};

const ESTADO_CONFIG = {
  PENDIENTE: { color: 'warning' as const, icon: Clock, label: 'Pendiente' },
  APROBADO: { color: 'success' as const, icon: CheckCircle, label: 'Aprobado' },
  RECHAZADO: { color: 'error' as const, icon: XCircle, label: 'Rechazado' },
};

interface DocumentUploadProps {
  documentos: Documento[];
  onUpload: (file: File, tipo: string, anio?: number) => void;
  onDownload: (doc: Documento) => void;
  onRevisar?: (docId: string, estado: 'APROBADO' | 'RECHAZADO', observaciones?: string) => void;
  onDelete?: (docId: string) => void;
  isAdmin: boolean;
  isPending?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documentos, onUpload, onDownload, onRevisar, onDelete, isAdmin, isPending
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState('CERTIFICADO_AMBIENTAL');
  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      alert('Solo se permiten archivos PDF, JPG o PNG');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo no puede superar 10 MB');
      return;
    }
    onUpload(file, tipo, anio);
  };

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Tipo documento</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-neutral-200 text-sm bg-white focus:border-primary-500 focus:outline-none"
            >
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Ano fiscal</label>
            <input
              type="number"
              value={anio}
              onChange={e => setAnio(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl border border-neutral-200 text-sm focus:border-primary-500 focus:outline-none"
              min={2015}
              max={2030}
            />
          </div>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-primary-400 bg-primary-50' : 'border-neutral-200 hover:border-primary-300 hover:bg-neutral-50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
      >
        <Upload size={24} className="text-neutral-400 mx-auto mb-2" />
        <p className="text-sm text-neutral-600">
          {isPending ? 'Subiendo...' : 'Arrastra un archivo aqui o haz click para seleccionar'}
        </p>
        <p className="text-xs text-neutral-400 mt-1">PDF, JPG, PNG (max 10 MB)</p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* Documents list */}
      {documentos.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">{documentos.length} documento{documentos.length !== 1 ? 's' : ''}</p>
          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
            {documentos.map(doc => {
              const est = ESTADO_CONFIG[doc.estado as keyof typeof ESTADO_CONFIG] || ESTADO_CONFIG.PENDIENTE;
              const EstIcon = est.icon;
              return (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-neutral-50 transition-colors">
                  <FileText size={18} className="text-neutral-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{doc.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-neutral-400">{TIPO_LABELS[doc.tipo] || doc.tipo}</span>
                      {doc.anio && <span className="text-xs text-neutral-400">· {doc.anio}</span>}
                      <span className="text-xs text-neutral-400">· {formatSize(doc.size)}</span>
                    </div>
                  </div>
                  <Badge variant="soft" color={est.color}>
                    <EstIcon size={12} className="mr-1" />
                    {est.label}
                  </Badge>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onDownload(doc)}
                      className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500"
                      title="Descargar"
                    >
                      <Download size={15} />
                    </button>
                    {isAdmin && doc.estado === 'PENDIENTE' && onRevisar && (
                      <>
                        <button
                          onClick={() => onRevisar(doc.id, 'APROBADO')}
                          className="p-1.5 rounded-lg hover:bg-success-50 text-success-600"
                          title="Aprobar"
                        >
                          <CheckCircle size={15} />
                        </button>
                        <button
                          onClick={() => onRevisar(doc.id, 'RECHAZADO')}
                          className="p-1.5 rounded-lg hover:bg-error-50 text-error-600"
                          title="Rechazar"
                        >
                          <XCircle size={15} />
                        </button>
                      </>
                    )}
                    {isAdmin && onDelete && (
                      <button
                        onClick={() => onDelete(doc.id)}
                        className="p-1.5 rounded-lg hover:bg-error-50 text-neutral-400 hover:text-error-600"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;

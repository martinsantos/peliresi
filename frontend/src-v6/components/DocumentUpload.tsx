import React, { useId, useRef, useState } from 'react';
import { Upload, FileText, Download, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import { Badge } from './ui/BadgeV2';
import type { Documento } from '../services/generador-fiscal.service';
import { DocumentAnalysis } from './DocumentAnalysis';

const TIPO_LABELS: Record<string, string> = {
  CERTIFICADO_AMBIENTAL: 'Certificado Ambiental',
  DDJJ_ANUAL: 'DDJJ Anual',
  INFORME_TECNICO: 'Informe Tecnico',
  LIBRO_OPERATORIA: 'Libro de Operatoria',
  COMPROBANTE_PAGO: 'Comprobante de sellado / pago',
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
  readOnly?: boolean;
  initialTipo?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documentos, onUpload, onDownload, onRevisar, onDelete, isAdmin, isPending, readOnly = false, initialTipo = 'CERTIFICADO_AMBIENTAL'
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const controlId = useId();
  const [tipo, setTipo] = useState(initialTipo);
  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (readOnly || isPending || !files?.length) return;
    const file = files[0];
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      setFileError('Elegí un PDF, JPG o PNG.');
      return;
    }
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setFileError('El archivo debe tener contenido y no superar 10 MB.');
      return;
    }
    setFileError(null);
    onUpload(file, tipo, anio);
  };

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      {!readOnly && <>
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${controlId}-tipo`} className="block text-sm font-medium text-neutral-700 mb-1">Tipo documento</label>
            <select
              id={`${controlId}-tipo`}
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="w-full min-h-11 px-3 rounded-xl border border-neutral-300 text-base sm:text-sm bg-white focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${controlId}-anio`} className="block text-sm font-medium text-neutral-700 mb-1">Año fiscal</label>
            <input
              id={`${controlId}-anio`}
              type="number"
              value={anio}
              onChange={e => setAnio(Number(e.target.value))}
              className="w-full min-h-11 px-3 rounded-xl border border-neutral-300 text-base sm:text-sm focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-100"
              min={2015}
              max={2030}
            />
          </div>
        </div>
      </div>
      {tipo === 'COMPROBANTE_PAGO' && <p className="text-sm leading-6 text-neutral-700">Sellados tributarios: recibo de caja de banco o comprobante de transferencia. La lectura ayuda a revisar el original; no acredita el pago ni lo confunde con la TEF.</p>}

      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-primary-400 bg-primary-50' : 'border-neutral-200 hover:border-primary-300 hover:bg-neutral-50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        role="button" tabIndex={isPending ? -1 : 0} aria-label="Adjuntar documento" aria-disabled={!!isPending}
        onKeyDown={event => { if (!isPending && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); fileRef.current?.click(); } }}
        onClick={() => { if (!isPending) fileRef.current?.click(); }}
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
          disabled={!!isPending}
          onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>
      {fileError && <p role="alert" className="text-sm text-error-700">{fileError}</p>}

      </>}
      {/* Documents list */}
      {documentos.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">{documentos.length} documento{documentos.length !== 1 ? 's' : ''}</p>
          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
            {documentos.map(doc => {
              const est = ESTADO_CONFIG[doc.estado as keyof typeof ESTADO_CONFIG] || ESTADO_CONFIG.PENDIENTE;
              const EstIcon = est.icon;
              return (
                <div key={doc.id} className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3 bg-white hover:bg-neutral-50 transition-colors sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                  <FileText size={18} className="text-neutral-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{doc.nombre}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                      <span className="text-xs text-neutral-400 break-words">{TIPO_LABELS[doc.tipo] || doc.tipo}</span>
                      {doc.anio && <span className="text-xs text-neutral-400">· {doc.anio}</span>}
                      <span className="text-xs text-neutral-400">· {formatSize(doc.size)}</span>
                    </div>
                  </div>
                  <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 sm:contents">
                  <Badge variant="soft" color={est.color}>
                    <EstIcon size={12} className="mr-1" />
                    {est.label}
                  </Badge>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label={`Descargar ${doc.nombre}`}
                      onClick={() => onDownload(doc)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-neutral-100 text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      title="Descargar"
                    >
                      <Download size={15} />
                    </button>
                    {!readOnly && isAdmin && doc.estado === 'PENDIENTE' && onRevisar && (
                      <>
                        <button
                          type="button"
                          aria-label={`Aprobar ${doc.nombre}`}
                          onClick={() => onRevisar(doc.id, 'APROBADO')}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-success-50 text-success-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          title="Aprobar"
                        >
                          <CheckCircle size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Rechazar ${doc.nombre}`}
                          onClick={() => onRevisar(doc.id, 'RECHAZADO')}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-error-50 text-error-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          title="Rechazar"
                        >
                          <XCircle size={15} />
                        </button>
                      </>
                    )}
                    {!readOnly && isAdmin && onDelete && (
                      <button
                        type="button"
                        aria-label={`Eliminar ${doc.nombre}`}
                        onClick={() => onDelete(doc.id)}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-error-50 text-neutral-400 hover:text-error-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  </div>
                  {doc.analisis && <div className="col-span-2 w-full sm:basis-full"><DocumentAnalysis analysis={doc.analisis} /></div>}
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

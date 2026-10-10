/**
 * Step Documentos — File upload step for required documents
 */
import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileText, Loader2, Paperclip, RefreshCw, Upload, X } from 'lucide-react';
import { Button } from '../../../../components/ui/ButtonV2';
import { SectionTitle } from '../SectionTitle';
import type { DocDef } from '../shared';
import type { DocumentoSolicitud } from '../../../../types/api';
import { DocumentAnalysis } from '../../../../components/DocumentAnalysis';
import type { ReceiptAnalysis } from '../../../../types/documentAnalysis';

interface StepDocumentosProps {
  reviewMode?: boolean;
  docs: DocDef[];
  adjuntos: Record<string, File>;
  uploadedDocs: Record<string, DocumentoSolicitud>;
  previewAnalyses?: Record<string, ReceiptAnalysis>;
  uploadStates: Record<string, 'uploading' | 'deleting' | 'reading' | 'downloading' | 'error' | undefined>;
  uploadErrors: Record<string, string | undefined>;
  requirementsStatus: 'loading' | 'loaded' | 'error';
  maxBytes: number;
  onRetryRequirements: () => void;
  onAddFile: (tipo: string, file: File) => unknown | Promise<unknown>;
  onRemoveFile: (tipo: string) => void | Promise<void>;
  onRetryReading?: (tipo: string) => void | Promise<void>;
  onDownloadFile?: (tipo: string) => void | Promise<void>;
}

export const StepDocumentos: React.FC<StepDocumentosProps> = ({
  reviewMode = false,
  docs,
  adjuntos,
  uploadedDocs,
  previewAnalyses = {},
  uploadStates,
  uploadErrors,
  requirementsStatus,
  maxBytes,
  onRetryRequirements,
  onAddFile,
  onRemoveFile,
  onRetryReading,
  onDownloadFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocTipo, setActiveDocTipo] = useState<string | null>(null);

  const triggerFileInput = (tipo: string) => {
    setActiveDocTipo(tipo);
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeDocTipo) {
      onAddFile(activeDocTipo, file);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <SectionTitle icon={FileText} title="Documentos" />
      <p className="text-sm leading-relaxed text-neutral-700">{reviewMode ? 'Probá la lectura real con un documento de prueba. El archivo se procesa temporalmente y se elimina: al volver se recuperan tus datos, no el archivo.' : <>Los documentos marcados como <strong>Guardado</strong> quedan en tu solicitud y se recuperan al volver.</>}</p>
      {reviewMode && <p className="text-sm leading-6 text-neutral-700">La prueba no consulta recibos de otros usuarios ni registra pagos o avisos.</p>}
      <p className="text-sm text-neutral-500">Formatos aceptados: PDF, JPG y PNG. Máximo {(maxBytes / 1024 / 1024).toFixed(0)} MB por archivo.</p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        aria-label={activeDocTipo ? `Adjuntar ${docs.find(doc => doc.tipo === activeDocTipo)?.nombre || 'documento'}` : 'Adjuntar documento'}
        className="hidden"
        onChange={handleFileSelect}
      />
      {requirementsStatus === 'loading' && (
        <div className="flex min-h-28 items-center justify-center gap-2 rounded-xl border border-neutral-200 text-sm text-neutral-500" role="status">
          <Loader2 size={16} className="animate-spin" /> Cargando requisitos vigentes…
        </div>
      )}
      {requirementsStatus === 'error' && (
        <div className="rounded-xl border border-error-200 bg-error-50 p-4" role="alert">
          <div className="flex items-start gap-2 text-sm text-error-800"><AlertCircle size={17} className="mt-0.5 shrink-0" /> No pudimos consultar los requisitos vigentes. No adjuntes documentación hasta recuperarlos.</div>
          <Button className="mt-3" variant="outline" size="sm" leftIcon={<RefreshCw size={14} />} onClick={onRetryRequirements}>Reintentar</Button>
        </div>
      )}
      {requirementsStatus === 'loaded' && <div className="space-y-3">
        {docs.map(doc => {
          const pendingFile = adjuntos[doc.tipo];
          const uploaded = uploadedDocs[doc.tipo];
          const state = uploadStates[doc.tipo];
          const attached = uploaded || pendingFile;
          const isBusy = state === 'uploading' || state === 'deleting' || state === 'reading' || state === 'downloading';
          const rejected = uploaded?.estado === 'RECHAZADO';
          return (
            <div key={doc.tipo} data-testid={`registration-document-${doc.tipo}`} className={`rounded-xl border p-3 transition-colors ${state === 'error' || rejected ? 'border-error-200 bg-error-50/60' : uploaded ? 'border-emerald-200 bg-emerald-50/60' : 'border-neutral-200 bg-neutral-50'}`}>
              <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {state === 'uploading' || state === 'deleting'
                  ? <Loader2 size={17} className="shrink-0 animate-spin text-[#0D8A4F]" />
                  : rejected ? <AlertCircle size={17} className="shrink-0 text-error-700" /> : uploaded ? <CheckCircle2 size={17} className="shrink-0 text-emerald-600" /> : <Paperclip size={16} className="shrink-0 text-neutral-400" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-800">{doc.nombre} {doc.required && <span className="text-error-600" aria-label="obligatorio">*</span>}</p>
                  {attached && (
                    <div className={`text-xs ${uploaded ? 'text-emerald-700' : 'text-neutral-600'}`}>
                      <p className="truncate" title={pendingFile?.name || uploaded?.nombre}>{pendingFile?.name || uploaded?.nombre}</p>
                      <p>{((pendingFile?.size || uploaded?.size || 0) / 1024).toFixed(0)} KB · {state === 'uploading' ? 'Subiendo…' : state === 'deleting' ? 'Eliminando…' : pendingFile ? (reviewMode ? 'Seleccionado para revisión' : 'Pendiente') : 'Guardado'}{state === 'reading' ? ' · Leyendo…' : state === 'downloading' ? ' · Descargando…' : ''}</p>
                      {pendingFile && uploaded && <p className="text-neutral-700">Reemplazo pendiente. El original {uploaded.nombre} sigue guardado hasta confirmar la nueva carga.</p>}
                    </div>
                  )}
                </div>
              </div>
              {attached ? (
                <div className="flex shrink-0 flex-wrap items-center justify-end">
                {uploaded && <button type="button" disabled={isBusy} aria-label={`Reemplazar ${doc.nombre}`} onClick={() => triggerFileInput(doc.tipo)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary-800 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 disabled:opacity-40">Reemplazar</button>}
                {uploaded && onDownloadFile && <button type="button" disabled={isBusy} aria-label={`Descargar ${uploaded.nombre}`} onClick={() => void onDownloadFile(doc.tipo)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-primary-800 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 disabled:opacity-40"><Download size={16} aria-hidden="true" /></button>}
                <button type="button" disabled={isBusy} aria-label={pendingFile && uploaded ? `Descartar selección pendiente de ${doc.nombre}` : `Eliminar ${doc.nombre}`} onClick={() => void onRemoveFile(doc.tipo)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-error-500 transition-colors hover:bg-error-100 disabled:opacity-40">
                  <X size={16} />
                </button>
                </div>
              ) : (
                <Button className="min-h-11" variant="outline" size="sm" leftIcon={<Upload size={14} />} disabled={isBusy} onClick={() => triggerFileInput(doc.tipo)}>
                  Adjuntar
                </Button>
              )}
              </div>
              {rejected && <p className="mt-2 text-sm text-error-800" role="alert">Documento rechazado: {uploaded.observaciones || 'Reemplazalo para corregir la solicitud antes de enviarla.'}</p>}
              {uploadErrors[doc.tipo] && <p className="mt-2 flex items-start gap-1.5 text-xs text-error-700" role="alert"><AlertCircle size={14} className="mt-0.5 shrink-0" />{uploadErrors[doc.tipo]}</p>}
              {state === 'error' && pendingFile && <Button variant="outline" size="sm" className="mt-2" onClick={() => void onAddFile(doc.tipo, pendingFile)}>Reintentar {doc.nombre}</Button>}
              {doc.tipo === 'COMPROBANTE_PAGO' && !uploaded && <p className="mt-2 text-sm leading-6 text-neutral-700">Sellados tributarios: recibo de caja de banco o comprobante de transferencia. Se revisa el original; no se acredita automáticamente un pago de TEF.</p>}
              <DocumentAnalysis analysis={reviewMode ? previewAnalyses[doc.tipo] : pendingFile ? undefined : uploaded?.analisis} kind={doc.tipo.startsWith('LICENCIA_CHOFER_') ? 'license' : doc.tipo === 'COMPROBANTE_PAGO' ? 'receipt' : 'document'} persisted={!reviewMode} retrying={isBusy} onRetry={(uploaded || reviewMode && pendingFile) && onRetryReading ? () => void onRetryReading(doc.tipo) : undefined} />
            </div>
          );
        })}
      </div>}
    </div>
  );
};

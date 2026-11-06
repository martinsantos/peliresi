/**
 * Step Documentos — File upload step for required documents
 */
import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Download, FileText, Loader2, Paperclip, RefreshCw, Upload, X } from 'lucide-react';
import { Button } from '../../../../components/ui/ButtonV2';
import { SectionTitle } from '../SectionTitle';
import type { DocDef } from '../shared';
import type { DocumentoSolicitud } from '../../../../types/api';
import { registrationDocumentReviewLabel } from '../../../../utils/registrationDocumentReview';
import { DocumentAnalysis } from '../../../../components/DocumentAnalysis';
import type { ReceiptAnalysis } from '../../../../types/documentAnalysis';

interface StepDocumentosProps {
  reviewMode?: boolean;
  missingFiles?: string[];
  docs: DocDef[];
  adjuntos: Record<string, File>;
  uploadedDocs: Record<string, DocumentoSolicitud>;
  previewAnalyses?: Record<string, ReceiptAnalysis>;
  uploadStates: Record<string, 'uploading' | 'deleting' | 'reading' | 'downloading' | 'error' | undefined>;
  readingFeedback?: Record<string, string | undefined>;
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
  missingFiles = [],
  docs,
  adjuntos,
  uploadedDocs,
  previewAnalyses = {},
  uploadStates,
  uploadErrors,
  readingFeedback = {},
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
      <details className="group text-sm text-neutral-700">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700">PDF, JPG o PNG · hasta {(maxBytes / 1024 / 1024).toFixed(0)} MB<ChevronDown size={16} aria-hidden="true" className="shrink-0 group-open:rotate-180" /></summary>
        <p className="pb-2 leading-6">{reviewMode ? 'Usá documentos de prueba. La prueba no consulta recibos de otros usuarios ni registra pagos o avisos.' : <>Los archivos marcados como <strong>Guardado</strong> se recuperan al volver.</>}</p>
      </details>
      {reviewMode && <p className="text-sm text-neutral-700">En prueba los archivos no se conservan al salir.</p>}
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
          const analysis = reviewMode ? previewAnalyses[doc.tipo] : pendingFile ? undefined : uploaded?.analisis;
          const readingNotice = analysis && analysis.lectura !== 'LEIDO' ? undefined : readingFeedback[doc.tipo];
          const attached = uploaded || pendingFile;
          const isBusy = state === 'uploading' || state === 'deleting' || state === 'reading' || state === 'downloading';
          const rejected = uploaded?.estado === 'RECHAZADO';
          const missing = missingFiles.includes(doc.tipo);
          const approved = uploaded?.estado === 'APROBADO' && !pendingFile && !missing;
          return (
            <div key={doc.tipo} data-testid={`registration-document-${doc.tipo}`} className={`rounded-xl border p-3 transition-colors ${state === 'error' || rejected ? 'border-error-200 bg-error-50/60' : approved ? 'border-emerald-200 bg-emerald-50/60' : 'border-neutral-200 bg-neutral-50'}`}>
              <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {state === 'uploading' || state === 'deleting'
                  ? <Loader2 size={17} className="shrink-0 animate-spin text-[#0D8A4F]" />
                  : rejected ? <AlertCircle size={17} className="shrink-0 text-error-700" /> : approved ? <CheckCircle2 size={17} className="shrink-0 text-emerald-600" /> : <Paperclip size={16} className="shrink-0 text-neutral-400" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-800">{doc.nombre} {doc.required && <span className="text-error-600" aria-label="obligatorio">*</span>}{doc.tipo === 'FACTURA_ELECTRICA' && !doc.required && <span className="font-normal text-neutral-600"> · Opcional</span>}</p>
                  {attached && (
                    <div className={`text-xs ${approved ? 'text-emerald-700' : 'text-neutral-600'}`}>
                      <p className="truncate" title={pendingFile?.name || uploaded?.nombre}>{pendingFile?.name || uploaded?.nombre}</p>
                      <p>{((pendingFile?.size || uploaded?.size || 0) / 1024).toFixed(0)} KB · {state === 'uploading' ? 'Subiendo…' : state === 'deleting' ? 'Eliminando…' : pendingFile ? (reviewMode ? 'Seleccionado para revisión' : 'Pendiente') : missing ? 'Original guardado · selección pendiente de recuperar' : `Guardado · ${registrationDocumentReviewLabel(uploaded?.estado)}`}{state === 'reading' ? ' · Leyendo…' : state === 'downloading' ? ' · Descargando…' : ''}</p>
                      {pendingFile && uploaded && <p className="text-neutral-700">Reemplazo pendiente. El original {uploaded.nombre} sigue guardado hasta confirmar la nueva carga.</p>}
                    </div>
                  )}
                </div>
              </div>
              {attached ? (
                <div className="flex shrink-0 flex-wrap items-center justify-end">
                {uploaded && <button type="button" disabled={isBusy} aria-label={`Reemplazar ${doc.nombre}`} onClick={() => triggerFileInput(doc.tipo)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary-800 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 disabled:opacity-40">Reemplazar</button>}
                {uploaded && onDownloadFile && <button type="button" disabled={isBusy} aria-label={`Descargar ${uploaded.nombre}`} onClick={() => void onDownloadFile(doc.tipo)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-primary-800 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 disabled:opacity-40"><Download size={16} aria-hidden="true" /></button>}
                <button type="button" disabled={isBusy} aria-label={(pendingFile || missing) && uploaded ? `Descartar selección pendiente de ${doc.nombre}` : `Eliminar ${doc.nombre}`} onClick={() => void onRemoveFile(doc.tipo)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-error-500 transition-colors hover:bg-error-100 disabled:opacity-40">
                  <X size={16} />
                </button>
                </div>
              ) : (
                <Button className="min-h-11" variant="outline" size="sm" leftIcon={<Upload size={14} />} disabled={isBusy} onClick={() => triggerFileInput(doc.tipo)}>
                  Adjuntar
                </Button>
              )}
              </div>
              <p role="status" aria-live="polite" aria-atomic="true" className={readingNotice && !isBusy && !uploadErrors[doc.tipo] ? "mt-2 text-sm leading-6 text-neutral-700" : "sr-only"}>{!isBusy && !uploadErrors[doc.tipo] ? readingNotice : null}</p>
              {rejected && <p className="mt-2 text-sm text-error-800" role="alert">Documento rechazado: {uploaded.observaciones || 'Reemplazalo para corregir la solicitud antes de enviarla.'}</p>}
              {uploadErrors[doc.tipo] && <p className="mt-2 flex items-start gap-1.5 text-xs text-error-700" role="alert"><AlertCircle size={14} className="mt-0.5 shrink-0" />{uploadErrors[doc.tipo]}</p>}
              {state === 'error' && pendingFile && <Button variant="outline" size="sm" className="mt-2" onClick={() => void onAddFile(doc.tipo, pendingFile)}>Reintentar {doc.nombre}</Button>}
              {doc.tipo === 'COMPROBANTE_PAGO' && !attached && <p className="mt-2 text-sm leading-6 text-neutral-700">Caja de banco o transferencia. El OCR no acredita el pago.</p>}
              {doc.tipo === 'FACTURA_ELECTRICA' && !attached && <p className="mt-2 text-sm leading-6 text-neutral-700">{doc.required ? 'Adjuntá la factura completa y legible del establecimiento.' : 'Si elegís adjuntarla, usá una factura completa y legible del establecimiento.'} Se leerán distribuidora, tarifa, período, kWh y potencia si figuran. No modifica la potencia instalada que declaraste.</p>}
              <DocumentAnalysis analysis={analysis} kind={doc.tipo.startsWith('LICENCIA_CHOFER_') ? 'license' : doc.tipo === 'CONSTANCIA_AFIP' ? 'arca' : doc.tipo === 'COMPROBANTE_PAGO' ? 'receipt' : doc.tipo === 'FACTURA_ELECTRICA' ? 'electricity' : 'document'} persisted={!reviewMode && !pendingFile} retrying={isBusy} onRetry={(uploaded && !pendingFile || reviewMode && pendingFile) && (['COMPROBANTE_PAGO', 'FACTURA_ELECTRICA', 'CONSTANCIA_AFIP'].includes(doc.tipo) || doc.tipo.startsWith('LICENCIA_CHOFER_')) && onRetryReading ? () => void onRetryReading(doc.tipo) : undefined} />
            </div>
          );
        })}
      </div>}
    </div>
  );
};

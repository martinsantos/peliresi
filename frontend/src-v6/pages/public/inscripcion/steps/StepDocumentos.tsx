/**
 * Step Documentos — File upload step for required documents
 */
import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, Paperclip, RefreshCw, Upload, X } from 'lucide-react';
import { Button } from '../../../../components/ui/ButtonV2';
import { SectionTitle } from '../SectionTitle';
import type { DocDef } from '../shared';
import type { DocumentoSolicitud } from '../../../../types/api';

interface StepDocumentosProps {
  docs: DocDef[];
  adjuntos: Record<string, File>;
  uploadedDocs: Record<string, DocumentoSolicitud>;
  uploadStates: Record<string, 'uploading' | 'deleting' | 'error' | undefined>;
  uploadErrors: Record<string, string | undefined>;
  requirementsStatus: 'loading' | 'loaded' | 'error';
  maxBytes: number;
  onRetryRequirements: () => void;
  onAddFile: (tipo: string, file: File) => void | Promise<void>;
  onRemoveFile: (tipo: string) => void | Promise<void>;
}

export const StepDocumentos: React.FC<StepDocumentosProps> = ({
  docs,
  adjuntos,
  uploadedDocs,
  uploadStates,
  uploadErrors,
  requirementsStatus,
  maxBytes,
  onRetryRequirements,
  onAddFile,
  onRemoveFile,
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
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-900">Guardado seguro, archivo por archivo</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-800">Cada documento queda guardado en tu solicitud apenas termina de subir. Podés cerrar esta página y continuar más tarde.</p>
      </div>
      <p className="text-sm text-neutral-500">Formatos aceptados: PDF, JPG y PNG. Máximo {(maxBytes / 1024 / 1024).toFixed(0)} MB por archivo.</p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
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
          const isBusy = state === 'uploading' || state === 'deleting';
          return (
            <div key={doc.tipo} className={`rounded-xl border p-3 transition-colors ${uploaded ? 'border-emerald-200 bg-emerald-50/60' : state === 'error' ? 'border-error-200 bg-error-50/60' : 'border-neutral-200 bg-neutral-50'}`}>
              <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {state === 'uploading' || state === 'deleting'
                  ? <Loader2 size={17} className="shrink-0 animate-spin text-[#0D8A4F]" />
                  : uploaded ? <CheckCircle2 size={17} className="shrink-0 text-emerald-600" /> : <Paperclip size={16} className="shrink-0 text-neutral-400" />}
                <div>
                  <p className="text-sm font-medium text-neutral-800">{doc.nombre} {doc.required && <span className="text-error-600" aria-label="obligatorio">*</span>}</p>
                  {attached && (
                    <p className={`truncate text-xs ${uploaded ? 'text-emerald-700' : 'text-neutral-600'}`}>{uploaded ? uploaded.nombre : pendingFile?.name} ({((uploaded ? uploaded.size : pendingFile?.size || 0) / 1024).toFixed(0)} KB) · {state === 'uploading' ? 'Subiendo…' : state === 'deleting' ? 'Eliminando…' : uploaded ? 'Guardado' : 'Pendiente'}</p>
                  )}
                </div>
              </div>
              {attached ? (
                <button type="button" disabled={isBusy} aria-label={`Eliminar ${doc.nombre}`} onClick={() => void onRemoveFile(doc.tipo)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-error-500 transition-colors hover:bg-error-100 disabled:opacity-40">
                  <X size={16} />
                </button>
              ) : (
                <Button className="min-h-11" variant="outline" size="sm" leftIcon={<Upload size={14} />} disabled={isBusy} onClick={() => triggerFileInput(doc.tipo)}>
                  Adjuntar
                </Button>
              )}
              </div>
              {uploadErrors[doc.tipo] && <p className="mt-2 flex items-start gap-1.5 text-xs text-error-700" role="alert"><AlertCircle size={14} className="mt-0.5 shrink-0" />{uploadErrors[doc.tipo]}</p>}
            </div>
          );
        })}
      </div>}
    </div>
  );
};

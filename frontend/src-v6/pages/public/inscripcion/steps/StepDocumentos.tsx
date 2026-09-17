/**
 * Step Documentos — File upload step for required documents
 */
import React, { useRef, useState } from 'react';
import { FileText, Paperclip, Upload, X, ScanLine, Loader2, Camera } from 'lucide-react';
import { Button } from '../../../../components/ui/ButtonV2';
import { SectionTitle } from '../SectionTitle';
import type { DocDef } from '../shared';
import { recognizeLocalDocument, releaseLocalOcrWorker, type LocalOcrResult } from '../../../../services/ocr.service';

interface StepDocumentosProps {
  docs: DocDef[];
  adjuntos: Record<string, File>;
  /** Documents already persisted in a resumable draft (metadata only). */
  existingDocuments?: Record<string, { estado?: string; estadoScan?: string }>;
  /** Enables a local-only fixture demonstration. No file is transmitted. */
  reviewMode?: boolean;
  documentDates?: Record<string, { vigenteDesde?: string; vigenteHasta?: string }>;
  onDateChange?: (tipo: string, field: 'vigenteDesde' | 'vigenteHasta', value: string) => void;
  onAddFile: (tipo: string, file: File) => void;
  onRemoveFile: (tipo: string) => void;
  onOcrResult?: (tipo: string, result: LocalOcrResult) => void;
}

export const StepDocumentos: React.FC<StepDocumentosProps> = ({
  docs,
  adjuntos,
  existingDocuments = {},
  reviewMode = false,
  documentDates = {},
  onDateChange,
  onAddFile,
  onRemoveFile,
  onOcrResult,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [activeDocKey, setActiveDocKey] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState<string | null>(null);
  const [ocrResults, setOcrResults] = useState<Record<string, LocalOcrResult>>({});

  const createReviewDocument = async (tipo: 'LICENCIA_CONDUCIR' | 'TARJETA_IDENTIFICACION_VEHICULO') => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 52px Arial';
    const lines = tipo === 'LICENCIA_CONDUCIR'
      ? ['LICENCIA NACIONAL DE CONDUCIR', 'APELLIDO: PEREZ', 'NOMBRE: JUAN', 'DNI: 20123456', 'LICENCIA: LICQA001', 'CLASE: E1', 'VENCIMIENTO: 31/12/2027']
      : ['CEDULA DE IDENTIFICACION VEHICULAR', 'DOMINIO: AB123CD', 'TITULAR: JUAN PEREZ', 'CUIT: 20-12345678-6', 'MARCA: MERCEDES-BENZ', 'MODELO: ATEGO', 'VENCIMIENTO: 31/12/2027'];
    lines.forEach((line, index) => ctx.fillText(line, 90, 130 + index * 95));
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const key = `${tipo}__FRENTE`;
    const file = new File([blob], `${tipo.toLowerCase()}-revision.png`, { type: 'image/png' });
    onAddFile(key, file);
    setOcrBusy(key);
    try {
      const result = await recognizeLocalDocument(file, tipo);
      setOcrResults(prev => ({ ...prev, [key]: result }));
      onOcrResult?.(key, result);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setOcrResults(prev => ({ ...prev, [key]: { text: `No se pudo leer el ejemplo localmente. ${detail}`, confidence: 0, language: 'spa', engine: 'tesseract.js-local' } }));
    } finally {
      setOcrBusy(null);
      await releaseLocalOcrWorker();
    }
  };

  const triggerFileInput = (key: string) => {
    setActiveDocKey(key);
    fileInputRef.current?.click();
  };

  const triggerCamera = (key: string) => {
    setActiveDocKey(key);
    cameraInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeDocKey) {
      onAddFile(activeDocKey, file);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const runOcr = async (key: string, tipo: string) => {
    const file = adjuntos[key];
    if (!file) return;
    setOcrBusy(key);
    try {
      const result = await recognizeLocalDocument(file, tipo);
      setOcrResults(prev => ({ ...prev, [key]: result }));
      onOcrResult?.(key, result);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setOcrResults(prev => ({ ...prev, [key]: { text: `No se pudo leer el documento localmente. ${detail}`, confidence: 0, language: 'spa', engine: 'tesseract.js-local' } }));
    } finally {
      setOcrBusy(null);
      await releaseLocalOcrWorker();
    }
  };

  return (
    <div className="space-y-4">
      <SectionTitle icon={FileText} title="Documentos" />
      <p className="text-sm text-neutral-500">
        Adjuntá los documentos requeridos. Formatos aceptados: PDF, JPG o PNG (máximo 10 MB).
      </p>
      {reviewMode && docs.some(doc => doc.tipo === 'LICENCIA_CONDUCIR') && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
          <p className="font-semibold">Demostración OCR local (no se envía)</p>
          <p className="mt-1 text-xs text-indigo-800">Genera una imagen sintética en este navegador y ejecuta el mismo reconocimiento local de un archivo cargado.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" leftIcon={<ScanLine size={13} />} disabled={ocrBusy !== null} onClick={() => void createReviewDocument('LICENCIA_CONDUCIR')}>Probar OCR de licencia</Button>
            <Button variant="outline" size="sm" leftIcon={<ScanLine size={13} />} disabled={ocrBusy !== null} onClick={() => void createReviewDocument('TARJETA_IDENTIFICACION_VEHICULO')}>Probar OCR de cédula azul</Button>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
      <div className="space-y-3">
        {docs.map(doc => {
          const persisted = existingDocuments[doc.tipo];
          const persistedRejected = persisted?.estado === 'RECHAZADO' || persisted?.estadoScan === 'RECHAZADO';
          const slots = doc.caras === 'FRENTE_Y_DORSO'
            ? [{ key: `${doc.tipo}__FRENTE`, label: 'Frente' }, { key: `${doc.tipo}__DORSO`, label: 'Dorso' }]
            : [{ key: doc.tipo, label: 'Archivo' }];
          return (
            <div key={doc.tipo} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-start gap-3">
                <Paperclip size={16} className="mt-0.5 text-neutral-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-800">{doc.nombre}</p>
                  <p className="mt-1 text-xs text-neutral-500">{doc.instrucciones || 'PDF, JPG o PNG. El documento debe ser legible.'}</p>
                  {doc.caras === 'FRENTE_Y_DORSO' && <p className="mt-1 text-xs font-medium text-indigo-700">En el teléfono: tomá una foto del frente y otra del dorso.</p>}
                  {doc.requiereVigencia && <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="text-xs text-neutral-700">Vigente desde · {doc.nombre}
                      <input type="date" className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm" value={documentDates[doc.tipo]?.vigenteDesde || ''} onChange={event => onDateChange?.(doc.tipo, 'vigenteDesde', event.target.value)} />
                    </label>
                    <label className="text-xs text-neutral-700">Vigente hasta · {doc.nombre}
                      <input type="date" className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm" value={documentDates[doc.tipo]?.vigenteHasta || ''} onChange={event => onDateChange?.(doc.tipo, 'vigenteHasta', event.target.value)} />
                    </label>
                  </div>}
                  {!persistedRejected && persisted && <p className="mt-1 text-xs text-blue-600">Ya cargado en esta solicitud · {persisted.estado === 'APROBADO' ? 'aprobado' : 'en revisión'}</p>}
                  {persistedRejected && <p className="mt-1 text-xs text-error-600">Documento rechazado · adjunte un reemplazo</p>}
                  <div className="mt-3 space-y-2">
                    {slots.map(slot => {
                      const attached = adjuntos[slot.key];
                      const savedSlot = existingDocuments[slot.key];
                      const ocr = ocrResults[slot.key];
                      return <div key={slot.key} className="rounded-lg border border-neutral-200 bg-white p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 break-words"><span className="text-xs font-semibold text-neutral-700">{slot.label}</span>{attached && <span className="ml-2 text-xs text-[#0D8A4F]">{attached.name} ({(attached.size / 1024).toFixed(0)} KB)</span>}{savedSlot && !attached && <span className="ml-2 text-xs text-blue-700">{savedSlot.estado === 'RECHAZADO' ? 'Rechazado: reemplazar' : 'Guardado en la solicitud'}</span>}</div>
                          <div className="flex flex-wrap items-center gap-1">
                            <Button variant="outline" size="sm" leftIcon={<Upload size={13} />} onClick={() => triggerFileInput(slot.key)}>{attached ? 'Reemplazar' : 'Adjuntar archivo'}</Button>
                            <Button variant="ghost" size="sm" leftIcon={<Camera size={13} />} onClick={() => triggerCamera(slot.key)}>Tomar foto</Button>
                            {attached && <Button variant="ghost" size="sm" leftIcon={ocrBusy === slot.key ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />} onClick={() => runOcr(slot.key, doc.tipo)} disabled={ocrBusy !== null}>{ocrBusy === slot.key ? 'Leyendo' : 'OCR local'}</Button>}
                            {attached && <button aria-label={`Quitar ${slot.label}`} onClick={() => onRemoveFile(slot.key)} className="p-1.5 rounded-lg hover:bg-error-100 text-error-500 transition-colors"><X size={15} /></button>}
                          </div>
                        </div>
                        {ocr && <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-900" data-testid={`ocr-preview-${slot.key}`}>
                          <p className="font-semibold">OCR local · {Math.round(ocr.confidence)}% · propuesta para revisar</p>
                          {ocr.tipoDetectado && <p className="mt-0.5">Tipo reconocido: <strong>{ocr.tipoDetectado.replace(/_/g, ' ')}</strong></p>}
                          {ocr.campos && ocr.campos.length > 0 ? <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">{ocr.campos.map(field => <span key={field.key}><strong>{field.label}:</strong> {field.value} <em className="text-blue-700">({field.confidence}%)</em></span>)}</div> : <p className="mt-1">No se identificaron campos estructurados; revise el texto.</p>}
                          <p className="mt-1 truncate text-blue-700" title={ocr.text}>Texto: {ocr.text.slice(0, 120)}</p>
                        </div>}
                      </div>;
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

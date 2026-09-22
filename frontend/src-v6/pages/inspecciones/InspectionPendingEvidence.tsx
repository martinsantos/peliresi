import { useEffect, useState } from 'react';
import { CloudUpload, Download, FileText } from 'lucide-react';
import { INSPECTION_EVIDENCE_ACCEPT, INSPECTION_PHOTO_ACCEPT, type PendingInspectionEvidence } from '../../services/inspectionOfflineEvidence';

export interface PendingEvidenceActions {
  busy: boolean;
  online: boolean;
  onRetry: (id: string) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
  onReplace: (id: string, file: File) => Promise<void>;
}

export function PendingEvidenceThumbnail({ evidence, actions }: { evidence: PendingInspectionEvidence; actions?: PendingEvidenceActions }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const previewUrl = URL.createObjectURL(evidence.file);
    setUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [evidence.file]);
  const [confirm, setConfirm] = useState<'discard' | 'replace' | null>(null);
  const [replacement, setReplacement] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); setConfirm(null); setReplacement(null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo completar. La captura sigue pendiente.'); }
    finally { setBusy(false); }
  };
  const disabled = busy || actions?.busy;
  return <figure data-testid="pending-inspection-evidence" className="min-w-0 overflow-hidden rounded-xl border border-amber-300 bg-amber-50">
    {evidence.mimeType.startsWith('image/') && url ? <img src={url} alt={`Captura pendiente: ${evidence.fileName}`} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center text-amber-800"><FileText size={22} /></div>}
    <figcaption className="space-y-2 p-3">
      <p className="break-words text-xs font-bold text-[#10213A]">{evidence.fileName}</p>
      <p className="flex items-start gap-1 text-xs font-bold text-amber-900"><CloudUpload size={14} className="shrink-0" />{evidence.uploaded ? 'Recibida; falta confirmar la copia local' : evidence.failureKind === 'terminal' ? 'Requiere corrección o revisión' : 'Pendiente de sincronizar'}</p>
      {evidence.lastError && <p role="alert" className="break-words text-xs leading-relaxed text-error-800">{evidence.lastError}</p>}
      {evidence.fields.descripcion && <p className="break-words text-xs text-neutral-700">{evidence.fields.descripcion}</p>}
      {evidence.attempts >= 3 && !evidence.uploaded && <p className="text-xs text-amber-950">Los intentos automáticos están pausados. Revisá el error y reintentá cuando esté resuelto.</p>}
      <a href={url} download={evidence.fileName} className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-xs font-bold text-primary-800"><Download size={14} />Descargar copia original</a>
      {!actions && <a href="#evidencias" className="inline-flex min-h-10 items-center px-2 text-xs font-bold text-primary-800">Revisar pendiente en Evidencias</a>}
      {actions && <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled || !actions.online} onClick={() => void run(() => actions.onRetry(evidence.id))} className="min-h-10 rounded-md border border-amber-400 bg-white px-2 text-xs font-bold text-amber-950 disabled:opacity-50">{evidence.uploaded ? 'Confirmar sincronización' : 'Reintentar carga'}</button>
        {!evidence.uploaded && <>
          {evidence.failureKind === 'terminal' && <button type="button" disabled={disabled} onClick={() => setConfirm('replace')} className="min-h-10 rounded-md border border-neutral-300 bg-white px-2 text-xs font-bold">Corregir archivo</button>}
          <button type="button" disabled={disabled} onClick={() => setConfirm('discard')} className="min-h-10 rounded-md px-2 text-xs font-bold text-error-800">Descartar pendiente</button>
        </>}
      </div>}
      {confirm && actions && <div className="space-y-2 rounded-lg border border-error-300 bg-white p-3">
        <p className="text-xs font-bold text-error-900">{confirm === 'discard' ? 'Se eliminará esta copia pendiente del dispositivo.' : 'Se reemplazará esta copia pendiente por otro archivo.'} Si es la única copia, perderás el original. Descargalo antes de confirmar. Los archivos ya incorporados al expediente permanecen intactos.</p>
        {confirm === 'replace' && <label className="block text-xs font-semibold">Archivo corregido<input type="file" aria-label={`Archivo corregido: ${evidence.fileName}`} accept={evidence.fields.itemId || evidence.fields.comparacionId ? INSPECTION_PHOTO_ACCEPT : INSPECTION_EVIDENCE_ACCEPT} onChange={(event) => setReplacement(event.currentTarget.files?.[0] || null)} className="mt-2 block w-full min-w-0 text-xs" /></label>}
        <div className="flex flex-wrap gap-2"><button type="button" disabled={disabled} onClick={() => { setConfirm(null); setReplacement(null); }} className="min-h-10 rounded-md border border-neutral-300 px-2 text-xs font-bold">Cancelar</button><button type="button" disabled={disabled || (confirm === 'replace' && !replacement)} onClick={() => void run(() => confirm === 'replace' && replacement ? actions.onReplace(evidence.id, replacement) : actions.onDiscard(evidence.id))} className="min-h-10 rounded-md bg-error-700 px-2 text-xs font-bold text-white disabled:opacity-50">{confirm === 'replace' ? 'Confirmar reemplazo' : 'Confirmar descarte'}</button></div>
      </div>}
      {error && <p role="alert" className="break-words text-xs text-error-800">{error}</p>}
    </figcaption>
  </figure>;
}

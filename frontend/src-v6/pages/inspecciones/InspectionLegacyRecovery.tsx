import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, History } from 'lucide-react';
import { readLegacyFieldCopies, recoverLegacyFieldEvidence, type LegacyFieldCopies } from '../../services/inspectionLegacyRecovery';
import type { PendingInspectionEvidence } from '../../services/inspectionOfflineEvidence';
import { Button } from '../../components/ui/ButtonV2';

interface Props {
  userId: string; inspectionId: string; owner: string; destination: string;
  disabled: boolean; verifyAccess: () => Promise<void>;
  onReview: (raw: string) => Promise<void>; onRecoveredFile: () => Promise<void>;
}
export function InspectionLegacyRecovery(props: Props) {
  const [copies, setCopies] = useState<LegacyFieldCopies | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const active = useRef(true);
  const inFlight = useRef(false);
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current || props.disabled) return;
    inFlight.current = true;
    setBusy(true); setError(''); setResult('');
    try { await props.verifyAccess(); if (active.current) await action(); }
    catch (failure) {
      if (active.current) { setCopies(null); setError(failure instanceof Error ? failure.message : 'No se pudieron revisar las copias. Reintentá con conexión.'); }
    } finally { inFlight.current = false; if (active.current) setBusy(false); }
  };
  const refresh = async () => {
    const found = await readLegacyFieldCopies(props.userId, props.inspectionId);
    if (active.current) setCopies(found);
  };
  return <details ref={disclosure} className="rounded-lg border border-neutral-200 bg-white px-4 text-sm">
    <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-medium text-neutral-700"><History size={18} aria-hidden="true" />Copias de versiones anteriores</summary>
    <div className="space-y-3 border-t border-neutral-200 py-4">
      <p className="text-neutral-600">Sólo de esta cuenta y expediente. No identifican la actividad de origen. Revisá el contenido antes de recuperarlo.</p>
      <p className="break-words font-semibold">Destino: {props.destination}</p>
      <Button variant="outline" disabled={props.disabled || busy} isLoading={busy} onClick={() => void run(refresh)}>Buscar copias anteriores</Button>
      {error && <p role="alert" className="text-error-800">{error}</p>}
      {result && <p role="status" className="text-primary-800">{result}</p>}
      {copies && !copies.texts.length && !copies.files.length && <p role="status">No hay copias anteriores pendientes en este dispositivo.</p>}
      {copies?.texts.map(copy => <TextCopy key={copy.source} raw={copy.raw} source={copy.source} disabled={props.disabled || busy} onReview={() => void run(async () => { if (active.current) { await props.onReview(copy.raw); if (disclosure.current) disclosure.current.open = false; } })} />)}
      {copies?.files.map(file => <FileCopy key={file.id} file={file} disabled={props.disabled || busy} onRecover={() => void run(async () => {
        await recoverLegacyFieldEvidence(props.userId, props.inspectionId, props.owner, file.id);
        if (!active.current) return;
        await props.onRecoveredFile(); await refresh();
        if (active.current) setResult('Archivo recuperado en Evidencias. Revisá el texto y el archivo; elegí Guardar y cargar archivo para enviarlos.');
      })} />)}
    </div>
  </details>;
}

function DownloadCopy({ blob, name }: { blob: Blob; name: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]);
  return <a href={url} download={name} className="inline-flex min-h-11 items-center gap-2 rounded px-2 font-medium text-primary-800 focus-visible:outline focus-visible:outline-2"><Download size={16} aria-hidden="true" />Descargar original</a>;
}
function TextCopy({ raw, source, disabled, onReview }: { raw: string; source: string; disabled: boolean; onReview: () => void }) {
  const blob = useMemo(() => new Blob([raw], { type: 'application/json' }), [raw]);
  let valid = false;
  try { const value = JSON.parse(raw); valid = value !== null && typeof value === 'object' && !Array.isArray(value); } catch { /* Download remains available. */ }
  return <div className="rounded-lg border border-neutral-200 p-3">
    <p className="font-semibold">{source === 'checkpoint' ? 'Texto con guardado confirmado' : 'Último texto del dispositivo'}</p>
    <div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" disabled={disabled || !valid} onClick={onReview}>Revisar texto guardado</Button><DownloadCopy blob={blob} name={`inspeccion-copia-${source}.json`} /></div>
    {!valid && <p role="alert" className="mt-2 text-error-800">Esta copia no se puede interpretar. Descargá el original; no se modificó.</p>}
  </div>;
}
function FileCopy({ file, disabled, onRecover }: { file: PendingInspectionEvidence; disabled: boolean; onRecover: () => void }) {
  return <div className="rounded-lg border border-neutral-200 p-3">
    <p className="break-words font-semibold">{file.fileName}</p>
    <p className="mt-1 text-neutral-600">{Math.ceil(file.file.size / 1024)} KB · {file.uploaded ? 'Con recepción previa; se conserva su constancia.' : 'Captura sin contexto confirmado.'}</p>
    <div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" disabled={disabled} onClick={onRecover}>Recuperar archivo aquí</Button><DownloadCopy blob={file.file} name={file.fileName} /></div>
  </div>;
}

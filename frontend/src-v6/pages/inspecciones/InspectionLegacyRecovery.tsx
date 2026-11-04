import { useBlobDownload } from '../../hooks/useBlobDownload';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Download, History } from 'lucide-react';
import { readLegacyFieldCopies, recoverLegacyFieldEvidence, type LegacyFieldCopies } from '../../services/inspectionLegacyRecovery';
import type { PendingInspectionEvidence } from '../../services/inspectionOfflineEvidence';
import { Button } from '../../components/ui/ButtonV2';

interface Props {
  userId: string; inspectionId: string; owner: string; destination: string;
  disabled: boolean; verifyAccess: () => Promise<void>;
  onReview: (raw: string) => Promise<void>; onRecoveredFile: () => Promise<void>;
  /** Rendered inside a workspace task, which already has its own heading. */
  embedded?: boolean;
  /** Where the recovered content shows up; the caller takes the person there, with its save bar. */
  afterReview?: () => void; afterRecoveredFile?: () => void;
}
export function InspectionLegacyRecovery(props: Props) {
  // A previous activity's result/callback must never be reused in this one.
  const identity = JSON.stringify([props.userId, props.inspectionId, props.owner]);
  return <ScopedLegacyRecovery key={identity} {...props} />;
}
function ScopedLegacyRecovery(props: Props) {
  const [copies, setCopies] = useState<LegacyFieldCopies | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [progress, setProgress] = useState('');
  const searchAttempt = useRef(0);
  const active = useRef(true);
  const inFlight = useRef(false);
  const disclosure = useRef<HTMLDetailsElement>(null);
  useLayoutEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const run = async (action: () => Promise<void>, pending = 'Comprobando permiso para recuperar la copia…') => {
    if (inFlight.current || props.disabled) return;
    inFlight.current = true;
    setBusy(true); setError(''); setResult(''); setProgress(pending);
    try { await props.verifyAccess(); if (active.current) await action(); }
    catch (failure) {
      if (active.current) { setCopies(null); setError(failure instanceof Error ? failure.message : 'No se pudieron revisar las copias. Reintentá con conexión.'); }
    } finally { inFlight.current = false; if (active.current) { setBusy(false); setProgress(''); } }
  };
  const refresh = async () => {
    const found = await readLegacyFieldCopies(props.userId, props.inspectionId);
    if (active.current) setCopies(found);
    return found;
  };
  const search = async () => {
    if (active.current) { setCopies(null); setProgress('Buscando copias anteriores en este dispositivo…'); }
    const found = await refresh();
    if (!active.current) return;
    const attempt = ++searchAttempt.current;
    const total = found.texts.length + found.files.length;
    setResult(total
      ? `Búsqueda ${attempt} finalizada: ${found.texts.length} ${found.texts.length === 1 ? 'copia de texto' : 'copias de texto'} y ${found.files.length} ${found.files.length === 1 ? 'archivo' : 'archivos'} para revisar. Todavía no se recuperó ni envió nada.`
      : `Búsqueda ${attempt} finalizada: no se encontraron copias de versiones anteriores en este dispositivo. El borrador actual se consulta por separado; este resultado no indica que se haya perdido.`);
  };
  const body = <div className={props.embedded ? 'space-y-3 text-sm' : 'space-y-3 border-t border-neutral-200 py-4'}>
      <div className="space-y-1 text-neutral-600">
        <p className="font-semibold text-neutral-800">Este panel no muestra el borrador actual.</p>
        <p>Lo que escribís ahora se guarda automáticamente por separado. Al revisar o recuperar una copia volvés al paso donde aparece, con su botón Guardar.</p>
        <p>Esta búsqueda revisa sólo copias de versiones anteriores de esta cuenta y expediente, en este dispositivo y navegador. No identifican la actividad de origen. Buscar no recupera ni envía nada automáticamente.</p>
      </div>
      <p className="break-words font-semibold">Destino: {props.destination}</p>
      <Button variant="outline" disabled={props.disabled || busy} isLoading={busy} onClick={() => void run(search, 'Comprobando permiso para buscar copias anteriores…')}>Buscar copias anteriores</Button>
      {props.disabled && <p className="text-neutral-600">La búsqueda y la recuperación requieren conexión y permiso de edición en esta actividad. Esperá a que termine cualquier guardado en curso.</p>}
      {busy && <p role="status" aria-live="polite" aria-atomic="true">{progress}</p>}
      {error && <div role="alert" className="space-y-1 text-error-800"><p>{error}</p><p>No se confirmó el resultado de esta revisión. No se borraron copias. Comprobá la conexión y volvé a buscar antes de recuperar.</p></div>}
      {result && <p role="status" aria-live="polite" aria-atomic="true" className="text-primary-800">{result}</p>}
      {copies?.texts.map(copy => <TextCopy key={copy.source} raw={copy.raw} source={copy.source} disabled={props.disabled || busy} onReview={() => void run(async () => { if (active.current) { await props.onReview(copy.raw); if (disclosure.current) disclosure.current.open = false; props.afterReview?.(); } })} />)}
      {copies?.files.map(file => <FileCopy key={file.id} file={file} disabled={props.disabled || busy} onRecover={() => void run(async () => {
        await recoverLegacyFieldEvidence(props.userId, props.inspectionId, props.owner, file.id);
        if (!active.current) return;
        await props.onRecoveredFile(); await refresh(); props.afterRecoveredFile?.();
        if (active.current) setResult('Archivo recuperado en Evidencias. Revisá el texto y el archivo; elegí Guardar y cargar archivo para enviarlos.');
      })} />)}
    </div>;
  if (props.embedded) return body;
  return <details ref={disclosure} className="rounded-lg border border-neutral-200 bg-white px-4 text-sm">
    <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-medium text-neutral-700"><History size={18} aria-hidden="true" />Copias de versiones anteriores</summary>
    {body}
  </details>;
}

function DownloadCopy({ blob, name }: { blob: Blob; name: string }) {
  const downloadRef = useBlobDownload(blob);
  return <a ref={downloadRef} download={name} className="inline-flex min-h-11 items-center gap-2 rounded px-2 font-medium text-primary-800 focus-visible:outline focus-visible:outline-2"><Download size={16} aria-hidden="true" />Descargar original</a>;
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

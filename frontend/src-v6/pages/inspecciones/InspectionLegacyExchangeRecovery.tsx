import { useBlobDownload } from '../../hooks/useBlobDownload';
import { useEffect, useMemo, useRef, useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { legacyExchangeBlocker, readLegacyExchangeCopies, type LegacyExchangeCopy } from '../../services/inspectionLegacyExchange';
import type { InspectionExchangeTimeline } from '../../types/inspection';
import { exchangeFileIdentity } from '../../services/inspectionCommandReceipt';

interface Props {
  userId: string; inspectionId: string; destination: string; disabled: boolean;
  verifyAccess: () => Promise<InspectionExchangeTimeline>;
  onRecover: (copy: LegacyExchangeCopy) => Promise<boolean>;
}
export function InspectionLegacyExchangeRecovery(props: Props) {
  const [copies, setCopies] = useState<Array<{ copy: LegacyExchangeCopy; blocker: string | null }> | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const active = useRef(true), inFlight = useRef(false), disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const run = async (selected?: LegacyExchangeCopy) => {
    if (inFlight.current || props.disabled) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const timeline = await props.verifyAccess();
      if (!active.current) return;
      const found = await readLegacyExchangeCopies(props.userId, props.inspectionId);
      const checked = await Promise.all(found.map(async copy => ({ copy, blocker: await legacyExchangeBlocker(copy, timeline, props.userId) })));
      if (!active.current) return;
      setCopies(checked);
      if (selected) {
        const item = checked.find(item => item.copy.id === selected.id && item.copy.raw === selected.raw);
        // Read again after authorization. Any file/text replacement requires a new review.
        if (!item || JSON.stringify(await exchangeFileIdentity(item.copy.files)) !== JSON.stringify(await exchangeFileIdentity(selected.files))) throw new Error('La copia cambió en otra pestaña. Buscá y revisá la versión actual.');
        if (!active.current) return;
        if (item.blocker) throw new Error(item.blocker);
        if (!await props.onRecover(item.copy)) throw new Error('No se pudo confirmar la recuperación. El original se conserva; volvé a intentarlo.');
        if (active.current && disclosure.current) disclosure.current.open = false;
      }
    } catch (failure) {
      if (active.current) { setCopies(null); setError(failure instanceof Error ? failure.message : 'No se pudo comprobar el acceso. Reintentá con conexión.'); }
    } finally { inFlight.current = false; if (active.current) setBusy(false); }
  };
  return <details ref={disclosure} className="rounded-lg border border-neutral-200 bg-white px-4 text-sm">
    <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-medium text-neutral-700"><History size={18} aria-hidden="true" />Copias de respuestas anteriores</summary>
    <div className="space-y-3 border-t border-neutral-200 py-4">
      <p className="text-neutral-700">Son copias de esta cuenta y expediente que no identifican la actividad de origen. Revisalas antes de recuperarlas.</p>
      <p className="break-words font-semibold">Destino: {props.destination}</p>
      <Button variant="outline" disabled={props.disabled || busy} isLoading={busy} onClick={() => void run()}>Buscar respuestas guardadas</Button>
      {error && <p role="alert" className="text-error-800">{error}</p>}
      {copies?.length === 0 && <p role="status">No hay respuestas antiguas guardadas en este dispositivo.</p>}
      {copies?.map(({ copy, blocker }) => <article key={copy.id} className="space-y-2 rounded-lg border border-neutral-200 p-3">
        <h4 className="break-words font-semibold">{copy.id === 'checkpoint' ? 'Texto y adjuntos guardados' : 'Último texto del dispositivo'}</h4>
        {copy.draft && <><p className="break-words font-semibold">{copy.draft.asunto || 'Sin asunto'}</p><p className="whitespace-pre-wrap break-words">{copy.draft.cuerpo}</p></>}
        <OriginalText raw={copy.raw} />
        {copy.files.map((file, index) => <OriginalFile key={index} file={file} />)}
        {blocker ? <p className="text-neutral-700">{blocker}</p> : <><p className="text-neutral-600">Recuperar conserva el original y el trabajo actual como otra versión. No envía la respuesta.</p><Button variant="outline" disabled={props.disabled || busy} onClick={() => void run(copy)}>Recuperar para revisar</Button></>}
      </article>)}
    </div>
  </details>;
}
function Download({ blob, name, label }: { blob: Blob; name: string; label: string }) {
  const downloadRef = useBlobDownload(blob);
  return <a className="flex min-h-11 items-center break-all rounded px-2 text-primary-800 underline focus-visible:outline focus-visible:outline-2" ref={downloadRef} download={name}>{label}</a>;
}
function OriginalText({ raw }: { raw: string }) {
  const blob = useMemo(() => new Blob([raw], { type: 'application/json' }), [raw]);
  return <Download blob={blob} name="respuesta-original.json" label="Descargar texto original" />;
}
function OriginalFile({ file }: { file: File }) { return <Download blob={file} name={file.name} label={`Descargar ${file.name}`} />; }

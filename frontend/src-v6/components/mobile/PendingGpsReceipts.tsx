import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '../ui/ButtonV2';
import { readPendingGpsQueue } from '../../services/gpsQueue';
import { verifyStoredGpsReceipts, type GpsReceiptSummary } from '../../services/gpsReceipts';

/** A completed/reassigned trip may have an accepted point whose response was
 * lost. Verify it without removing the shared local queue or sending a point. */
export function PendingGpsReceipts({ ownerId, contextOwner, manifestId }: { ownerId: string | number; contextOwner: string; manifestId: string }) {
  const owner = String(ownerId);
  const [queue, setQueue] = useState(() => contextOwner ? readPendingGpsQueue(owner, manifestId, contextOwner) : { ok: false as const, reason: 'context' as const });
  const [summary, setSummary] = useState<GpsReceiptSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false), mounted = useRef(true);
  const refresh = useCallback(() => setQueue(contextOwner ? readPendingGpsQueue(owner, manifestId, contextOwner) : { ok: false, reason: 'context' }), [owner, contextOwner, manifestId]);

  useEffect(() => {
    mounted.current = true; refresh();
    const changed = () => { setSummary(null); refresh(); };
    window.addEventListener('storage', changed);
    window.addEventListener('focus', changed);
    return () => { mounted.current = false; window.removeEventListener('storage', changed); window.removeEventListener('focus', changed); };
  }, [refresh]);

  if (queue.ok && queue.points.length === 0) return null;
  const issue = !queue.ok ? queue.reason : !queue.durable ? 'storage' : null;
  const issueText = issue === 'legacy'
    ? 'Hay ubicaciones antiguas sin titular identificado. Conservá este dispositivo y contactá a soporte.'
    : issue === 'unscoped' ? 'Hay ubicaciones anteriores sin actividad identificada. Conservá este dispositivo y contactá a soporte.'
    : issue === 'context' ? 'No se pudo identificar la actividad. Volvé a ingresar antes de comprobar las ubicaciones.'
    : issue === 'invalid' ? 'No se pudieron leer las ubicaciones guardadas. Conservá este dispositivo y contactá a soporte.'
      : issue ? 'No se pudo confirmar el guardado local. Conservá esta pantalla y revisá el almacenamiento.' : '';

  async function verify() {
    if (inFlight.current || issue) return;
    inFlight.current = true; setBusy(true); setError(''); setSummary(null);
    try {
      const result = await verifyStoredGpsReceipts(owner, manifestId, contextOwner);
      if (mounted.current) { refresh(); setSummary(result); }
    } catch (failure) {
      if (mounted.current) { refresh(); setError(failure instanceof Error ? failure.message : 'No se pudo comprobar la recepción. Conservá este dispositivo y contactá a soporte.'); }
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }

  return <section aria-label="Comprobar recepción de ubicaciones" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-neutral-900">
    <div className="flex items-start gap-3"><MapPin size={20} className="mt-0.5 shrink-0 text-amber-800" aria-hidden="true" /><div className="min-w-0 flex-1 space-y-3">
      <h3 className="font-bold">Ubicaciones por revisar</h3>
      {issueText ? <p role="alert">{issueText}</p> : <>
        <p>Comprobá cuáles recibió SITREP. La copia local se conserva.</p>
        <Button type="button" variant="outline" isLoading={busy} onClick={() => void verify()}>Comprobar recepción</Button>
        {summary && <p role="status">SITREP confirmó {summary.confirmed} de {summary.checked}. {summary.unconfirmed ? 'Las no confirmadas siguen guardadas; contactá a soporte.' : 'La copia local sigue guardada en este dispositivo.'}</p>}
        {error && <p role="alert">{error}</p>}
      </>}
    </div></div>
  </section>;
}

import { useEffect, useState } from 'react';
import { toast } from '../ui/Toast';
import type { IncidentCommand, IncidentResult } from '../../services/incidentCommand';

export type PendingIncidentNoticeProps = {
  pending: IncidentCommand | null;
  storageError: string;
  checking: boolean;
  busy: boolean;
  onRetry: () => Promise<IncidentResult>;
  onRefresh: () => void;
  onConfirmed?: (result: IncidentResult) => void;
};

/** The same saved command is used from the trip and manifest screens. */
export function PendingIncidentNotice({ pending, storageError, checking, busy, onRetry, onRefresh, onConfirmed }: PendingIncidentNoticeProps) {
  const [error, setError] = useState('');
  useEffect(() => { setError(''); }, [pending?.referencia]);
  if (checking) return <p role="status" className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">Comprobando envíos guardados…</p>;
  if (storageError) return <div role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-900">
    <p>{storageError}</p>
    <button type="button" className="min-h-11 font-semibold underline" onClick={onRefresh}>Volver a comprobar</button>
  </div>;
  if (!pending) return null;
  const label = pending.body.tipo === 'PAUSA' ? 'La pausa' : pending.body.tipo === 'REANUDACION' ? 'La reanudación' : 'El incidente';
  const retry = async () => {
    setError('');
    try {
      const result = await onRetry();
      onConfirmed?.(result);
      if (result.cleaned) toast.success('Envío confirmado');
      else toast.info('Envío confirmado', 'No pudimos actualizar la copia local. Conservá este dispositivo y comprobá el envío.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No pudimos comprobar el envío. Revisá la conexión e intentá nuevamente.'); }
  };
  return <div role="status" className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900">
    <p className="font-semibold">{label} puede estar registrado.</p>
    <p className="mt-1">Comprobá este envío antes de registrar otro. Se conserva en este dispositivo y actividad.</p>
    {error && <p role="alert" className="mt-2">{error}</p>}
    <button type="button" className="min-h-11 font-semibold underline disabled:opacity-50" disabled={busy} onClick={() => void retry()}>
      {busy ? 'Comprobando…' : 'Comprobar envío'}
    </button>
  </div>;
}

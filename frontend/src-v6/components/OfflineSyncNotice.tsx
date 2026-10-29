import { AlertTriangle } from 'lucide-react';
import type { OfflineSyncStatus } from '../hooks/useOfflineSync';

export function OfflineSyncNotice({ status }: { status: OfflineSyncStatus }) {
  if (!(status.terminal > 0 || status.auth > 0 || status.retryable > 0 || status.lastError)) return null;
  const onlyContextBlocked = status.pending > 0 && status.contextBlocked === status.pending;
  const onlyLegacyBlocked = status.pending > 0 && status.legacyBlocked === status.pending;
  const onlyBlocked = status.pending > 0 && (status.contextBlocked || 0) + (status.legacyBlocked || 0) === status.pending;
  const mixedBlocked = onlyBlocked && !onlyContextBlocked && !onlyLegacyBlocked;
  return (
    <div role="status" className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs ${status.terminal > 0 || status.auth > 0 ? 'border-error-200 bg-error-50 text-error-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
      <span className="flex min-w-0 items-center gap-2"><AlertTriangle size={16} className="shrink-0" /><span className="min-w-0"><strong>{onlyContextBlocked ? 'Cambios de otra actividad' : onlyLegacyBlocked ? 'Cambios anteriores para revisar' : mixedBlocked ? 'Cambios pendientes de revisión' : status.auth > 0 ? 'La sesión debe renovarse' : status.terminal > 0 ? 'Hay cambios que requieren revisión' : status.retryable > 0 ? 'Hay cambios esperando reintento' : 'No pudimos revisar la sincronización'}</strong>{status.pending > 0 && <span className="ml-1">· {status.pending} {status.pending === 1 ? 'pendiente' : 'pendientes'}</span>}{(status.lastError || mixedBlocked) && <span className="block break-words opacity-80">{mixedBlocked ? 'Volvé a la actividad donde guardaste tus cambios. Los anteriores sin contexto se conservan; consultá a soporte.' : status.lastError}</span>}</span></span>
      {!onlyBlocked && <button type="button" disabled={status.syncing} onClick={() => void status.retry()} className="min-h-11 shrink-0 rounded-md border border-current bg-white px-2 font-bold disabled:opacity-50">{status.syncing ? 'Reintentando…' : 'Reintentar'}</button>}
    </div>
  );
}

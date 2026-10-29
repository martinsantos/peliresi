import { AlertTriangle } from 'lucide-react';
import type { OfflineSyncStatus } from '../hooks/useOfflineSync';

export function OfflineSyncNotice({ status }: { status: OfflineSyncStatus }) {
  if (!(status.terminal > 0 || status.auth > 0 || status.retryable > 0 || status.lastError)) return null;
  return (
    <div role="status" className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs ${status.terminal > 0 || status.auth > 0 ? 'border-error-200 bg-error-50 text-error-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
      <span className="flex min-w-0 items-center gap-2"><AlertTriangle size={16} className="shrink-0" /><span className="min-w-0"><strong>{status.auth > 0 ? 'La sesión debe renovarse' : status.terminal > 0 ? 'Hay cambios que requieren revisión' : status.retryable > 0 ? 'Hay cambios esperando reintento' : 'No pudimos revisar la sincronización'}</strong>{status.pending > 0 && <span className="ml-1">· {status.pending} {status.pending === 1 ? 'pendiente' : 'pendientes'}</span>}{status.lastError && <span className="block break-words opacity-80">{status.lastError}</span>}</span></span>
      <button type="button" disabled={status.syncing} onClick={() => void status.retry()} className="min-h-11 shrink-0 rounded-md border border-current bg-white px-2 font-bold disabled:opacity-50">{status.syncing ? 'Reintentando…' : 'Reintentar'}</button>
    </div>
  );
}

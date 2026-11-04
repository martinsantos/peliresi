import type { AttentionState } from '../hooks/useAttentionCounts';

export function AttentionBadge({ count, label = 'pendientes de atender', state }: { count?: number; label?: string; state?: AttentionState }) {
  if (state === 'hidden') return null;
  if (state === 'loading' || state === 'error') {
    const message = state === 'error' ? 'Cantidad de pendientes no disponible. Abrí esta sección para consultar.' : 'Consultando cantidad de pendientes';
    return <span title={message} aria-label={message}
      className="ml-auto inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 px-1 text-xs font-bold text-neutral-700">
      {state === 'error' ? '?' : '…'}
    </span>;
  }
  if (!count || !Number.isFinite(count) || count < 0) return null;
  const text = count === 1 ? label.replace(/^avisos\b/, 'aviso').replace(/^pendientes\b/, 'pendiente') : label;
  return <span title={`${count} ${text}`} aria-label={`${count} ${text}`}
    className="ml-auto inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-error-700 px-1 text-xs font-bold leading-none text-white tabular-nums ring-1 ring-white/40">
    {count > 99 ? '99+' : count}
  </span>;
}

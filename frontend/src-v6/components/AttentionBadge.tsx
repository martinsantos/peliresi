export function AttentionBadge({ count, label = 'pendientes de atender' }: { count?: number; label?: string }) {
  if (!count || !Number.isFinite(count) || count < 0) return null;
  const text = count === 1 ? label.replace(/^avisos\b/, 'aviso').replace(/^pendientes\b/, 'pendiente') : label;
  return <span title={`${count} ${text}`} aria-label={`${count} ${text}`}
    className="ml-auto inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-error-700 px-1 text-xs font-bold leading-none text-white tabular-nums ring-1 ring-white/40">
    {count > 99 ? '99+' : count}
  </span>;
}

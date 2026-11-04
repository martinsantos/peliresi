/** Age describes the last received measurement, never the device's connectivity. */
export function positionAge(timestamp: string | undefined, now: number): string {
  if (!timestamp) return 'Sin posición recibida';
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return 'Fecha de recepción no válida';
  const seconds = Math.floor((now - time) / 1000);
  if (seconds < 0) return 'Fecha de recepción adelantada; revisar reloj';
  if (seconds < 60) return 'Última recepción hace menos de un minuto';
  if (seconds < 3600) return `Última recepción hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Última recepción hace ${Math.floor(seconds / 3600)} h`;
  return `Última recepción hace ${Math.floor(seconds / 86400)} días`;
}

export function MonitorPosition({ position, now = Date.now(), compact = false, historic = false }: {
  position: { timestamp: string; velocidad?: number | null } | null; now?: number; compact?: boolean; historic?: boolean;
}) {
  const valid = position && Number.isFinite(new Date(position.timestamp).getTime());
  return <div className="space-y-1 text-xs leading-5 text-neutral-700" aria-label="Última posición recibida">
    <p style={{ margin: 0 }}>{historic ? (!position ? 'Sin GPS recibido en el historial cargado' : valid ? 'Última recepción en el historial cargado' : 'Fecha de recepción no válida') : positionAge(position?.timestamp, now)}</p>
    {!compact && valid && <time dateTime={position.timestamp} className="block">
      {new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Mendoza', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(position.timestamp))} · Mendoza
    </time>}
    {!compact && valid && <p style={{ margin: 0 }}>Hora de captura no disponible. El punto puede ser anterior a la recepción.</p>}
    {!compact && position?.velocidad != null && Number.isFinite(position.velocidad) && <p style={{ margin: 0 }}>Velocidad no disponible</p>}
  </div>;
}

import { Card } from './ui/CardV2';

export interface CompanyHistoryEvent {
  id: string;
  createdAt: string;
  datos?: { motivo?: unknown } | null;
  presentacion?: {
    titulo: string;
    autor: string | null;
    persona: string | null;
    actividad: string | null;
    establecimiento: string | null;
  };
}

export function CompanyHistory({ events }: { events: CompanyHistoryEvent[] }) {
  return <Card>
    <h2 className="mb-3 font-semibold">Historial de la empresa</h2>
    {events.length > 0 ? <>
      <p className="mb-3 text-sm text-neutral-600">{events.length === 1 ? 'Último cambio' : `Últimos ${events.length} cambios · del más reciente al más antiguo.`}</p>
      <ol className="divide-y divide-neutral-100" aria-label="Cambios de la empresa">
        {events.map(event => {
          const display = event.presentacion;
          const date = new Date(event.createdAt);
          const validDate = Number.isFinite(date.getTime());
          const details = [display?.persona, display?.actividad, display?.establecimiento].filter(Boolean).join(' · ');
          return <li key={event.id} className="space-y-1 break-words py-4">
            <h3 className="font-semibold text-neutral-900">{display?.titulo || 'Cambio registrado'}</h3>
            {details && <p className="text-sm text-neutral-800">{details}</p>}
            <p className="text-sm text-neutral-600">Registrado por: {display?.autor || 'Nombre no disponible'}</p>
            {validDate ? <time className="block text-sm text-neutral-600" dateTime={date.toISOString()}>{date.toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' })}</time> : <p className="text-sm text-neutral-600">Fecha no disponible</p>}
            {typeof event.datos?.motivo === 'string' && event.datos.motivo.trim() && <p className="text-sm text-neutral-800">Motivo: {event.datos.motivo}</p>}
          </li>;
        })}
      </ol>
    </> : <p className="text-sm text-neutral-600">Sin cambios registrados.</p>}
  </Card>;
}

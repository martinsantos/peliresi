import React from 'react';
import { ArrowRight, Clock3, MapPin, Radio, Truck } from 'lucide-react';
import { Card, CardContent } from '../ui/CardV2';

interface TripLike {
  id: string;
  numero?: string;
  fechaRetiro?: string | null;
  operador?: { razonSocial?: string };
  generador?: { razonSocial?: string };
}

interface TransportistaTripQueueProps {
  activeTrips: TripLike[];
  pendingTrips: TripLike[];
  onOpenTrip: (id: string) => void;
  activeTotal?: number;
  pendingTotal?: number;
}

const elapsed = (date?: string | null) => {
  if (!date) return null;
  const ms = Date.now() - new Date(date).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

export const TransportistaTripQueue: React.FC<TransportistaTripQueueProps> = ({ activeTrips, pendingTrips, onOpenTrip, activeTotal, pendingTotal }) => {
  if (activeTrips.length === 0 && pendingTrips.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-sm font-bold text-neutral-800">Sin viajes asignados</p>
          <p className="mt-1 text-sm text-neutral-600">Los manifiestos listos para retirar o en tránsito aparecerán acá.</p>
        </CardContent>
      </Card>
    );
  }

  const sections = [
    { label: 'En tránsito', trips: activeTrips, total: activeTotal ?? activeTrips.length, Icon: Radio, tone: 'border-primary-200 bg-primary-50 text-primary-800', action: 'Abrir seguimiento' },
    { label: 'Listos para retirar', trips: pendingTrips, total: pendingTotal ?? pendingTrips.length, Icon: Truck, tone: 'border-warning-200 bg-warning-50 text-warning-900', action: 'Ver retiro' },
  ];
  return <section aria-label="Viajes del transportista" className="space-y-4">
    {sections.filter(section => section.trips.length > 0).map(section => <div key={section.label}>
      <h2 aria-label={`${section.label}: ${section.total} manifiesto${section.total === 1 ? '' : 's'}`} className="mb-2 flex items-center gap-2 text-sm font-bold text-neutral-900"><section.Icon size={18} aria-hidden="true" />{section.label}<span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">{section.total}</span></h2>
      <ul className="space-y-2">{section.trips.map(trip => {
        const number = trip.numero || trip.id.slice(0, 8);
        const duration = section.label === 'En tránsito' ? elapsed(trip.fechaRetiro) : null;
        return <li key={trip.id}><button type="button" onClick={() => onOpenTrip(trip.id)} aria-label={`${section.label === 'En tránsito' ? 'Ir al viaje' : 'Abrir viaje asignado'} ${number}`}
          className={`w-full rounded-xl border p-3 text-left shadow-sm transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 ${section.tone}`}>
          <span className="flex items-center justify-between gap-3"><strong className="min-w-0 truncate text-sm">{number}</strong><span className="flex shrink-0 items-center gap-1 text-xs font-semibold">{section.action}<ArrowRight size={16} aria-hidden="true" /></span></span>
          <span className="mt-1.5 flex min-w-0 items-center gap-1 text-xs text-neutral-700"><MapPin size={14} aria-hidden="true" className="shrink-0" /><span className="truncate">{trip.generador?.razonSocial || 'Origen pendiente'} → {trip.operador?.razonSocial || 'Destino pendiente'}</span></span>
          {duration && <span className="mt-1 flex items-center gap-1 text-xs text-neutral-700"><Clock3 size={14} aria-hidden="true" />Transcurrido {duration}</span>}
        </button></li>;
      })}</ul>
      {section.total > section.trips.length && <p className="mt-2 text-xs text-neutral-600">Se muestran {section.trips.length} de {section.total}. Abrí Manifiestos para ver el resto.</p>}
    </div>)}
    {activeTrips.length > 1 && <p className="text-xs text-neutral-600">Cada móvil transmite GPS únicamente mientras tiene abierto el seguimiento de ese manifiesto.</p>}
  </section>;
};

export default TransportistaTripQueue;

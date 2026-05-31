import React from 'react';
import { ChevronRight, Radio, Truck } from 'lucide-react';
import { Badge } from '../ui/BadgeV2';
import { Card, CardContent } from '../ui/CardV2';

interface TripLike {
  id: string;
  numero?: string;
  operador?: { razonSocial?: string };
  generador?: { razonSocial?: string };
}

interface TransportistaTripQueueProps {
  activeTrips: TripLike[];
  pendingTrips: TripLike[];
  onOpenTrip: (id: string) => void;
}

export const TransportistaTripQueue: React.FC<TransportistaTripQueueProps> = ({ activeTrips, pendingTrips, onOpenTrip }) => {
  if (activeTrips.length === 0 && pendingTrips.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-sm font-bold text-neutral-800">Sin viajes asignados</p>
          <p className="mt-1 text-xs text-neutral-500">Cuando haya un manifiesto aprobado aparecera aqui.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-2" aria-label="Viajes del transportista">
      {activeTrips.map((trip) => {
        const label = trip.numero || trip.id.slice(0, 8);
        return (
          <button
            key={trip.id}
            type="button"
            onClick={() => onOpenTrip(trip.id)}
            aria-label={`Ir al viaje ${label}`}
            className="w-full rounded-2xl border-2 border-success-200 bg-success-50 p-4 text-left shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-100 text-success-700">
                  <Radio size={18} className="animate-pulse" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-success-900">Viaje en curso {label}</p>
                  <p className="truncate text-xs text-success-800">Destino: {trip.operador?.razonSocial || '-'}</p>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-success-700" />
            </div>
          </button>
        );
      })}

      {pendingTrips.map((trip) => {
        const label = trip.numero || trip.id.slice(0, 8);
        return (
          <button
            key={trip.id}
            type="button"
            onClick={() => onOpenTrip(trip.id)}
            aria-label={`Abrir viaje asignado ${label}`}
            className="w-full rounded-2xl border border-warning-200 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-100 text-warning-700">
                  <Truck size={17} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-neutral-900">{label}</p>
                    <Badge color="warning" variant="soft" size="sm">Retiro pendiente</Badge>
                  </div>
                  <p className="truncate text-xs text-neutral-500">{trip.generador?.razonSocial || '-'}</p>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-neutral-400" />
            </div>
          </button>
        );
      })}
    </section>
  );
};

export default TransportistaTripQueue;

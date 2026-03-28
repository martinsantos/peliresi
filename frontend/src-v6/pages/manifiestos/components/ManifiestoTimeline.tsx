/**
 * SITREP v6 - Manifiesto Timeline
 * ================================
 * Renders the timeline/events history section for a manifiesto.
 */

import React from 'react';
import { Route, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { formatDateTime, formatEstado } from '../../../utils/formatters';
import type { Manifiesto, EventoManifiesto } from '../../../types/models';
import { EstadoManifiesto } from '../../../types/models';

type TimelineEntry = {
  id: string;
  date: string;
  title: string;
  description: string;
  status: string;
};

function buildTimeline(manifiesto: Partial<Manifiesto>): TimelineEntry[] {
  if (!manifiesto.eventos || !Array.isArray(manifiesto.eventos) || manifiesto.eventos.length === 0) return [];

  const estadoOrder = [
    EstadoManifiesto.BORRADOR,
    EstadoManifiesto.PENDIENTE_APROBACION,
    EstadoManifiesto.APROBADO,
    EstadoManifiesto.EN_TRANSITO,
    EstadoManifiesto.ENTREGADO,
    EstadoManifiesto.RECIBIDO,
    EstadoManifiesto.EN_TRATAMIENTO,
    EstadoManifiesto.TRATADO,
  ];

  const currentIdx = estadoOrder.indexOf(manifiesto.estado || EstadoManifiesto.BORRADOR);

  return manifiesto.eventos.map((ev, i) => ({
    id: ev.id,
    date: formatDateTime(ev.createdAt),
    title: String(ev.tipo || '').replace(/_/g, ' '),
    description: String(ev.descripcion || '') + (ev.usuario ? ` - ${ev.usuario.nombre}` : ''),
    status: i < currentIdx ? 'completed' : i === currentIdx ? 'current' : 'pending',
  }));
}

interface ManifiestoTimelineProps {
  eventos: EventoManifiesto[] | undefined;
  manifiesto: Partial<Manifiesto>;
}

const ManifiestoTimeline: React.FC<ManifiestoTimelineProps> = ({ manifiesto }) => {
  const timeline = buildTimeline(manifiesto);

  return (
    <Card>
      <CardHeader title="Trazabilidad" icon={<Route size={20} />} />
      <CardContent>
        {timeline.length === 0 ? (
          <div className="py-8 text-center text-neutral-500">No hay eventos registrados para este manifiesto</div>
        ) : (
          <div className="relative">
            {/* Line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-200" />

            {/* Events */}
            <div className="space-y-6 animate-fade-in">
              {timeline.map((event, index) => (
                <div key={event.id} className="relative flex gap-4">
                  {/* Dot */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                      event.status === 'completed'
                        ? 'bg-success-500 text-white'
                        : event.status === 'current'
                        ? 'bg-info-500 text-white ring-4 ring-info-100'
                        : 'bg-neutral-200 text-neutral-400'
                    }`}
                  >
                    {event.status === 'completed' ? (
                      <CheckCircle size={16} />
                    ) : (
                      <span className="text-xs font-bold">{index + 1}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`font-semibold ${
                          event.status === 'pending' ? 'text-neutral-400' : 'text-neutral-900'
                        }`}>
                          {event.title}
                        </p>
                        <p className={`text-sm mt-0.5 ${
                          event.status === 'pending' ? 'text-neutral-400' : 'text-neutral-600'
                        }`}>
                          {event.description}
                        </p>
                      </div>
                      <span className={`text-sm ${
                        event.status === 'pending' ? 'text-neutral-400' : 'text-neutral-500'
                      }`}>
                        {event.date}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ManifiestoTimeline;

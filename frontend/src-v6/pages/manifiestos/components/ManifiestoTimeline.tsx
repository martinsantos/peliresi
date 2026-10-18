/**
 * SITREP v6 - Manifiesto Timeline
 * ================================
 * Renders the timeline/events history section for a manifiesto.
 */

import React from 'react';
import { Route, Clock } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { formatDateTime } from '../../../utils/formatters';
import type { Manifiesto, EventoManifiesto } from '../../../types/models';

type TimelineEntry = {
  id: string;
  date: string;
  title: string;
  description: string;
};

function buildTimeline(manifiesto: Partial<Manifiesto>): TimelineEntry[] {
  if (!manifiesto.eventos || !Array.isArray(manifiesto.eventos) || manifiesto.eventos.length === 0) return [];

  // Every item comes from a persisted event, not a future workflow step.
  // Incidents/reversions mean event index and workflow stage are unrelated.
  return manifiesto.eventos.map(ev => ({
    id: ev.id,
    date: formatDateTime(ev.createdAt),
    title: String(ev.tipo || '').replace(/_/g, ' '),
    description: String(ev.descripcion || '') + (ev.usuario ? ` - ${ev.usuario.nombre}` : ''),
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
              {timeline.map(event => (
                <div key={event.id} className="relative flex gap-4">
                  {/* Dot */}
                  <div
                    aria-label="Evento registrado"
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 bg-neutral-100 text-neutral-700"
                  >
                    <Clock size={16} aria-hidden="true" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-neutral-900">
                          {event.title}
                        </p>
                        <p className="text-sm mt-0.5 break-words text-neutral-600">
                          {event.description}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm text-neutral-600">
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

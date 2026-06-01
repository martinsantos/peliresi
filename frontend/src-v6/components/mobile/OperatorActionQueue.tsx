import React from 'react';
import { ChevronRight, FlaskConical, Scale } from 'lucide-react';
import { EstadoManifiesto } from '../../types/models';
import { Badge } from '../ui/BadgeV2';
import { Card, CardContent } from '../ui/CardV2';

interface OperatorManifestLike {
  id: string;
  numero?: string;
  estado: EstadoManifiesto;
  generador?: { razonSocial?: string };
  transportista?: { razonSocial?: string };
}

interface OperatorActionQueueProps {
  manifiestos: OperatorManifestLike[];
  onOpenManifiesto: (id: string) => void;
}

function actionLabel(estado: EstadoManifiesto) {
  if (estado === EstadoManifiesto.ENTREGADO) return 'Recepcion pendiente';
  if (estado === EstadoManifiesto.RECIBIDO) return 'Pesaje o tratamiento';
  if (estado === EstadoManifiesto.EN_TRATAMIENTO) return 'Cerrar tratamiento';
  return 'Revisar manifiesto';
}

export const OperatorActionQueue: React.FC<OperatorActionQueueProps> = ({ manifiestos, onOpenManifiesto }) => {
  if (manifiestos.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-sm font-bold text-neutral-800">Sin acciones de operador</p>
          <p className="mt-1 text-xs text-neutral-500">Las recepciones y tratamientos pendientes apareceran aqui.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-2" aria-label="Acciones del operador">
      {manifiestos.map((m) => {
        const label = m.numero || m.id.slice(0, 8);
        return (
          <button
            key={m.id}
            type="button"
            aria-label={`Abrir manifiesto ${label}`}
            onClick={() => onOpenManifiesto(m.id)}
            className="w-full rounded-2xl border border-blue-100 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  {m.estado === EstadoManifiesto.ENTREGADO ? <Scale size={18} /> : <FlaskConical size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 max-w-[128px] truncate text-sm font-bold text-neutral-900">{label}</p>
                    <Badge color="info" variant="soft" size="sm" className="max-w-full truncate">{actionLabel(m.estado)}</Badge>
                  </div>
                  <p className="truncate text-xs text-neutral-500">{m.generador?.razonSocial || m.transportista?.razonSocial || '-'}</p>
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

export default OperatorActionQueue;

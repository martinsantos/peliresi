import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Pause, Play, RotateCcw, Truck } from 'lucide-react';
import { EstadoManifiesto } from '../../types/models';
import { Badge } from '../ui/BadgeV2';
import { Button } from '../ui/ButtonV2';

interface TripActionBarProps {
  estado: EstadoManifiesto;
  viajeStatus: 'ACTIVO' | 'PAUSADO';
  isPending: boolean;
  disabled?: boolean;
  connectionLimited?: boolean;
  hasPendingSync: boolean;
  delegated?: boolean;
  onConfirmPickup: () => void;
  onTogglePause: () => void;
  onReportIncident: () => void;
  onConfirmDelivery: () => void;
}

export const TripActionBar: React.FC<TripActionBarProps> = ({
  estado,
  viajeStatus,
  isPending,
  disabled = false,
  connectionLimited = false,
  hasPendingSync,
  delegated = false,
  onConfirmPickup,
  onTogglePause,
  onReportIncident,
  onConfirmDelivery,
}) => {
  if (estado === EstadoManifiesto.APROBADO) {
    return (
      <div className="rounded-2xl border border-primary-100 bg-white p-3 shadow-sm">
        <Button
          fullWidth
          size="lg"
          onClick={onConfirmPickup}
          disabled={isPending || disabled}
          leftIcon={isPending ? <Loader2 size={20} className="animate-spin" /> : <Truck size={20} />}
        >
          Confirmar retiro
        </Button>
      </div>
    );
  }

  if (estado !== EstadoManifiesto.EN_TRANSITO) return null;

  return (
    <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">{delegated?'Control del manifiesto':'Acciones de campo'}</span>
        {hasPendingSync && <Badge color="warning" variant="soft" size="sm" dot>Sync pendiente</Badge>}
      </div>
      {!delegated&&<div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onTogglePause}
          disabled={isPending || disabled || connectionLimited}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-warning-200 bg-warning-50 px-3 text-sm font-bold text-warning-800 disabled:opacity-50"
        >
          {viajeStatus === 'ACTIVO' ? <Pause size={18} /> : <Play size={18} />}
          {viajeStatus === 'ACTIVO' ? 'Pausar' : 'Reanudar'}
        </button>
        <button
          type="button"
          onClick={onReportIncident}
          disabled={isPending || disabled || connectionLimited}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-error-200 bg-error-50 px-3 text-sm font-bold text-error-800 disabled:opacity-50"
        >
          <AlertTriangle size={18} />
          Incidente
        </button>
      </div>}
      <Button
        fullWidth
        size="lg"
        onClick={onConfirmDelivery}
        disabled={isPending || disabled}
        leftIcon={isPending ? <Loader2 size={20} className="animate-spin" /> : hasPendingSync ? <RotateCcw size={20} /> : <CheckCircle2 size={20} />}
      >
        Confirmar entrega
      </Button>
    </div>
  );
};

export default TripActionBar;

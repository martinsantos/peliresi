import React from 'react';
import { AlertTriangle, Compass, Crosshair, Gauge, LocateFixed, MapPin, WifiOff, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/CardV2';
import { Badge } from '../ui/BadgeV2';
import { AndroidPermissionGuide } from './AndroidPermissionGuide';
import { headingToCompass, type GpsDetails, type GpsStatus } from '../../hooks/useGPSTracking';
import type { GpsStorageIssue } from '../../services/gpsQueue';

interface GpsStatusPanelProps {
  status: GpsStatus;
  sendStatus: 'ok' | 'error' | 'idle';
  sendError?: string | null;
  position: [number, number] | null;
  details: GpsDetails;
  pendingCount: number;
  lastSyncAt: Date | null;
  onRetry?: () => void;
  retrying?: boolean;
  retryDisabled?: boolean;
  paused?: boolean;
  storageError?: boolean;
  storageIssue?: GpsStorageIssue | null;
}

const STATUS_COPY: Record<GpsStatus, { label: string; tone: string; icon: React.ReactNode }> = {
  checking: { label: 'Verificando GPS', tone: 'bg-neutral-100 text-neutral-700', icon: <Loader2 size={14} className="animate-spin" /> },
  acquiring: { label: 'Buscando señal GPS', tone: 'bg-warning-50 text-warning-700', icon: <LocateFixed size={14} className="animate-pulse" /> },
  active: { label: 'GPS activo', tone: 'bg-success-50 text-success-700', icon: <span className="h-2.5 w-2.5 rounded-full bg-success-500 animate-pulse" /> },
  denied: { label: 'Permiso GPS denegado', tone: 'bg-error-50 text-error-700', icon: <WifiOff size={14} /> },
  unavailable: { label: 'GPS no disponible', tone: 'bg-error-50 text-error-700', icon: <WifiOff size={14} /> },
  error: { label: 'Error GPS', tone: 'bg-error-50 text-error-700', icon: <AlertTriangle size={14} /> },
};

function formatLastSync(lastSyncAt: Date | null) {
  if (!lastSyncAt) return 'Sin sincronizar';
  return `Actualizado ${lastSyncAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
}

export const GpsStatusPanel: React.FC<GpsStatusPanelProps> = ({
  status,
  sendStatus,
  sendError = null,
  position,
  details,
  pendingCount,
  lastSyncAt,
  onRetry,
  retrying = false,
  retryDisabled = false,
  paused = false,
  storageError = false,
  storageIssue = null,
}) => {
  const storageNotice = storageError && <p role="alert" className="rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-900">{storageIssue === 'legacy' ? 'Hay ubicaciones anteriores sin titular identificado. Se conservaron; contactá a soporte antes de confirmar.' : storageIssue === 'unscoped' ? 'Hay ubicaciones anteriores sin actividad identificada. Conservá este dispositivo y contactá a soporte.' : storageIssue === 'context' ? 'Hay ubicaciones pendientes de otra actividad. Volvé a esa actividad o contactá a soporte.' : storageIssue === 'invalid' ? 'No se pudieron leer las ubicaciones guardadas. Se conservaron; contactá a soporte antes de confirmar.' : storageIssue === 'reference' ? 'No se pudo preparar la ubicación para enviarla de forma segura. Contactá a soporte.' : 'No se pudo guardar el recorrido en el dispositivo. Mantené esta pantalla abierta, revisá el almacenamiento o la conexión y reintentá.'}</p>;
  const sendNotice = sendStatus === 'error' && sendError && !storageError && <p role="alert" data-gps-send-error className="rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-900">{sendError}</p>;
  if (paused) return <div className="space-y-2"><p role="status" className="rounded-xl bg-neutral-100 p-3 text-sm text-neutral-800">Seguimiento GPS pausado. Reanudá el viaje para compartir ubicación.</p>{storageNotice}{sendNotice}</div>;
  if (storageError && storageIssue && ['legacy', 'unscoped', 'context', 'invalid'].includes(storageIssue)) return <div>{storageNotice}</div>;
  const copy = STATUS_COPY[status];
  const retryStorage = storageError && (!storageIssue || storageIssue === 'storage');

  return (
    <div className="space-y-2">
      {sendNotice}
      <Card className={`${copy.tone} border-none`}>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="status" aria-live="polite" className="flex min-w-0 items-center gap-2">
              {copy.icon}
              <span className="text-sm font-bold">{copy.label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pendingCount > 0 && <Badge color="warning" variant="solid" size="sm">{pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}</Badge>}
              {sendStatus === 'ok' && <Badge color="success" variant="soft" size="sm">{formatLastSync(lastSyncAt)}</Badge>}
              {sendStatus === 'error' && <Badge color="error" variant="soft" size="sm">Sin enviar</Badge>}
            </div>
          </div>

          {onRetry && (retryStorage || (!storageError && ['denied', 'unavailable', 'error'].includes(status))) && (
            <button type="button" onClick={onRetry} disabled={retrying || retryDisabled}
              className="mt-3 min-h-11 rounded-lg border border-primary-700 bg-white px-4 text-sm font-semibold text-primary-800 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 disabled:opacity-60">
              {retrying ? 'Reintentando GPS' : retryStorage ? 'Reintentar guardado' : 'Reintentar GPS'}
            </button>
          )}

          {status === 'active' && position && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-700">
              <div className="flex items-center gap-1.5">
                <Crosshair size={13} className="text-neutral-400" />
                <span>{position[0].toFixed(5)}, {position[1].toFixed(5)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-neutral-400" />
                <span>{details.accuracy != null ? `±${Math.round(details.accuracy)} m` : 'Precisión no disponible'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Gauge size={13} className="text-neutral-400" />
                <span>{details.speed != null ? `${Math.round(details.speed * 3.6)} km/h` : '- km/h'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Compass size={13} className="text-neutral-400" />
                <span>{headingToCompass(details.heading)}</span>
              </div>
            </div>
          )}

          {status === 'acquiring' && (
            <p className="mt-2 text-xs text-warning-700">Esperando el primer punto GPS del dispositivo.</p>
          )}
        </CardContent>
      </Card>

      {(status === 'denied' || status === 'unavailable') && (
        <details className="rounded-xl border border-neutral-200 bg-white p-3 text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
            {status === 'denied' ? 'Cómo habilitar la ubicación' : 'Cómo recuperar el GPS'}
          </summary>
          <AndroidPermissionGuide permission="gps" state={status} />
        </details>
      )}
      {storageNotice}
    </div>
  );
};

export default GpsStatusPanel;

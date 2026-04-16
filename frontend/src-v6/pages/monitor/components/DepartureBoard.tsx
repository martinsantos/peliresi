/**
 * DepartureBoard — Airport-style event display for the War Room sidebar
 * Shows the current event as a compact, dark terminal-style card.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, MapPin, Package, Clock } from 'lucide-react';
import { EVENT_COLORS } from '../utils/war-room-icons';
import { formatTimeShort } from '../utils/formatters';

interface Props {
  event: {
    timestamp: string;
    eventoTipo?: string;
    manifiestoId: string;
    manifiestoNumero: string;
    descripcion: string;
    latitud?: number;
    longitud?: number;
    generador?: { razonSocial: string; lat: number; lng: number };
    operador?: { razonSocial: string; lat: number; lng: number };
    transportista?: string | { razonSocial: string; cuit?: string };
    estadoActual?: string;
    residuos?: Array<{ codigo: string; nombre: string; cantidad: number; unidad: string }>;
    fechas?: { firma?: string; retiro?: string; entrega?: string; recepcion?: string; cierre?: string };
    tratamientoMetodo?: string;
    cuitGenerador?: string;
    cuitOperador?: string;
  } | null;
  eventIndex: number;
  totalEvents: number;
}

const WORKFLOW_STATES = [
  { key: 'borrador', label: 'BOR', dateKey: null },
  { key: 'aprobado', label: 'APR', dateKey: 'firma' },
  { key: 'enTransito', label: 'TRA', dateKey: 'retiro' },
  { key: 'entregado', label: 'ENT', dateKey: 'entrega' },
  { key: 'recibido', label: 'REC', dateKey: 'recepcion' },
  { key: 'enTratamiento', label: 'TRT', dateKey: null },
  { key: 'tratado', label: 'FIN', dateKey: 'cierre' },
] as const;

// Map eventoTipo to workflow progress index
const TIPO_TO_PROGRESS: Record<string, number> = {
  CREACION: 0,
  FIRMA: 1,
  RETIRO: 2,
  ENTREGA: 3,
  RECEPCION: 4,
  TRATAMIENTO: 5,
  CIERRE: 6,
};

const EVENT_LABELS: Record<string, string> = {
  CREACION: 'CREACION',
  FIRMA: 'FIRMA',
  RETIRO: 'RETIRO',
  ENTREGA: 'ENTREGA',
  RECEPCION: 'RECEPCION',
  TRATAMIENTO: 'TRATAMIENTO',
  CIERRE: 'CIERRE',
  INCIDENTE: 'INCIDENTE',
  CANCELACION: 'CANCELACION',
  RECHAZO: 'RECHAZO',
};

export const DepartureBoard: React.FC<Props> = ({ event, eventIndex, totalEvents }) => {
  const [animKey, setAnimKey] = useState(0);
  const prevEventRef = useRef<string | null>(null);

  // Trigger animation when event changes
  useEffect(() => {
    const eventId = event ? `${event.manifiestoId}-${event.timestamp}-${event.eventoTipo}` : null;
    if (eventId !== prevEventRef.current) {
      prevEventRef.current = eventId;
      setAnimKey(k => k + 1);
    }
  }, [event]);

  if (!event) {
    return (
      <div className="bg-neutral-900 text-neutral-500 rounded-lg border border-neutral-700 p-4 text-center text-xs font-mono">
        Sin evento seleccionado
      </div>
    );
  }

  const tipo = event.eventoTipo || 'CREACION';
  const borderColor = EVENT_COLORS[tipo] || '#6B7280';
  const progressIdx = TIPO_TO_PROGRESS[tipo] ?? -1;
  const progressPct = progressIdx >= 0 ? ((progressIdx + 1) / WORKFLOW_STATES.length) * 100 : 0;

  return (
    <div
      key={animKey}
      className="bg-neutral-900 rounded-lg border overflow-hidden departure-board-enter"
      style={{ borderColor, maxWidth: 300 }}
    >
      {/* Header: type badge + time + counter */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span
          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: borderColor + '22', color: borderColor }}
        >
          {EVENT_LABELS[tipo] || tipo}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-neutral-400">
            {formatTimeShort(event.timestamp)}
          </span>
          <span className="text-[10px] font-mono text-neutral-600 tabular-nums">
            {eventIndex + 1}/{totalEvents}
          </span>
        </div>
      </div>

      {/* Manifest number */}
      <div className="px-3 pt-2 pb-1">
        <span className="text-lg font-bold font-mono text-white tracking-wide">
          {event.manifiestoNumero}
        </span>
      </div>

      {/* Route: Generador -> Transportista -> Operador */}
      <div className="px-3 py-2 space-y-1.5">
        {event.generador && (
          <RouteNode
            label="GEN"
            name={event.generador.razonSocial}
            cuit={event.cuitGenerador}
            coords={[event.generador.lat, event.generador.lng]}
            color="#7C3AED"
          />
        )}
        {event.transportista && (
          <div className="flex items-center gap-1.5 pl-2">
            <ArrowRight size={10} className="text-neutral-600" />
            <span className="text-[10px] text-orange-400 font-medium truncate">
              {typeof event.transportista === 'string' ? event.transportista : event.transportista?.razonSocial}
            </span>
          </div>
        )}
        {event.operador && (
          <RouteNode
            label="OPE"
            name={event.operador.razonSocial}
            cuit={event.cuitOperador}
            coords={[event.operador.lat, event.operador.lng]}
            color="#2563EB"
          />
        )}
      </div>

      {/* Residuos */}
      {event.residuos && event.residuos.length > 0 && (
        <div className="px-3 py-1.5 border-t border-neutral-800">
          <div className="flex items-center gap-1 mb-1">
            <Package size={10} className="text-neutral-500" />
            <span className="text-[9px] uppercase text-neutral-500 font-semibold tracking-wide">Residuos</span>
          </div>
          <div className="space-y-0.5">
            {event.residuos.slice(0, 3).map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <span className="text-yellow-500 font-mono font-bold">{r.codigo}</span>
                <span className="text-neutral-400 truncate flex-1">{r.nombre}</span>
                <span className="text-neutral-500 tabular-nums">{r.cantidad} {r.unidad}</span>
              </div>
            ))}
            {event.residuos.length > 3 && (
              <span className="text-[9px] text-neutral-600">+{event.residuos.length - 3} mas</span>
            )}
          </div>
        </div>
      )}

      {/* Workflow timeline dots */}
      <div className="px-3 py-2 border-t border-neutral-800">
        <div className="flex items-center justify-between mb-1.5">
          {WORKFLOW_STATES.map((ws, i) => {
            const filled = i <= progressIdx;
            const active = i === progressIdx;
            return (
              <div key={ws.key} className="flex flex-col items-center gap-0.5">
                <div
                  className={`w-2.5 h-2.5 rounded-full border transition-all ${
                    active ? 'scale-125' : ''
                  }`}
                  style={{
                    backgroundColor: filled ? borderColor : 'transparent',
                    borderColor: filled ? borderColor : '#525252',
                    boxShadow: active ? `0 0 6px ${borderColor}` : 'none',
                  }}
                />
                <span className={`text-[7px] font-mono ${filled ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  {ws.label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, backgroundColor: borderColor }}
          />
        </div>
      </div>

      {/* Description footer */}
      <div className="px-3 py-1.5 border-t border-neutral-800">
        <p className="text-[10px] text-neutral-500 leading-tight truncate">
          {event.descripcion}
        </p>
      </div>

      {/* CSS animation */}
      <style>{`
        .departure-board-enter {
          animation: db-slide-in 0.3s ease-out;
        }
        @keyframes db-slide-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

// Sub-component for route nodes
const RouteNode: React.FC<{
  label: string;
  name: string;
  cuit?: string;
  coords?: [number, number];
  color: string;
}> = ({ label, name, cuit, coords, color }) => (
  <div className="flex items-start gap-1.5">
    <span
      className="text-[8px] font-bold px-1 py-0.5 rounded mt-0.5 flex-shrink-0"
      style={{ backgroundColor: color + '22', color }}
    >
      {label}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] text-neutral-200 font-medium truncate leading-tight">{name}</p>
      <div className="flex items-center gap-1.5 text-[9px] text-neutral-600">
        {cuit && <span className="font-mono">{cuit}</span>}
        {coords && coords[0] !== 0 && (
          <span className="flex items-center gap-0.5">
            <MapPin size={7} />
            {coords[0].toFixed(2)}, {coords[1].toFixed(2)}
          </span>
        )}
      </div>
    </div>
  </div>
);

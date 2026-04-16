/**
 * DepartureBoard — Airport-style event display for the War Room sidebar
 * Shows the current event as a compact, dark terminal-style card.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, MapPin, Package, FileText, CheckCircle, Truck, Box, FlaskConical, Zap } from 'lucide-react';
import { EVENT_COLORS, RESIDUO_PALETTE } from '../utils/war-room-icons';
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
  { key: 'borrador',      label: 'BOR', dateKey: null,       Icon: FileText },
  { key: 'aprobado',      label: 'APR', dateKey: 'firma',    Icon: CheckCircle },
  { key: 'enTransito',    label: 'TRA', dateKey: 'retiro',   Icon: Truck },
  { key: 'entregado',     label: 'ENT', dateKey: 'entrega',  Icon: Box },
  { key: 'recibido',      label: 'REC', dateKey: 'recepcion',Icon: Package },
  { key: 'enTratamiento', label: 'TRT', dateKey: null,       Icon: FlaskConical },
  { key: 'tratado',       label: 'FIN', dateKey: 'cierre',   Icon: Zap },
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
      className="bg-neutral-900 rounded-xl overflow-hidden departure-board-enter-v2"
      style={{ borderLeft: `4px solid ${borderColor}`, maxWidth: 300, boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)` }}
    >
      {/* Header especial para CREACION */}
      {tipo === 'CREACION' && (
        <div className="px-3 py-1.5 bg-emerald-900/50 border-b border-emerald-700/30 flex items-center gap-1.5">
          <span className="text-emerald-300 text-base leading-none">✦</span>
          <span className="text-[11px] text-emerald-300 font-bold tracking-wide uppercase">Nuevo Manifiesto</span>
        </div>
      )}

      {/* Header: type badge + time + counter */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span
          className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: borderColor + '22', color: borderColor }}
        >
          {EVENT_LABELS[tipo] || tipo}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-neutral-400 tabular-nums">
            {formatTimeShort(event.timestamp)}
          </span>
          <span className="text-[10px] font-mono text-neutral-600 tabular-nums">
            {eventIndex + 1}/{totalEvents}
          </span>
        </div>
      </div>

      {/* Manifest number — grande */}
      <div className="px-3 pt-3 pb-1">
        <span className="text-3xl font-black font-mono text-white tracking-wider leading-none">
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
            <span className="text-[11px] text-orange-400 font-semibold truncate">
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

      {/* Residuos — pills de color */}
      {event.residuos && event.residuos.length > 0 && (
        <div className="px-3 py-1.5 border-t border-neutral-800">
          <div className="flex items-center gap-1 mb-1.5">
            <Package size={10} className="text-neutral-500" />
            <span className="text-[9px] uppercase text-neutral-500 font-bold tracking-wide">Residuos</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {event.residuos.slice(0, 4).map((r, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full border font-mono"
                style={{
                  background: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length] + '20',
                  color: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length],
                  borderColor: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length] + '40',
                }}
              >
                {r.codigo} · {r.cantidad} {r.unidad}
              </span>
            ))}
            {event.residuos.length > 4 && (
              <span className="text-[9px] text-neutral-600 self-center">+{event.residuos.length - 4}</span>
            )}
          </div>
        </div>
      )}

      {/* Workflow timeline — iconos Lucide */}
      <div className="px-3 py-2.5 border-t border-neutral-800">
        <div className="flex items-center justify-between mb-2">
          {WORKFLOW_STATES.map((ws, i) => {
            const { Icon } = ws;
            const filled = i <= progressIdx;
            const active = i === progressIdx;
            return (
              <div key={ws.key} className="flex flex-col items-center gap-0.5">
                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${active ? 'scale-125' : ''}`}
                  style={{
                    backgroundColor: filled ? borderColor + 'cc' : 'transparent',
                    borderColor: filled ? borderColor : '#404040',
                    boxShadow: active ? `0 0 10px ${borderColor}80` : 'none',
                  }}
                >
                  <Icon size={11} color={filled ? '#fff' : '#525252'} />
                </div>
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
            style={{ width: `${progressPct}%`, background: `linear-gradient(to right, ${borderColor}99, ${borderColor})` }}
          />
        </div>
      </div>

      {/* Description footer */}
      <div className="px-3 py-1.5 border-t border-neutral-800">
        <p className="text-[10px] text-neutral-500 leading-tight truncate">
          {event.descripcion}
        </p>
      </div>
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
      className="text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
      style={{ backgroundColor: color + '22', color }}
    >
      {label}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] text-neutral-200 font-semibold truncate leading-tight">{name}</p>
      <div className="flex items-center gap-1.5 text-[10px] text-neutral-600">
        {cuit && <span className="font-mono">{cuit}</span>}
        {coords && coords[0] !== 0 && (
          <span className="flex items-center gap-0.5">
            <MapPin size={8} />
            {coords[0].toFixed(2)}, {coords[1].toFixed(2)}
          </span>
        )}
      </div>
    </div>
  </div>
);

/**
 * EventFeed — Scrollable event timeline
 * Colored left borders, bold manifest numbers, Lucide icons per event type
 */

import React, { useRef, useEffect } from 'react';
import { Plus, PenLine, Truck, Package, FlaskConical, Zap, AlertTriangle, XCircle, RotateCcw } from 'lucide-react';
import type { MonitorMode } from '../WarRoomPage';
import { formatTimeShort } from '../utils/formatters';
import { EVENT_COLORS, RESIDUO_PALETTE } from '../utils/war-room-icons';

const TIPO_ICONS: Record<string, React.ElementType> = {
  CREACION:    Plus,
  FIRMA:       PenLine,
  RETIRO:      Truck,
  ENTREGA:     Package,
  RECEPCION:   Package,
  TRATAMIENTO: FlaskConical,
  CIERRE:      Zap,
  INCIDENTE:   AlertTriangle,
  CANCELACION: XCircle,
  RECHAZO:     RotateCcw,
};

interface EventItem {
  id: string;
  tipo: string;
  descripcion: string;
  latitud?: number;
  longitud?: number;
  timestamp: string;
  manifiestoNumero: string;
  generador?: { razonSocial: string };
  operador?: { razonSocial: string };
  residuos?: Array<{ codigo: string; nombre: string; cantidad: number; unidad: string }>;
}

interface Props {
  eventos: EventItem[];
  mode: MonitorMode;
  onEventClick?: (lat: number, lng: number) => void;
  currentEventId?: string;
  className?: string;
}

export const EventFeed: React.FC<Props> = ({ eventos, mode, onEventClick, currentEventId, className }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [eventos.length]);

  const handleClick = (ev: EventItem) => {
    if (onEventClick && ev.latitud && ev.longitud) {
      onEventClick(ev.latitud, ev.longitud);
    }
  };

  if (eventos.length === 0) {
    return (
      <div className={`wr-panel p-3 flex flex-col min-h-0 ${className ?? ''}`}>
        <p className="text-xs text-neutral-400 text-center py-4">Sin eventos recientes</p>
      </div>
    );
  }

  return (
    <div className={`wr-panel p-3 flex flex-col min-h-0 ${className ?? ''}`}>
      <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0 -mr-1 pr-1 space-y-0.5">
        {eventos.map((ev, i) => {
          const color = EVENT_COLORS[ev.tipo as keyof typeof EVENT_COLORS] || '#94a3b8';
          const isActive = currentEventId && ev.id === currentEventId;
          const TipoIcon = TIPO_ICONS[ev.tipo];
          return (
            <div
              key={ev.id}
              className={`wr-event-item flex items-start gap-2 py-1.5 pr-1 rounded-sm cursor-pointer transition-colors ${
                isActive ? 'bg-emerald-50' : 'hover:bg-neutral-50/80'
              } ${i === 0 ? 'wr-event-arrive' : ''}`}
              style={{
                animationDelay: `${i * 40}ms`,
                borderLeft: isActive ? `4px solid ${color}` : `2px solid ${color}50`,
                paddingLeft: isActive ? '7px' : '8px',
              }}
              onClick={() => handleClick(ev)}
            >
              {/* Dot */}
              <div
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-semibold text-neutral-500 tabular-nums">
                    {formatTimeShort(ev.timestamp)}
                  </span>
                  <span
                    className="text-[9px] uppercase px-1.5 py-0.5 rounded-sm flex items-center gap-0.5"
                    style={{
                      backgroundColor: color + '20',
                      color,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      border: `1px solid ${color}30`,
                    }}
                  >
                    {TipoIcon && <TipoIcon size={8} strokeWidth={2.5} />}
                    {ev.tipo}
                  </span>
                </div>
                <p className="text-[11px] leading-tight truncate">
                  <span className="font-black text-neutral-800 font-mono tracking-tight">{ev.manifiestoNumero}</span>
                  <span className="text-neutral-300 mx-1">·</span>
                  <span className="text-neutral-500 text-[10px]">{ev.descripcion}</span>
                </p>
                {ev.tipo === 'CREACION' && ev.generador && (
                  <p className="text-[10px] text-emerald-600 font-semibold truncate mt-0.5">
                    {ev.generador.razonSocial}
                  </p>
                )}
                {ev.tipo === 'CREACION' && ev.residuos && ev.residuos.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {ev.residuos.slice(0, 2).map((r, ri) => (
                      <span
                        key={ri}
                        className="text-[9px] px-1.5 py-0.5 rounded-full border font-mono"
                        style={{
                          background: RESIDUO_PALETTE[ri % RESIDUO_PALETTE.length] + '18',
                          color: RESIDUO_PALETTE[ri % RESIDUO_PALETTE.length],
                          borderColor: RESIDUO_PALETTE[ri % RESIDUO_PALETTE.length] + '40',
                        }}
                      >
                        {r.codigo} · {r.cantidad} {r.unidad}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

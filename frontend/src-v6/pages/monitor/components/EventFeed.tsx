/**
 * EventFeed — Scrollable event timeline with sharp, brilliant styling
 * Colored left borders, ring-effect dots, bold timestamps, crisp badges
 */

import React, { useRef, useEffect } from 'react';
import type { MonitorMode } from '../WarRoomPage';
import { formatTimeShort } from '../utils/formatters';
import { EVENT_COLORS } from '../utils/war-room-icons';

interface EventItem {
  id: string;
  tipo: string;
  descripcion: string;
  latitud?: number;
  longitud?: number;
  timestamp: string;
  manifiestoNumero: string;
}

interface Props {
  eventos: EventItem[];
  mode: MonitorMode;
  onEventClick?: (lat: number, lng: number) => void;
  currentEventId?: string;
}

export const EventFeed: React.FC<Props> = ({ eventos, mode, onEventClick, currentEventId }) => {
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
      <div className="wr-panel p-3 flex-1 min-h-0">
        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Eventos</h3>
        <p className="text-xs text-neutral-400 text-center py-4">Sin eventos recientes</p>
      </div>
    );
  }

  return (
    <div className="wr-panel p-3 flex-1 min-h-0 flex flex-col">
      <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
        Eventos
        <span className="ml-1.5 text-neutral-400 font-normal">({eventos.length})</span>
      </h3>
      <div ref={scrollRef} className="overflow-y-auto flex-1 -mr-1 pr-1 space-y-0.5">
        {eventos.map((ev, i) => {
          const color = EVENT_COLORS[ev.tipo as keyof typeof EVENT_COLORS] || '#94a3b8';
          const isActive = currentEventId && ev.id === currentEventId;
          return (
            <div
              key={ev.id}
              className={`wr-event-item flex items-start gap-2 py-1.5 pr-1 rounded-sm cursor-pointer transition-colors ${
                isActive ? 'bg-neutral-100 ring-1 ring-neutral-300' : 'hover:bg-neutral-50/80'
              }`}
              style={{
                animationDelay: `${i * 40}ms`,
                borderLeft: isActive ? `3px solid ${color}` : `2px solid ${color}`,
                paddingLeft: '8px',
              }}
              onClick={() => handleClick(ev)}
            >
              {/* Dot with ring effect */}
              <div
                className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 0 2px ${color}30, 0 0 4px ${color}50`,
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-semibold text-neutral-500 tabular-nums">
                    {formatTimeShort(ev.timestamp)}
                  </span>
                  <span
                    className="text-[9px] uppercase px-1 py-0.5 rounded-sm"
                    style={{
                      backgroundColor: color + '20',
                      color,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      border: `1px solid ${color}30`,
                    }}
                  >
                    {ev.tipo}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-600 truncate">
                  <span className="font-bold">{ev.manifiestoNumero}</span>
                  {' — '}{ev.descripcion}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

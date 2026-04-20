/**
 * FloatingPanelLayer — Draggable floating panels over the War Room map.
 * Panels can be opened from EventFeed (manifiesto) or Viajes widget (viaje).
 * Multiple panels coexist; clicking a panel brings it to front.
 * Pure mousedown/mousemove drag — no external libraries.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  GripVertical, X, Minus, Maximize2,
  ArrowRight, Package, MapPin, Truck, CheckCircle,
  FileText, Zap, FlaskConical, Box,
} from 'lucide-react';
import { EVENT_COLORS, RESIDUO_PALETTE } from '../utils/war-room-icons';
import { formatTimeShort } from '../utils/formatters';
import type { EnTransitoItem } from '../api/monitor-api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FPType = 'manifiesto' | 'viaje';

export interface ManifiestoFPData {
  timestamp: string;
  eventoTipo?: string;
  manifiestoNumero: string;
  descripcion: string;
  generador?: { razonSocial: string; lat?: number; lng?: number };
  operador?: { razonSocial: string; lat?: number; lng?: number };
  transportista?: string | { razonSocial: string };
  residuos?: Array<{ codigo: string; nombre: string; cantidad: number; unidad: string }>;
  estadoActual?: string;
  tratamientoMetodo?: string;
}

export type ViajeFPData = EnTransitoItem;

export interface FloatingPanel {
  id: string;
  type: FPType;
  data: ManifiestoFPData | ViajeFPData;
  pos: { x: number; y: number };
  zIndex: number;
  minimized: boolean;
}

// ─── Workflow dots ────────────────────────────────────────────────────────────

const WORKFLOW = [
  { key: 'borrador',      label: 'BOR', Icon: FileText },
  { key: 'aprobado',      label: 'APR', Icon: CheckCircle },
  { key: 'enTransito',    label: 'TRA', Icon: Truck },
  { key: 'entregado',     label: 'ENT', Icon: Box },
  { key: 'recibido',      label: 'REC', Icon: Package },
  { key: 'enTratamiento', label: 'TRT', Icon: FlaskConical },
  { key: 'tratado',       label: 'FIN', Icon: Zap },
] as const;

const TIPO_TO_PROGRESS: Record<string, number> = {
  CREACION: 0, FIRMA: 1, RETIRO: 2, ENTREGA: 3,
  RECEPCION: 4, TRATAMIENTO: 5, CIERRE: 6,
};

// ─── ManifiestoContent ────────────────────────────────────────────────────────

const ManifiestoContent: React.FC<{ data: ManifiestoFPData }> = ({ data }) => {
  const tipo = data.eventoTipo || '';
  const color = EVENT_COLORS[tipo as keyof typeof EVENT_COLORS] || '#94a3b8';
  const transNombre = typeof data.transportista === 'string'
    ? data.transportista
    : data.transportista?.razonSocial ?? '';
  const progressIdx = TIPO_TO_PROGRESS[tipo] ?? -1;

  return (
    <div className="space-y-2.5">
      {/* Type badge + time */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide"
          style={{ backgroundColor: color + '20', color }}
        >
          {tipo || 'EVENTO'}
        </span>
        <span className="text-[10px] font-mono text-neutral-400 tabular-nums">
          {formatTimeShort(data.timestamp)}
        </span>
      </div>

      {/* Manifest number */}
      <p
        className="text-2xl font-black font-mono text-neutral-900 tracking-tight leading-none pl-2"
        style={{ borderLeft: `3px solid ${color}` }}
      >
        {data.manifiestoNumero}
      </p>

      {/* Actors */}
      <div className="space-y-1">
        {data.generador && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 shrink-0">GEN</span>
            <span className="text-[11px] text-neutral-700 truncate font-medium">{data.generador.razonSocial}</span>
          </div>
        )}
        {transNombre && (
          <div className="flex items-center gap-1.5 pl-1">
            <ArrowRight size={9} className="text-neutral-400 shrink-0" />
            <span className="text-[11px] text-orange-600 truncate font-semibold">{transNombre}</span>
          </div>
        )}
        {data.operador && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">OPE</span>
            <span className="text-[11px] text-neutral-700 truncate font-medium">{data.operador.razonSocial}</span>
          </div>
        )}
      </div>

      {/* Residuos pills */}
      {data.residuos && data.residuos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.residuos.slice(0, 6).map((r, i) => (
            <span
              key={i}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border"
              style={{
                background: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length] + '18',
                color: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length],
                borderColor: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length] + '40',
              }}
            >
              {r.codigo} · {r.cantidad} {r.unidad}
            </span>
          ))}
        </div>
      )}

      {/* Workflow progress dots */}
      {progressIdx >= 0 && (
        <div className="pt-1 border-t border-black/5">
          <div className="flex items-center justify-between mb-1.5">
            {WORKFLOW.map(({ label, Icon }, i) => {
              const filled = i <= progressIdx;
              const active = i === progressIdx;
              return (
                <div key={label} className="flex flex-col items-center gap-0.5">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${active ? 'scale-110' : ''} transition-all`}
                    style={{
                      backgroundColor: filled ? color : 'transparent',
                      borderColor: filled ? color : '#e5e7eb',
                      boxShadow: active ? `0 0 8px ${color}60` : 'none',
                    }}
                  >
                    <Icon size={9} color={filled ? '#fff' : '#d1d5db'} />
                  </div>
                  <span className={`text-[7px] font-mono ${filled ? 'text-neutral-500' : 'text-neutral-300'}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-1 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((progressIdx + 1) / WORKFLOW.length) * 100}%`,
                background: `linear-gradient(to right, ${color}80, ${color})`,
              }}
            />
          </div>
        </div>
      )}

      {/* Description */}
      <p className="text-[10px] text-neutral-400 truncate border-t border-black/5 pt-1.5">
        {data.descripcion}
      </p>
    </div>
  );
};

// ─── ViajeContent ─────────────────────────────────────────────────────────────

const ViajeContent: React.FC<{ data: ViajeFPData }> = ({ data }) => {
  const vel = data.ultimaPosicion?.velocidad;

  return (
    <div className="space-y-2.5">
      {/* Manifest number */}
      <p className="text-2xl font-black font-mono text-neutral-900 tracking-tight leading-none pl-2"
         style={{ borderLeft: '3px solid #f97316' }}>
        {data.numero}
      </p>

      {/* Transportista */}
      <div className="flex items-center gap-1.5">
        <Truck size={11} className="text-orange-500 shrink-0" />
        <span className="text-[11px] text-neutral-700 font-semibold truncate">{data.transportista || '—'}</span>
      </div>

      {/* Vehiculo + Chofer */}
      {(data.vehiculo || data.chofer) && (
        <div className="space-y-0.5">
          {data.vehiculo && (
            <p className="text-[10px] text-neutral-500">
              <span className="font-mono font-bold text-neutral-700">{data.vehiculo.patente}</span>
              <span className="ml-1 text-neutral-400">{data.vehiculo.descripcion}</span>
            </p>
          )}
          {data.chofer && (
            <p className="text-[10px] text-neutral-500">Chofer: <span className="font-medium text-neutral-700">{data.chofer.nombre}</span></p>
          )}
        </div>
      )}

      {/* Route */}
      <div className="flex items-center gap-1.5 bg-neutral-50 rounded-lg px-2 py-1.5">
        <span className="text-[9px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded shrink-0">ORI</span>
        <span className="text-[10px] text-neutral-600 truncate flex-1">{data.origen.razonSocial || '—'}</span>
        <ArrowRight size={9} className="text-neutral-300 shrink-0" />
        <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">DST</span>
        <span className="text-[10px] text-neutral-600 truncate flex-1">{data.destino.razonSocial || '—'}</span>
      </div>

      {/* GPS status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <MapPin size={10} className="text-neutral-400" />
          <span className="text-[10px] text-neutral-500">
            {data.ruta.length > 0 ? `${data.ruta.length} pts GPS` : 'Sin GPS'}
          </span>
        </div>
        {vel != null && vel > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-orange-600">{vel.toFixed(0)} km/h</span>
          </div>
        )}
        {data.ultimaPosicion && (
          <span className="text-[9px] text-neutral-400 font-mono ml-auto">
            {formatTimeShort(data.ultimaPosicion.timestamp)}
          </span>
        )}
      </div>

      {/* Residuos */}
      {data.residuos && data.residuos.length > 0 && (
        <div className="border-t border-black/5 pt-2">
          <p className="text-[9px] text-neutral-400 uppercase font-bold mb-1">Residuos</p>
          <div className="flex flex-wrap gap-1">
            {data.residuos.slice(0, 4).map((r, i) => (
              <span
                key={i}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border"
                style={{
                  background: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length] + '18',
                  color: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length],
                  borderColor: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length] + '40',
                }}
              >
                {r.codigo} · {r.cantidad} {r.unidad}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── FloatingPanelWindow ──────────────────────────────────────────────────────

const PANEL_TYPE_LABELS: Record<FPType, string> = {
  manifiesto: 'Manifiesto',
  viaje: 'En Tránsito',
};

const FloatingPanelWindow: React.FC<{
  panel: FloatingPanel;
  onClose: () => void;
  onBringToFront: () => void;
  onMove: (pos: { x: number; y: number }) => void;
  onMinimize: () => void;
}> = ({ panel, onClose, onBringToFront, onMove, onMinimize }) => {

  const onHeaderMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore clicks on buttons inside header
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    onBringToFront();

    const startX = e.clientX - panel.pos.x;
    const startY = e.clientY - panel.pos.y;

    const onMouseMove = (ev: MouseEvent) => {
      const x = Math.max(0, Math.min(window.innerWidth - 280, ev.clientX - startX));
      const y = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - startY));
      onMove({ x, y });
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panel.pos, onBringToFront, onMove]);

  return (
    <div
      className="fp-window"
      style={{
        transform: `translate(${panel.pos.x}px, ${panel.pos.y}px)`,
        zIndex: panel.zIndex,
      }}
      onMouseDown={onBringToFront}
    >
      {/* Header */}
      <div className="fp-header" onMouseDown={onHeaderMouseDown}>
        <GripVertical size={12} className="text-neutral-400 shrink-0" />
        <span className="fp-title">{PANEL_TYPE_LABELS[panel.type]}</span>
        {panel.type === 'manifiesto' && (
          <span className="text-[9px] font-mono text-neutral-400 mr-1">
            {(panel.data as ManifiestoFPData).manifiestoNumero}
          </span>
        )}
        {panel.type === 'viaje' && (
          <span className="text-[9px] font-mono text-neutral-400 mr-1">
            {(panel.data as ViajeFPData).numero}
          </span>
        )}
        <button onClick={onMinimize} className="fp-btn" title={panel.minimized ? 'Expandir' : 'Minimizar'}>
          {panel.minimized ? <Maximize2 size={11} /> : <Minus size={11} />}
        </button>
        <button onClick={onClose} className="fp-btn fp-btn-close" title="Cerrar">
          <X size={11} />
        </button>
      </div>

      {/* Content — hidden when minimized */}
      {!panel.minimized && (
        <div className="fp-content">
          {panel.type === 'manifiesto' && <ManifiestoContent data={panel.data as ManifiestoFPData} />}
          {panel.type === 'viaje' && <ViajeContent data={panel.data as ViajeFPData} />}
        </div>
      )}
    </div>
  );
};

// ─── FloatingPanelLayer ───────────────────────────────────────────────────────

export const FloatingPanelLayer: React.FC<{
  panels: FloatingPanel[];
  onClose: (id: string) => void;
  onBringToFront: (id: string) => void;
  onMove: (id: string, pos: { x: number; y: number }) => void;
  onMinimize: (id: string) => void;
}> = ({ panels, onClose, onBringToFront, onMove, onMinimize }) => (
  <div className="fp-layer">
    {panels.map(panel => (
      <FloatingPanelWindow
        key={panel.id}
        panel={panel}
        onClose={() => onClose(panel.id)}
        onBringToFront={() => onBringToFront(panel.id)}
        onMove={pos => onMove(panel.id, pos)}
        onMinimize={() => onMinimize(panel.id)}
      />
    ))}
  </div>
);

// ─── useFloatingPanels hook ───────────────────────────────────────────────────

export function useFloatingPanels() {
  const [panels, setPanels] = useState<FloatingPanel[]>([]);
  const topZRef = useRef(1100);

  const openPanel = useCallback((
    type: FPType,
    data: ManifiestoFPData | ViajeFPData,
    id: string,
  ) => {
    setPanels(prev => {
      // Dedup: already open → bring to front and un-minimize
      const existing = prev.find(p => p.id === id);
      if (existing) {
        topZRef.current++;
        const z = topZRef.current;
        return prev.map(p => p.id === id ? { ...p, zIndex: z, minimized: false } : p);
      }
      // New panel — stagger position
      const offset = (prev.length % 5) * 28;
      topZRef.current++;
      return [...prev, {
        id, type, data,
        pos: { x: 340 + offset, y: 72 + offset },
        zIndex: topZRef.current,
        minimized: false,
      }];
    });
  }, []);

  const closePanel = useCallback((id: string) => {
    setPanels(p => p.filter(x => x.id !== id));
  }, []);

  const bringToFront = useCallback((id: string) => {
    topZRef.current++;
    const z = topZRef.current;
    setPanels(p => p.map(x => x.id === id ? { ...x, zIndex: z } : x));
  }, []);

  const movePanel = useCallback((id: string, pos: { x: number; y: number }) => {
    setPanels(p => p.map(x => x.id === id ? { ...x, pos } : x));
  }, []);

  const minimizePanel = useCallback((id: string) => {
    setPanels(p => p.map(x => x.id === id ? { ...x, minimized: !x.minimized } : x));
  }, []);

  return { panels, openPanel, closePanel, bringToFront, movePanel, minimizePanel };
}

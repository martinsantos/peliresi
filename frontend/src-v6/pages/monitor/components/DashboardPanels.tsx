/**
 * DashboardPanels — Left sidebar with Widget System
 * Layout: top zone (scrollable widgets) + drag divider + bottom zone (EventFeed).
 * Each widget: collapsible header + closeable. Closed → tray.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Factory, FlaskConical, Package, Beaker, Droplets,
  ChevronUp, ChevronDown, X, Truck, GitBranch, Radio,
  FileText, ArrowRight, Users, GripHorizontal,
  MapPin, CheckCircle, Clock,
} from 'lucide-react';
import type { MonitorMode } from '../WarRoomPage';
import type { MonitorLiveResponse, ForecastResponse, TimelineResponse, EnTransitoItem } from '../api/monitor-api';
import { formatNumber, formatTimeShort } from '../utils/formatters';
import { EventFeed } from './EventFeed';
import { EVENT_COLORS } from '../utils/war-room-icons';

// ─── AnimatedCounter ─────────────────────────────────────────────────────────

function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(value);
  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end || !ref.current) { prevRef.current = end; return; }
    const duration = 300;
    const startTime = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      if (ref.current) ref.current.textContent = String(Math.round(start + (end - start) * eased));
      if (t < 1) requestAnimationFrame(step);
      else prevRef.current = end;
    };
    requestAnimationFrame(step);
  }, [value]);
  return <span ref={ref}>{value}</span>;
}

// ─── Palettes & colors ───────────────────────────────────────────────────────

const RESIDUO_PALETTE = ['#059669', '#7c3aed', '#dc2626', '#d97706', '#2563eb', '#0891b2', '#be185d', '#65a30d'];

const ESTADO_COLORS: Record<string, { base: string; dark: string }> = {
  BORRADOR:       { base: '#94a3b8', dark: '#64748b' },
  APROBADO:       { base: '#22c55e', dark: '#16a34a' },
  EN_TRANSITO:    { base: '#3b82f6', dark: '#2563eb' },
  ENTREGADO:      { base: '#f97316', dark: '#ea580c' },
  RECIBIDO:       { base: '#8b5cf6', dark: '#7c3aed' },
  EN_TRATAMIENTO: { base: '#a855f7', dark: '#9333ea' },
  TRATADO:        { base: '#eab308', dark: '#ca8a04' },
};

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador', APROBADO: 'Aprobado', EN_TRANSITO: 'En Tránsito',
  ENTREGADO: 'Entregado', RECIBIDO: 'Recibido', EN_TRATAMIENTO: 'En Tratam.', TRATADO: 'Tratado',
};

// ─── Widget system ────────────────────────────────────────────────────────────

type WId = 'pipeline' | 'viajes' | 'actores' | 'residuos' | 'tratamiento' | 'manifiesto' | 'eventos';
type WState = 'visible' | 'minimized' | 'closed';

const STORAGE_KEY = 'wr-widget-states-v2';
const DIVIDER_KEY = 'wr-divider-pct-v1';

const DEFAULTS: Record<WId, WState> = {
  pipeline:    'visible',
  viajes:      'visible',
  manifiesto:  'visible',
  actores:     'minimized',
  residuos:    'minimized',
  tratamiento: 'closed',
  eventos:     'visible',
};

const WIDGET_CONFIGS: { id: WId; label: string; icon: React.ElementType }[] = [
  { id: 'pipeline',    label: 'Pipeline',    icon: GitBranch },
  { id: 'viajes',      label: 'Viajes',      icon: Truck },
  { id: 'manifiesto',  label: 'Manifiesto',  icon: FileText },
  { id: 'actores',     label: 'Actores',     icon: Users },
  { id: 'residuos',    label: 'Residuos',    icon: Droplets },
  { id: 'tratamiento', label: 'Tratamiento', icon: Beaker },
];

// ─── WidgetShell ──────────────────────────────────────────────────────────────

const WidgetShell: React.FC<{
  title: string;
  icon: React.ElementType;
  state: WState;
  onMin: () => void;
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}> = ({ title, icon: Icon, state, onMin, onClose, className = '', children }) => (
  <div className={`wr-panel overflow-hidden flex flex-col flex-shrink-0 ${className}`}>
    <div
      className="flex items-center gap-1.5 px-2.5 py-2 border-b border-black/5 cursor-pointer select-none"
      onClick={onMin}
    >
      <Icon size={13} className="text-[#0D8A4F] shrink-0" />
      <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide flex-1">{title}</span>
      <button
        className="p-0.5 rounded hover:bg-black/5 text-neutral-400 hover:text-neutral-600 transition-colors"
        onClick={e => { e.stopPropagation(); onMin(); }}
      >
        {state === 'minimized' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
      {onClose && (
        <button
          className="p-0.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-400 transition-colors"
          onClick={e => { e.stopPropagation(); onClose(); }}
          title="Cerrar"
        >
          <X size={12} />
        </button>
      )}
    </div>
    {state !== 'minimized' && (
      <div className="p-2.5">{children}</div>
    )}
  </div>
);

// ─── Compact Manifiesto card (light, fits inside sidebar) ─────────────────────

const ManifiestoCard: React.FC<{
  event: {
    timestamp: string;
    eventoTipo?: string;
    manifiestoNumero: string;
    descripcion: string;
    generador?: { razonSocial: string };
    operador?: { razonSocial: string };
    transportista?: string | { razonSocial: string };
    residuos?: Array<{ codigo: string; cantidad: number; unidad: string }>;
    estadoActual?: string;
  } | null;
  eventIndex: number;
  totalEvents: number;
}> = ({ event, eventIndex, totalEvents }) => {
  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-4 gap-1">
        <Clock size={20} className="text-neutral-300" />
        <p className="text-[11px] text-neutral-400">Sin evento activo</p>
        <p className="text-[10px] text-neutral-300">Iniciá el playback</p>
      </div>
    );
  }

  const tipo = event.eventoTipo || '';
  const color = EVENT_COLORS[tipo as keyof typeof EVENT_COLORS] || '#94a3b8';
  const transNombre = typeof event.transportista === 'string'
    ? event.transportista
    : event.transportista?.razonSocial ?? '';

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide"
          style={{ backgroundColor: color + '20', color }}
        >
          {tipo || 'EVENTO'}
        </span>
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono tabular-nums">
          <span>{formatTimeShort(event.timestamp)}</span>
          {totalEvents > 0 && <span className="text-neutral-300">{eventIndex + 1}/{totalEvents}</span>}
        </div>
      </div>

      {/* Manifest number */}
      <p className="text-xl font-black font-mono text-neutral-900 tracking-tight leading-none"
         style={{ borderLeft: `3px solid ${color}`, paddingLeft: '8px' }}>
        {event.manifiestoNumero}
      </p>

      {/* Actors */}
      <div className="space-y-1">
        {event.generador && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-700 shrink-0">GEN</span>
            <span className="text-[11px] text-neutral-700 truncate font-medium">{event.generador.razonSocial}</span>
          </div>
        )}
        {transNombre && (
          <div className="flex items-center gap-1.5">
            <ArrowRight size={9} className="text-neutral-400 shrink-0 ml-0.5" />
            <span className="text-[11px] text-orange-600 truncate font-medium">{transNombre}</span>
          </div>
        )}
        {event.operador && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">OPE</span>
            <span className="text-[11px] text-neutral-700 truncate font-medium">{event.operador.razonSocial}</span>
          </div>
        )}
      </div>

      {/* Residuos pills */}
      {event.residuos && event.residuos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {event.residuos.slice(0, 3).map((r, i) => (
            <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {r.codigo} · {r.cantidad} {r.unidad}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      <p className="text-[10px] text-neutral-400 truncate">{event.descripcion}</p>
    </div>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  mode: MonitorMode;
  liveData: MonitorLiveResponse | null;
  forecastData: ForecastResponse | null;
  timelineData: TimelineResponse | null;
  playbackCounters?: Record<string, number>;
  playbackEvents?: Array<{
    id: string; tipo: string; descripcion: string; timestamp: string;
    manifiestoNumero: string;
    generador?: { razonSocial: string };
    operador?: { razonSocial: string };
    residuos?: Array<{ codigo: string; nombre: string; cantidad: number; unidad: string }>;
  }>;
  currentEventId?: string;
  enTransito?: EnTransitoItem[];
  currentEvent?: React.ComponentProps<typeof ManifiestoCard>['event'];
  currentEventIndex?: number;
  totalEventCount?: number;
  onTripClick?: (lat: number, lng: number) => void;
  onEventOpen?: (event: {
    tipo: string; timestamp: string; manifiestoNumero: string; descripcion: string;
    generador?: { razonSocial: string }; operador?: { razonSocial: string };
    residuos?: Array<{ codigo: string; nombre: string; cantidad: number; unidad: string }>;
  }) => void;
  onViajeOpen?: (viaje: EnTransitoItem) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DashboardPanels: React.FC<Props> = ({
  mode, liveData, forecastData, timelineData, playbackCounters, playbackEvents,
  currentEventId, enTransito = [], currentEvent, currentEventIndex = 0,
  totalEventCount = 0, onTripClick, onEventOpen, onViajeOpen,
}) => {
  // ── Widget state ──
  const [ws, setWs] = useState<Record<WId, WState>>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) return { ...DEFAULTS, ...JSON.parse(s) };
    } catch {}
    return DEFAULTS;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ws)); } catch {}
  }, [ws]);

  const minimize = (id: WId) => setWs(p => ({ ...p, [id]: p[id] === 'minimized' ? 'visible' : 'minimized' }));
  const close    = (id: WId) => setWs(p => ({ ...p, [id]: 'closed' }));
  const restore  = (id: WId) => setWs(p => ({ ...p, [id]: 'visible' }));
  const closedWidgets = WIDGET_CONFIGS.filter(w => ws[w.id] === 'closed');

  // ── Drag divider ──
  const containerRef = useRef<HTMLDivElement>(null);
  const [dividerPct, setDividerPct] = useState<number>(() => {
    try { const s = localStorage.getItem(DIVIDER_KEY); if (s) return parseFloat(s); } catch {}
    return 55; // 55% for stats zone by default
  });
  const isDragging = useRef(false);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      const clamped = Math.max(25, Math.min(75, pct));
      setDividerPct(clamped);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setDividerPct(prev => {
        try { localStorage.setItem(DIVIDER_KEY, String(prev)); } catch {}
        return prev;
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // ── Data ──
  const porEstado = mode === 'PLAYBACK'
    ? (playbackCounters || {})
    : (liveData?.estadisticas?.porEstado || {});
  const maxEstado = Math.max(...Object.values(porEstado), 1);
  const stages = ['BORRADOR', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'];
  const eventos = playbackEvents || liveData?.eventosRecientes || [];

  // In PLAYBACK: derive Residuos/Tratamiento/Actores from timelineData events
  // (gives stats relevant to the selected day, not the live snapshot)
  const timelineResidues = React.useMemo(() => {
    if (mode !== 'PLAYBACK' || !timelineData) return null;
    const counts: Record<string, { nombre: string; total: number; categoria: string | null }> = {};
    timelineData.eventos.forEach(ev => {
      ev.residuos?.forEach(r => {
        if (!counts[r.nombre]) counts[r.nombre] = { nombre: r.nombre, total: 0, categoria: null };
        counts[r.nombre].total += r.cantidad;
      });
    });
    return Object.values(counts).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [mode, timelineData]);

  const timelineTratamientos = React.useMemo(() => {
    if (mode !== 'PLAYBACK' || !timelineData) return null;
    const counts: Record<string, number> = {};
    timelineData.eventos
      .filter(ev => ev.eventoTipo === 'TRATAMIENTO' && ev.tratamientoMetodo)
      .forEach(ev => { counts[ev.tratamientoMetodo!] = (counts[ev.tratamientoMetodo!] || 0) + 1; });
    return Object.entries(counts).map(([metodo, cantidad]) => ({ metodo, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
  }, [mode, timelineData]);

  const timelineActores = React.useMemo(() => {
    if (mode !== 'PLAYBACK' || !timelineData) return null;
    const gen: Record<string, number> = {};
    const ope: Record<string, number> = {};
    timelineData.eventos.forEach(ev => {
      if (ev.generador?.razonSocial) gen[ev.generador.razonSocial] = (gen[ev.generador.razonSocial] || 0) + 1;
      if (ev.operador?.razonSocial) ope[ev.operador.razonSocial] = (ope[ev.operador.razonSocial] || 0) + 1;
    });
    return {
      generadores: Object.entries(gen).map(([razonSocial, cantidad]) => ({ razonSocial, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
      operadores: Object.entries(ope).map(([razonSocial, cantidad]) => ({ razonSocial, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
    };
  }, [mode, timelineData]);

  const topGeneradores = timelineActores?.generadores || liveData?.topGeneradores || [];
  const topOperadores = timelineActores?.operadores || liveData?.topOperadores || [];
  const topResiduos = timelineResidues || liveData?.topResiduos || [];
  const tratamientosActivos = timelineTratamientos || liveData?.tratamientosActivos || [];

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden p-3 gap-0">

      {/* ── ZONA STATS — altura controlada por divider ── */}
      <div
        className="flex flex-col gap-2 overflow-y-auto flex-shrink-0 pb-2"
        style={{ height: `calc(${dividerPct}% - 16px)` }}
      >
        {/* Widget: Pipeline */}
        {ws.pipeline !== 'closed' && (
          <WidgetShell title="Pipeline" icon={GitBranch}
            state={ws.pipeline} onMin={() => minimize('pipeline')} onClose={() => close('pipeline')}>
            <div className="flex flex-col gap-1">
              {stages.map(estado => {
                const count = porEstado[estado] || 0;
                const pct = maxEstado > 0 ? (count / maxEstado) * 100 : 0;
                const colors = ESTADO_COLORS[estado] || ESTADO_COLORS.BORRADOR;
                const isKeyStage = ['EN_TRANSITO', 'RECIBIDO', 'EN_TRATAMIENTO'].includes(estado);
                if (count === 0 && !isKeyStage && mode === 'LIVE') return null;
                return (
                  <div key={estado} className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500 w-[58px] truncate font-medium flex-shrink-0">
                      {ESTADO_LABELS[estado] || estado}
                    </span>
                    <div className="flex-1 h-4 rounded overflow-hidden relative" style={{ backgroundColor: colors.base + '12' }}>
                      <div
                        className={`h-full transition-all duration-300 ${count === 0 ? 'opacity-40' : ''}`}
                        style={{
                          width: `${Math.max(pct, count > 0 ? 5 : 0)}%`,
                          background: `linear-gradient(to right, ${colors.dark}cc, ${colors.base})`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-black tabular-nums font-mono w-6 text-right flex-shrink-0"
                      style={{ color: count > 0 ? colors.dark : '#d1d5db' }}>
                      <AnimatedCounter value={count} />
                    </span>
                  </div>
                );
              })}
            </div>
          </WidgetShell>
        )}

        {/* Widget: Viajes */}
        {ws.viajes !== 'closed' && (
          <WidgetShell title="Viajes" icon={Truck}
            state={ws.viajes} onMin={() => minimize('viajes')} onClose={() => close('viajes')}>
            {enTransito.length === 0 ? (
              <p className="text-[11px] text-neutral-400 text-center py-2">Sin viajes activos</p>
            ) : (
              <div className="space-y-1">
                {enTransito.map(v => (
                  <div key={v.manifiestoId}
                    className="flex items-start gap-2 py-1.5 px-1 rounded hover:bg-orange-50/60 cursor-pointer transition-colors"
                    onClick={() => {
                      onViajeOpen?.(v);
                      const pos = v.ultimaPosicion;
                      if (pos?.latitud && pos?.longitud) onTripClick?.(pos.latitud, pos.longitud);
                    }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[11px] font-black font-mono text-neutral-800 truncate">{v.numero}</p>
                        {v.ultimaPosicion?.velocidad != null && v.ultimaPosicion.velocidad > 0 && (
                          <span className="text-[9px] font-mono text-orange-500 shrink-0">
                            {v.ultimaPosicion.velocidad.toFixed(0)}km/h
                          </span>
                        )}
                      </div>
                      {v.transportista && (
                        <p className="text-[10px] text-neutral-500 truncate">{v.transportista}</p>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] text-neutral-400 truncate">{v.origen.razonSocial}</span>
                        <ArrowRight size={7} className="text-neutral-300 shrink-0" />
                        <span className="text-[9px] text-neutral-400 truncate">{v.destino.razonSocial}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </WidgetShell>
        )}

        {/* Widget: Manifiesto (compact card, no dark background) */}
        {ws.manifiesto !== 'closed' && (
          <WidgetShell title="Manifiesto" icon={FileText}
            state={ws.manifiesto} onMin={() => minimize('manifiesto')} onClose={() => close('manifiesto')}>
            <ManifiestoCard
              event={currentEvent ?? null}
              eventIndex={currentEventIndex}
              totalEvents={totalEventCount}
            />
          </WidgetShell>
        )}

        {/* Widget: Top Actores */}
        {ws.actores !== 'closed' && (topGeneradores.length > 0 || topOperadores.length > 0) && (
          <WidgetShell title="Actores" icon={Users}
            state={ws.actores} onMin={() => minimize('actores')} onClose={() => close('actores')}>
            <h4 className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Top Generadores</h4>
            {(() => {
              const maxGen = Math.max(...topGeneradores.slice(0, 2).map(g => g.cantidad), 1);
              return topGeneradores.slice(0, 2).map((g, i) => (
                <div key={i} className="flex items-center gap-2 mb-1 relative">
                  <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: '#7c3aed20' }}>
                    <Factory size={11} className="text-purple-700" />
                  </div>
                  <div className="flex-1 min-w-0 relative">
                    <div className="absolute inset-0 rounded transition-all duration-300" style={{ width: `${(g.cantidad / maxGen) * 100}%`, backgroundColor: '#7c3aed10' }} />
                    <div className="relative flex items-center justify-between px-1 py-0.5">
                      <span className="text-[11px] font-semibold text-neutral-700 truncate">{g.razonSocial}</span>
                      <span className="text-[11px] font-black text-neutral-900 tabular-nums font-mono ml-1"><AnimatedCounter value={g.cantidad} /></span>
                    </div>
                  </div>
                </div>
              ));
            })()}
            <h4 className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1 mt-2">Top Operadores</h4>
            {(() => {
              const maxOper = Math.max(...topOperadores.slice(0, 2).map(o => o.cantidad), 1);
              return topOperadores.slice(0, 2).map((o, i) => (
                <div key={i} className="flex items-center gap-2 mb-1 relative">
                  <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: '#2563eb20' }}>
                    <FlaskConical size={11} className="text-blue-700" />
                  </div>
                  <div className="flex-1 min-w-0 relative">
                    <div className="absolute inset-0 rounded transition-all duration-300" style={{ width: `${(o.cantidad / maxOper) * 100}%`, backgroundColor: '#2563eb10' }} />
                    <div className="relative flex items-center justify-between px-1 py-0.5">
                      <span className="text-[11px] font-semibold text-neutral-700 truncate">{o.razonSocial}</span>
                      <span className="text-[11px] font-black text-neutral-900 tabular-nums font-mono ml-1"><AnimatedCounter value={o.cantidad} /></span>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </WidgetShell>
        )}

        {/* Widget: Residuos */}
        {ws.residuos !== 'closed' && (
          <WidgetShell title="Residuos" icon={Droplets}
            state={ws.residuos} onMin={() => minimize('residuos')} onClose={() => close('residuos')}>
            {(() => {
              const residuos = topResiduos.slice(0, 3);
              if (residuos.length === 0) return <p className="text-[11px] text-neutral-400 italic py-1 text-center">Sin datos</p>;
              const maxTotal = Math.max(...residuos.map(r => r.total), 1);
              return residuos.map((r, i) => (
                <div key={i} className="flex items-center gap-2 mb-1 relative">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length] }} />
                  <div className="flex-1 min-w-0 relative">
                    <div className="absolute inset-0 rounded transition-all duration-300"
                      style={{ width: `${(r.total / maxTotal) * 100}%`, backgroundColor: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length] + '18' }} />
                    <div className="relative flex items-center justify-between px-1 py-0.5">
                      <span className="text-[11px] text-neutral-700 truncate">{r.nombre}</span>
                      <span className="text-[11px] font-bold text-neutral-900 tabular-nums font-mono ml-1">{formatNumber(r.total)}</span>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </WidgetShell>
        )}

        {/* Widget: Tratamiento */}
        {ws.tratamiento !== 'closed' && tratamientosActivos.length > 0 && (
          <WidgetShell title="Tratamiento" icon={Beaker}
            state={ws.tratamiento} onMin={() => minimize('tratamiento')} onClose={() => close('tratamiento')}>
            {(() => {
              const tratamientos = tratamientosActivos.slice(0, 2);
              if (tratamientos.length === 0) return <p className="text-[11px] text-neutral-400 italic py-1 text-center">Sin datos</p>;
              const maxCant = Math.max(...tratamientos.map(t => t.cantidad), 1);
              return tratamientos.map((t, i) => (
                <div key={i} className="flex items-center gap-2 mb-1 relative">
                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: '#7c3aed20' }}>
                    <Beaker size={10} className="text-violet-700" />
                  </div>
                  <div className="flex-1 min-w-0 relative">
                    <div className="absolute inset-0 rounded transition-all duration-300" style={{ width: `${(t.cantidad / maxCant) * 100}%`, backgroundColor: '#7c3aed10' }} />
                    <div className="relative flex items-center justify-between px-1 py-0.5">
                      <span className="text-[11px] text-neutral-700 truncate">{t.metodo}</span>
                      <span className="text-[11px] font-bold text-neutral-900 tabular-nums font-mono ml-1">{t.cantidad}</span>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </WidgetShell>
        )}

        {/* Forecast panels (FORECAST mode, no widget controls) */}
        {mode === 'FORECAST' && forecastData && (
          <>
            <div className="wr-panel p-3">
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Package size={12} /> Pendiente Retiro ({forecastData.pendienteRetiro.length})
              </h3>
              {forecastData.pendienteRetiro.length === 0
                ? <p className="text-[11px] text-neutral-400 italic text-center py-1">Sin retiros pendientes</p>
                : forecastData.pendienteRetiro.slice(0, 8).map(m => (
                  <div key={m.manifiestoId} className="mb-2 p-2 rounded border border-amber-200 bg-amber-50/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-xs text-neutral-800">{m.numero}</span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{m.diasEspera}d</span>
                    </div>
                    <div className="text-[10px] text-neutral-600 truncate">
                      <span className="font-semibold text-purple-600">{m.generador}</span>
                      <span className="mx-1 text-neutral-400">→</span>
                      <span className="font-semibold text-blue-600">{m.operador}</span>
                    </div>
                  </div>
                ))}
            </div>
            <div className="wr-panel p-3">
              <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FlaskConical size={12} /> Pendiente Tratamiento ({forecastData.pendienteTratamiento.length})
              </h3>
              {forecastData.pendienteTratamiento.length === 0
                ? <p className="text-[11px] text-neutral-400 italic text-center py-1">Sin tratamientos pendientes</p>
                : forecastData.pendienteTratamiento.slice(0, 8).map(m => (
                  <div key={m.manifiestoId} className="mb-1.5 flex items-center gap-2">
                    <div className="w-1.5 h-5 rounded-full shrink-0" style={{ backgroundColor: m.estado === 'EN_TRATAMIENTO' ? '#a855f7' : '#8b5cf6' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[11px] text-neutral-800">{m.numero}</span>
                        <span className="text-[10px] font-bold text-purple-700 tabular-nums">{m.diasEnEspera}d</span>
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate">{m.operador}</div>
                    </div>
                  </div>
                ))}
            </div>
            {forecastData.vencimientosProximos.length > 0 && (
              <div className="wr-panel p-3">
                <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Vencimientos</h3>
                {forecastData.vencimientosProximos.slice(0, 5).map((v, i) => (
                  <div key={i} className="flex items-center justify-between mb-1 text-[11px]">
                    <span className="text-neutral-700 truncate flex-1">{v.entidad}</span>
                    <span className={`font-bold tabular-nums font-mono ${v.diasRestantes < 7 ? 'text-red-600' : v.diasRestantes < 30 ? 'text-amber-600' : 'text-neutral-500'}`}>
                      {v.diasRestantes}d
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Tray — closed widgets */}
        {closedWidgets.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1 py-1.5 bg-neutral-50/80 rounded-xl border border-black/5 flex-shrink-0">
            {closedWidgets.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => restore(id)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-neutral-500
                           hover:text-[#0D8A4F] hover:bg-white rounded-lg border border-transparent
                           hover:border-black/8 transition-all uppercase tracking-wide">
                <Icon size={10} /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── DRAG DIVIDER ── */}
      <div
        className="flex items-center justify-center h-4 flex-shrink-0 cursor-row-resize group"
        onMouseDown={onDividerMouseDown}
      >
        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-neutral-100 group-hover:bg-neutral-200 transition-colors">
          <GripHorizontal size={12} className="text-neutral-400" />
        </div>
      </div>

      {/* ── ZONA EVENTOS — takes remaining height ── */}
      <WidgetShell
        title="Eventos"
        icon={Radio}
        state={ws.eventos}
        onMin={() => minimize('eventos')}
        className="flex-1 min-h-0 overflow-hidden"
      >
        <div className="h-full overflow-y-auto -mr-1 pr-1">
          <EventFeed
            eventos={eventos}
            mode={mode}
            currentEventId={currentEventId}
            onEventClick={onEventOpen}
          />
        </div>
      </WidgetShell>
    </div>
  );
};

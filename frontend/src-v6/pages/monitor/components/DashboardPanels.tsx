/**
 * DashboardPanels — Left sidebar with Pipeline Funnel, Top Actores, Placeholders, EventFeed
 * Sharp, brilliant visual style: gradient bars, crisp borders, vivid colors
 */

import React, { useRef, useEffect } from 'react';
import { Factory, FlaskConical, Package, Beaker, Droplets } from 'lucide-react';
import type { MonitorMode } from '../WarRoomPage';
import type { MonitorLiveResponse, ForecastResponse, TimelineResponse } from '../api/monitor-api';
import { formatNumber } from '../utils/formatters';
import { EventFeed } from './EventFeed';

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

// ─── Residuo color palette ──────────────────────────────────────────────────

const RESIDUO_PALETTE = ['#059669', '#7c3aed', '#dc2626', '#d97706', '#2563eb', '#0891b2', '#be185d', '#65a30d'];

// ─── Estado colors ───────────────────────────────────────────────────────────

const ESTADO_COLORS: Record<string, { base: string; light: string; dark: string }> = {
  BORRADOR:       { base: '#94a3b8', light: '#cbd5e1', dark: '#64748b' },
  APROBADO:       { base: '#22c55e', light: '#4ade80', dark: '#16a34a' },
  EN_TRANSITO:    { base: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
  ENTREGADO:      { base: '#f97316', light: '#fb923c', dark: '#ea580c' },
  RECIBIDO:       { base: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed' },
  EN_TRATAMIENTO: { base: '#a855f7', light: '#c084fc', dark: '#9333ea' },
  TRATADO:        { base: '#eab308', light: '#facc15', dark: '#ca8a04' },
  RECHAZADO:      { base: '#ef4444', light: '#f87171', dark: '#dc2626' },
  CANCELADO:      { base: '#6b7280', light: '#9ca3af', dark: '#4b5563' },
};

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  APROBADO: 'Aprobado',
  EN_TRANSITO: 'En Tránsito',
  ENTREGADO: 'Entregado',
  RECIBIDO: 'Recibido',
  EN_TRATAMIENTO: 'En Tratamiento',
  TRATADO: 'Tratado',
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  mode: MonitorMode;
  liveData: MonitorLiveResponse | null;
  forecastData: ForecastResponse | null;
  timelineData: TimelineResponse | null;
  playbackCounters?: Record<string, number>;
  playbackEvents?: Array<{
    id: string;
    tipo: string;
    descripcion: string;
    timestamp: string;
    manifiestoNumero: string;
    generador?: { razonSocial: string };
    operador?: { razonSocial: string };
    residuos?: Array<{ codigo: string; nombre: string; cantidad: number; unidad: string }>;
  }>;
  currentEventId?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const DashboardPanels: React.FC<Props> = ({
  mode,
  liveData,
  forecastData,
  playbackCounters,
  playbackEvents,
  currentEventId,
}) => {
  // Use playback counters if provided, otherwise live data
  const porEstado = playbackCounters || liveData?.estadisticas?.porEstado || {};
  const maxEstado = Math.max(...Object.values(porEstado), 1);

  // Pipeline stages in order
  const stages = ['BORRADOR', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'];

  // Events: playback overrides live
  const eventos = playbackEvents || liveData?.eventosRecientes || [];

  return (
    <div className="flex flex-col h-full overflow-hidden p-3 gap-2">

      {/* ── ZONA STATS — compacta, scroll interno, altura fija ── */}
      <div className="flex flex-col gap-2 flex-shrink-0 overflow-y-auto" style={{ maxHeight: 210 }}>

        {/* Pipeline Funnel — barras finas */}
        <div className="wr-panel p-3">
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Pipeline</h3>
          <div className="flex flex-col gap-1">
            {stages.map(estado => {
              const count = porEstado[estado] || 0;
              const pct = maxEstado > 0 ? (count / maxEstado) * 100 : 0;
              const colors = ESTADO_COLORS[estado] || ESTADO_COLORS.BORRADOR;
              // En LIVE: ocultar estados vacíos que no son del flujo principal
              const isKeyStage = ['EN_TRANSITO', 'RECIBIDO', 'EN_TRATAMIENTO'].includes(estado);
              if (count === 0 && !isKeyStage && mode === 'LIVE') return null;
              return (
                <div key={estado} className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-500 w-[62px] truncate font-medium flex-shrink-0">
                    {ESTADO_LABELS[estado] || estado}
                  </span>
                  <div className="flex-1 h-5 rounded overflow-hidden relative" style={{ backgroundColor: colors.base + '12' }}>
                    <div
                      className={`wr-funnel-bar-gradient h-full ${count === 0 ? 'opacity-40' : ''}`}
                      style={{
                        width: `${Math.max(pct, count > 0 ? 5 : 0)}%`,
                        background: `linear-gradient(to right, ${colors.dark}cc, ${colors.base})`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-black tabular-nums font-mono w-7 text-right flex-shrink-0"
                    style={{ color: count > 0 ? colors.dark : '#d1d5db' }}>
                    <AnimatedCounter value={count} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Actores — 2 items por sección */}
        {liveData && (
          <div className="wr-panel p-3">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Top Generadores</h3>
            {(() => {
              const maxGen = Math.max(...liveData.topGeneradores.slice(0, 2).map(g => g.cantidad), 1);
              return liveData.topGeneradores.slice(0, 2).map((g, i) => (
                <div key={i} className="flex items-center gap-2 mb-1 relative">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#7c3aed' }}>
                    <Factory size={13} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0 relative">
                    <div className="absolute inset-0 rounded-sm transition-all duration-300" style={{ width: `${(g.cantidad / maxGen) * 100}%`, backgroundColor: '#7c3aed18' }} />
                    <div className="relative flex items-center justify-between px-1.5 py-0.5">
                      <span className="text-xs font-semibold text-neutral-700 truncate">{g.razonSocial}</span>
                      <span className="text-xs font-black text-neutral-900 tabular-nums font-mono ml-2"><AnimatedCounter value={g.cantidad} /></span>
                    </div>
                  </div>
                </div>
              ));
            })()}
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mt-2 mb-1.5">Top Operadores</h3>
            {(() => {
              const maxOper = Math.max(...liveData.topOperadores.slice(0, 2).map(o => o.cantidad), 1);
              return liveData.topOperadores.slice(0, 2).map((o, i) => (
                <div key={i} className="flex items-center gap-2 mb-1 relative">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#2563eb' }}>
                    <FlaskConical size={13} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0 relative">
                    <div className="absolute inset-0 rounded-sm transition-all duration-300" style={{ width: `${(o.cantidad / maxOper) * 100}%`, backgroundColor: '#2563eb18' }} />
                    <div className="relative flex items-center justify-between px-1.5 py-0.5">
                      <span className="text-xs font-semibold text-neutral-700 truncate">{o.razonSocial}</span>
                      <span className="text-xs font-black text-neutral-900 tabular-nums font-mono ml-2"><AnimatedCounter value={o.cantidad} /></span>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {/* Por Tipo de Residuo — máx 3 */}
        <div className="wr-panel p-3">
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Droplets size={12} className="text-emerald-500" />
            Por Tipo de Residuo
          </h3>
          {(() => {
            const residuos = liveData?.topResiduos?.slice(0, 3) || [];
            if (residuos.length === 0) return <p className="text-[11px] text-neutral-400 italic py-1 text-center">Sin datos</p>;
            const maxTotal = Math.max(...residuos.map(r => r.total), 1);
            return residuos.map((r, i) => (
              <div key={i} className="flex items-center gap-2 mb-1 relative">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length] }} />
                <div className="flex-1 min-w-0 relative">
                  <div className="absolute inset-0 rounded-sm transition-all duration-300"
                    style={{ width: `${(r.total / maxTotal) * 100}%`, backgroundColor: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length] + '18' }} />
                  <div className="relative flex items-center justify-between px-1.5 py-0.5">
                    <span className="text-[11px] text-neutral-700 truncate">{r.nombre}</span>
                    <span className="text-[11px] font-bold text-neutral-900 tabular-nums font-mono ml-2">{formatNumber(r.total)}</span>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>

        {/* Por Tratamiento — máx 2 */}
        <div className="wr-panel p-3">
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Beaker size={12} className="text-violet-500" />
            Por Tratamiento
          </h3>
          {(() => {
            const tratamientos = liveData?.tratamientosActivos?.slice(0, 2) || [];
            if (tratamientos.length === 0) return <p className="text-[11px] text-neutral-400 italic py-1 text-center">Sin datos</p>;
            const maxCant = Math.max(...tratamientos.map(t => t.cantidad), 1);
            return tratamientos.map((t, i) => (
              <div key={i} className="flex items-center gap-2 mb-1 relative">
                <div className="w-5 h-5 rounded-sm flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#7c3aed' }}>
                  <Beaker size={10} className="text-white" />
                </div>
                <div className="flex-1 min-w-0 relative">
                  <div className="absolute inset-0 rounded-sm transition-all duration-300" style={{ width: `${(t.cantidad / maxCant) * 100}%`, backgroundColor: '#7c3aed18' }} />
                  <div className="relative flex items-center justify-between px-1.5 py-0.5">
                    <span className="text-[11px] text-neutral-700 truncate">{t.metodo}</span>
                    <span className="text-[11px] font-bold text-neutral-900 tabular-nums font-mono ml-2">{t.cantidad}</span>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>

        {/* Forecast panels */}
        {mode === 'FORECAST' && forecastData && (
          <>
            <div className="wr-panel p-3">
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Package size={12} />
                Pendiente Retiro ({forecastData.pendienteRetiro.length})
              </h3>
              {forecastData.pendienteRetiro.length === 0 ? (
                <p className="text-[11px] text-neutral-400 italic text-center py-1">Sin retiros pendientes</p>
              ) : forecastData.pendienteRetiro.slice(0, 8).map(m => (
                <div key={m.manifiestoId} className="mb-2 p-2 rounded border border-amber-200 bg-amber-50/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-xs text-neutral-800">{m.numero}</span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded tabular-nums">{m.diasEspera}d espera</span>
                  </div>
                  <div className="text-[10px] text-neutral-600">
                    <span className="font-semibold text-purple-600">{m.generador}</span>
                    <span className="mx-1 text-neutral-400">→</span>
                    <span className="font-semibold text-blue-600">{m.operador}</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">{m.transportista}</div>
                </div>
              ))}
            </div>
            <div className="wr-panel p-3">
              <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FlaskConical size={12} />
                Pendiente Tratamiento ({forecastData.pendienteTratamiento.length})
              </h3>
              {forecastData.pendienteTratamiento.length === 0 ? (
                <p className="text-[11px] text-neutral-400 italic text-center py-1">Sin tratamientos pendientes</p>
              ) : forecastData.pendienteTratamiento.slice(0, 8).map(m => (
                <div key={m.manifiestoId} className="mb-1.5 flex items-center gap-2">
                  <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: m.estado === 'EN_TRATAMIENTO' ? '#a855f7' : '#8b5cf6' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[11px] text-neutral-800">{m.numero}</span>
                      <span className="text-[10px] font-bold text-purple-700 tabular-nums">{m.diasEnEspera}d</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate">{m.operador}</div>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
                    backgroundColor: m.estado === 'EN_TRATAMIENTO' ? '#f3e8ff' : '#ede9fe',
                    color: m.estado === 'EN_TRATAMIENTO' ? '#7c3aed' : '#6d28d9',
                  }}>{m.estado === 'EN_TRATAMIENTO' ? 'TRATANDO' : 'RECIBIDO'}</span>
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
      </div>

      {/* ── Separador con label EVENTOS ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex-1 h-px bg-neutral-200" />
        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Eventos</span>
        {eventos.length > 0 && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500 tabular-nums">
            {eventos.length}
          </span>
        )}
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      {/* ── ZONA EVENTOS — flex-1, siempre visible ── */}
      <EventFeed
        eventos={eventos}
        mode={mode}
        currentEventId={currentEventId}
        className="flex-1 min-h-0"
      />
    </div>
  );
};

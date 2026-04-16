/**
 * DashboardPanels — Left sidebar with Pipeline Funnel, Top Actores, Placeholders, EventFeed
 * Sharp, brilliant visual style: gradient bars, crisp borders, vivid colors
 */

import React from 'react';
import { Factory, FlaskConical, Package, Beaker, Droplets } from 'lucide-react';
import type { MonitorMode } from '../WarRoomPage';
import type { MonitorLiveResponse, ForecastResponse, TimelineResponse } from '../api/monitor-api';
import { formatNumber } from '../utils/formatters';
import { EventFeed } from './EventFeed';

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
    <div className="flex flex-col gap-3 h-full overflow-y-auto p-3">
      {/* ── Pipeline Funnel ── */}
      <div className="wr-panel p-3">
        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Pipeline</h3>
        <div className="flex flex-col gap-1">
          {stages.map(estado => {
            const count = porEstado[estado] || 0;
            const pct = maxEstado > 0 ? (count / maxEstado) * 100 : 0;
            const colors = ESTADO_COLORS[estado] || ESTADO_COLORS.BORRADOR;
            const barTooSmall = pct < 20;

            return (
              <div key={estado} className="flex items-center gap-2">
                {/* Label */}
                <span className="text-[10px] text-neutral-500 w-20 truncate font-medium">
                  {ESTADO_LABELS[estado] || estado}
                </span>

                {/* Bar container */}
                <div
                  className="flex-1 h-6 overflow-hidden relative"
                  style={{ backgroundColor: colors.base + '10' }}
                >
                  {/* Solid bar — flat, high contrast, no gradient */}
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${Math.max(pct, count > 0 ? 4 : 0)}%`,
                      backgroundColor: colors.dark,
                    }}
                  />

                  {/* Number */}
                  {count > 0 && (
                    <span
                      className="absolute inset-y-0 flex items-center text-xs font-black tabular-nums font-mono tracking-tight"
                      style={{
                        right: barTooSmall ? undefined : '6px',
                        left: barTooSmall ? `${Math.max(pct, 5)}%` : undefined,
                        paddingLeft: barTooSmall ? '4px' : undefined,
                        color: barTooSmall ? colors.dark : '#fff',
                      }}
                    >
                      {formatNumber(count)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Top Actores ── */}
      {liveData && (
        <div className="wr-panel p-3">
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Top Generadores</h3>
          {(() => {
            const maxGen = Math.max(...liveData.topGeneradores.slice(0, 3).map(g => g.cantidad), 1);
            return liveData.topGeneradores.slice(0, 3).map((g, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5 relative">
                <div className="w-6 h-6 rounded-sm flex items-center justify-center"
                  style={{ backgroundColor: '#7c3aed' }}>
                  <Factory size={13} className="text-white" />
                </div>
                <div className="flex-1 min-w-0 relative">
                  {/* Background bar */}
                  <div
                    className="absolute inset-0 rounded-sm transition-all duration-300"
                    style={{
                      width: `${(g.cantidad / maxGen) * 100}%`,
                      backgroundColor: '#7c3aed25',
                    }}
                  />
                  <div className="relative flex items-center justify-between px-1.5 py-0.5">
                    <span className="text-xs text-neutral-700 truncate">{g.razonSocial}</span>
                    <span className="text-xs font-bold text-neutral-900 tabular-nums font-mono ml-2">{g.cantidad}</span>
                  </div>
                </div>
              </div>
            ));
          })()}

          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mt-3 mb-2">Top Operadores</h3>
          {(() => {
            const maxOper = Math.max(...liveData.topOperadores.slice(0, 3).map(o => o.cantidad), 1);
            return liveData.topOperadores.slice(0, 3).map((o, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5 relative">
                <div className="w-6 h-6 rounded-sm flex items-center justify-center"
                  style={{ backgroundColor: '#2563eb' }}>
                  <FlaskConical size={13} className="text-white" />
                </div>
                <div className="flex-1 min-w-0 relative">
                  {/* Background bar */}
                  <div
                    className="absolute inset-0 rounded-sm transition-all duration-300"
                    style={{
                      width: `${(o.cantidad / maxOper) * 100}%`,
                      backgroundColor: '#2563eb25',
                    }}
                  />
                  <div className="relative flex items-center justify-between px-1.5 py-0.5">
                    <span className="text-xs text-neutral-700 truncate">{o.razonSocial}</span>
                    <span className="text-xs font-bold text-neutral-900 tabular-nums font-mono ml-2">{o.cantidad}</span>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* ── Por Tipo de Residuo ── */}
      <div className="wr-panel p-3">
        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Droplets size={12} className="text-emerald-500" />
          Por Tipo de Residuo
        </h3>
        {(() => {
          const residuos = liveData?.topResiduos?.slice(0, 5) || [];
          if (residuos.length === 0) {
            return <p className="text-[11px] text-neutral-400 italic py-2 text-center">Sin datos</p>;
          }
          const maxTotal = Math.max(...residuos.map(r => r.total), 1);
          return residuos.map((r, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5 relative">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length] }}
              />
              <div className="flex-1 min-w-0 relative">
                <div
                  className="absolute inset-0 rounded-sm transition-all duration-300"
                  style={{
                    width: `${(r.total / maxTotal) * 100}%`,
                    backgroundColor: RESIDUO_PALETTE[i % RESIDUO_PALETTE.length] + '20',
                  }}
                />
                <div className="relative flex items-center justify-between px-1.5 py-0.5">
                  <span className="text-[11px] text-neutral-700 truncate">{r.nombre}</span>
                  <span className="text-[11px] font-bold text-neutral-900 tabular-nums font-mono ml-2">
                    {formatNumber(r.total)}
                  </span>
                </div>
              </div>
            </div>
          ));
        })()}
      </div>

      {/* ── Por Tratamiento ── */}
      <div className="wr-panel p-3">
        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Beaker size={12} className="text-violet-500" />
          Por Tratamiento
        </h3>
        {(() => {
          const tratamientos = liveData?.tratamientosActivos || [];
          if (tratamientos.length === 0) {
            return <p className="text-[11px] text-neutral-400 italic py-2 text-center">Sin datos</p>;
          }
          const maxCant = Math.max(...tratamientos.map(t => t.cantidad), 1);
          return tratamientos.map((t, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5 relative">
              <div className="w-5 h-5 rounded-sm flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#7c3aed' }}>
                <Beaker size={11} className="text-white" />
              </div>
              <div className="flex-1 min-w-0 relative">
                <div
                  className="absolute inset-0 rounded-sm transition-all duration-300"
                  style={{
                    width: `${(t.cantidad / maxCant) * 100}%`,
                    backgroundColor: '#7c3aed20',
                  }}
                />
                <div className="relative flex items-center justify-between px-1.5 py-0.5">
                  <span className="text-[11px] text-neutral-700 truncate">{t.metodo}</span>
                  <span className="text-[11px] font-bold text-neutral-900 tabular-nums font-mono ml-2">{t.cantidad}</span>
                </div>
              </div>
            </div>
          ));
        })()}
      </div>

      {/* ── Forecast panel ── */}
      {mode === 'FORECAST' && forecastData && (
        <>
          <div className="wr-panel p-3">
            <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Package size={12} />
              Pendiente Retiro ({forecastData.pendienteRetiro.length})
            </h3>
            {forecastData.pendienteRetiro.length === 0 ? (
              <p className="text-[11px] text-neutral-400 italic text-center py-2">Sin retiros pendientes</p>
            ) : (
              forecastData.pendienteRetiro.slice(0, 8).map(m => (
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
              ))
            )}
          </div>

          <div className="wr-panel p-3">
            <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FlaskConical size={12} />
              Pendiente Tratamiento ({forecastData.pendienteTratamiento.length})
            </h3>
            {forecastData.pendienteTratamiento.length === 0 ? (
              <p className="text-[11px] text-neutral-400 italic text-center py-2">Sin tratamientos pendientes</p>
            ) : (
              forecastData.pendienteTratamiento.slice(0, 8).map(m => (
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
              ))
            )}
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

      {/* ── Event Feed ── */}
      <EventFeed
        eventos={eventos}
        mode={mode}
        currentEventId={currentEventId}
      />
    </div>
  );
};

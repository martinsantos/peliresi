/**
 * TimelineControls — Bottom bar with KPIs + event-driven playback controls
 * LIVE mode: LIVE badge + KPIs from liveData
 * PLAYBACK mode: play/pause, speed chips (fast/normal/slow), event-based scrubber,
 *   event counter, current event timestamp, KPIs from playback counters
 */

import React, { useMemo } from 'react';
import { Play, Pause, Calendar, FileText, Truck, Weight, MapPin, TrendingUp, RotateCcw, ChevronLeft, ChevronRight, SkipBack, SkipForward, Sun, Sunrise, Sunset, Moon } from 'lucide-react';
import type { MonitorMode } from '../WarRoomPage';
import type { ForecastResponse, MonitorLiveResponse, TimelineResponse } from '../api/monitor-api';
import { formatNumber, formatTimeShort } from '../utils/formatters';
import { periodEnd } from '../utils/playback-period';
import { Select } from '../../../components/ui/Select';

type PlaybackSpeed = 'fast' | 'normal' | 'slow';

interface PlaybackControls {
  isPlaying: boolean;
  speed: PlaybackSpeed;
  currentEventIndex: number;
  totalEventCount: number;
  progress: number;
  isDone: boolean;
  counters: Record<string, number>;
  play: () => void;
  pause: () => void;
  setSpeed: (s: PlaybackSpeed) => void;
  skipToNext: () => void;
  skipToPrev: () => void;
  seek: (progress: number) => void;
  currentEventTimestamp?: string | null;
}

interface Props {
  mode: MonitorMode;
  liveData: MonitorLiveResponse | null;
  playbackDate: string | null;
  playbackDias?: number;
  onPeriodChange?: (days: number) => void;
  onDateChange: (date: string) => void;
  onSwitchToPlayback: (date?: string) => void;
  timelineData: TimelineResponse | null;
  isLoading: boolean;
  playback: PlaybackControls | null;
  autoContinue?: boolean;
  onAutoContinueToggle?: () => void;
  activeDays?: string[];
  currentHour?: number; // 0–23 — para indicador hora en PLAYBACK
  forecastData?: ForecastResponse | null;
  liveCurrent?: boolean;
}

/** Format "2026-03-16" -> "16 mar 2026" */
function formatDateFull(d: string | null): string {
  if (!d) return '—';
  const date = new Date(d + 'T12:00:00');
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SPEED_LABELS: Record<PlaybackSpeed, string> = {
  fast: '▶▶ Rapido',
  normal: '▶ Normal',
  slow: '▶ Lento',
};
const SPEED_ORDER: PlaybackSpeed[] = ['fast', 'normal', 'slow'];

export const TimelineControls: React.FC<Props> = ({
  mode, liveData, playbackDate, playbackDias = 1, onPeriodChange, onDateChange, onSwitchToPlayback, timelineData, isLoading, playback,
  autoContinue, onAutoContinueToggle, activeDays, currentHour, forecastData, liveCurrent = false,
}) => {
  // Smart date navigation — find prev/next active day relative to current playbackDate
  const sortedDays = useMemo(() => (activeDays || []).slice().sort(), [activeDays]);
  const currentDayIndex = useMemo(() => {
    if (!playbackDate || sortedDays.length === 0) return -1;
    const exact = sortedDays.indexOf(playbackDate);
    if (exact >= 0) return exact;
    // Date not in list — find closest previous day
    for (let i = sortedDays.length - 1; i >= 0; i--) {
      if (sortedDays[i] <= playbackDate) return i;
    }
    return 0;
  }, [sortedDays, playbackDate]);

  const prevDay = currentDayIndex > 0 ? sortedDays[currentDayIndex - 1] : null;
  const nextDay = currentDayIndex >= 0 && currentDayIndex < sortedDays.length - 1
    ? sortedDays[currentDayIndex + 1]
    : null;

  const goToPrevDay = () => { if (prevDay) onDateChange(prevDay); };
  const goToNextDay = () => { if (nextDay) onDateChange(nextDay); };
  const stats = liveData?.estadisticas;
  const tripsWithGps = liveData?.enTransito?.filter(trip => trip.ultimaPosicion != null
    && Number.isFinite(trip.ultimaPosicion.latitud) && Number.isFinite(trip.ultimaPosicion.longitud)).length ?? 0;

  // In PLAYBACK mode, use playback counters for KPIs; in LIVE mode, use liveData
  const isPlayback = mode === 'PLAYBACK' && playback;
  const hasKpiData=mode==='PLAYBACK'?!!playback:!!stats;

  const kpiManifiestos = isPlayback
    ? (playback.counters.totalCreated || 0)
    : (stats?.manifiestosHoy || 0);
  const kpiEnTransito = isPlayback
    ? (playback.counters.enTransito || 0)
    : (stats?.enTransitoActivos || 0);
  const kpiTratados = isPlayback
    ? (playback.counters.tratado || 0)
    : 0;
  const kpiTotal = isPlayback
    ? Object.values(playback.counters).reduce((s, v) => s + v, 0) - (playback.counters.totalCreated || 0)
    : (stats?.total || 0);

  return (
    <div className="wr-panel flex items-center gap-4 px-4 py-3">
      {/* KPI Cards */}
      <div className="wr-summary flex items-center gap-3 flex-shrink-0">
        {mode === 'FORECAST' ? <>
          <KpiCard icon={<Truck size={14}/>} label="Retiros pendientes" value={forecastData?forecastData.pendienteRetiro.length:null} color="#92400e"/>
          <KpiCard icon={<Weight size={14}/>} label="Tratamientos pendientes" value={forecastData?forecastData.pendienteTratamiento.length:null} color="#6d28d9"/>
          <KpiCard icon={<Calendar size={14}/>} label="Vencimientos a 7 días" value={forecastData?forecastData.vencimientosProximos.length:null} color="#b91c1c"/>
        </> : <>
        <KpiCard
          icon={<FileText size={14} />}
          label={isPlayback ? 'Creados' : 'Creados hoy'}
          value={hasKpiData?kpiManifiestos:null}
          color="#0D8A4F"
        />
        <KpiCard
          icon={<Truck size={14} />}
          label="En tránsito"
          value={hasKpiData?kpiEnTransito:null}
          color="#3b82f6"
        />
        <KpiCard
          icon={isPlayback ? <Weight size={14} /> : <MapPin size={14} />}
          label={isPlayback ? 'Tratados' : 'Viajes con GPS'}
          value={hasKpiData?(isPlayback ? kpiTratados : tripsWithGps):null}
          color="#8b5cf6"
        />
        <KpiCard
          icon={<TrendingUp size={14} />}
          label={isPlayback ? 'En historial' : 'Manifiestos registrados'}
          value={hasKpiData?(isPlayback ? kpiTotal : (stats?.total || 0)):null}
          color="#f97316"
        />
        </>}
      </div>

      {/* Separator */}
      <div className="wr-summary-separator w-px h-8 bg-neutral-200 flex-shrink-0" />

      {/* Mode-specific controls */}
      <div className="wr-timeline-actions flex items-center gap-3 flex-1 min-w-0">
        {mode === 'LIVE' && (
          <>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-green-800">
              {liveCurrent && <span className="wr-live-dot" aria-hidden="true" />}
              {liveCurrent ? 'Actualización automática' : 'Datos sin actualizar'}
            </span>
            <button
              onClick={() => onSwitchToPlayback()}
              className="text-xs text-neutral-500 hover:text-neutral-700 px-2 py-1 rounded hover:bg-neutral-100 transition-colors"
            >
              <Play size={12} className="inline mr-1" />
              Reproducir
            </button>
          </>
        )}

        {mode === 'PLAYBACK' && (
          <>
            {onPeriodChange && <div className="flex items-center gap-2 text-sm font-semibold text-[#1B5E3C]">
              <Calendar size={18} aria-hidden="true" />
              <div className="w-48"><Select placeholder="Período de reproducción" value={String(playbackDias)} onChange={value => onPeriodChange(Number(value))}
                options={[{ value: '1', label: 'Un día' }, { value: '7', label: 'Últimos 7 días' }, { value: '30', label: 'Últimos 30 días' }]} /></div>
            </div>}
            {playbackDias > 1 && playbackDate && <span className="text-sm font-semibold tabular-nums text-neutral-800">{formatDateFull(playbackDate)} — {formatDateFull(periodEnd(playbackDate, playbackDias))}</span>}
            {/* Date navigator — only active days */}
            {playbackDias === 1 && <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={goToPrevDay}
                aria-label="Día activo anterior"
                disabled={!prevDay}
                className="w-7 h-7 rounded flex items-center justify-center text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold text-neutral-800 min-w-[90px] text-center tabular-nums">
                {formatDateFull(playbackDate)}
              </span>
              <button
                onClick={goToNextDay}
                aria-label="Día activo siguiente"
                disabled={!nextDay}
                className="w-7 h-7 rounded flex items-center justify-center text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>}

            {isLoading && (
              <span className="text-xs text-neutral-400 flex-shrink-0">Cargando...</span>
            )}

            {playback && !isLoading && (
              <>
                {/* Play/Pause button */}
                <button
                  onClick={playback.isPlaying ? playback.pause : playback.play}
                  aria-label={playback.isPlaying ? 'Pausar historial' : 'Reproducir historial'}
                  disabled={playback.totalEventCount === 0}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 shadow-md ${
                    playback.isPlaying
                      ? 'bg-[#1B5E3C] hover:bg-[#14482e] text-white'
                      : 'bg-[#0D8A4F] hover:bg-[#096c3d] text-white disabled:opacity-50'
                  }`}
                  title={playback.isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
                >
                  {playback.isPlaying
                    ? <Pause size={18} fill="currentColor" />
                    : <Play size={18} fill="currentColor" className="ml-0.5" />
                  }
                </button>

                {/* Event navigation */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={playback.skipToPrev}
                    className="w-7 h-7 rounded flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors"
                    title="Evento anterior"
                  >
                    <SkipBack size={14} />
                  </button>
                  <button
                    onClick={playback.skipToNext}
                    className="w-7 h-7 rounded flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors"
                    title="Siguiente evento"
                  >
                    <SkipForward size={14} />
                  </button>
                </div>

                {/* Event counter — prominent */}
                <span className="text-xs font-bold text-neutral-700 tabular-nums font-mono">
                  {playback.totalEventCount ? playback.currentEventIndex + 1 : 0} / {playback.totalEventCount}
                </span>

                {/* Current event timestamp + indicador hora día/noche */}
                {playback.currentEventTimestamp && (
                  <span className="text-[11px] font-mono text-neutral-500 tabular-nums flex-shrink-0">
                  {playbackDias > 1 && `${new Date(playback.currentEventTimestamp).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza', day: '2-digit', month: 'short' })} · `}{formatTimeShort(playback.currentEventTimestamp)}
                  </span>
                )}
                {currentHour !== undefined && (() => {
                  const HourIcon = currentHour >= 6 && currentHour < 10 ? Sunrise
                    : currentHour >= 10 && currentHour < 18 ? Sun
                    : currentHour >= 18 && currentHour < 21 ? Sunset
                    : Moon;
                  return (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 flex-shrink-0">
                      <HourIcon size={12} className="opacity-70" />
                      {String(currentHour).padStart(2, '0')}h
                    </span>
                  );
                })()}

                {/* Speed chips — fast/normal/slow */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {SPEED_ORDER.map(s => (
                    <button
                      key={s}
                      onClick={() => playback.setSpeed(s)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                        playback.speed === s
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                      }`}
                    >
                      {SPEED_LABELS[s]}
                    </button>
                  ))}
                </div>

                {/* Progress scrubber — 0 to 1 based on event progress */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex-1 min-w-[100px] relative">
                    <input
                      type="range"
                      min={0}
                      max={1000}
                      value={Math.round(playback.progress * 1000)}
                      aria-label="Recorrer historial"
                      onChange={event=>playback.seek(Number(event.target.value)/1000)}
                      className="wr-scrubber w-full"
                      style={{ '--progress': `${playback.progress * 100}%` } as React.CSSProperties}
                    />
                  </div>
                </div>

                {/* Done indicator */}
                {playback.isDone && (
                  <span className="text-[10px] font-bold text-emerald-600 flex-shrink-0">FIN</span>
                )}

                {/* Auto-continue toggle */}
                {onAutoContinueToggle && playbackDias === 1 && (
                  <button
                    onClick={onAutoContinueToggle}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors flex-shrink-0 ${
                      autoContinue
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                        : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                    }`}
                    title="Continuar automaticamente al dia siguiente"
                    aria-pressed={autoContinue}
                  >
                    <RotateCcw size={10} />
                    Auto
                  </button>
                )}
              </>
            )}
            {!isLoading && timelineData?.eventos.length === 0 && <span className="text-sm text-neutral-700">Sin movimientos registrados en este período.</span>}
          </>
        )}

        {mode === 'FORECAST' && (
          <span className="text-xs font-semibold text-purple-600 flex items-center gap-1.5">
            <Calendar size={12} />
            Pendientes actuales · vencimientos a 7 días
          </span>
        )}
      </div>
    </div>
  );
};

// Mini KPI card
const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | null;
  color: string;
  decimals?: number;
}> = ({ icon, label, value, color, decimals = 0 }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 rounded-lg border border-neutral-100 hover:shadow-sm transition-shadow">
    <div className="flex-shrink-0" style={{ color }}>{icon}</div>
    <div>
      <p className="text-lg font-bold text-neutral-900 tabular-nums leading-none">{value == null ? '—' : formatNumber(value, decimals)}</p>
      <p className="text-xs text-neutral-700 leading-tight mt-1">{label}</p>
    </div>
  </div>
);

/**
 * TimelineControls — Bottom bar with KPIs + event-driven playback controls
 * LIVE mode: LIVE badge + KPIs from liveData
 * PLAYBACK mode: play/pause, speed chips (fast/normal/slow), event-based scrubber,
 *   event counter, current event timestamp, KPIs from playback counters
 */

import React, { useMemo } from 'react';
import { Play, Pause, Calendar, FileText, Truck, Weight, TrendingUp, RotateCcw, ChevronLeft, ChevronRight, SkipBack, SkipForward } from 'lucide-react';
import type { MonitorMode } from '../WarRoomPage';
import type { MonitorLiveResponse, TimelineResponse } from '../api/monitor-api';
import { formatNumber, formatTimeShort } from '../utils/formatters';

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
  currentEventTimestamp?: string | null;
}

interface Props {
  mode: MonitorMode;
  liveData: MonitorLiveResponse | null;
  playbackDate: string | null;
  onDateChange: (date: string) => void;
  onSwitchToPlayback: (date?: string) => void;
  timelineData: TimelineResponse | null;
  isLoading: boolean;
  playback: PlaybackControls | null;
  autoContinue?: boolean;
  onAutoContinueToggle?: () => void;
  activeDays?: string[];
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
  mode, liveData, playbackDate, onDateChange, onSwitchToPlayback, timelineData, isLoading, playback,
  autoContinue, onAutoContinueToggle, activeDays,
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

  // In PLAYBACK mode, use playback counters for KPIs; in LIVE mode, use liveData
  const isPlayback = mode === 'PLAYBACK' && playback;

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
      <div className="flex items-center gap-3 flex-shrink-0">
        <KpiCard
          icon={<FileText size={14} />}
          label={isPlayback ? 'Creados' : 'Manifiestos Hoy'}
          value={kpiManifiestos}
          color="#0D8A4F"
        />
        <KpiCard
          icon={<Truck size={14} />}
          label="En Transito"
          value={kpiEnTransito}
          color="#3b82f6"
        />
        <KpiCard
          icon={<Weight size={14} />}
          label={isPlayback ? 'Tratados' : 'Toneladas'}
          value={isPlayback ? kpiTratados : (stats?.toneladas || 0)}
          color="#8b5cf6"
          decimals={isPlayback ? 0 : 1}
        />
        <KpiCard
          icon={<TrendingUp size={14} />}
          label="Total"
          value={isPlayback ? kpiTotal : (stats?.total || 0)}
          color="#f97316"
        />
      </div>

      {/* Separator */}
      <div className="w-px h-8 bg-neutral-200 flex-shrink-0" />

      {/* Mode-specific controls */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {mode === 'LIVE' && (
          <>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
              <span className="wr-live-dot" />
              LIVE
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
            {/* Date navigator — only active days */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={goToPrevDay}
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
                disabled={!nextDay}
                className="w-7 h-7 rounded flex items-center justify-center text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {isLoading && (
              <span className="text-xs text-neutral-400 flex-shrink-0">Cargando...</span>
            )}

            {playback && !isLoading && (
              <>
                {/* Play/Pause button */}
                <button
                  onClick={playback.isPlaying ? playback.pause : playback.play}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 shadow-md ${
                    playback.isPlaying
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white'
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
                  {playback.currentEventIndex + 1} / {playback.totalEventCount}
                </span>

                {/* Current event timestamp */}
                {playback.currentEventTimestamp && (
                  <span className="text-[11px] font-mono text-neutral-500 tabular-nums flex-shrink-0">
                    {formatTimeShort(playback.currentEventTimestamp)}
                  </span>
                )}

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
                      readOnly
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
                {onAutoContinueToggle && (
                  <button
                    onClick={onAutoContinueToggle}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors flex-shrink-0 ${
                      autoContinue
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                        : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                    }`}
                    title="Continuar automaticamente al dia siguiente"
                  >
                    <RotateCcw size={10} />
                    Auto
                  </button>
                )}
              </>
            )}
          </>
        )}

        {mode === 'FORECAST' && (
          <span className="text-xs font-semibold text-purple-600 flex items-center gap-1.5">
            <Calendar size={12} />
            Proximos 7 dias
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
  value: number;
  color: string;
  decimals?: number;
}> = ({ icon, label, value, color, decimals = 0 }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 rounded-lg border border-neutral-100 hover:shadow-sm transition-shadow">
    <div className="flex-shrink-0" style={{ color }}>{icon}</div>
    <div>
      <p className="text-sm font-bold text-neutral-900 tabular-nums leading-none">{formatNumber(value, decimals)}</p>
      <p className="text-[10px] text-neutral-500 leading-tight">{label}</p>
    </div>
  </div>
);

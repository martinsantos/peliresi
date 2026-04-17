/**
 * War Room Monitor — Vista de Monitoreo Independiente
 * ====================================================
 * Full-screen, 3 modos: LIVE / PLAYBACK / FORECAST
 * Modulo autonomo — no importa componentes del app principal
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Radio, Play, Pause, FastForward, Calendar, Film, X, Leaf, Clock } from 'lucide-react';
import { useWarRoomData } from './hooks/useWarRoomData';
import { useMonitorTimeline } from './hooks/useMonitorTimeline';
import { useForecast } from './hooks/useForecast';
import { useTimeline } from './hooks/useTimeline';
import { WarRoomMap } from './components/WarRoomMap';
import { WarRoomHeader } from './components/WarRoomHeader';
import { DashboardPanels } from './components/DashboardPanels';
import { DepartureBoard } from './components/DepartureBoard';
import { EventFeed } from './components/EventFeed';
import { TimelineControls } from './components/TimelineControls';
import { todayISO } from './utils/formatters';
import type { EnTransitoItem } from './api/monitor-api';
import { fetchActiveDays, fetchTimeline } from './api/monitor-api';
import './styles/war-room.css';

export type MonitorMode = 'LIVE' | 'PLAYBACK' | 'FORECAST';

const WarRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setModeRaw] = useState<MonitorMode>('LIVE');
  const [cinemaMode, setCinemaMode] = useState(false);
  const [playbackDate, setPlaybackDate] = useState<string | null>(null);
  const [playbackDias, setPlaybackDias] = useState(1);

  // Data hooks — only enabled for their respective modes
  const liveData = useWarRoomData(mode === 'LIVE');
  const timelineData = useMonitorTimeline(playbackDate, playbackDias);
  const forecastData = useForecast(7, mode === 'FORECAST');

  // Active days for date navigator
  const activeDaysQuery = useQuery({ queryKey: ['monitor-active-days'], queryFn: fetchActiveDays, staleTime: 5 * 60_000 });
  const activeDays = activeDaysQuery.data || [];

  // Pre-fetch the next active day so auto-continue transitions are instant
  const sortedDaysForPrefetch = useMemo(() => [...activeDays].sort(), [activeDays]);
  const currentDayIdxForPrefetch = playbackDate ? sortedDaysForPrefetch.indexOf(playbackDate) : -1;
  const nextDayForPrefetch = currentDayIdxForPrefetch >= 0 && currentDayIdxForPrefetch < sortedDaysForPrefetch.length - 1
    ? sortedDaysForPrefetch[currentDayIdxForPrefetch + 1]
    : null;
  useQuery({
    queryKey: ['monitor-timeline', nextDayForPrefetch, playbackDias],
    queryFn: () => fetchTimeline(nextDayForPrefetch!, playbackDias),
    enabled: mode === 'PLAYBACK' && !!nextDayForPrefetch,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  // Smart mode change — auto-selects latest active day when switching to PLAYBACK
  const setMode = useCallback((newMode: MonitorMode) => {
    if (newMode === 'PLAYBACK') {
      setPlaybackDate(prev => {
        if (prev) return prev; // Already have a date
        if (activeDays.length > 0) {
          const sorted = [...activeDays].sort();
          return sorted[sorted.length - 1];
        }
        return todayISO(); // Fallback to today
      });
    }
    setModeRaw(newMode);
  }, [activeDays]);

  // If activeDays loads after mode was set to PLAYBACK with no date
  useEffect(() => {
    if (mode === 'PLAYBACK' && !playbackDate && activeDays.length > 0) {
      const sorted = [...activeDays].sort();
      setPlaybackDate(sorted[sorted.length - 1]);
    }
  }, [mode, playbackDate, activeDays]);

  // Playback engine — fed with timeline events
  const timelineEvents = mode === 'PLAYBACK' && timelineData.data
    ? timelineData.data.eventos
    : null;
  const playback = useTimeline(timelineEvents);

  // Auto-continue: when enabled, advance to next day when playback finishes
  const [autoContinue, setAutoContinue] = useState(true);

  // Auto-start playback at 50x cuando llegan datos nuevos para el día actual.
  // Trackea por referencia del objeto data (no por fecha) para evitar race condition:
  // si se guarda la fecha cuando los datos son del día anterior, cuando llega la data
  // real el guard ya está satisfecho y nunca arranca.
  const autoStartedDataRef = useRef<object | null>(null);
  useEffect(() => {
    if (
      mode === 'PLAYBACK' &&
      timelineData.data &&
      timelineData.data.eventos.length > 0 &&
      timelineData.data !== autoStartedDataRef.current
    ) {
      autoStartedDataRef.current = timelineData.data;
      playback.setSpeed(50);
      const timer = setTimeout(() => {
        playback.play();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [mode, timelineData.data]);

  // Auto-continue to next ACTIVE day — seamless, no visible pause
  useEffect(() => {
    if (
      mode === 'PLAYBACK' &&
      autoContinue &&
      !playback.isPlaying &&
      playback.progress >= 0.99 &&
      playbackDate &&
      activeDays.length > 0
    ) {
      const sorted = [...activeDays].sort();
      const idx = sorted.indexOf(playbackDate);
      const nextDay = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;

      if (nextDay && nextDay <= todayISO()) {
        playback.reset();
        setPlaybackDate(nextDay);
      }
    }
  }, [mode, autoContinue, playback.isPlaying, playback.progress, playbackDate, activeDays]);



  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case 'Escape': navigate(-1); break;
        case 'c': case 'C': setCinemaMode(v => !v); break;
        case '1': setMode('LIVE'); break;
        case '2': setMode('PLAYBACK'); break;
        case '3': setMode('FORECAST'); break;
        case ' ':
          e.preventDefault();
          if (mode === 'PLAYBACK') {
            playback.isPlaying ? playback.pause() : playback.play();
          }
          break;
        case '+': case '=':
          if (mode === 'PLAYBACK') {
            const speedsUp: number[] = [10, 50, 100];
            const idxUp = speedsUp.indexOf(playback.speed);
            if (idxUp < speedsUp.length - 1) playback.setSpeed(speedsUp[idxUp + 1]);
          }
          break;
        case '-': case '_':
          if (mode === 'PLAYBACK') {
            const speedsDown: number[] = [10, 50, 100];
            const idxDown = speedsDown.indexOf(playback.speed);
            if (idxDown > 0) playback.setSpeed(speedsDown[idxDown - 1]);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (mode === 'PLAYBACK') {
            if (e.shiftKey) playback.skipEvents(10);
            else playback.skipToNextEvent();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (mode === 'PLAYBACK') playback.skipToPrevEvent();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate, mode, playback.isPlaying, playback.speed]);

  // Switch to PLAYBACK mode with today's date
  const handleSwitchToPlayback = useCallback((date?: string) => {
    const d = date || todayISO();
    setPlaybackDate(d);
    setMode('PLAYBACK');
  }, []);

  // Handle date change in playback
  const handleDateChange = useCallback((d: string) => {
    setPlaybackDate(d);
    playback.reset();
    setMode('PLAYBACK');
  }, [playback]);

  // Resolve actors for the map — always show actors even if timeline hasn't loaded yet
  const actores = timelineData.data?.actores || liveData.data?.actores || null;

  // Build enTransito from playback activeTrips for the map
  const enTransitoFromPlayback = useMemo((): EnTransitoItem[] => {
    if (mode !== 'PLAYBACK' || !playback.activeTrips.size) return [];
    const items: EnTransitoItem[] = [];
    playback.activeTrips.forEach((trip, manifiestoId) => {
      items.push({
        manifiestoId,
        numero: manifiestoId.slice(0, 8),
        transportista: '',
        origen: { razonSocial: '', lat: null, lng: null },
        destino: { razonSocial: '', lat: null, lng: null },
        fechaRetiro: null,
        ultimaPosicion: {
          latitud: trip.lat,
          longitud: trip.lng,
          timestamp: new Date(playback.currentTime).toISOString(),
        },
        ruta: trip.trail.map(([lat, lng]) => ({ lat, lng, timestamp: '' })),
      });
    });
    return items;
  }, [mode, playback.activeTrips, playback.currentTime]);

  const enTransito = mode === 'LIVE' ? (liveData.data?.enTransito || []) : enTransitoFromPlayback;

  // Resolve coordinates: use event coords, fall back to generador/operador
  const resolveCoords = useCallback((ev: any): { lat: number | undefined; lng: number | undefined } => {
    if (ev.latitud != null) return { lat: ev.latitud, lng: ev.longitud };
    // RETIRO/CREACION/FIRMA → generador location
    const genTypes = ['CREACION', 'FIRMA', 'RETIRO'];
    if (genTypes.includes(ev.eventoTipo) && ev.generador?.lat) return { lat: ev.generador.lat, lng: ev.generador.lng };
    // ENTREGA/RECEPCION/TRATAMIENTO/CIERRE → operador location
    const operTypes = ['ENTREGA', 'RECEPCION', 'TRATAMIENTO', 'CIERRE', 'PESAJE'];
    if (operTypes.includes(ev.eventoTipo) && ev.operador?.lat) return { lat: ev.operador.lat, lng: ev.operador.lng };
    // Fallback: try generador then operador
    if (ev.generador?.lat) return { lat: ev.generador.lat, lng: ev.generador.lng };
    if (ev.operador?.lat) return { lat: ev.operador.lat, lng: ev.operador.lng };
    return { lat: undefined, lng: undefined };
  }, []);

  // Build event feed items from playback processedEvents — incluye generador/residuos para CREACION
  const playbackEventFeed = useMemo(() => {
    if (mode !== 'PLAYBACK') return [];
    return playback.processedEvents
      .filter(ev => ev.type === 'EVENTO')
      .map((ev, i) => {
        const coords = resolveCoords(ev);
        return {
          id: `pb-${i}-${ev.manifiestoId}`,
          tipo: ev.eventoTipo || 'EVENTO',
          descripcion: ev.descripcion,
          latitud: coords.lat,
          longitud: coords.lng,
          timestamp: ev.timestamp,
          manifiestoNumero: ev.manifiestoNumero,
          generador: ev.generador ? { razonSocial: ev.generador.razonSocial } : undefined,
          operador: ev.operador ? { razonSocial: ev.operador.razonSocial } : undefined,
          residuos: ev.residuos,
        };
      });
  }, [mode, playback.processedEvents, resolveCoords]);

  const eventosRecientes = mode === 'LIVE'
    ? (liveData.data?.eventosRecientes || [])
    : playbackEventFeed;

  // Map playback counters from camelCase to UPPER_SNAKE_CASE for DashboardPanels pipeline
  const playbackCountersForPipeline = useMemo(() => {
    if (mode !== 'PLAYBACK') return undefined;
    const c = playback.counters;
    return {
      BORRADOR: c.borrador,
      APROBADO: c.aprobado,
      EN_TRANSITO: c.enTransito,
      ENTREGADO: c.entregado,
      RECIBIDO: c.recibido,
      EN_TRATAMIENTO: c.enTratamiento,
      TRATADO: c.tratado,
    };
  }, [mode, playback.counters]);

  // Speed mapping: useTimeline uses numeric, TimelineControls uses string labels
  const SPEED_TO_NUM: Record<string, number> = { fast: 100, normal: 50, slow: 10 };
  const NUM_TO_SPEED = (n: number): 'fast' | 'normal' | 'slow' =>
    n >= 100 ? 'fast' : n >= 50 ? 'normal' : 'slow';

  // Resolve currentEvent with coordinates for the map camera
  const currentEventForMap = useMemo(() => {
    if (mode !== 'PLAYBACK' || !playback.currentEvent) return null;
    const ev = playback.currentEvent;
    const coords = resolveCoords(ev);
    if (coords.lat == null || coords.lng == null) return null;
    if (Math.abs(coords.lat) < 0.001 && Math.abs(coords.lng) < 0.001) return null;
    return {
      lat: coords.lat,
      lng: coords.lng,
      tipo: ev.eventoTipo || 'EVENTO',
      manifiestoNumero: ev.manifiestoNumero || '',
    };
  }, [mode, playback.currentEvent, resolveCoords]);

  // Build playback controls object for TimelineControls (new event-driven interface)
  const playbackControls = mode === 'PLAYBACK' && timelineData.data ? {
    isPlaying: playback.isPlaying,
    speed: NUM_TO_SPEED(playback.speed),
    currentEventIndex: playback.currentEventIndex,
    totalEventCount: playback.totalEventCount,
    progress: playback.progress,
    isDone: playback.progress >= 0.99 && !playback.isPlaying,
    counters: playback.counters as unknown as Record<string, number>,
    play: playback.play,
    pause: playback.pause,
    setSpeed: (s: 'fast' | 'normal' | 'slow') => playback.setSpeed(SPEED_TO_NUM[s]),
    skipToNext: playback.skipToNextEvent,
    skipToPrev: playback.skipToPrevEvent,
    currentEventTimestamp: playback.currentEvent?.timestamp || null,
  } : null;

  return (
    <div className={`wr-layout ${cinemaMode ? 'wr-cinema' : ''}`}>
      {/* Header */}
      <div className="wr-layout-header">
        <WarRoomHeader
          mode={mode}
          cinemaMode={cinemaMode}
          onModeChange={setMode}
          onCinemaToggle={() => setCinemaMode(v => !v)}
          onClose={() => navigate(-1)}
        />
      </div>

      {/* Left Panel — Dashboards */}
      <div className="wr-layout-sidebar wr-enter-left">
        <DashboardPanels
          mode={mode}
          liveData={liveData.data || null}
          forecastData={forecastData.data || null}
          timelineData={timelineData.data || null}
          playbackCounters={playbackCountersForPipeline}
          playbackEvents={eventosRecientes}
          currentEventId={mode === 'PLAYBACK' && playback.currentEvent ? `pb-0-${playback.currentEvent.manifiestoId}` : undefined}
        />
      </div>

      {/* Map */}
      <div className="wr-layout-map">
        {/* DepartureBoard — sticky overlay top-left of map */}
        {mode === 'PLAYBACK' && playback.currentEvent && (
          <div className="absolute top-3 left-3 z-[1001] w-72 pointer-events-none">
            <DepartureBoard
              event={playback.currentEvent}
              eventIndex={playback.currentEventIndex}
              totalEvents={playback.totalEventCount}
            />
          </div>
        )}
        <WarRoomMap
          cinemaMode={cinemaMode}
          actores={actores || null}
          enTransito={enTransito}
          mode={mode}
          currentHour={mode === 'PLAYBACK' ? playback.currentHour : undefined}
          playbackTrips={mode === 'PLAYBACK' ? playback.activeTrips : undefined}
          currentEvent={currentEventForMap}
          playbackEvents={mode === 'PLAYBACK' ? playbackEventFeed.map(e => ({
            id: e.id,
            tipo: e.tipo,
            lat: e.latitud ?? 0,
            lng: e.longitud ?? 0,
            numero: e.manifiestoNumero,
          })).filter(e => e.lat !== 0 && e.lng !== 0) : undefined}
        />
      </div>

      {/* Bottom Panel — KPIs + Timeline Controls */}
      <div className="wr-layout-bottom wr-enter-up">
        <TimelineControls
          mode={mode}
          liveData={liveData.data || null}
          playbackDate={playbackDate}
          onDateChange={handleDateChange}
          onSwitchToPlayback={handleSwitchToPlayback}
          timelineData={timelineData.data || null}
          isLoading={timelineData.isLoading}
          autoContinue={autoContinue}
          onAutoContinueToggle={() => setAutoContinue(v => !v)}
          activeDays={activeDays}
          playback={playbackControls}
          currentHour={mode === 'PLAYBACK' ? playback.currentHour : undefined}
        />
      </div>
    </div>
  );
};

export default WarRoomPage;

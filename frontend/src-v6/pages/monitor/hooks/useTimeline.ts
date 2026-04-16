/**
 * useTimeline — Event-driven playback engine (Fase 6)
 *
 * Steps through EVENTO-type events one by one with no dead time.
 * GPS points between consecutive events are processed silently to update truck positions.
 * Speed controls the pause between events (not a time multiplier).
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { TimelineEvent } from '../api/monitor-api';
import { buildTimeline } from '../utils/timeline-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlaybackSpeed = 'fast' | 'normal' | 'slow';

interface TripState {
  lat: number;
  lng: number;
  trail: [number, number][];
}

interface Counters {
  borrador: number;
  aprobado: number;
  enTransito: number;
  entregado: number;
  recibido: number;
  enTratamiento: number;
  tratado: number;
  totalCreated: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  speed: number;                       // Numeric speed kept for consumer compat (1,5,10,50,100)
  currentEventIndex: number;
  totalEventCount: number;
  currentEvent: TimelineEvent | null;
  processedEvents: TimelineEvent[];
  activeTrips: Map<string, TripState>;
  counters: Counters;
  progress: number;                    // 0-1 based on event index
  isDone: boolean;
  // Kept for consumer compatibility (TimelineControls scrubber, time display)
  currentTime: number;
  startTime: number;
  endTime: number;
  currentHour: number; // 0–23, hora local del evento actual (para ciclo día/noche)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_COUNTERS: Counters = {
  borrador: 0,
  aprobado: 0,
  enTransito: 0,
  entregado: 0,
  recibido: 0,
  enTratamiento: 0,
  tratado: 0,
  totalCreated: 0,
};

/** Map numeric speed values to internal PlaybackSpeed */
function numericToSpeed(n: number): PlaybackSpeed {
  if (n >= 50) return 'fast';
  if (n >= 10) return 'normal';
  return 'slow';
}

/** Map PlaybackSpeed to setInterval delay in ms */
const SPEED_TO_INTERVAL: Record<PlaybackSpeed, number> = {
  fast: 500,
  normal: 1500,
  slow: 3000,
};

/** Map eventoTipo → new counter key */
const EVENTO_TO_COUNTER: Record<string, keyof Counters | null> = {
  CREACION: 'borrador',
  FIRMA: 'aprobado',
  RETIRO: 'enTransito',
  ENTREGA: 'entregado',
  RECEPCION: 'recibido',
  TRATAMIENTO: 'enTratamiento',
  CIERRE: 'tratado',
  CANCELACION: null,
  RECHAZO: null,
  INCIDENTE: null,
  PESAJE: null,
  REVERSION: null,
};

/** Map eventoTipo → previous counter key to decrement */
const PREV_STATE: Record<string, keyof Counters | null> = {
  FIRMA: 'borrador',
  RETIRO: 'aprobado',
  ENTREGA: 'enTransito',
  RECEPCION: 'entregado',
  TRATAMIENTO: 'recibido',
  CIERRE: 'enTratamiento',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTimeline(events: TimelineEvent[] | null) {
  // ── Refs for sorted data ──────────────────────────────────────────────────
  // allSorted: full timeline including GPS + EVENTO, sorted by time
  const allSortedRef = useRef<Array<TimelineEvent & { unixMs: number }>>([]);
  // eventoList: only EVENTO entries, preserving order
  const eventoListRef = useRef<Array<TimelineEvent & { unixMs: number }>>([]);

  // ── Mutable playback refs (not tied to React render cycle) ────────────────
  const currentEventIndexRef = useRef(-1); // Index into eventoList, -1 = before start
  const numericSpeedRef = useRef(50);      // Consumer-facing speed value
  const isPlayingRef = useRef(false);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mutable accumulator refs (rebuilt on reprocess)
  const processedEventsRef = useRef<TimelineEvent[]>([]);
  const activeTripsRef = useRef<Map<string, TripState>>(new Map());
  const countersRef = useRef<Counters>({ ...INITIAL_COUNTERS });
  const currentEventObjRef = useRef<TimelineEvent | null>(null);

  // Time boundaries for scrubber compatibility
  const startTimeRef = useRef(0);
  const endTimeRef = useRef(0);

  // ── React state (updated after each step) ─────────────────────────────────
  const [state, setState] = useState<PlaybackState>({
    isPlaying: false,
    speed: 50,
    currentEventIndex: -1,
    totalEventCount: 0,
    currentEvent: null,
    processedEvents: [],
    activeTrips: new Map(),
    counters: { ...INITIAL_COUNTERS },
    progress: 0,
    isDone: false,
    currentTime: 0,
    startTime: 0,
    endTime: 0,
    currentHour: 12,
  });

  // ── Process a single timeline entry (mutates refs) ────────────────────────
  const processSingleEntry = useCallback((ev: TimelineEvent & { unixMs: number }) => {
    if (ev.type === 'GPS') {
      // Update truck position silently
      if (ev.latitud != null && ev.longitud != null) {
        const key = ev.manifiestoId;
        const existing = activeTripsRef.current.get(key);
        const pos: [number, number] = [ev.latitud, ev.longitud];
        if (existing) {
          existing.lat = ev.latitud;
          existing.lng = ev.longitud;
          existing.trail.push(pos);
        } else {
          activeTripsRef.current.set(key, {
            lat: ev.latitud,
            lng: ev.longitud,
            trail: [pos],
          });
        }
      }
    } else if (ev.type === 'EVENTO' && ev.eventoTipo) {
      const tipo = ev.eventoTipo;

      // Decrement previous state counter
      const prevKey = PREV_STATE[tipo];
      if (prevKey && countersRef.current[prevKey] > 0) {
        countersRef.current[prevKey]--;
      }

      // Increment new state counter
      const newKey = EVENTO_TO_COUNTER[tipo];
      if (newKey) {
        countersRef.current[newKey]++;
      }

      // Track total created
      if (tipo === 'CREACION') {
        countersRef.current.totalCreated++;
      }

      // ── Trip management ────────────────────────────────────────────────
      if (tipo === 'RETIRO') {
        const originLat = ev.latitud ?? ev.generador?.lat;
        const originLng = ev.longitud ?? ev.generador?.lng;
        if (originLat != null && originLng != null) {
          const pos: [number, number] = [originLat, originLng];
          activeTripsRef.current.set(ev.manifiestoId, {
            lat: originLat,
            lng: originLng,
            trail: [pos],
          });
        }
      }

      if (tipo === 'ENTREGA') {
        const trip = activeTripsRef.current.get(ev.manifiestoId);
        if (trip) {
          // Snap truck to delivery coords if available
          if (ev.latitud != null && ev.longitud != null) {
            trip.lat = ev.latitud;
            trip.lng = ev.longitud;
            trip.trail.push([ev.latitud, ev.longitud]);
          } else if (ev.operador?.lat != null && ev.operador?.lng != null) {
            trip.lat = ev.operador.lat;
            trip.lng = ev.operador.lng;
            trip.trail.push([ev.operador.lat, ev.operador.lng]);
          }
          // Remove trip on delivery
          activeTripsRef.current.delete(ev.manifiestoId);
        }
      }

      if (tipo === 'RECEPCION' || tipo === 'CIERRE') {
        activeTripsRef.current.delete(ev.manifiestoId);
      }

      // Track current event object
      currentEventObjRef.current = ev;

      // Add to processed events (most recent first, capped at 100)
      processedEventsRef.current = [ev, ...processedEventsRef.current].slice(0, 100);
    }
  }, []);

  // ── Reprocess all entries from scratch up to eventoList[targetIdx] ────────
  const processUpToEvent = useCallback((targetIdx: number) => {
    const allSorted = allSortedRef.current;
    const eventoList = eventoListRef.current;

    // Reset accumulators
    processedEventsRef.current = [];
    activeTripsRef.current = new Map();
    countersRef.current = { ...INITIAL_COUNTERS };
    currentEventObjRef.current = null;

    if (targetIdx < 0 || eventoList.length === 0) {
      currentEventIndexRef.current = -1;
      return;
    }

    // Clamp
    const clamped = Math.min(targetIdx, eventoList.length - 1);
    const cutoffMs = eventoList[clamped].unixMs;

    // Process all entries in allSorted whose time <= cutoffMs
    // But we need to process exactly up to and including the target evento.
    // Strategy: process all allSorted entries up to cutoffMs, but be careful
    // if multiple eventos share the same timestamp — we need exactly clamped+1 eventos.
    let eventosSeen = 0;
    for (let i = 0; i < allSorted.length; i++) {
      const entry = allSorted[i];
      if (entry.unixMs > cutoffMs) break;

      // If this is an EVENTO, check if we've already processed enough
      if (entry.type === 'EVENTO') {
        if (eventosSeen > clamped) break;
        processSingleEntry(entry);
        eventosSeen++;
      } else {
        // GPS: process if its time is <= cutoff
        processSingleEntry(entry);
      }
    }

    currentEventIndexRef.current = clamped;
  }, [processSingleEntry]);

  // ── Flush mutable refs → React state ──────────────────────────────────────
  const flushState = useCallback(() => {
    const eventoCount = eventoListRef.current.length;
    const idx = currentEventIndexRef.current;
    const progress = eventoCount > 0 ? Math.max(0, (idx + 1) / eventoCount) : 0;

    // currentTime for scrubber: use the timestamp of the current event
    const currentTime = idx >= 0 && idx < eventoListRef.current.length
      ? eventoListRef.current[idx].unixMs
      : startTimeRef.current;

    const currentHour = idx >= 0 && idx < eventoListRef.current.length
      ? new Date(eventoListRef.current[idx].unixMs).getHours()
      : 12;

    setState({
      isPlaying: isPlayingRef.current,
      speed: numericSpeedRef.current,
      currentEventIndex: idx,
      totalEventCount: eventoCount,
      currentEvent: currentEventObjRef.current,
      processedEvents: [...processedEventsRef.current],
      activeTrips: new Map(activeTripsRef.current),
      counters: { ...countersRef.current },
      progress,
      isDone: eventoCount > 0 && idx >= eventoCount - 1,
      currentTime,
      startTime: startTimeRef.current,
      endTime: endTimeRef.current,
      currentHour,
    });
  }, []);

  // ── Clear running interval ────────────────────────────────────────────────
  const clearPlayInterval = useCallback(() => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  // ── Step forward by one event (the core tick) ─────────────────────────────
  const stepForward = useCallback(() => {
    const eventoList = eventoListRef.current;
    const allSorted = allSortedRef.current;
    if (eventoList.length === 0) return;

    const nextIdx = currentEventIndexRef.current + 1;
    if (nextIdx >= eventoList.length) {
      // Reached the end
      isPlayingRef.current = false;
      clearPlayInterval();
      flushState();
      return;
    }

    // Determine the time window: from previous event time to next event time
    const prevMs = currentEventIndexRef.current >= 0
      ? eventoListRef.current[currentEventIndexRef.current].unixMs
      : 0;
    const nextEvento = eventoList[nextIdx];
    const nextMs = nextEvento.unixMs;

    // Process all GPS points between prevMs and nextMs (silent, no pause)
    for (let i = 0; i < allSorted.length; i++) {
      const entry = allSorted[i];
      if (entry.unixMs <= prevMs) continue;
      if (entry.unixMs > nextMs) break;
      if (entry.type === 'GPS') {
        processSingleEntry(entry);
      }
    }

    // Process the event itself
    processSingleEntry(nextEvento);
    currentEventIndexRef.current = nextIdx;

    flushState();
  }, [processSingleEntry, clearPlayInterval, flushState]);

  // ── Start the interval for auto-stepping ──────────────────────────────────
  const startInterval = useCallback(() => {
    clearPlayInterval();
    const pSpeed = numericToSpeed(numericSpeedRef.current);
    const ms = SPEED_TO_INTERVAL[pSpeed];
    intervalIdRef.current = setInterval(() => {
      stepForward();
    }, ms);
  }, [stepForward, clearPlayInterval]);

  // ── Rebuild timeline when events prop changes ─────────────────────────────
  useEffect(() => {
    // Stop any running playback
    isPlayingRef.current = false;
    clearPlayInterval();

    if (!events || events.length === 0) {
      allSortedRef.current = [];
      eventoListRef.current = [];
      currentEventIndexRef.current = -1;
      processedEventsRef.current = [];
      activeTripsRef.current = new Map();
      countersRef.current = { ...INITIAL_COUNTERS };
      currentEventObjRef.current = null;
      startTimeRef.current = 0;
      endTimeRef.current = 0;

      setState({
        isPlaying: false,
        speed: numericSpeedRef.current,
        currentEventIndex: -1,
        totalEventCount: 0,
        currentEvent: null,
        processedEvents: [],
        activeTrips: new Map(),
        counters: { ...INITIAL_COUNTERS },
        progress: 0,
        isDone: false,
        currentTime: 0,
        startTime: 0,
        endTime: 0,
        currentHour: 12,
      });
      return;
    }

    const sorted = buildTimeline(events);
    allSortedRef.current = sorted;

    const eventoOnly = sorted.filter(e => e.type === 'EVENTO');
    eventoListRef.current = eventoOnly;

    const start = sorted[0].unixMs;
    const end = sorted[sorted.length - 1].unixMs;
    startTimeRef.current = start;
    endTimeRef.current = end;

    // Reset accumulators
    currentEventIndexRef.current = -1;
    processedEventsRef.current = [];
    activeTripsRef.current = new Map();
    countersRef.current = { ...INITIAL_COUNTERS };
    currentEventObjRef.current = null;

    setState({
      isPlaying: false,
      speed: numericSpeedRef.current,
      currentEventIndex: -1,
      totalEventCount: eventoOnly.length,
      currentEvent: null,
      processedEvents: [],
      activeTrips: new Map(),
      counters: { ...INITIAL_COUNTERS },
      progress: 0,
      isDone: false,
      currentTime: start,
      startTime: start,
      endTime: end,
      currentHour: 12,
    });
  }, [events, clearPlayInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearPlayInterval();
  }, [clearPlayInterval]);

  // ── Public methods ────────────────────────────────────────────────────────

  const play = useCallback(() => {
    const eventoList = eventoListRef.current;
    if (eventoList.length === 0) return;

    // If at end, reset first
    if (currentEventIndexRef.current >= eventoList.length - 1) {
      currentEventIndexRef.current = -1;
      processedEventsRef.current = [];
      activeTripsRef.current = new Map();
      countersRef.current = { ...INITIAL_COUNTERS };
      currentEventObjRef.current = null;
    }

    isPlayingRef.current = true;
    startInterval();
    // Immediately step to first event if at the beginning
    if (currentEventIndexRef.current < 0) {
      stepForward();
    } else {
      flushState();
    }
  }, [startInterval, stepForward, flushState]);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    clearPlayInterval();
    flushState();
  }, [clearPlayInterval, flushState]);

  const setSpeed = useCallback((speed: number) => {
    numericSpeedRef.current = speed;
    // If currently playing, restart interval with new speed
    if (isPlayingRef.current) {
      startInterval();
    }
    // Flush to update speed display
    flushState();
  }, [startInterval, flushState]);

  const skipToNextEvent = useCallback(() => {
    if (eventoListRef.current.length === 0) return;
    // Pause first
    isPlayingRef.current = false;
    clearPlayInterval();
    stepForward();
  }, [clearPlayInterval, stepForward]);

  const skipToPrevEvent = useCallback(() => {
    if (eventoListRef.current.length === 0) return;
    isPlayingRef.current = false;
    clearPlayInterval();

    const newIdx = Math.max(-1, currentEventIndexRef.current - 1);
    processUpToEvent(newIdx);
    flushState();
  }, [clearPlayInterval, processUpToEvent, flushState]);

  const goToEvent = useCallback((idx: number) => {
    if (eventoListRef.current.length === 0) return;
    isPlayingRef.current = false;
    clearPlayInterval();

    const clamped = Math.max(-1, Math.min(idx, eventoListRef.current.length - 1));
    processUpToEvent(clamped);
    flushState();
  }, [clearPlayInterval, processUpToEvent, flushState]);

  const skipEvents = useCallback((n: number) => {
    if (eventoListRef.current.length === 0) return;
    isPlayingRef.current = false;
    clearPlayInterval();

    const targetIdx = currentEventIndexRef.current + n;
    const clamped = Math.max(-1, Math.min(targetIdx, eventoListRef.current.length - 1));

    if (n > 0 && clamped > currentEventIndexRef.current) {
      // Forward: step incrementally (more efficient than full reprocess)
      const allSorted = allSortedRef.current;
      const eventoList = eventoListRef.current;
      const prevMs = currentEventIndexRef.current >= 0
        ? eventoList[currentEventIndexRef.current].unixMs
        : 0;
      const targetMs = eventoList[clamped].unixMs;

      // Process GPS between current and target
      for (let i = 0; i < allSorted.length; i++) {
        const entry = allSorted[i];
        if (entry.unixMs <= prevMs) continue;
        if (entry.unixMs > targetMs) break;
        if (entry.type === 'GPS') {
          processSingleEntry(entry);
        }
      }

      // Process each evento between current+1 and clamped (inclusive)
      for (let ei = currentEventIndexRef.current + 1; ei <= clamped; ei++) {
        processSingleEntry(eventoList[ei]);
      }
      currentEventIndexRef.current = clamped;
    } else {
      // Backward or same: reprocess from scratch
      processUpToEvent(clamped);
    }

    flushState();
  }, [clearPlayInterval, processSingleEntry, processUpToEvent, flushState]);

  /**
   * seek(progress) — jump to a position by progress fraction (0-1).
   * Maps progress to the nearest event index and reprocesses.
   * Kept for consumer compatibility (TimelineControls scrubber).
   */
  const seek = useCallback((progress: number) => {
    const eventoList = eventoListRef.current;
    if (eventoList.length === 0) return;

    const clamped = Math.max(0, Math.min(1, progress));
    const targetIdx = Math.round(clamped * (eventoList.length - 1));

    isPlayingRef.current = false;
    clearPlayInterval();
    processUpToEvent(targetIdx);
    flushState();
  }, [clearPlayInterval, processUpToEvent, flushState]);

  const reset = useCallback(() => {
    isPlayingRef.current = false;
    clearPlayInterval();

    currentEventIndexRef.current = -1;
    processedEventsRef.current = [];
    activeTripsRef.current = new Map();
    countersRef.current = { ...INITIAL_COUNTERS };
    currentEventObjRef.current = null;

    setState(prev => ({
      ...prev,
      isPlaying: false,
      currentEventIndex: -1,
      totalEventCount: eventoListRef.current.length,
      currentEvent: null,
      processedEvents: [],
      activeTrips: new Map(),
      counters: { ...INITIAL_COUNTERS },
      progress: 0,
      isDone: false,
      currentTime: startTimeRef.current,
    }));
  }, [clearPlayInterval]);

  return {
    ...state,
    play,
    pause,
    setSpeed,
    seek,
    reset,
    skipToNextEvent,
    skipToPrevEvent,
    skipEvents,
    goToEvent,
  };
}

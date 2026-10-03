/**
 * SITREP v6 - Centro de Control — Sala de Operaciones (v2)
 * =========================================================
 * Orchestrator: data fetching, state management, layout.
 * UI sections delegated to components/ subdirectory.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDashboardStats } from '../../hooks/useDashboard';
import { useManifiestos } from '../../hooks/useManifiestos';
import { useAlertas } from '../../hooks/useAlertas';
import { useCentroControl } from '../../hooks/useCentroControl';
import { useAuth } from '../../contexts/AuthContext';
import type { CentroControlData } from '../../hooks/useCentroControl';
import { EstadoManifiesto } from '../../types/models';
import { formatRelativeTime } from '../../utils/formatters';
import { computeDateRange } from '../../utils/date-presets';

import { useInspectionOperations } from '../../hooks/useInspectionOperations';
import { canUseInspectionOperations } from '../../services/inspectionOperations.service';
import { ControlFilters, type LayerState } from './components/ControlFilters';
import { ControlStats } from './components/ControlStats';
import { ControlMap } from './components/ControlMap';
import { ViajesPanel, type TripPanel } from './components/ViajesPanel';

// ── Constants ──
const POLL_INTERVAL = 30;

export const CentroControlPage: React.FC = () => {
  const { currentUser, isAdmin, isTransportista } = useAuth();

  const [countdown, setCountdown] = useState(POLL_INTERVAL);

  // ── Trip selection & filter ──
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedRealizadoId, setSelectedRealizadoId] = useState<string | null>(null);
  const [tripFilter, setTripFilter] = useState('');
  const [tripPanel, setTripPanel] = useState<TripPanel>('activos');
  // The first response may choose a default only before the user's first action.
  const panelInitialized = useRef(false);
  const handleTripPanelChange = (panel: TripPanel) => { panelInitialized.current = true; setTripPanel(panel); };

  // ── Layer toggles ──
  const [layers, setLayers] = useState<LayerState>({
    generadores: true,
    transportistas: true,
    operadores: true,
    transito: true,
    ...(canUseInspectionOperations(currentUser) ? { inspecciones: true } : {}),
  });

  // ── Date range (default: 30 días) ──
  const [datePreset, setDatePreset] = useState(30);
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0]);

  // ── Map zoom ──
  const [mapZoom, setMapZoom] = useState(10);

  const inspections = useInspectionOperations({ limit: 100 });
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const selectInspection = (id: string) => { panelInitialized.current = true; setSelectedInspectionId(id); setTripPanel('inspecciones'); setLayers((previous) => ({ ...previous, inspecciones: true })); };

  // ── API Hooks ──
  const { refetch: refetchStats } = useDashboardStats();
  const { data: ccData, refetch: refetchCC } = useCentroControl({
    fechaDesde,
    fechaHasta,
    capas: Object.entries(layers).filter(([k, v]) => v && k !== 'inspecciones').map(([k]) => k),
  });
  // Only fetch alertas for ADMIN — TRANSPORTISTA gets 403
  const { data: alertasData } = useAlertas({ limit: 10 }, isAdmin);
  const { data: completedData } = useManifiestos({ estado: EstadoManifiesto.ENTREGADO, limit: 20 });

  // ── Clock + Countdown ──
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          refetchStats();
          refetchCC();
          return POLL_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [refetchStats, refetchCC]);

  // ── Scroll lock: block page scroll over map, allow over viajes panel ──
  const mapColRef = useRef<HTMLDivElement>(null);
  const viajesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mapCol = mapColRef.current;
    const viajesEl = viajesRef.current;
    if (!mapCol || !viajesEl) return;
    const handler = (e: WheelEvent) => {
      if (viajesEl.contains(e.target as Node)) return;
      e.preventDefault();
    };
    mapCol.addEventListener('wheel', handler, { passive: false });
    return () => mapCol.removeEventListener('wheel', handler);
  }, []);

  const handleManualRefresh = useCallback(() => {
    refetchStats();
    refetchCC();
    if (canUseInspectionOperations(currentUser)) void inspections.refetch();
    setCountdown(POLL_INTERVAL);
  }, [refetchStats, refetchCC, inspections.refetch, currentUser]);

  const handleDatePreset = useCallback((days: number) => {
    setDatePreset(days);
    const range = computeDateRange(days);
    setFechaDesde(range.desde);
    setFechaHasta(range.hasta);
  }, []);

  const toggleLayer = useCallback((layer: keyof LayerState) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  // ── Centro Control data ──
  const cc: CentroControlData | null = ccData || null;

  // ── Alertas ──
  const alertas = useMemo(() => {
    const items = alertasData?.items;
    if (!items || !Array.isArray(items) || items.length === 0) return [];
    return items.slice(0, 6).map((a: any) => ({
      id: a.id,
      tipo: (a.estado === 'PENDIENTE' ? (a.regla?.evento?.includes('CRITICO') ? 'critical' : 'warning') : 'info') as 'critical' | 'warning' | 'info',
      mensaje: a.regla?.nombre || a.datos || 'Alerta del sistema',
      tiempo: formatRelativeTime(a.createdAt),
    }));
  }, [alertasData]);

  // ── Filtered trips (TRANSPORTISTA sees only own trips) ──
  const userTransportista = isTransportista ? (currentUser?.sector || '') : '';
  const filteredEnTransito = useMemo(() => {
    if (!cc?.enTransito) return [];
    let items = cc.enTransito;
    if (userTransportista) {
      items = items.filter(m => m.transportista === userTransportista);
    }
    if (!tripFilter.trim()) return items;
    const q = tripFilter.toLowerCase();
    return items.filter(m =>
      m.numero.toLowerCase().includes(q) || m.transportista.toLowerCase().includes(q)
    );
  }, [cc?.enTransito, tripFilter, userTransportista]);

  const enTransitoForMap = useMemo(() => {
    if (!cc?.enTransito) return [];
    if (!userTransportista) return cc.enTransito;
    return cc.enTransito.filter(m => m.transportista === userTransportista);
  }, [cc?.enTransito, userTransportista]);

  // ── Trip fly-to points ──
  const activeTripFlyPoints = useMemo((): [number, number][] => {
    if (!selectedTripId || !enTransitoForMap.length) return [];
    const trip = enTransitoForMap.find(m => m.manifiestoId === selectedTripId);
    if (!trip) return [];
    const pts: [number, number][] = [];
    if (trip.ultimaPosicion) pts.push([trip.ultimaPosicion.latitud, trip.ultimaPosicion.longitud]);
    if (trip.origenLatLng) pts.push(trip.origenLatLng);
    if (trip.destinoLatLng) pts.push(trip.destinoLatLng);
    return pts;
  }, [selectedTripId, enTransitoForMap]);

  const viajesRealizados = useMemo(() => {
    const items = completedData?.items || [];
    if (!Array.isArray(items)) return [];
    return items.map((m) => ({
      id: m.id,
      numero: m.numero || m.id,
      transportista: m.transportista?.razonSocial || 'Transportista',
      origen: m.generador?.razonSocial || 'Origen',
      destino: m.operador?.razonSocial || 'Destino',
      origenPos: m.generador?.latitud && m.generador?.longitud
        ? [m.generador.latitud, m.generador.longitud] as [number, number] : null,
      destinoPos: m.operador?.latitud && m.operador?.longitud
        ? [m.operador.latitud, m.operador.longitud] as [number, number] : null,
      estado: m.estado,
      fechaEntrega: m.updatedAt || m.fechaEntrega,
    }));
  }, [completedData]);

  const panelBoundsPoints = useMemo((): [number, number][] => {
    if (tripPanel === 'activos') {
      return enTransitoForMap
        .filter(m => m.ultimaPosicion)
        .map(m => [m.ultimaPosicion!.latitud, m.ultimaPosicion!.longitud] as [number, number]);
    }
    if (tripPanel === 'realizados') {
      const pts: [number, number][] = [];
      for (const m of viajesRealizados) {
        if (m.origenPos) pts.push(m.origenPos);
        if (m.destinoPos) pts.push(m.destinoPos);
      }
      return pts;
    }
    return [];
  }, [tripPanel, enTransitoForMap, viajesRealizados]);

  const realizadoFlyPoints = useMemo((): [number, number][] => {
    if (!selectedRealizadoId) return [];
    const trip = viajesRealizados.find((m: any) => m.id === selectedRealizadoId);
    if (!trip) return [];
    const pts: [number, number][] = [];
    if (trip.origenPos) pts.push(trip.origenPos);
    if (trip.destinoPos) pts.push(trip.destinoPos);
    return pts;
  }, [selectedRealizadoId, viajesRealizados]);

  // Choose an initial panel only; polling must not override the user's selection.
  // Auto-switch to realizados if no active trips
  useEffect(() => {
    if (!cc || panelInitialized.current) return;
    panelInitialized.current = true;
    if (cc && filteredEnTransito.length === 0 && viajesRealizados.length > 0) {
      setTripPanel('realizados');
    } else if (cc && filteredEnTransito.length > 0) {
      setTripPanel('activos');
    }
  }, [cc, filteredEnTransito.length, viajesRealizados.length]);

  // Clear selections when switching panels
  useEffect(() => {
    setSelectedTripId(null);
    setSelectedRealizadoId(null);
  }, [tripPanel]);

  return (
    <>
      {/* ══════ Sticky Filters Bar ══════ */}
      <ControlFilters
        countdown={countdown}
        datePreset={datePreset}
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        onManualRefresh={handleManualRefresh}
        onDatePreset={handleDatePreset}
        onFechaDesde={(val) => { setFechaDesde(val); setDatePreset(-1); }}
        onFechaHasta={(val) => { setFechaHasta(val); setDatePreset(-1); }}
      />

      {/* ══════ Main Content ══════ */}
      <div className="space-y-6 mt-4 xl:max-w-7xl xl:mx-auto isolate">

      {/* KPI Cards + Pipeline (first two sections) */}
      <ControlStats
        cc={cc}
        alertas={alertas}
        datePreset={datePreset}
        inspectionCount={canUseInspectionOperations(currentUser) ? inspections.isError || !inspections.data ? null : inspections.data.total : undefined}
      >



      {/* ══════ Mapa de Actividad + Viajes Activos ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ControlMap
          cc={cc}
          layers={layers}
          onToggleLayer={toggleLayer}
          mapZoom={mapZoom}
          onZoomChange={setMapZoom}
          enTransitoForMap={enTransitoForMap}
          selectedTripId={selectedTripId}
          onSelectTrip={setSelectedTripId}
          selectedRealizadoId={selectedRealizadoId}
          tripPanel={tripPanel}
          viajesRealizados={viajesRealizados}
          activeTripFlyPoints={activeTripFlyPoints}
          panelBoundsPoints={panelBoundsPoints}
          realizadoFlyPoints={realizadoFlyPoints}
          mapColRef={mapColRef}
          inspections={inspections.data?.items || []}
          selectedInspectionId={tripPanel === 'inspecciones' ? selectedInspectionId : null}
          onSelectInspection={selectInspection}
        />

        <ViajesPanel
          filteredEnTransito={filteredEnTransito}
          viajesRealizados={viajesRealizados}
          tripFilter={tripFilter}
          onTripFilterChange={setTripFilter}
          tripPanel={tripPanel}
          onTripPanelChange={handleTripPanelChange}
          selectedTripId={selectedTripId}
          onSelectTrip={setSelectedTripId}
          selectedRealizadoId={selectedRealizadoId}
          onSelectRealizado={setSelectedRealizadoId}
          viajesRef={viajesRef}
          inspections={canUseInspectionOperations(currentUser) ? inspections.data?.items || [] : undefined}
          inspectionTotal={inspections.data?.total}
          inspectionError={inspections.isError}
          inspectionLoading={inspections.isPending}
          selectedInspectionId={selectedInspectionId}
          onSelectInspection={selectInspection}
        />
      </div>
      </ControlStats>
      </div>
    </>
  );
};

export default CentroControlPage;

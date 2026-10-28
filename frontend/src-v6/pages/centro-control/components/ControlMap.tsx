/**
 * CentroControl — Leaflet Map with all layers, markers, polylines
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, RefreshCw } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './control-map.css';
import { Card } from '../../../components/ui/CardV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { MapLayerToggle } from '../../../components/ui/MapLayerToggle';
import { ACTOR_ICONS, ACTOR_COLORS, createClusterIcon } from '../../../utils/map-icons';
import { resolveActorLocation } from '../../../utils/actorLocation';
import type { CentroControlData, EnTransitoItem } from '../../../hooks/useCentroControl';
import type { LayerState } from './ControlFilters';

import { InspectionMapLayer } from '../../inspecciones/InspectionMapLayer';
import { hasInspectionCoordinates, type InspectionOperation } from '../../../services/inspectionOperations.service';
import { MonitorPosition } from '../../monitor/components/MonitorPosition';

// ── Cluster helper ──
function clusterMarkers<T extends { latitud: number; longitud: number }>(
  items: T[],
  zoomThreshold: number
): (T & { count?: number })[] {
  if (items.length < 50 || zoomThreshold > 11) return items;
  const gridSize = 0.05;
  const clusters = new Map<string, { items: T[]; lat: number; lng: number }>();

  for (const item of items) {
    const key = `${Math.round(item.latitud / gridSize)}_${Math.round(item.longitud / gridSize)}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.items.push(item);
      existing.lat = (existing.lat * (existing.items.length - 1) + item.latitud) / existing.items.length;
      existing.lng = (existing.lng * (existing.items.length - 1) + item.longitud) / existing.items.length;
    } else {
      clusters.set(key, { items: [item], lat: item.latitud, lng: item.longitud });
    }
  }

  return Array.from(clusters.values()).map(c => ({
    ...c.items[0],
    latitud: c.lat,
    longitud: c.lng,
    count: c.items.length > 1 ? c.items.length : undefined,
  }));
}

// ── Map helper components ──
function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => onZoom(map.getZoom());
    map.on('zoomend', handler);
    return () => { map.off('zoomend', handler); };
  }, [map, onZoom]);
  return null;
}

/** A marker can be visible near the edge of the scrolling workspace while its
 * popup is hidden behind the app header or bottom navigation. Reveal the open
 * popup only when it is actually clipped; do not move an already readable map. */
function RevealOpenPopup() {
  const map = useMap();
  useEffect(() => {
    let active: L.Popup | null = null;
    let frame = 0;
    const originalWidths = new WeakMap<L.Popup, number>();
    const constrainWidth = () => {
      if (!active) return;
      if (!originalWidths.has(active)) originalWidths.set(active, active.options.maxWidth ?? 300);
      // Leaflet's maxWidth applies to the inner content; reserve space for
      // its margins, popup chrome and map padding as well.
      const width = Math.max(80, Math.min(originalWidths.get(active)!, map.getSize().x - 64));
      if (active.options.maxWidth !== width || active.options.minWidth !== 0) {
        active.options.maxWidth = width;
        active.options.minWidth = 0;
        active.update();
      }
    };
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const popup = active?.getElement();
        const main = popup?.closest('main');
        if (!active?.isOpen() || !popup || !main) return;
        const content = popup.getBoundingClientRect(), workspace = main.getBoundingClientRect();
        const nav = document.querySelector<HTMLElement>('nav[aria-label="Navegación principal"]');
        const fixedNavTop = nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().top : innerHeight;
        const top = Math.max(workspace.top, 0) + 8;
        const bottom = Math.min(workspace.bottom, fixedNavTop, innerHeight) - 8;
        const delta = content.top < top ? content.top - top : content.bottom > bottom ? content.bottom - bottom : 0;
        if (delta) main.scrollBy({ top: delta, behavior: 'auto' });
      });
    };
    const opened = (event: L.PopupEvent) => { active = event.popup; constrainWidth(); reveal(); };
    const closed = () => { active = null; cancelAnimationFrame(frame); };
    const resized = () => { constrainWidth(); reveal(); };
    map.on('popupopen', opened);
    map.on('popupclose', closed);
    map.on('moveend', reveal);
    map.on('resize', resized);
    return () => {
      cancelAnimationFrame(frame);
      map.off('popupopen', opened);
      map.off('popupclose', closed);
      map.off('moveend', reveal);
      map.off('resize', resized);
    };
  }, [map]);
  return null;
}

function FitBounds({ points, animate = true }: { points: [number, number][]; animate?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      if (animate) map.flyTo(points[0], 13, { duration: 0.8 });
      else map.setView(points[0], 13, { animate: false });
    } else {
      map.flyToBounds(L.latLngBounds(points), { padding: [40, 40], duration: 0.8, maxZoom: 14 });
    }
  }, [points, map, animate]);
  return null;
}

interface ViajeRealizado {
  id: string;
  numero: string;
  transportista: string;
  origen: string;
  destino: string;
  origenPos: [number, number] | null;
  destinoPos: [number, number] | null;
  estado: string;
  fechaEntrega: string | null;
}

interface ControlMapProps {
  cc: CentroControlData | null;
  layers: LayerState;
  onToggleLayer: (layer: keyof LayerState) => void;
  mapZoom: number;
  onZoomChange: (z: number) => void;
  enTransitoForMap: EnTransitoItem[];
  selectedTripId: string | null;
  onSelectTrip: (id: string | null) => void;
  selectedRealizadoId: string | null;
  tripPanel: 'activos' | 'realizados' | 'inspecciones' | null;
  inspections: InspectionOperation[];
  selectedInspectionId: string | null;
  onSelectInspection: (id: string) => void;
  viajesRealizados: ViajeRealizado[];
  activeTripFlyPoints: [number, number][];
  panelBoundsPoints: [number, number][];
  realizadoFlyPoints: [number, number][];
  mapColRef: React.RefObject<HTMLDivElement | null>;
}

export const ControlMap: React.FC<ControlMapProps> = ({
  cc,
  layers,
  onToggleLayer,
  mapZoom,
  onZoomChange,
  enTransitoForMap,
  selectedTripId,
  onSelectTrip,
  selectedRealizadoId,
  tripPanel,
  viajesRealizados,
  activeTripFlyPoints,
  panelBoundsPoints,
  realizadoFlyPoints,
  mapColRef,
  inspections,
  selectedInspectionId,
  onSelectInspection,
}) => {
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const carrierLocations = useMemo(() => (cc?.transportistas || []).map(actor => ({
    actor, location: resolveActorLocation(actor),
  })), [cc?.transportistas]);
  const unlocatedCarriers = carrierLocations.filter(item => !item.location.position).length;
  const inspectionFlyPoints = useMemo((): [number, number][] => {
    const selected = layers.inspecciones ? inspections.find((item) => item.id === selectedInspectionId) : undefined;
    return selected && hasInspectionCoordinates(selected) ? [[selected.latitud!, selected.longitud!]] : [];
  }, [inspections, selectedInspectionId, layers.inspecciones]);

  // Clustered generadores
  const generadoresClustered = useMemo(() => {
    if (!cc?.generadores) return [];
    return clusterMarkers(cc.generadores, mapZoom);
  }, [cc?.generadores, mapZoom]);

  return (
    <div ref={mapColRef} className="lg:col-span-2">
      <Card padding="none">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-neutral-900">Mapa de Actividad</h3>
            <Badge variant="soft" color="primary">
              {enTransitoForMap.length} en tránsito
            </Badge>
          </div>
          <div role="group" aria-label="Zoom del mapa" className="flex gap-1">
            <button type="button" aria-label="Acercar mapa" onClick={() => mapRef.current?.zoomIn()} className="grid h-11 w-11 place-items-center rounded-lg border border-neutral-300 bg-white text-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700"><Plus size={18} aria-hidden="true" /></button>
            <button type="button" aria-label="Alejar mapa" onClick={() => mapRef.current?.zoomOut()} className="grid h-11 w-11 place-items-center rounded-lg border border-neutral-300 bg-white text-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700"><Minus size={18} aria-hidden="true" /></button>
            <span className="sr-only" aria-live="polite">Nivel de zoom {mapZoom}</span>
          </div>
        <div role="group" aria-label="Capas del mapa" className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-2 sm:flex sm:flex-wrap">
            <MapLayerToggle category="generador" label="Generadores" pressed={layers.generadores} onToggle={() => onToggleLayer('generadores')} />
            <MapLayerToggle category="transportista" label="Transportistas" pressed={layers.transportistas} onToggle={() => onToggleLayer('transportistas')} />
            <MapLayerToggle category="operador" label="Operadores" pressed={layers.operadores} onToggle={() => onToggleLayer('operadores')} />
            {layers.inspecciones !== undefined && <MapLayerToggle category="inspeccion" label="Inspecciones" pressed={layers.inspecciones} onToggle={() => onToggleLayer('inspecciones')} />}
            <MapLayerToggle category="enTransito" label="En Tránsito" pressed={layers.transito} onToggle={() => onToggleLayer('transito')} />
          </div>
        </div>

        <div className="p-5">
          {layers.transportistas && unlocatedCarriers > 0 && <p className="mb-3 text-sm text-neutral-700">{unlocatedCarriers} {unlocatedCarriers === 1 ? 'transportista sin ubicación verificada' : 'transportistas sin ubicación verificada'}</p>}
          <div className="h-[20rem] sm:h-[28rem] lg:h-[32rem] rounded-xl overflow-hidden border border-neutral-200 relative isolate">
            <MapContainer
              ref={mapRef}
              zoomControl={false}
              fadeAnimation={false}
              center={[-32.9287, -68.8535]}
              zoom={10}
              style={{ height: '100%', width: '100%', zIndex: 0 }}
              className="z-0"
            >
              <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <RevealOpenPopup />
              {layers.inspecciones && <InspectionMapLayer items={inspections} onSelect={onSelectInspection} />}
              {inspectionFlyPoints.length > 0 && <FitBounds points={inspectionFlyPoints} animate={false} />}
              <ZoomTracker onZoom={onZoomChange} />
              {/* Fly to selected active trip (all points) */}
              {activeTripFlyPoints.length > 0 && (
                <FitBounds points={activeTripFlyPoints} />
              )}

              {/* Generadores */}
              {layers.generadores && generadoresClustered.map((g: any, idx: number) => (
                <Marker
                  key={`gen-${g.id}-${idx}`}
                  position={[g.latitud, g.longitud]}
                  icon={g.count ? createClusterIcon(g.count, ACTOR_COLORS.generador) : ACTOR_ICONS.generador}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong className="text-green-700">{g.razonSocial}</strong>
                      {g.count && <span className="text-xs text-neutral-500 ml-1">({g.count} en zona)</span>}
                      <br />
                      <span className="text-xs text-neutral-500">CUIT: {g.cuit}</span><br />
                      <span className="text-xs text-neutral-500">Cat: {g.categoria}</span><br />
                      <span className="text-xs font-medium">Manifiestos: {g.cantManifiestos}</span>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Transportistas */}
              {layers.transportistas && carrierLocations.map(({ actor: t, location }, idx) => location.position && (
                <Marker
                  key={`trans-${t.id}-${idx}`}
                  position={location.position}
                  icon={ACTOR_ICONS.transportista}
                  title={t.razonSocial}
                  alt={'Transportista: ' + t.razonSocial}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong className="text-orange-700">{t.razonSocial}</strong><br />
                      <span className="text-xs text-neutral-500">CUIT: {t.cuit}</span><br />
                      <span className="text-xs text-neutral-700">{location.label}</span><br />
                      <span className="text-xs">Vehículos: {t.vehiculosActivos}</span><br />
                      <span className="text-xs font-medium">En tránsito: {t.enviosEnTransito}</span>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Operadores */}
              {layers.operadores && cc?.operadores?.map((o, idx) => (
                <Marker
                  key={`oper-${o.id}-${idx}`}
                  position={[o.latitud, o.longitud]}
                  icon={ACTOR_ICONS.operador}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong className="text-blue-700">{o.razonSocial}</strong><br />
                      <span className="text-xs text-neutral-500">CUIT: {o.cuit}</span><br />
                      <span className="text-xs text-neutral-500">Cat: {o.categoria}</span><br />
                      <span className="text-xs">Recibidos: {o.cantRecibidos} | Tratados: {o.cantTratados}</span>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* En Tránsito (markers + polylines) */}
              {layers.transito && enTransitoForMap.map((m, idx) => (
                <React.Fragment key={`transit-${m.manifiestoId}-${idx}`}>
                  {m.ultimaPosicion && (
                    <Marker
                      position={[m.ultimaPosicion.latitud, m.ultimaPosicion.longitud]}
                      icon={m.manifiestoId === selectedTripId ? ACTOR_ICONS.enTransitoSelected : ACTOR_ICONS.enTransito}
                      title={`Viaje en tránsito: ${m.numero}`}
                      alt={`Viaje en tránsito: ${m.numero}`}
                      eventHandlers={{ click: () => onSelectTrip(m.manifiestoId) }}
                    >
                      <Popup className="control-trip-popup" minWidth={0} maxWidth={280}>
                        <div className="text-sm">
                          <strong className="block break-words pr-8 text-red-700">{m.numero}</strong>
                          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '11px' }}><strong style={{ color: '#15803d' }}>ORIGEN:</strong> {m.origen}</span>
                            <span style={{ fontSize: '11px' }}><strong style={{ color: '#b45309' }}>TRANSPORTE:</strong> {m.transportista}</span>
                            <span style={{ fontSize: '11px' }}><strong style={{ color: '#1d4ed8' }}>OPERADOR:</strong> {m.destino}</span>
                          </div>
                          <div className="mt-2"><MonitorPosition position={m.ultimaPosicion} /></div>
                          {m.canViewDetail === true ? <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/manifiestos/${m.manifiestoId}`);
                            }}
                            className="control-trip-detail mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700"
                          >
                            Ver detalle
                          </a> : <p className="mt-2 text-xs text-neutral-600">Vista operativa · expediente restringido</p>}
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  {m.ruta.length > 1 && (
                    <Polyline
                      positions={m.ruta.map(p => [p.lat, p.lng] as [number, number])}
                      color="#ef4444"
                      weight={3}
                      opacity={0.6}
                      dashArray="8 4"
                    />
                  )}
                </React.Fragment>
              ))}

              {/* Selected active trip: origin/destination markers */}
              {layers.transito && tripPanel === 'activos' && selectedTripId && (() => {
                const trip = enTransitoForMap.find(m => m.manifiestoId === selectedTripId);
                if (!trip) return null;
                return (
                  <>
                    {trip.origenLatLng && (
                      <Marker position={trip.origenLatLng} icon={ACTOR_ICONS.generador}>
                        <Popup><strong>Origen:</strong> {trip.origen}</Popup>
                      </Marker>
                    )}
                    {trip.destinoLatLng && (
                      <Marker position={trip.destinoLatLng} icon={ACTOR_ICONS.operador}>
                        <Popup><strong>Destino:</strong> {trip.destino}</Popup>
                      </Marker>
                    )}
                    {trip.origenLatLng && trip.destinoLatLng && (
                      <Polyline
                        positions={[trip.origenLatLng, trip.destinoLatLng]}
                        pathOptions={{ color: '#6366f1', weight: 2, dashArray: '8 8', opacity: 0.7 }}
                      />
                    )}
                  </>
                );
              })()}

              {/* Viajes Realizados markers */}
              {tripPanel === 'realizados' && viajesRealizados.map((m: any) => {
                if (!m.origenPos && !m.destinoPos) return null;
                const isSelected = m.id === selectedRealizadoId;
                return (
                  <React.Fragment key={`realizado-${m.id}`}>
                    {m.origenPos && (
                      <Marker position={m.origenPos} icon={ACTOR_ICONS.generador}>
                        <Popup>
                          <div className="text-sm">
                            <strong className="text-green-700">Origen</strong><br />
                            {m.origen}<br />
                            <span className="text-xs text-neutral-500">{m.numero}</span>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    {m.destinoPos && (
                      <Marker position={m.destinoPos} icon={ACTOR_ICONS.operador}>
                        <Popup>
                          <div className="text-sm">
                            <strong className="text-blue-700">Destino</strong><br />
                            {m.destino}<br />
                            <span className="text-xs text-neutral-500">{m.numero}</span>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    {m.origenPos && m.destinoPos && (
                      <Polyline
                        positions={[m.origenPos, m.destinoPos]}
                        pathOptions={{
                          color: isSelected ? '#6366f1' : '#94a3b8',
                          weight: isSelected ? 3 : 1.5,
                          dashArray: '8 6',
                          opacity: isSelected ? 0.9 : 0.4,
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}

              {/* Auto-fit map bounds on panel switch */}
              {!selectedTripId && !selectedRealizadoId && panelBoundsPoints.length > 0 && (
                <FitBounds points={panelBoundsPoints} />
              )}

              {/* Fly to selected realizado trip */}
              {realizadoFlyPoints.length > 0 && (
                <FitBounds points={realizadoFlyPoints} />
              )}
            </MapContainer>

            {!cc && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[400]">
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <RefreshCw size={16} className="animate-spin" /> Cargando datos...
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

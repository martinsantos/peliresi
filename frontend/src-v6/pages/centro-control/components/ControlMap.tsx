/**
 * CentroControl — Leaflet Map with all layers, markers, polylines
 */
import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '../../../components/ui/CardV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { ACTOR_ICONS, ACTOR_COLORS, createClusterIcon } from '../../../utils/map-icons';
import type { CentroControlData, EnTransitoItem } from '../../../hooks/useCentroControl';
import type { LayerState } from './ControlFilters';

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

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.flyTo(points[0], 13, { duration: 0.8 });
    } else {
      map.flyToBounds(L.latLngBounds(points), { padding: [40, 40], duration: 0.8, maxZoom: 14 });
    }
  }, [points, map]);
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
  mapZoom: number;
  onZoomChange: (z: number) => void;
  enTransitoForMap: EnTransitoItem[];
  selectedTripId: string | null;
  onSelectTrip: (id: string | null) => void;
  selectedRealizadoId: string | null;
  tripPanel: 'activos' | 'realizados';
  viajesRealizados: ViajeRealizado[];
  activeTripFlyPoints: [number, number][];
  panelBoundsPoints: [number, number][];
  realizadoFlyPoints: [number, number][];
  mapColRef: React.RefObject<HTMLDivElement | null>;
}

export const ControlMap: React.FC<ControlMapProps> = ({
  cc,
  layers,
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
}) => {
  const navigate = useNavigate();

  // Clustered generadores
  const generadoresClustered = useMemo(() => {
    if (!cc?.generadores) return [];
    return clusterMarkers(cc.generadores, mapZoom);
  }, [cc?.generadores, mapZoom]);

  return (
    <div ref={mapColRef} className="lg:col-span-2">
      <Card padding="none">
        <div className="flex items-center justify-between p-5 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-neutral-900">Mapa de Actividad</h3>
            <Badge variant="soft" color="primary">
              {enTransitoForMap.length} en tránsito
            </Badge>
          </div>
          {/* Map legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: ACTOR_COLORS.generador }} /> Generadores</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: ACTOR_COLORS.transportista, transform: 'rotate(45deg)' }} /> Transportistas</span>
            <span className="flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,1 13,4 13,10 7,13 1,10 1,4" fill={ACTOR_COLORS.operador}/></svg> Operadores</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: ACTOR_COLORS.enTransito }} /> En Tránsito</span>
          </div>
        </div>
        <div className="p-5">
          <div className="h-[20rem] sm:h-[28rem] lg:h-[32rem] rounded-xl overflow-hidden border border-neutral-200 relative isolate">
            <MapContainer
              center={[-32.9287, -68.8535]}
              zoom={10}
              style={{ height: '100%', width: '100%', zIndex: 0 }}
              className="z-0"
            >
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
              {layers.transportistas && cc?.transportistas?.filter(t => t.latitud != null && t.longitud != null).map((t, idx) => (
                <Marker
                  key={`trans-${t.id}-${idx}`}
                  position={[t.latitud!, t.longitud!]}
                  icon={ACTOR_ICONS.transportista}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong className="text-orange-700">{t.razonSocial}</strong><br />
                      <span className="text-xs text-neutral-500">CUIT: {t.cuit}</span><br />
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
                      eventHandlers={{ click: () => onSelectTrip(m.manifiestoId) }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong className="text-red-700">{m.numero}</strong>
                          {m.ultimaPosicion.velocidad != null && (
                            <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>{Math.round(m.ultimaPosicion.velocidad)} km/h</span>
                          )}
                          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '11px' }}><strong style={{ color: '#15803d' }}>ORIGEN:</strong> {m.origen}</span>
                            <span style={{ fontSize: '11px' }}><strong style={{ color: '#b45309' }}>TRANSPORTE:</strong> {m.transportista}</span>
                            <span style={{ fontSize: '11px' }}><strong style={{ color: '#1d4ed8' }}>OPERADOR:</strong> {m.destino}</span>
                          </div>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/manifiestos/${m.manifiestoId}`);
                            }}
                            style={{ color: '#0D8A4F', fontWeight: 600, fontSize: '12px', display: 'block', marginTop: '6px' }}
                          >
                            Ver detalle
                          </a>
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
              {tripPanel === 'activos' && selectedTripId && (() => {
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

            {/* Mobile legend */}
            <div className="sm:hidden absolute bottom-20 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-[400] text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: ACTOR_COLORS.generador }} /> Gen</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: ACTOR_COLORS.transportista, transform: 'rotate(45deg)' }} /> Trans</span>
                <span className="flex items-center gap-1"><svg width="11" height="11" viewBox="0 0 14 14"><polygon points="7,1 13,4 13,10 7,13 1,10 1,4" fill={ACTOR_COLORS.operador}/></svg> Oper</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: ACTOR_COLORS.enTransito }} /> Tránsito</span>
              </div>
            </div>

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

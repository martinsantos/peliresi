/**
 * WarRoomMap — Leaflet map with event-driven playback camera + floating info tooltip
 * LIVE mode: shows all actors (generadores, transportistas, operadores) + enTransito trucks
 * PLAYBACK mode: HIDES static actors, shows only event action (trips, flashes, camera follows)
 */

import { InspectionMapLayer } from '../../inspecciones/InspectionMapLayer';
import type { InspectionOperation } from '../../../services/inspectionOperations.service';
import React, { useMemo, useEffect, useRef, memo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import type { MonitorMode } from '../WarRoomPage';
import type { ActorPosition, EnTransitoItem } from '../api/monitor-api';
import {
  createGeneradorIcon,
  createTransportistaIcon,
  createOperadorIcon,
} from '../utils/war-room-icons';
import { EVENT_COLORS } from '../utils/war-room-icons';
import { ACTOR_ICONS } from '../../../utils/map-icons';
import { MapCategorySymbol, type MapCategory } from '../../../components/ui/MapLayerToggle';
import { MonitorPopupBounds } from './MonitorPopupBounds';

// Keep the Monitor on the same keyless base map already used by SITREP's
// other map views. The former CARTO endpoint now paints API KEY REQUIRED.
const MAP_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; OpenStreetMap contributors';
const MENDOZA_CENTER: [number, number] = [-32.9287, -68.8535];
const MAX_GENERADORES = 50;

const POPUP_LABELS = { generador: 'Generador', transportista: 'Transportista', operador: 'Operador', enTransito: 'En tránsito' };
/** One bounded live detail; identity is the shared symbol, not a colored title strip. */
function LivePopup({ category, name, children }: { category: Exclude<MapCategory, 'inspeccion'>; name: string; children: React.ReactNode }) {
  return <section data-testid="monitor-live-popup" aria-label={`${POPUP_LABELS[category]} ${name}`} tabIndex={0}
    style={{ width: 'min(240px, calc(100vw - 96px))', minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, lineHeight: 1.5, color: '#374151' }}
    className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
    <header style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 24, paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
      <MapCategorySymbol category={category} />
      <strong style={{ fontSize: 12, color: '#262626' }}>{POPUP_LABELS[category]}</strong>
    </header>
    {children}
  </section>;
}

const ADDRESS_STYLE: React.CSSProperties = { fontSize: 12, color: '#4b5563', marginTop: 6, whiteSpace: 'normal', overflowWrap: 'anywhere' };

function tripPopup(id: string, points: number): HTMLElement {
  const content = document.createElement('div');
  content.style.cssText = 'color:#262626;font:13px/1.5 Inter,system-ui,sans-serif;overflow-wrap:anywhere';
  const heading = document.createElement('strong');
  heading.textContent = 'EN TRÁNSITO';
  heading.style.cssText = 'display:block;color:#b91c1c';
  const detail = document.createElement('div');
  detail.textContent = `${id.slice(0, 10).toUpperCase()} · ${points} puntos GPS`;
  content.append(heading, detail);
  return content;
}

// ─── PlaybackCamera — pan suave solo si el evento está fuera del viewport ────
function PlaybackCamera({ currentEvent }: { currentEvent: { lat: number; lng: number } | null }) {
  const map = useMap();
  const prevRef = useRef('');

  useEffect(() => {
    if (!currentEvent) return;
    const key = `${currentEvent.lat.toFixed(4)},${currentEvent.lng.toFixed(4)}`;
    if (key === prevRef.current) return;
    prevRef.current = key;

    const pt = L.latLng(currentEvent.lat, currentEvent.lng);
    const bounds = map.getBounds();
    // Solo mover si el evento está fuera del viewport actual
    if (!bounds.contains(pt)) {
      map.panTo(pt, { animate: true, duration: 0.5, easeLinearity: 0.5 });
    }
  }, [currentEvent, map]);

  return null;
}

// One selectable marker per trip; details open on demand, never competing labels.
function PlaybackLayer({ trips }: {
  trips: Map<string, { lat: number; lng: number; trail: [number, number][] }>;
}) {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  // Trail: múltiples segmentos por trip (gradiente de opacidad)
  const polylinesRef = useRef<Map<string, L.Polyline[]>>(new Map());

  useEffect(() => {
    const currentIds = new Set(trips.keys());

    // Remove stale
    markersRef.current.forEach((m, id) => { if (!currentIds.has(id)) { map.removeLayer(m); markersRef.current.delete(id); } });
    polylinesRef.current.forEach((segs, id) => {
      if (!currentIds.has(id)) { segs.forEach(p => map.removeLayer(p)); polylinesRef.current.delete(id); }
    });

    trips.forEach((trip, id) => {
      const pos: L.LatLngExpression = [trip.lat, trip.lng];

      // Truck marker
      let marker = markersRef.current.get(id);
      if (marker) {
        marker.setLatLng(pos);
        marker.setPopupContent(tripPopup(id, trip.trail.length));
      } else {
        marker = L.marker(pos, { icon: ACTOR_ICONS.enTransitoSelected, zIndexOffset: 3000,
          keyboard: true, title: 'Viaje en tránsito ' + id.slice(0, 10).toUpperCase(),
          alt: 'Viaje en tránsito ' + id.slice(0, 10).toUpperCase() })
          .bindPopup(tripPopup(id, trip.trail.length), { minWidth: 160, maxWidth: 240, autoPan: true }).addTo(map);
        markersRef.current.set(id, marker);
      }

      // Trail con gradiente de opacidad — 4 segmentos, más opaco en la punta
      const prevSegs = polylinesRef.current.get(id) ?? [];
      prevSegs.forEach(p => map.removeLayer(p));
      const trail = trip.trail;
      const newSegs: L.Polyline[] = [];
      if (trail.length > 1) {
        const n = trail.length;
        const SEGMENTS = 4;
        for (let s = 0; s < SEGMENTS; s++) {
          const from = Math.floor((s / SEGMENTS) * n);
          const to = Math.min(Math.floor(((s + 1) / SEGMENTS) * n) + 1, n);
          const slice = trail.slice(from, to);
          if (slice.length < 2) continue;
          const opacity = 0.10 + (s / (SEGMENTS - 1)) * 0.70;
          const weight = s < 2 ? 2 : 4;
          newSegs.push(L.polyline(slice, { color: '#DC2626', weight, opacity }).addTo(map));
        }
      }
      polylinesRef.current.set(id, newSegs);

    });
  }, [trips, map]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => map.removeLayer(m));
      polylinesRef.current.forEach(segs => segs.forEach(p => map.removeLayer(p)));
      markersRef.current.clear();
      polylinesRef.current.clear();
    };
  }, [map]);

  return null;
}

// Event details already live in the selectable current-event control and feed.
// Keep only the territorial flash, and cancel owned animation work on reset/exit.
// Tracks shown events by ID. Clears shownRef when events list shrinks (new day).
function EventFlash({ events }: { events: Array<{ lat: number; lng: number; tipo: string; id: string; numero?: string; desc?: string }> }) {
  const map = useMap();
  // FIFO bounded set (max 200): shownIdsRef tracks order, shownSetRef for O(1) lookup
  const shownIdsRef = useRef<string[]>([]);
  const shownSetRef = useRef<Set<string>>(new Set());
  const prevCountRef = useRef(0);
  const pendingFramesRef = useRef<Set<number>>(new Set());
  const pendingMarkersRef = useRef<Set<L.Layer>>(new Set());

  // Clear state when events list shrinks (new day / reset)
  useEffect(() => {
    if (events.length < prevCountRef.current) {
      shownIdsRef.current = [];
      shownSetRef.current.clear();
      pendingMarkersRef.current.forEach(m => map.removeLayer(m));
      pendingMarkersRef.current.clear();
      pendingFramesRef.current.forEach(frame => cancelAnimationFrame(frame));
      pendingFramesRef.current.clear();
    }
    prevCountRef.current = events.length;
  }, [events.length, map]);

  useEffect(() => {
    for (const ev of events) {
      if (shownSetRef.current.has(ev.id)) continue;
      // Add to FIFO bounded set
      shownSetRef.current.add(ev.id);
      shownIdsRef.current.push(ev.id);
      if (shownIdsRef.current.length > 200) {
        shownSetRef.current.delete(shownIdsRef.current.shift()!);
      }

      const color = EVENT_COLORS[ev.tipo] || '#94a3b8';

      // Expanding circle
      const circle = L.circleMarker([ev.lat, ev.lng], {
        radius: 20, color, fillColor: color, fillOpacity: 0.4, weight: 3, opacity: 0.8,
      }).addTo(map);
      pendingMarkersRef.current.add(circle);

      let frame = 0;
      const scheduleFrame = () => {
        const handle = requestAnimationFrame(() => {
          pendingFramesRef.current.delete(handle);
          animateCircle();
        });
        pendingFramesRef.current.add(handle);
      };
      const animateCircle = () => {
        if (!pendingMarkersRef.current.has(circle)) return;
        frame++;
        circle.setRadius(20 + frame * 2);
        circle.setStyle({ opacity: Math.max(0, 0.8 - frame * 0.04), fillOpacity: Math.max(0, 0.4 - frame * 0.02) });
        if (frame < 25) {
          scheduleFrame();
        } else {
          map.removeLayer(circle);
          pendingMarkersRef.current.delete(circle);
        }
      };
      scheduleFrame();
    }
    // (FIFO eviction above — no hard-clear needed)
  }, [events, map]);

  // Cleanup on unmount — no detached map animations survive navigation.
  useEffect(() => {
    return () => {
      pendingMarkersRef.current.forEach(m => map.removeLayer(m));
      pendingMarkersRef.current.clear();
      pendingFramesRef.current.forEach(frame => cancelAnimationFrame(frame));
      pendingFramesRef.current.clear();
    };
  }, [map]);

  return null;
}

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  inspections?: InspectionOperation[];
  cinemaMode: boolean;
  actores: { generadores: ActorPosition[]; transportistas: ActorPosition[]; operadores: ActorPosition[] } | null;
  enTransito: EnTransitoItem[];
  mode: MonitorMode;
  currentHour?: number; // 0–23 — para overlay día/noche en PLAYBACK
  // Playback-specific
  playbackTrips?: Map<string, { lat: number; lng: number; trail: [number, number][] }>;
  currentEvent?: { lat: number; lng: number; tipo: string; manifiestoNumero: string } | null;
  playbackEvents?: Array<{ id: string; tipo: string; lat: number; lng: number; numero?: string }>;
}

export const WarRoomMap: React.FC<Props> = ({ inspections = [], cinemaMode, actores, enTransito, mode, currentHour, playbackTrips, currentEvent, playbackEvents }) => {

  // Overlay día/noche — sutil, máx opacity 0.12
  const dayOverlayColor = useMemo(() => {
    if (currentHour === undefined || mode !== 'PLAYBACK') return null;
    if (currentHour >= 0  && currentHour < 6)  return 'rgba(20,40,80,0.12)';
    if (currentHour >= 6  && currentHour < 10) return 'rgba(255,200,100,0.08)';
    if (currentHour >= 10 && currentHour < 17) return null;
    if (currentHour >= 17 && currentHour < 20) return 'rgba(255,120,50,0.08)';
    return 'rgba(20,40,80,0.12)';
  }, [currentHour, mode]);

  const visibleGeneradores = useMemo(() => {
    if (!actores?.generadores) return [];
    return actores.generadores.filter(g => g.lat && g.lng).slice(0, MAX_GENERADORES);
  }, [actores?.generadores]);

  const flashEvents = useMemo(() => {
    if (!playbackEvents) return [];
    return playbackEvents.filter(e => e.lat && e.lng).slice(0, 30)
      .map(e => ({ lat: e.lat, lng: e.lng, tipo: e.tipo, id: e.id, numero: e.numero }));
  }, [playbackEvents]);

  const prominentIcon = ACTOR_ICONS.enTransitoSelected;

  return (
    <div className="relative w-full h-full">
    <MapContainer center={MENDOZA_CENTER} zoom={10} className="w-full h-full" zoomControl={false}>
      {mode === 'LIVE' && <MonitorPopupBounds />}
      {mode === 'LIVE' && <InspectionMapLayer items={inspections} />}
      <TileLayer url={MAP_TILES} attribution={ATTRIBUTION} />

      {/* PLAYBACK: camera + imperative trucks + event flashes */}
      {mode === 'PLAYBACK' && (
        <>
          <PlaybackCamera currentEvent={currentEvent || null} />
          <PlaybackLayer trips={playbackTrips || new Map()} />
          <EventFlash events={flashEvents} />
        </>
      )}

      {/* Only show static actors when NOT in playback mode */}
      {mode !== 'PLAYBACK' && (
        <>
          {/* Generadores — low z */}
          {visibleGeneradores.map(g => (
            <Marker key={`gen-${g.id}`} position={[g.lat!, g.lng!]} icon={createGeneradorIcon()} zIndexOffset={-1000} title={`Generador: ${g.razonSocial}`} alt={`Generador: ${g.razonSocial}`}>
              <Popup minWidth={0} maxWidth={280} maxHeight={220} autoPanPadding={[12, 12]}>
                <LivePopup category="generador" name={g.razonSocial}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b', marginBottom: 2 }}>{g.razonSocial}</div>
                  {g.cuit && <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280', marginBottom: 6 }}>CUIT {g.cuit}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                    {g.categoria && (
                      <div style={{ background: '#f5f3ff', padding: '4px 6px', borderRadius: 4 }}>
                        <div style={{ color: '#7c3aed', fontWeight: 700 }}>Categoria</div>
                        <div style={{ color: '#374151' }}>{g.categoria}</div>
                      </div>
                    )}
                    {g.numeroInscripcion && (
                      <div style={{ background: '#f5f3ff', padding: '4px 6px', borderRadius: 4 }}>
                        <div style={{ color: '#7c3aed', fontWeight: 700 }}>Inscripcion</div>
                        <div style={{ color: '#374151', fontFamily: 'monospace' }}>{g.numeroInscripcion}</div>
                      </div>
                    )}
                    {g.cantManifiestos != null && (
                      <div style={{ background: '#f5f3ff', padding: '4px 6px', borderRadius: 4 }}>
                        <div style={{ color: '#7c3aed', fontWeight: 700 }}>Manifiestos</div>
                        <div style={{ color: '#374151', fontWeight: 600 }}>{g.cantManifiestos}</div>
                      </div>
                    )}
                    <div style={{ background: '#f5f3ff', padding: '4px 6px', borderRadius: 4 }}>
                      <div style={{ color: '#7c3aed', fontWeight: 700 }}>Coord</div>
                      <div style={{ color: '#374151', fontFamily: 'monospace' }}>{g.lat!.toFixed(3)},{g.lng!.toFixed(3)}</div>
                    </div>
                  </div>
                  {g.domicilio && <div style={ADDRESS_STYLE}>{g.domicilio}</div>}
                </LivePopup>
              </Popup>
            </Marker>
          ))}

          {/* Transportistas — low z */}
          {actores?.transportistas.filter(t => t.lat && t.lng).map(t => (
            <Marker key={`trans-${t.id}`} position={[t.lat!, t.lng!]} icon={createTransportistaIcon()} zIndexOffset={-800} title={`Transportista: ${t.razonSocial}`} alt={`Transportista: ${t.razonSocial}`}>
              <Popup minWidth={0} maxWidth={280} maxHeight={220} autoPanPadding={[12, 12]}>
                <LivePopup category="transportista" name={t.razonSocial}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b', marginBottom: 2 }}>{t.razonSocial}</div>
                  {t.cuit && <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280', marginBottom: 6 }}>CUIT {t.cuit}</div>}
                  {t.domicilio && <div style={{ ...ADDRESS_STYLE, marginBottom: 6 }}>{t.domicilio}</div>}
                  {t.vehiculos && t.vehiculos.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#9a3412', marginBottom: 2 }}>Vehículos</div>
                      {t.vehiculos.slice(0, 3).map((v, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#374151', fontFamily: 'monospace' }}>
                          {v.patente} <span style={{ color: '#4b5563', fontFamily: 'Inter, system-ui, sans-serif' }}>{v.tipo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {t.choferes && t.choferes.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#9a3412', marginBottom: 2 }}>Choferes</div>
                      {t.choferes.slice(0, 3).map((c, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#374151' }}>{c.nombre}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4, fontSize: 11 }}>
                    <div style={{ background: '#fffbeb', padding: '4px 6px', borderRadius: 4 }}>
                      <div style={{ color: '#9a3412', fontWeight: 700 }}>Coord</div>
                      <div style={{ color: '#374151', fontFamily: 'monospace' }}>{t.lat!.toFixed(3)},{t.lng!.toFixed(3)}</div>
                    </div>
                  </div>
                </LivePopup>
              </Popup>
            </Marker>
          ))}

          {/* Operadores — low z */}
          {actores?.operadores.filter(o => o.lat && o.lng).map(o => (
            <Marker key={`oper-${o.id}`} position={[o.lat!, o.lng!]} icon={createOperadorIcon()} zIndexOffset={-900} title={`Operador: ${o.razonSocial}`} alt={`Operador: ${o.razonSocial}`}>
              <Popup minWidth={0} maxWidth={280} maxHeight={220} autoPanPadding={[12, 12]}>
                <LivePopup category="operador" name={o.razonSocial}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b', marginBottom: 2 }}>{o.razonSocial}</div>
                  {o.cuit && <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280', marginBottom: 4 }}>CUIT {o.cuit}</div>}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, marginBottom: 6 }}>
                    {o.categoria && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: 3 }}>{o.categoria}</span>
                    )}
                    {o.modalidades && o.modalidades.map((m, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 700, background: m === 'IN_SITU' ? '#fef3c7' : '#e0e7ff', color: m === 'IN_SITU' ? '#92400e' : '#3730a3', padding: '2px 6px', borderRadius: 3 }}>{m}</span>
                    ))}
                  </div>
                  {o.tratamientos && o.tratamientos.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' as const, marginBottom: 2 }}>Tratamientos</div>
                      {o.tratamientos.slice(0, 3).map((t, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#374151', paddingLeft: 8, borderLeft: '2px solid #93c5fd' }}>{t}</div>
                      ))}
                      {o.tratamientos.length > 3 && <div style={{ fontSize: 12, color: '#4b5563', paddingLeft: 8 }}>+{o.tratamientos.length - 3} más</div>}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                    {o.cantManifiestos != null && (
                      <div style={{ background: '#eff6ff', padding: '4px 6px', borderRadius: 4 }}>
                        <div style={{ color: '#2563EB', fontWeight: 700 }}>Recibidos</div>
                        <div style={{ color: '#374151', fontWeight: 600 }}>{o.cantManifiestos}</div>
                      </div>
                    )}
                    <div style={{ background: '#eff6ff', padding: '4px 6px', borderRadius: 4 }}>
                      <div style={{ color: '#2563EB', fontWeight: 700 }}>Coord</div>
                      <div style={{ color: '#374151', fontFamily: 'monospace' }}>{o.lat!.toFixed(3)},{o.lng!.toFixed(3)}</div>
                    </div>
                  </div>
                  {o.domicilio && <div style={ADDRESS_STYLE}>{o.domicilio}</div>}
                </LivePopup>
              </Popup>
            </Marker>
          ))}
        </>
      )}

      {/* LIVE mode: enTransito trucks */}
      {mode !== 'PLAYBACK' && enTransito.map(trip => {
        const lastPos = trip.ultimaPosicion;
        const routePoints = trip.ruta.map(p => [p.lat, p.lng] as [number, number]);
        return (
          <React.Fragment key={`trip-${trip.manifiestoId}`}>
            {routePoints.length > 1 && (
              <Polyline positions={routePoints} pathOptions={{ color: '#EF4444', weight: 3, opacity: 0.7, dashArray: '8 4' }} />
            )}
            {lastPos && (
              <Marker position={[lastPos.latitud, lastPos.longitud]} icon={prominentIcon} zIndexOffset={2000} title={`Viaje en tránsito: ${trip.numero}`} alt={`Viaje en tránsito: ${trip.numero}`}>
                <Popup minWidth={0} maxWidth={280} maxHeight={220} autoPanPadding={[12, 12]}>
                  <LivePopup category="enTransito" name={trip.numero}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{trip.numero}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{trip.transportista}</div>
                    {trip.vehiculo && (
                      <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{trip.vehiculo.patente}</span>
                        <span style={{ color: '#4b5563' }}> {trip.vehiculo.descripcion}</span>
                      </div>
                    )}
                    {trip.chofer && (
                      <div style={{ fontSize: 11, color: '#374151' }}>Chofer: {trip.chofer.nombre}</div>
                    )}
                    {trip.residuos && trip.residuos.length > 0 && (
                      <div style={{ marginTop: 4, marginBottom: 2 }}>
                        {trip.residuos.slice(0, 3).map((r, i) => (
                          <div key={i} style={{ fontSize: 10, color: '#374151', paddingLeft: 6, borderLeft: '2px solid #fca5a5' }}>
                            <span style={{ fontFamily: 'monospace', color: '#6b7280' }}>{r.codigo}</span> {r.nombre} — {r.cantidad} {r.unidad}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                      <div style={{ background: '#fef2f2', padding: '4px 6px', borderRadius: 4 }}>
                        <div style={{ color: '#b91c1c', fontWeight: 700 }}>Velocidad</div>
                        <div style={{ fontFamily: 'monospace' }}>{lastPos.velocidad != null ? `${lastPos.velocidad} km/h` : '—'}</div>
                      </div>
                      <div style={{ background: '#fef2f2', padding: '4px 6px', borderRadius: 4 }}>
                        <div style={{ color: '#b91c1c', fontWeight: 700 }}>GPS</div>
                        <div style={{ fontFamily: 'monospace' }}>{trip.ruta.length} pts</div>
                      </div>
                    </div>
                  </LivePopup>
                </Popup>
              </Marker>
            )}
          </React.Fragment>
        );
      })}
    </MapContainer>
    {/* Overlay día/noche — pointer-events: none, no bloquea interacción con el mapa */}
    {dayOverlayColor && (
      <div className="wr-day-overlay" style={{ backgroundColor: dayOverlayColor }} />
    )}
    </div>
  );
};

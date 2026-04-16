/**
 * WarRoomMap — Leaflet map with event-driven playback camera + floating info tooltip
 * LIVE mode: shows all actors (generadores, transportistas, operadores) + enTransito trucks
 * PLAYBACK mode: HIDES static actors, shows only event action (trips, flashes, camera follows)
 */

import React, { useMemo, useEffect, useRef } from 'react';
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

const VOYAGER_TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; OpenStreetMap &copy; CARTO';
const MENDOZA_CENTER: [number, number] = [-32.9287, -68.8535];
const MAX_GENERADORES = 50;

const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;

function makeTruckIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:48px;height:48px;"><div style="position:absolute;inset:-8px;border-radius:50%;border:3px solid #EF4444;opacity:0.5;animation:wr-ring-pulse 1.5s ease-out infinite;"></div><div style="position:absolute;inset:-16px;border-radius:50%;border:2px solid #EF4444;opacity:0.3;animation:wr-ring-pulse 2s ease-out infinite 0.5s;"></div><div style="width:48px;height:48px;background:#DC2626;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px 4px rgba(239,68,68,0.6),0 4px 12px rgba(0,0,0,0.4);border:3px solid #fff;">${TRUCK_SVG}</div></div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

function makeTooltipIcon(text: string): L.DivIcon {
  // All content is hardcoded strings from our own system — not user input
  return L.divIcon({
    className: '',
    html: `<div style="background:rgba(0,0,0,0.88);color:#fff;padding:6px 10px;border-radius:8px;font-size:11px;font-family:monospace;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.15);pointer-events:none;">${text}</div>`,
    iconSize: [180, 50],
    iconAnchor: [-30, 25],
  });
}

// ─── PlaybackCamera — simplified, follows currentEvent directly ─────────────
function PlaybackCamera({ currentEvent }: { currentEvent: { lat: number; lng: number } | null }) {
  const map = useMap();
  const prevRef = useRef('');

  useEffect(() => {
    if (!currentEvent) return;
    const key = `${currentEvent.lat.toFixed(4)},${currentEvent.lng.toFixed(4)}`;
    if (key === prevRef.current) return;
    prevRef.current = key;
    map.flyTo([currentEvent.lat, currentEvent.lng], 15, { duration: 1.0 });
  }, [currentEvent, map]);

  return null;
}

// ─── Imperative layer: truck markers + trails + floating tooltips ─────────────
function PlaybackLayer({ trips }: {
  trips: Map<string, { lat: number; lng: number; trail: [number, number][] }>;
}) {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const tooltipsRef = useRef<Map<string, L.Marker>>(new Map());
  const truckIconRef = useRef(makeTruckIcon());

  useEffect(() => {
    const currentIds = new Set(trips.keys());

    // Remove stale
    markersRef.current.forEach((m, id) => { if (!currentIds.has(id)) { map.removeLayer(m); markersRef.current.delete(id); } });
    polylinesRef.current.forEach((p, id) => { if (!currentIds.has(id)) { map.removeLayer(p); polylinesRef.current.delete(id); } });
    tooltipsRef.current.forEach((t, id) => { if (!currentIds.has(id)) { map.removeLayer(t); tooltipsRef.current.delete(id); } });

    trips.forEach((trip, id) => {
      const pos: L.LatLngExpression = [trip.lat, trip.lng];
      const shortId = id.slice(0, 10).toUpperCase();

      // Truck marker
      let marker = markersRef.current.get(id);
      if (marker) {
        marker.setLatLng(pos);
      } else {
        marker = L.marker(pos, { icon: truckIconRef.current, zIndexOffset: 3000 }).addTo(map);
        markersRef.current.set(id, marker);
      }

      // Trail polyline
      let pl = polylinesRef.current.get(id);
      if (pl) {
        pl.setLatLngs(trip.trail);
      } else if (trip.trail.length > 1) {
        pl = L.polyline(trip.trail, { color: '#DC2626', weight: 5, opacity: 0.8 }).addTo(map);
        polylinesRef.current.set(id, pl);
      }

      // Floating tooltip
      const tooltipContent = `<span style="font-weight:800;color:#EF4444;">EN TRÁNSITO</span> ${shortId} <span style="color:#9ca3af;">${trip.trail.length}pts</span>`;
      let tt = tooltipsRef.current.get(id);
      if (tt) {
        tt.setLatLng(pos);
        const newIcon = makeTooltipIcon(tooltipContent);
        tt.setIcon(newIcon);
      } else {
        const ttIcon = makeTooltipIcon(tooltipContent);
        tt = L.marker(pos, { icon: ttIcon, zIndexOffset: 4000, interactive: false }).addTo(map);
        tooltipsRef.current.set(id, tt);
      }
    });
  }, [trips, map]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => map.removeLayer(m));
      polylinesRef.current.forEach(p => map.removeLayer(p));
      tooltipsRef.current.forEach(t => map.removeLayer(t));
      markersRef.current.clear();
      polylinesRef.current.clear();
      tooltipsRef.current.clear();
    };
  }, [map]);

  return null;
}

// ─── EventFlash — expanding circle + momentary popup with event info ─────────
// Tracks shown events by ID. Clears shownRef when events list shrinks (new day).
function EventFlash({ events }: { events: Array<{ lat: number; lng: number; tipo: string; id: string; numero?: string; desc?: string }> }) {
  const map = useMap();
  const shownRef = useRef<Set<string>>(new Set());
  const prevCountRef = useRef(0);
  const pendingTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const pendingMarkersRef = useRef<Set<L.Layer>>(new Set());

  // Clear state when events list shrinks (new day / reset)
  useEffect(() => {
    if (events.length < prevCountRef.current) {
      // New day or reset — clear all tracking
      shownRef.current.clear();
      // Remove all pending markers
      pendingMarkersRef.current.forEach(m => map.removeLayer(m));
      pendingMarkersRef.current.clear();
      // Clear all pending timers
      pendingTimersRef.current.forEach(t => clearTimeout(t));
      pendingTimersRef.current.clear();
    }
    prevCountRef.current = events.length;
  }, [events.length, map]);

  useEffect(() => {
    for (const ev of events) {
      if (shownRef.current.has(ev.id)) continue;
      shownRef.current.add(ev.id);

      const color = EVENT_COLORS[ev.tipo] || '#94a3b8';

      // Expanding circle
      const circle = L.circleMarker([ev.lat, ev.lng], {
        radius: 20, color, fillColor: color, fillOpacity: 0.4, weight: 3, opacity: 0.8,
      }).addTo(map);
      pendingMarkersRef.current.add(circle);

      let frame = 0;
      const animateCircle = () => {
        frame++;
        circle.setRadius(20 + frame * 2);
        circle.setStyle({ opacity: Math.max(0, 0.8 - frame * 0.04), fillOpacity: Math.max(0, 0.4 - frame * 0.02) });
        if (frame < 25) {
          requestAnimationFrame(animateCircle);
        } else {
          map.removeLayer(circle);
          pendingMarkersRef.current.delete(circle);
        }
      };
      requestAnimationFrame(animateCircle);

      // Momentary info popup — shows for 3 seconds then removes
      const label = ev.tipo === 'RETIRO' ? 'RETIRO' : ev.tipo === 'ENTREGA' ? 'ENTREGA'
        : ev.tipo === 'RECEPCION' ? 'RECEPCIÓN' : ev.tipo === 'TRATAMIENTO' ? 'TRATAMIENTO'
        : ev.tipo === 'CIERRE' ? 'CIERRE' : ev.tipo === 'FIRMA' ? 'FIRMA'
        : ev.tipo === 'CREACION' ? 'NUEVO' : ev.tipo === 'INCIDENTE' ? 'INCIDENTE' : ev.tipo;

      const popupIcon = L.divIcon({
        className: '',
        html: `<div style="
          background:${color};color:#fff;padding:6px 12px;border-radius:6px;
          font-size:11px;font-weight:800;letter-spacing:0.04em;
          white-space:nowrap;box-shadow:0 4px 16px ${color}80,0 2px 8px rgba(0,0,0,0.3);
          font-family:system-ui,sans-serif;pointer-events:none;
          animation:wr-popup-appear 0.3s ease-out;
          text-transform:uppercase;
        ">
          <span style="margin-right:4px;">${ev.tipo === 'INCIDENTE' ? '⚠' : '●'}</span>
          ${label}${ev.numero ? ' — ' + ev.numero : ''}
        </div>`,
        iconSize: [200, 30],
        iconAnchor: [100, 50],
      });

      const popup = L.marker([ev.lat, ev.lng], { icon: popupIcon, zIndexOffset: 5000, interactive: false }).addTo(map);
      pendingMarkersRef.current.add(popup);

      // Remove after 3 seconds
      const timer = setTimeout(() => {
        map.removeLayer(popup);
        pendingMarkersRef.current.delete(popup);
        pendingTimersRef.current.delete(timer);
      }, 3000);
      pendingTimersRef.current.add(timer);
    }
    if (shownRef.current.size > 500) shownRef.current.clear();
  }, [events, map]);

  // Cleanup on unmount — remove all pending markers and clear timers
  useEffect(() => {
    return () => {
      pendingMarkersRef.current.forEach(m => map.removeLayer(m));
      pendingMarkersRef.current.clear();
      pendingTimersRef.current.forEach(t => clearTimeout(t));
      pendingTimersRef.current.clear();
    };
  }, [map]);

  return null;
}

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  cinemaMode: boolean;
  actores: { generadores: ActorPosition[]; transportistas: ActorPosition[]; operadores: ActorPosition[] } | null;
  enTransito: EnTransitoItem[];
  mode: MonitorMode;
  // Playback-specific
  playbackTrips?: Map<string, { lat: number; lng: number; trail: [number, number][] }>;
  currentEvent?: { lat: number; lng: number; tipo: string; manifiestoNumero: string } | null;
  playbackEvents?: Array<{ id: string; tipo: string; lat: number; lng: number; numero?: string }>;
}

export const WarRoomMap: React.FC<Props> = ({ cinemaMode, actores, enTransito, mode, playbackTrips, currentEvent, playbackEvents }) => {
  const tiles = cinemaMode ? DARK_TILES : VOYAGER_TILES;

  const visibleGeneradores = useMemo(() => {
    if (!actores?.generadores) return [];
    return actores.generadores.filter(g => g.lat && g.lng).slice(0, MAX_GENERADORES);
  }, [actores?.generadores]);

  const flashEvents = useMemo(() => {
    if (!playbackEvents) return [];
    return playbackEvents.filter(e => e.lat && e.lng).slice(0, 30)
      .map(e => ({ lat: e.lat, lng: e.lng, tipo: e.tipo, id: e.id, numero: e.numero }));
  }, [playbackEvents]);

  const prominentIcon = useMemo(() => L.divIcon({
    className: '',
    html: `<div style="position:relative;width:44px;height:44px;"><div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid #EF4444;opacity:0.5;animation:wr-ring-pulse 2s ease-out infinite;"></div><div style="width:44px;height:44px;background:#EF4444;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px 2px rgba(239,68,68,0.5),0 2px 8px rgba(0,0,0,0.3);border:2px solid #fff;">${TRUCK_SVG}</div></div>`,
    iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -24],
  }), []);

  return (
    <MapContainer center={MENDOZA_CENTER} zoom={10} className="w-full h-full" zoomControl={false} attributionControl={false}>
      <TileLayer url={tiles} attribution={ATTRIBUTION} />

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
            <Marker key={`gen-${g.id}`} position={[g.lat!, g.lng!]} icon={createGeneradorIcon()} zIndexOffset={-1000}>
              <Popup maxWidth={300}>
                <div style={{ minWidth: 240, fontFamily: 'sans-serif' }}>
                  <div style={{ background: '#7c3aed', color: '#fff', padding: '8px 12px', margin: '-12px -20px 8px', borderRadius: '4px 4px 0 0', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
                    &#9724; GENERADOR
                  </div>
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
                  {g.domicilio && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{g.domicilio}</div>}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Transportistas — low z */}
          {actores?.transportistas.filter(t => t.lat && t.lng).map(t => (
            <Marker key={`trans-${t.id}`} position={[t.lat!, t.lng!]} icon={createTransportistaIcon()} zIndexOffset={-800}>
              <Popup maxWidth={300}>
                <div style={{ minWidth: 240, fontFamily: 'sans-serif' }}>
                  <div style={{ background: '#D97706', color: '#fff', padding: '8px 12px', margin: '-12px -20px 8px', borderRadius: '4px 4px 0 0', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
                    &#9724; TRANSPORTISTA
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b', marginBottom: 2 }}>{t.razonSocial}</div>
                  {t.cuit && <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280', marginBottom: 6 }}>CUIT {t.cuit}</div>}
                  {t.domicilio && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{t.domicilio}</div>}
                  {t.vehiculos && t.vehiculos.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#D97706', textTransform: 'uppercase' as const, marginBottom: 2 }}>Vehiculos</div>
                      {t.vehiculos.slice(0, 3).map((v, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#374151', fontFamily: 'monospace' }}>
                          {v.patente} <span style={{ color: '#9ca3af', fontFamily: 'sans-serif' }}>{v.tipo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {t.choferes && t.choferes.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#D97706', textTransform: 'uppercase' as const, marginBottom: 2 }}>Choferes</div>
                      {t.choferes.slice(0, 3).map((c, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#374151' }}>{c.nombre}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4, fontSize: 11 }}>
                    <div style={{ background: '#fffbeb', padding: '4px 6px', borderRadius: 4 }}>
                      <div style={{ color: '#D97706', fontWeight: 700 }}>Coord</div>
                      <div style={{ color: '#374151', fontFamily: 'monospace' }}>{t.lat!.toFixed(3)},{t.lng!.toFixed(3)}</div>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Operadores — low z */}
          {actores?.operadores.filter(o => o.lat && o.lng).map(o => (
            <Marker key={`oper-${o.id}`} position={[o.lat!, o.lng!]} icon={createOperadorIcon()} zIndexOffset={-900}>
              <Popup maxWidth={320}>
                <div style={{ minWidth: 260, fontFamily: 'sans-serif' }}>
                  <div style={{ background: '#2563EB', color: '#fff', padding: '8px 12px', margin: '-12px -20px 8px', borderRadius: '4px 4px 0 0', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
                    &#9724; OPERADOR
                  </div>
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
                      {o.tratamientos.length > 3 && <div style={{ fontSize: 10, color: '#9ca3af', paddingLeft: 8 }}>+{o.tratamientos.length - 3} mas</div>}
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
                  {o.domicilio && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{o.domicilio}</div>}
                </div>
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
              <Marker position={[lastPos.latitud, lastPos.longitud]} icon={prominentIcon} zIndexOffset={2000}>
                <Popup maxWidth={320}>
                  <div style={{ minWidth: 260, fontFamily: 'sans-serif' }}>
                    <div style={{ background: '#DC2626', color: '#fff', padding: '8px 12px', margin: '-12px -20px 8px', borderRadius: '4px 4px 0 0', fontWeight: 800, fontSize: 11, letterSpacing: '0.05em' }}>
                      &#9679; EN TR&Aacute;NSITO
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{trip.numero}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{trip.transportista}</div>
                    {trip.vehiculo && (
                      <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{trip.vehiculo.patente}</span>
                        <span style={{ color: '#9ca3af' }}> {trip.vehiculo.descripcion}</span>
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
                        <div style={{ color: '#DC2626', fontWeight: 700 }}>Velocidad</div>
                        <div style={{ fontFamily: 'monospace' }}>{lastPos.velocidad != null ? `${lastPos.velocidad} km/h` : '—'}</div>
                      </div>
                      <div style={{ background: '#fef2f2', padding: '4px 6px', borderRadius: 4 }}>
                        <div style={{ color: '#DC2626', fontWeight: 700 }}>GPS</div>
                        <div style={{ fontFamily: 'monospace' }}>{trip.ruta.length} pts</div>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
};

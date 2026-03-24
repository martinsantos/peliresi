import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers, Eye, EyeOff,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '../../../components/ui/CardV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { ACTOR_ICONS, ACTOR_COLORS, createClusterIcon } from '../../../utils/map-icons';
import { getDepartamento, DEPARTAMENTOS_MENDOZA } from '../../../utils/mendoza-departamentos';
import { clusterMarkers } from './shared';
import type { CentroControlData } from '../../../hooks/useCentroControl';

// ── Geocoding helpers para transportistas sin coords ──

/** Offset determinístico por ID para evitar superposición en mismo centroide */
function hashOffset(seed: string, range: number): number {
  const h = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return ((h % 200) / 200 - 0.5) * 2 * range;
}

const MENDOZA_CAP: [number, number] = [-32.8908, -68.8272];

/** Nivel 1: centroide del departamento inferido desde domicilio + jitter */
function deptFallback(id: string, domicilio?: string): [number, number] {
  if (domicilio) {
    const lower = domicilio.toLowerCase();
    const dept = DEPARTAMENTOS_MENDOZA.find(d => lower.includes(d.nombre.toLowerCase()));
    if (dept) {
      return [
        dept.centro[0] + hashOffset(id, 0.018),
        dept.centro[1] + hashOffset(id + 'lng', 0.018),
      ];
    }
  }
  return [MENDOZA_CAP[0] + hashOffset(id, 0.05), MENDOZA_CAP[1] + hashOffset(id + 'lng', 0.05)];
}

// ── Leaflet default icon fix ──
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function MapaActoresTab({
  ccData,
  onSelectDep,
  incluirTodos = true,
  onToggleIncluirTodos,
}: {
  ccData: CentroControlData | null;
  onSelectDep: (dep: string) => void;
  periodoLabel: string;
  incluirTodos?: boolean;
  onToggleIncluirTodos?: (value: boolean) => void;
}) {
  const navigate = useNavigate();
  const [layers, setLayers] = useState({
    generadores: true,
    transportistas: true,
    operadores: true,
  });

  const toggleLayer = useCallback((layer: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  // Nivel 2: posiciones geocodificadas por Nominatim (mejoran el centroide de forma asíncrona)
  const [geocodedPos, setGeocodedPos] = useState<Record<string, [number, number]>>({});

  useEffect(() => {
    if (!ccData?.transportistas) return;
    const missing = ccData.transportistas.filter(
      t => (t.latitud == null || t.longitud == null) && t.domicilio,
    );
    if (missing.length === 0) return;

    // Cargar desde caché de sesión primero
    const toFetch: typeof missing = [];
    const fromCache: Record<string, [number, number]> = {};
    for (const t of missing) {
      const hit = sessionStorage.getItem(`geo_trans_${t.id}`);
      if (hit) {
        try { fromCache[t.id] = JSON.parse(hit); } catch { toFetch.push(t); }
      } else {
        toFetch.push(t);
      }
    }
    if (Object.keys(fromCache).length > 0) {
      setGeocodedPos(prev => ({ ...prev, ...fromCache }));
    }
    if (toFetch.length === 0) return;

    // Geocodificar con Nominatim — max 1 req/seg (ToS)
    let cancelled = false;
    let idx = 0;
    const next = async () => {
      if (cancelled || idx >= toFetch.length) return;
      const t = toFetch[idx++];
      try {
        const q = encodeURIComponent(`${t.domicilio}, Mendoza, Argentina`);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ar`,
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data) && data.length > 0) {
            const pos: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            sessionStorage.setItem(`geo_trans_${t.id}`, JSON.stringify(pos));
            setGeocodedPos(prev => ({ ...prev, [t.id]: pos }));
          }
        }
      } catch { /* Nominatim falló — centroide de dpto ya visible */ }
      if (!cancelled) setTimeout(next, 1100); // 1 req/seg
    };
    next();
    return () => { cancelled = true; };
  }, [ccData?.transportistas]);

  const generadoresClustered = useMemo(() => {
    if (!ccData?.generadores) return [];
    return clusterMarkers(ccData.generadores as any[]);
  }, [ccData?.generadores]);

  const totalGen = ccData?.generadores?.length || 0;
  const totalTrans = ccData?.transportistas?.length || 0;
  const totalOper = ccData?.operadores?.length || 0;

  if (import.meta.env.DEV) {
    console.debug('[MapaActores] Generadores:', totalGen, 'Transportistas:', totalTrans, 'Operadores:', totalOper, 'incluirTodos:', incluirTodos);
  }

  if (!ccData) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
        <p className="mt-4 text-neutral-600 font-medium">Cargando datos del mapa...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI + Layer toggles + "Todos" toggle — sticky below the date filter bar */}
      <div className="sticky top-[92px] z-10 -mx-4 lg:-mx-8 px-4 lg:px-8 pb-3 bg-[#FAFAF8]">
        <div className="flex flex-wrap items-center gap-3 p-3.5 bg-white rounded-2xl border border-neutral-100 shadow-sm">
          <Layers size={16} className="text-neutral-400" />
          {([
            { key: 'generadores' as const, label: 'Generadores', color: 'bg-purple-500', activeClass: 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm', count: totalGen },
            { key: 'transportistas' as const, label: 'Transportistas', color: 'bg-orange-500', activeClass: 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm', count: totalTrans },
            { key: 'operadores' as const, label: 'Operadores', color: 'bg-blue-500', activeClass: 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm', count: totalOper },
          ]).map(l => (
            <button
              key={l.key}
              onClick={() => toggleLayer(l.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                layers[l.key]
                  ? l.activeClass
                  : 'bg-neutral-50 border-transparent text-neutral-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${layers[l.key] ? l.color : 'bg-neutral-300'}`} />
              <span>{l.label}</span>
              <Badge variant="soft" color="neutral" className="text-[10px] px-1.5 py-0 ml-1">{l.count}</Badge>
              {layers[l.key] ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3 text-xs text-neutral-500">
            {totalGen + totalTrans + totalOper} actores totales
            {onToggleIncluirTodos && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none border-l border-neutral-200 pl-3">
                <span className="text-xs font-medium text-neutral-600">Todos</span>
                <button
                  role="switch"
                  aria-checked={incluirTodos}
                  onClick={() => onToggleIncluirTodos(!incluirTodos)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${incluirTodos ? 'bg-primary-500' : 'bg-neutral-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${incluirTodos ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                </button>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Map */}
      <Card padding="none">
        <div className="p-5">
          <div className="h-[calc(100vh-22rem)] min-h-[28rem] max-h-[52rem] rounded-xl overflow-hidden border border-neutral-200 relative isolate">
            <MapContainer
              center={[-32.9287, -68.8535]}
              zoom={10}
              style={{ height: '100%', width: '100%', zIndex: 0 }}
              className="z-0"
            >
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {/* Generadores */}
              {layers.generadores && generadoresClustered.map((g: any, idx: number) => (
                <Marker
                  key={`gen-${g.id}-${idx}`}
                  position={[g.latitud, g.longitud]}
                  icon={g.count ? createClusterIcon(g.count, ACTOR_COLORS.generador) : ACTOR_ICONS.generador}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong className="text-purple-700">{g.razonSocial}</strong>
                      {g.count && <span className="text-xs text-neutral-500 ml-1">({g.count} en zona)</span>}
                      <br />
                      <span className="text-xs text-neutral-500">CUIT: {g.cuit}</span><br />
                      <span className="text-xs text-neutral-500">Cat: {g.categoria}</span><br />
                      <span className="text-xs font-medium">Manifiestos: {g.cantManifiestos}</span><br />
                      <div className="flex items-center gap-3 mt-1">
                        <button
                          className="text-xs text-primary-600 hover:underline"
                          onClick={() => onSelectDep(getDepartamento(g.latitud, g.longitud))}
                        >
                          Ver departamento
                        </button>
                        {!g.count && (
                          <button
                            className="text-xs text-primary-600 hover:underline font-medium"
                            onClick={() => navigate(`/admin/actores/generadores/${g.id}`)}
                          >
                            Ver detalle →
                          </button>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Transportistas — coords reales > Nominatim geocoded > centroide de dpto */}
              {layers.transportistas && ccData.transportistas?.map((t, idx) => {
                const pos: [number, number] =
                  geocodedPos[t.id] ??
                  (t.latitud != null && t.longitud != null
                    ? [t.latitud, t.longitud] as [number, number]
                    : null) ??
                  deptFallback(t.id, t.domicilio);
                return (
                  <Marker
                    key={`trans-${t.id}-${idx}`}
                    position={pos}
                    icon={ACTOR_ICONS.transportista}
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong className="text-orange-700">{t.razonSocial}</strong><br />
                        <span className="text-xs text-neutral-500">CUIT: {t.cuit}</span><br />
                        {(t as any).localidad && (
                          <span className="text-xs text-neutral-500">📍 {(t as any).localidad}</span>
                        )}
                        {(t as any).vencimientoHabilitacion && (() => {
                          const vto = new Date((t as any).vencimientoHabilitacion);
                          const dias = Math.ceil((vto.getTime() - Date.now()) / 86400000);
                          const emoji = dias <= 0 ? '🔴' : dias <= 30 ? '🟡' : '🟢';
                          return <><br /><span className="text-xs">{emoji} Vto: {vto.toLocaleDateString('es-AR')}</span></>;
                        })()}
                        {(t as any).corrientesAutorizadas && (() => {
                          const corrientes = (t as any).corrientesAutorizadas.split('/').filter(Boolean);
                          const visible = corrientes.slice(0, 3);
                          const resto = corrientes.length - visible.length;
                          return (
                            <><br /><span className="text-xs text-neutral-600">
                              Corrientes: {visible.join(' ')}
                              {resto > 0 ? ` +${resto} más` : ''}
                            </span></>
                          );
                        })()}
                        <br /><span className="text-xs">Vehículos: {t.vehiculosActivos}</span><br />
                        <span className="text-xs font-medium">En tránsito: {t.enviosEnTransito}</span><br />
                        <div className="flex items-center gap-3 mt-1">
                          <button
                            className="text-xs text-primary-600 hover:underline"
                            onClick={() => onSelectDep(getDepartamento(pos[0], pos[1]))}
                          >
                            Ver departamento
                          </button>
                          <button
                            className="text-xs text-primary-600 hover:underline font-medium"
                            onClick={() => navigate(`/admin/actores/transportistas/${t.id}`)}
                          >
                            Ver detalle →
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Operadores */}
              {layers.operadores && ccData.operadores?.map((o, idx) => (
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
                      <span className="text-xs">Recibidos: {o.cantRecibidos} | Tratados: {o.cantTratados}</span><br />
                      <div className="flex items-center gap-3 mt-1">
                        <button
                          className="text-xs text-primary-600 hover:underline"
                          onClick={() => onSelectDep(getDepartamento(o.latitud, o.longitud))}
                        >
                          Ver departamento
                        </button>
                        <button
                          className="text-xs text-primary-600 hover:underline font-medium"
                          onClick={() => navigate(`/admin/actores/operadores/${o.id}`)}
                        >
                          Ver detalle →
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Legend overlay */}
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-[400] text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Generadores</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Transportistas</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Operadores</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

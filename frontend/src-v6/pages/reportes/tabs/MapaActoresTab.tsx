import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers, Eye, EyeOff, Download, FileDown, Printer,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '../../../components/ui/CardV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { ACTOR_ICONS, ACTOR_COLORS, createClusterIcon } from '../../../utils/map-icons';
import { getDepartamento, DEPARTAMENTOS_MENDOZA } from '../../../utils/mendoza-departamentos';
import { clusterMarkers, downloadCsv } from './shared';
import { exportReportePDF } from '../../../utils/exportPdf';
import type { CentroControlData, ActorTransportista } from '../../../hooks/useCentroControl';

// ActorTransportista may carry additional fields from the backend not declared in the hook type
type ActorTransportistaExtra = ActorTransportista & {
  localidad?: string;
  vencimientoHabilitacion?: string;
  corrientesAutorizadas?: string;
};

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

/** Helper: fly map to a target position when it changes */
function FlyToTarget({ target, zoom }: { target: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, zoom, { duration: 1.2 });
  }, [map, target, zoom]);
  return null;
}

export default function MapaActoresTab({
  ccData,
  onSelectDep,
  periodoLabel = '',
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
    operadoresFijos: true,
    operadoresInSitu: true,
  });
  const [selectedDep, setSelectedDep] = useState('');

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
    return clusterMarkers(ccData.generadores);
  }, [ccData?.generadores]);

  const totalGen = ccData?.generadores?.length || 0;
  const totalTrans = ccData?.transportistas?.length || 0;
  const operadoresFijos = useMemo(() =>
    (ccData?.operadores || []).filter((o: any) => {
      const mods: string[] = o.modalidades || [];
      return mods.includes('FIJO') || mods.length === 0;
    }), [ccData?.operadores]);
  const operadoresInSitu = useMemo(() =>
    (ccData?.operadores || []).filter((o: any) => {
      const mods: string[] = o.modalidades || [];
      return mods.includes('IN_SITU');
    }), [ccData?.operadores]);
  const totalOper = ccData?.operadores?.length || 0;

  // Departamento filter — client-side via getDepartamento()
  const filterByDep = useCallback(<T extends { latitud: number; longitud: number }>(items: T[]): T[] => {
    if (!selectedDep) return items;
    return items.filter(item => item.latitud && item.longitud && getDepartamento(item.latitud, item.longitud) === selectedDep);
  }, [selectedDep]);

  const flyTarget = useMemo((): [number, number] | null => {
    if (!selectedDep) return null;
    const dep = DEPARTAMENTOS_MENDOZA.find(d => d.nombre === selectedDep);
    return dep ? dep.centro as [number, number] : null;
  }, [selectedDep]);

  // Filtered counts for badges
  const filteredGen = useMemo(() => filterByDep(ccData?.generadores || []), [filterByDep, ccData?.generadores]);
  const filteredTrans = useMemo(() => filterByDep(ccData?.transportistas?.filter(t => t.latitud != null && t.longitud != null) as any[] || []), [filterByDep, ccData?.transportistas]);
  const filteredOpFijos = useMemo(() => filterByDep(operadoresFijos as any[]), [filterByDep, operadoresFijos]);
  const filteredOpInSitu = useMemo(() => filterByDep(operadoresInSitu as any[]), [filterByDep, operadoresInSitu]);
  const filteredGenClustered = useMemo(() => {
    if (!selectedDep) return generadoresClustered;
    return clusterMarkers(filteredGen);
  }, [selectedDep, filteredGen, generadoresClustered]);

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
          {/* Departamento filter */}
          <select
            value={selectedDep}
            onChange={e => setSelectedDep(e.target.value)}
            className="h-8 px-2 pr-7 text-xs border border-neutral-200 rounded-lg bg-white text-neutral-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-200 outline-none"
          >
            <option value="">Todos los deptos.</option>
            {DEPARTAMENTOS_MENDOZA.map(d => (
              <option key={d.nombre} value={d.nombre}>{d.nombre}</option>
            ))}
          </select>
          <span className="w-px h-5 bg-neutral-200" />
          {([
            { key: 'generadores' as const, label: 'Generadores', color: 'bg-purple-500', activeClass: 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm', count: selectedDep ? filteredGen.length : totalGen },
            { key: 'transportistas' as const, label: 'Transportistas', color: 'bg-orange-500', activeClass: 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm', count: selectedDep ? filteredTrans.length : totalTrans },
            { key: 'operadoresFijos' as const, label: 'Op. Fijos', color: 'bg-blue-500', activeClass: 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm', count: selectedDep ? filteredOpFijos.length : operadoresFijos.length },
            { key: 'operadoresInSitu' as const, label: 'Op. In Situ', color: 'bg-emerald-500', activeClass: 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm', count: selectedDep ? filteredOpInSitu.length : operadoresInSitu.length },
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
            {totalGen + totalTrans + totalOper} actores ({totalOper} operadores)
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
              <FlyToTarget target={flyTarget} zoom={12} />

              {/* Generadores */}
              {layers.generadores && filteredGenClustered.map((g: any, idx: number) => (
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
              {layers.transportistas && ccData.transportistas?.filter(tRaw => {
                if (!selectedDep) return true;
                const t = tRaw as ActorTransportistaExtra;
                const p = geocodedPos[t.id] ?? (t.latitud != null && t.longitud != null ? [t.latitud, t.longitud] as [number, number] : null) ?? deptFallback(t.id, t.domicilio);
                return getDepartamento(p[0], p[1]) === selectedDep;
              }).map((tRaw, idx) => {
                const t = tRaw as ActorTransportistaExtra;
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
                        {t.localidad && (
                          <span className="text-xs text-neutral-500">📍 {t.localidad}</span>
                        )}
                        {t.vencimientoHabilitacion && (() => {
                          const vto = new Date(t.vencimientoHabilitacion);
                          const dias = Math.ceil((vto.getTime() - Date.now()) / 86400000);
                          const emoji = dias <= 0 ? '🔴' : dias <= 30 ? '🟡' : '🟢';
                          return <><br /><span className="text-xs">{emoji} Vto: {vto.toLocaleDateString('es-AR')}</span></>;
                        })()}
                        {t.corrientesAutorizadas && (() => {
                          const corrientes = t.corrientesAutorizadas.split('/').filter(Boolean);
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

              {/* Operadores FIJOS — icono azul */}
              {layers.operadoresFijos && (selectedDep ? filteredOpFijos : operadoresFijos).map((o: any, idx: number) => (
                <Marker
                  key={`oper-fijo-${o.id}-${idx}`}
                  position={[o.latitud, o.longitud]}
                  icon={ACTOR_ICONS.operador}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong className="text-blue-700">{o.razonSocial}</strong>
                      <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">FIJO</span><br />
                      <span className="text-xs text-neutral-500">CUIT: {o.cuit}</span><br />
                      {o.corrientesY && (
                        <><span className="text-xs text-neutral-600">Corrientes: {o.corrientesY}</span><br /></>
                      )}
                      <span className="text-xs">Recibidos: {o.cantRecibidos} | Tratados: {o.cantTratados}</span><br />
                      <div className="flex items-center gap-3 mt-1">
                        <button className="text-xs text-primary-600 hover:underline" onClick={() => onSelectDep(getDepartamento(o.latitud, o.longitud))}>Ver departamento</button>
                        <button className="text-xs text-primary-600 hover:underline font-medium" onClick={() => navigate(`/admin/actores/operadores/${o.id}`)}>Ver detalle →</button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Operadores IN SITU — icono verde */}
              {layers.operadoresInSitu && (selectedDep ? filteredOpInSitu : operadoresInSitu).map((o: any, idx: number) => (
                <Marker
                  key={`oper-insitu-${o.id}-${idx}`}
                  position={[o.latitud, o.longitud]}
                  icon={ACTOR_ICONS.operador}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong className="text-emerald-700">{o.razonSocial}</strong>
                      <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">IN SITU</span><br />
                      <span className="text-xs text-neutral-500">CUIT: {o.cuit}</span><br />
                      {o.corrientesY && (
                        <><span className="text-xs text-neutral-600">Corrientes: {o.corrientesY}</span><br /></>
                      )}
                      <span className="text-xs">Recibidos: {o.cantRecibidos} | Tratados: {o.cantTratados}</span><br />
                      <div className="flex items-center gap-3 mt-1">
                        <button className="text-xs text-primary-600 hover:underline" onClick={() => onSelectDep(getDepartamento(o.latitud, o.longitud))}>Ver departamento</button>
                        <button className="text-xs text-primary-600 hover:underline font-medium" onClick={() => navigate(`/admin/actores/operadores/${o.id}`)}>Ver detalle →
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
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Op. Fijos</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Op. In Situ</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de actores visibles en el mapa */}
      {(() => {
        // Build unified list of visible actors based on active layers + dep filter
        const visibleActors: { tipo: string; color: string; razonSocial: string; cuit: string; depto: string; detalle: string; id: string; ruta: string }[] = [];

        if (layers.generadores) {
          for (const g of (selectedDep ? filteredGen : ccData?.generadores || []) as any[]) {
            visibleActors.push({ tipo: 'Generador', color: 'purple', razonSocial: g.razonSocial, cuit: g.cuit, depto: getDepartamento(g.latitud, g.longitud), detalle: `${g.cantManifiestos || 0} manifiestos`, id: g.id, ruta: `/admin/actores/generadores/${g.id}` });
          }
        }
        if (layers.transportistas) {
          for (const t of (ccData?.transportistas || []).filter((tRaw: any) => {
            if (!selectedDep) return true;
            const p = geocodedPos[tRaw.id] ?? (tRaw.latitud != null ? [tRaw.latitud, tRaw.longitud] : null) ?? deptFallback(tRaw.id, tRaw.domicilio);
            return getDepartamento(p[0], p[1]) === selectedDep;
          }) as any[]) {
            const p = geocodedPos[t.id] ?? (t.latitud != null ? [t.latitud, t.longitud] : null) ?? deptFallback(t.id, t.domicilio);
            visibleActors.push({ tipo: 'Transportista', color: 'orange', razonSocial: t.razonSocial, cuit: t.cuit, depto: getDepartamento(p[0], p[1]), detalle: `${t.vehiculosActivos || 0} veh. · ${t.enviosEnTransito || 0} en tránsito`, id: t.id, ruta: `/actores/transportistas/${t.id}` });
          }
        }
        if (layers.operadoresFijos) {
          for (const o of (selectedDep ? filteredOpFijos : operadoresFijos) as any[]) {
            visibleActors.push({ tipo: 'Op. Fijo', color: 'blue', razonSocial: o.razonSocial || o.nombre, cuit: o.cuit, depto: getDepartamento(o.latitud, o.longitud), detalle: `Recibidos: ${o.cantRecibidos || 0} · Tratados: ${o.cantTratados || 0}`, id: o.id, ruta: `/admin/actores/operadores/${o.id}` });
          }
        }
        if (layers.operadoresInSitu) {
          for (const o of (selectedDep ? filteredOpInSitu : operadoresInSitu) as any[]) {
            if (!visibleActors.some(v => v.id === o.id && v.tipo.startsWith('Op.'))) {
              visibleActors.push({ tipo: 'Op. In Situ', color: 'emerald', razonSocial: o.razonSocial || o.nombre, cuit: o.cuit, depto: getDepartamento(o.latitud, o.longitud), detalle: `Recibidos: ${o.cantRecibidos || 0} · Tratados: ${o.cantTratados || 0}`, id: o.id, ruta: `/admin/actores/operadores/${o.id}` });
            }
          }
        }

        if (visibleActors.length === 0) return null;

        const colorMap: Record<string, string> = { purple: 'bg-purple-500', orange: 'bg-orange-500', blue: 'bg-blue-500', emerald: 'bg-emerald-500' };
        const badgeColorMap: Record<string, string> = { purple: 'text-purple-700 bg-purple-50', orange: 'text-orange-700 bg-orange-50', blue: 'text-blue-700 bg-blue-50', emerald: 'text-emerald-700 bg-emerald-50' };

        const handleExportCsv = () => {
          const depLabel = selectedDep || 'Todos los departamentos';
          const fecha = periodoLabel || 'Todos los períodos';
          const capasActivas = [
            layers.generadores && 'Generadores',
            layers.transportistas && 'Transportistas',
            layers.operadoresFijos && 'Op. Fijos',
            layers.operadoresInSitu && 'Op. In Situ',
          ].filter(Boolean).join(', ');
          const headers = ['Tipo', 'Razón Social', 'CUIT', 'Departamento', 'Detalle', 'Período', 'Filtro Depto', 'Capas'];
          const rows = visibleActors.map(a => [a.tipo, a.razonSocial, a.cuit, a.depto, a.detalle, fecha, depLabel, capasActivas]);
          downloadCsv(`actores-mapa-${depLabel.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows, {
            titulo: 'Actores en Mapa',
            periodo: fecha,
            filtros: `Departamento: ${depLabel}, Capas: ${capasActivas}`,
            total: visibleActors.length,
          });
        };

        const handleExportPdf = () => {
          exportReportePDF({
            titulo: 'Actores en Mapa',
            subtitulo: selectedDep ? `Departamento: ${selectedDep}` : 'Todos los departamentos',
            periodo: periodoLabel || 'Todos los periodos',
            kpis: [
              { label: 'Total', value: visibleActors.length },
              { label: 'Generadores', value: visibleActors.filter(a => a.tipo === 'Generador').length },
              { label: 'Transportistas', value: visibleActors.filter(a => a.tipo === 'Transportista').length },
              { label: 'Operadores', value: visibleActors.filter(a => a.tipo.startsWith('Op.')).length },
            ],
            tabla: {
              headers: ['Tipo', 'Razon Social', 'CUIT', 'Departamento', 'Detalle'],
              rows: visibleActors.map(a => [a.tipo, a.razonSocial, a.cuit, a.depto, a.detalle]),
            },
          });
        };

        return (
          <Card>
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-neutral-900 min-w-0 truncate">
                Actores en el mapa {selectedDep && <span className="text-primary-600">— {selectedDep}</span>}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="soft" color="neutral">{visibleActors.length}</Badge>
                <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors" title="Imprimir"><Printer size={13} />Imprimir</button>
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg border border-primary-200 transition-colors"
                  title="Exportar lista filtrada a CSV"
                >
                  <Download size={13} />
                  CSV
                </button>
                <button
                  onClick={handleExportPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-error-700 bg-error-50 hover:bg-error-100 rounded-lg border border-error-200 transition-colors"
                  title="Exportar lista filtrada a PDF"
                >
                  <FileDown size={13} />
                  PDF
                </button>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto divide-y divide-neutral-100">
              {visibleActors.map((a, i) => (
                <button
                  key={`${a.tipo}-${a.id}-${i}`}
                  onClick={() => navigate(a.ruta)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition-colors text-left"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${colorMap[a.color] || 'bg-neutral-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{a.razonSocial}</p>
                    <p className="text-xs text-neutral-500">{a.cuit} · {a.depto}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${badgeColorMap[a.color] || 'text-neutral-600 bg-neutral-100'}`}>{a.tipo}</span>
                  <span className="text-xs text-neutral-400 shrink-0 hidden sm:block">{a.detalle}</span>
                </button>
              ))}
            </div>
          </Card>
        );
      })()}
    </div>
  );
}

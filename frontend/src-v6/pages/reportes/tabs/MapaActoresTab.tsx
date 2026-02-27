import React, { useState, useMemo, useCallback } from 'react';
import {
  Calendar, Layers, Eye, EyeOff,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '../../../components/ui/CardV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { ACTOR_ICONS, ACTOR_COLORS, createClusterIcon } from '../../../utils/map-icons';
import { getDepartamento } from '../../../utils/mendoza-departamentos';
import { clusterMarkers } from './shared';
import type { CentroControlData } from '../../../hooks/useCentroControl';

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
  periodoLabel,
  incluirTodos = true,
  onToggleIncluirTodos,
}: {
  ccData: CentroControlData | null;
  onSelectDep: (dep: string) => void;
  periodoLabel: string;
  incluirTodos?: boolean;
  onToggleIncluirTodos?: (value: boolean) => void;
}) {
  const [layers, setLayers] = useState({
    generadores: true,
    transportistas: true,
    operadores: true,
  });

  const toggleLayer = useCallback((layer: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const generadoresClustered = useMemo(() => {
    if (!ccData?.generadores) return [];
    return clusterMarkers(ccData.generadores as any[]);
  }, [ccData?.generadores]);

  const transportistasClustered = useMemo(() => {
    if (!ccData?.transportistas) return [];
    return clusterMarkers(ccData.transportistas as any[]);
  }, [ccData?.transportistas]);

  const operadoresClustered = useMemo(() => {
    if (!ccData?.operadores) return [];
    return clusterMarkers(ccData.operadores as any[]);
  }, [ccData?.operadores]);

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
      {/* Active filter banner + toggle */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
        <Calendar size={14} className="text-amber-600 shrink-0" />
        <span className="text-xs font-medium text-amber-800">
          {incluirTodos ? 'Mostrando todos los actores registrados' : <>Actores filtrados por: <strong>{periodoLabel}</strong></>}
        </span>
        {onToggleIncluirTodos && (
          <label className="ml-auto flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs font-medium text-amber-800">Mostrar todos</span>
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

      {/* KPI + Layer toggles */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-2xl border border-neutral-100 shadow-sm">
        <Layers size={16} className="text-neutral-400" />
        {([
          { key: 'generadores' as const, label: 'Generadores', color: 'bg-purple-500', count: totalGen },
          { key: 'transportistas' as const, label: 'Transportistas', color: 'bg-orange-500', count: totalTrans },
          { key: 'operadores' as const, label: 'Operadores', color: 'bg-blue-500', count: totalOper },
        ]).map(l => (
          <button
            key={l.key}
            onClick={() => toggleLayer(l.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              layers[l.key]
                ? 'bg-white border-neutral-200 text-neutral-700 shadow-sm'
                : 'bg-neutral-50 border-transparent text-neutral-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${layers[l.key] ? l.color : 'bg-neutral-300'}`} />
            <span>{l.label}</span>
            <Badge variant="soft" color="neutral" className="text-[10px] px-1.5 py-0 ml-1">{l.count}</Badge>
            {layers[l.key] ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        ))}
        <div className="ml-auto text-xs text-neutral-500">
          {totalGen + totalTrans + totalOper} actores totales
        </div>
      </div>

      {/* Map */}
      <Card padding="none">
        <div className="p-5">
          <div className="h-[32rem] sm:h-[36rem] rounded-xl overflow-hidden border border-neutral-200 relative isolate">
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
                      {g.coordsFallback && <span className="text-xs text-amber-600 block">⚠ Ubicación aproximada</span>}
                      <button
                        className="text-xs text-primary-600 hover:underline mt-1"
                        onClick={() => onSelectDep(getDepartamento(g.latitud, g.longitud))}
                      >
                        Ver departamento: {getDepartamento(g.latitud, g.longitud)}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Transportistas */}
              {layers.transportistas && transportistasClustered.map((t: any, idx: number) => (
                <Marker
                  key={`trans-${t.id}-${idx}`}
                  position={[t.latitud, t.longitud]}
                  icon={t.count ? createClusterIcon(t.count, ACTOR_COLORS.transportista) : ACTOR_ICONS.transportista}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong className="text-orange-700">{t.razonSocial}</strong>
                      {t.count && <span className="text-xs text-neutral-500 ml-1">({t.count} en zona)</span>}
                      <br />
                      <span className="text-xs text-neutral-500">CUIT: {t.cuit}</span><br />
                      <span className="text-xs">Vehículos: {t.vehiculosActivos}</span><br />
                      <span className="text-xs font-medium">En tránsito: {t.enviosEnTransito}</span><br />
                      {t.coordsFallback && <span className="text-xs text-amber-600 block">⚠ Ubicación aproximada</span>}
                      <button
                        className="text-xs text-primary-600 hover:underline mt-1"
                        onClick={() => onSelectDep(getDepartamento(t.latitud, t.longitud))}
                      >
                        Ver departamento: {getDepartamento(t.latitud, t.longitud)}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Operadores */}
              {layers.operadores && operadoresClustered.map((o: any, idx: number) => (
                <Marker
                  key={`oper-${o.id}-${idx}`}
                  position={[o.latitud, o.longitud]}
                  icon={o.count ? createClusterIcon(o.count, ACTOR_COLORS.operador) : ACTOR_ICONS.operador}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong className="text-blue-700">{o.razonSocial}</strong>
                      {o.count && <span className="text-xs text-neutral-500 ml-1">({o.count} en zona)</span>}
                      <br />
                      <span className="text-xs text-neutral-500">CUIT: {o.cuit}</span><br />
                      <span className="text-xs text-neutral-500">Cat: {o.categoria}</span><br />
                      <span className="text-xs">Recibidos: {o.cantRecibidos} | Tratados: {o.cantTratados}</span><br />
                      {o.coordsFallback && <span className="text-xs text-amber-600 block">⚠ Ubicación aproximada</span>}
                      <button
                        className="text-xs text-primary-600 hover:underline mt-1"
                        onClick={() => onSelectDep(getDepartamento(o.latitud, o.longitud))}
                      >
                        Ver departamento: {getDepartamento(o.latitud, o.longitud)}
                      </button>
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
                <span className="flex items-center gap-1 text-amber-600">⚠ Ubic. aproximada</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

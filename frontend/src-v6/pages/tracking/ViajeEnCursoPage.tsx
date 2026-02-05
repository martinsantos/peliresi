/**
 * SITREP v6 - Viaje en Curso Page
 * ================================
 * Vista de tracking para admin/generador — conectado a API real con mapa Leaflet
 * Responsive: 2-column desktop, stacked mobile
 * Clickable actor cards fly the map to their location
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Package,
  Clock,
  Truck,
  CheckCircle2,
  Loader2,
  Building2,
  User,
  FileText,
  Weight,
  ExternalLink,
  Crosshair,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Skeleton } from '../../components/ui/Skeleton';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ACTOR_ICONS, ACTOR_COLORS } from '../../utils/map-icons';
import { useManifiesto } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';
import { formatDateTime, formatEstado, formatWeight, formatNumber, formatCuit } from '../../utils/formatters';

// Approximate geocoding for Mendoza demo locations
// Ordered most-specific first so longer matches win over generic city names
// In production this would come from a geocoding API or stored lat/lng
const MENDOZA_LOCATIONS: [string, [number, number]][] = [
  // Specific streets / landmarks (most precise)
  ['fangio', [-32.9480, -68.8290]],          // Calle Juan M. Fangio, Godoy Cruz (Acc. Sur)
  ['acceso sur', [-32.9500, -68.8300]],       // Acceso Sur, Godoy Cruz
  ['acceso este', [-32.8850, -68.7900]],      // Acceso Este
  ['acceso norte', [-32.8300, -68.8400]],     // Acceso Norte
  ['parque industrial las heras', [-32.8230, -68.7780]],  // Parque Industrial Las Heras
  ['parque industrial', [-32.8230, -68.7780]],
  ['zona industrial las heras', [-32.8230, -68.7780]],
  ['zona industrial', [-32.8600, -68.7900]],
  ['plumerillo', [-32.8320, -68.7940]],       // El Plumerillo, Las Heras
  ['ruta 40', [-32.9200, -68.8600]],
  ['ruta 7', [-32.8800, -68.7500]],
  ['panamericana', [-32.8700, -68.8100]],
  ['san martin sur', [-32.9400, -68.8350]],   // Av. San Martín Sur, Godoy Cruz
  ['san martin norte', [-32.8600, -68.8300]], // Av. San Martín, Capital
  ['costanera', [-32.8850, -68.8500]],
  ['lateral sur', [-32.9460, -68.8310]],
  ['lateral norte', [-32.8400, -68.8250]],
  ['pedro molina', [-32.8750, -68.8200]],     // Pedro Molina, Guaymallén
  ['beltran', [-32.8850, -68.8100]],          // Gral. Beltrán, Guaymallén
  ['dorrego', [-32.9100, -68.7950]],          // Dorrego, Guaymallén
  ['rodriguez peña', [-32.8500, -68.8100]],
  ['bandera de los andes', [-32.9050, -68.8100]],
  ['carril nacional', [-32.9200, -68.7800]],
  ['patricias mendocinas', [-32.8870, -68.8350]],
  ['emilio civit', [-32.8950, -68.8350]],     // Parque, Capital
  ['san lorenzo', [-32.8900, -68.8280]],
  ['belgrano', [-32.8870, -68.8230]],
  // Zones / neighborhoods
  ['chacras de coria', [-32.9800, -68.8780]],
  ['bermejo', [-32.8800, -68.7900]],
  ['villa nueva', [-32.9100, -68.8100]],
  ['rodeo del medio', [-33.0100, -68.7200]],
  ['russell', [-33.0000, -68.7600]],
  ['coquimbito', [-32.9800, -68.7400]],
  ['corralitos', [-33.0400, -68.7000]],
  // Cities (less precise - fallback)
  ['godoy cruz', [-32.9320, -68.8430]],
  ['las heras', [-32.8450, -68.8180]],
  ['guaymallen', [-32.8960, -68.8160]],
  ['guaymallén', [-32.8960, -68.8160]],
  ['maipu', [-32.9430, -68.7550]],
  ['maipú', [-32.9430, -68.7550]],
  ['lujan', [-33.0400, -68.8800]],
  ['luján', [-33.0400, -68.8800]],
  ['san rafael', [-34.6175, -67.4867]],
  ['san martin', [-33.3020, -68.4710]],
  ['san martín', [-33.3020, -68.4710]],
  ['junin', [-33.1380, -68.4930]],
  ['junín', [-33.1380, -68.4930]],
  ['rivadavia', [-33.1900, -68.4630]],
  ['lavalle', [-32.7230, -68.5940]],
  ['tunuyan', [-33.5700, -69.0170]],
  ['tunuyán', [-33.5700, -69.0170]],
  ['tupungato', [-33.3700, -69.1500]],
  ['mendoza', [-32.8908, -68.8272]],
  ['capital', [-32.8908, -68.8272]],
];

function geocodeAddress(domicilio?: string, fallbackLat?: number, fallbackLng?: number): [number, number] | null {
  if (fallbackLat && fallbackLng) return [fallbackLat, fallbackLng];
  if (!domicilio) return null;
  const lower = domicilio.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, coords] of MENDOZA_LOCATIONS) {
    if (lower.includes(key)) return coords;
  }
  return null;
}

function getEstadoBadgeColor(estado: string): 'info' | 'success' | 'warning' | 'error' | 'neutral' {
  switch (estado) {
    case EstadoManifiesto.EN_TRANSITO: return 'info';
    case EstadoManifiesto.ENTREGADO:
    case EstadoManifiesto.RECIBIDO:
    case EstadoManifiesto.TRATADO: return 'success';
    case EstadoManifiesto.EN_TRATAMIENTO: return 'warning';
    case EstadoManifiesto.RECHAZADO:
    case EstadoManifiesto.CANCELADO: return 'error';
    default: return 'neutral';
  }
}

// Helper component to fly the map to a position
const FlyTo: React.FC<{ position: [number, number] | null; zoom?: number }> = ({ position, zoom = 15 }) => {
  const map = useMap();
  React.useEffect(() => {
    if (position) {
      map.flyTo(position, zoom, { duration: 1.2 });
    }
  }, [map, position, zoom]);
  return null;
};

// Helper to fit map bounds to all markers with appropriate zoom
const FitBounds: React.FC<{ points: [number, number][] }> = ({ points }) => {
  const map = useMap();
  React.useEffect(() => {
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
      // Use percentage-based padding relative to map size for tighter fit
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

const ViajeEnCursoPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  const { data: apiData, isLoading, isError } = useManifiesto(id || '');
  const manifiesto = (apiData as any)?.data || apiData;
  const m = manifiesto || {};

  // State: which actor to fly to
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [selectedActor, setSelectedActor] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);

  const defaultCenter: [number, number] = [-32.9287, -68.8535];

  const lastPosition: [number, number] | null = m.ultimaUbicacion
    ? [m.ultimaUbicacion.latitud, m.ultimaUbicacion.longitud]
    : null;

  // Geocode actors
  const origenPos = useMemo(() =>
    geocodeAddress(m.generador?.domicilio) || [-32.9320, -68.8430] as [number, number],
    [m.generador?.domicilio]
  );
  const destinoPos = useMemo(() =>
    geocodeAddress(m.operador?.domicilio) || [-32.8550, -68.8200] as [number, number],
    [m.operador?.domicilio]
  );
  // Transportista: use last known GPS or midpoint between origin/destination
  const transportistaPos = useMemo(() => {
    if (lastPosition) return lastPosition;
    return [
      (origenPos[0] + destinoPos[0]) / 2,
      (origenPos[1] + destinoPos[1]) / 2,
    ] as [number, number];
  }, [lastPosition, origenPos, destinoPos]);

  // All map points for initial bounds fitting
  const allPoints = useMemo(() => {
    const pts: [number, number][] = [origenPos, destinoPos];
    if (lastPosition) pts.push(lastPosition);
    return pts;
  }, [origenPos, destinoPos, lastPosition]);

  const mapCenter = lastPosition || [(origenPos[0] + destinoPos[0]) / 2, (origenPos[1] + destinoPos[1]) / 2] as [number, number];

  const trackPoints: [number, number][] = Array.isArray(m.tracking)
    ? m.tracking.map((t: any) => [t.latitud, t.longitud] as [number, number])
    : [];

  const totalPeso = Array.isArray(m.residuos) ? m.residuos.reduce((sum: number, r: any) => sum + (r.cantidad || 0), 0) : 0;
  const eventos = Array.isArray(m.eventos) ? m.eventos : [];

  const handleActorClick = (actor: string, pos: [number, number]) => {
    setSelectedActor(actor);
    if (actor === 'transportista') {
      // Show full route by re-fitting bounds
      setFlyTarget(null);
      setFitKey(k => k + 1);
    } else {
      setFlyTarget(pos);
    }
  };

  const handleShowAll = () => {
    setSelectedActor(null);
    setFlyTarget(null);
    setFitKey(k => k + 1);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24" />
          <div className="flex-1">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!manifiesto || isError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <Truck size={48} className="mx-auto text-neutral-300 mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Manifiesto no encontrado</h3>
            <p className="text-neutral-600">No se pudo cargar la información de seguimiento.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={isMobile ? '/mobile/centro-control' : '/centro-control'}>
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />}>
            Volver
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-neutral-900">Seguimiento de Viaje</h2>
            <Badge variant="soft" color={getEstadoBadgeColor(m.estado || '')}>
              {m.estado === EstadoManifiesto.EN_TRANSITO && <Navigation size={12} className="mr-1 animate-pulse" />}
              {formatEstado(m.estado || '')}
            </Badge>
          </div>
          <p className="text-neutral-600 mt-1 flex items-center gap-2">
            <span className="font-mono">{m.numero || id}</span>
            {m.fechaCreacion && (
              <>
                <span className="text-neutral-300">|</span>
                <span className="text-sm">{formatDateTime(m.fechaCreacion)}</span>
              </>
            )}
          </p>
        </div>
        <Link to={isMobile ? `/mobile/manifiestos/${id}` : `/manifiestos/${id}`}>
          <Button variant="outline" leftIcon={<FileText size={16} />}>
            Ver Manifiesto
          </Button>
        </Link>
      </div>

      {/* Main grid: map + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Map + Route + Residuos */}
        <div className="lg:col-span-2 space-y-6">
          {/* Map */}
          <Card className="overflow-hidden">
            <div className="h-[420px] relative isolate">
              <MapContainer
                center={mapCenter}
                zoom={12}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
                className="z-0"
              >
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {/* Fit all markers on mount and when fitKey changes */}
                <FitBounds key={fitKey} points={allPoints} />

                {/* Fly to clicked actor */}
                {flyTarget && <FlyTo position={flyTarget} />}

                {/* Track polyline */}
                {trackPoints.length > 1 && (
                  <Polyline positions={trackPoints} color="#0D8A4F" weight={4} opacity={0.8} />
                )}

                {/* Dashed line from origin to destination — only when Transportista is selected */}
                {selectedActor === 'transportista' && (
                  <Polyline
                    positions={[origenPos, destinoPos]}
                    pathOptions={{ color: '#94a3b8', weight: 2, dashArray: '8 8' }}
                  />
                )}

                {/* Origin marker (Generador) */}
                <Marker position={origenPos} icon={ACTOR_ICONS.generador}>
                  <Popup>
                    <div className="text-sm">
                      <strong>Origen — Generador</strong><br />
                      {m.generador?.razonSocial || '-'}<br />
                      <span className="text-gray-500">{m.generador?.domicilio || ''}</span>
                    </div>
                  </Popup>
                </Marker>

                {/* Destination marker (Operador) */}
                <Marker position={destinoPos} icon={ACTOR_ICONS.operador}>
                  <Popup>
                    <div className="text-sm">
                      <strong>Destino — Operador</strong><br />
                      {m.operador?.razonSocial || '-'}<br />
                      <span className="text-gray-500">{m.operador?.domicilio || ''}</span>
                    </div>
                  </Popup>
                </Marker>

                {/* Truck marker (current position or midpoint) */}
                {lastPosition && (
                  <Marker position={lastPosition} icon={ACTOR_ICONS.enTransito}>
                    <Popup>
                      <div className="text-sm">
                        <strong>Transportista</strong><br />
                        {m.transportista?.razonSocial || '-'}<br />
                        <span className="text-gray-500">{m.numero || id}</span>
                      </div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
            {/* Map legend */}
            <div className="px-4 py-2.5 bg-neutral-50 border-t border-neutral-100 flex items-center gap-4 text-xs text-neutral-500">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded" style={{ background: ACTOR_COLORS.generador }} />
                <span>Generador</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,1 13,4 13,10 7,13 1,10 1,4" fill={ACTOR_COLORS.operador}/></svg>
                <span>Operador</span>
              </div>
              {lastPosition && (
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: ACTOR_COLORS.enTransito }} />
                  <span>En Tránsito</span>
                </div>
              )}
              {selectedActor ? (
                <button type="button" onClick={handleShowAll} className="ml-auto text-primary-600 hover:text-primary-800 font-medium underline underline-offset-2">
                  Ver ruta completa
                </button>
              ) : (
                <div className="ml-auto text-neutral-400">Click un actor para ubicar en mapa</div>
              )}
            </div>
          </Card>

          {/* Route: Origin → Destination */}
          <Card>
            <CardHeader title="Ruta" icon={<Navigation size={20} />} />
            <CardContent>
              <div className="flex items-stretch gap-4">
                {/* Origin */}
                <button
                  type="button"
                  onClick={() => handleActorClick('generador', origenPos)}
                  className={`flex-1 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    selectedActor === 'generador'
                      ? 'border-neutral-900 bg-neutral-50 shadow-sm'
                      : 'border-neutral-100 bg-neutral-50 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-neutral-900 rounded-full flex items-center justify-center">
                      <MapPin className="text-white" size={12} />
                    </div>
                    <span className="text-xs font-semibold text-neutral-500 uppercase">Origen</span>
                    <Crosshair size={12} className="ml-auto text-neutral-400" />
                  </div>
                  <p className="font-semibold text-neutral-900">{m.generador?.razonSocial || 'Generador'}</p>
                  <p className="text-sm text-neutral-500 mt-1">{m.generador?.domicilio || '-'}</p>
                  {m.generador?.cuit && <p className="text-xs text-neutral-400 mt-1">CUIT: {formatCuit(m.generador.cuit)}</p>}
                </button>

                {/* Arrow */}
                <div className="flex items-center">
                  <div className="w-8 h-0.5 bg-neutral-300 relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-neutral-300" />
                  </div>
                </div>

                {/* Destination */}
                <button
                  type="button"
                  onClick={() => handleActorClick('operador', destinoPos)}
                  className={`flex-1 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    selectedActor === 'operador'
                      ? 'border-primary-500 bg-primary-50 shadow-sm'
                      : 'border-primary-100 bg-primary-50 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="text-white" size={12} />
                    </div>
                    <span className="text-xs font-semibold text-primary-600 uppercase">Destino</span>
                    <Crosshair size={12} className="ml-auto text-primary-400" />
                  </div>
                  <p className="font-semibold text-neutral-900">{m.operador?.razonSocial || 'Operador'}</p>
                  <p className="text-sm text-neutral-500 mt-1">{m.operador?.domicilio || '-'}</p>
                  {m.operador?.cuit && <p className="text-xs text-neutral-400 mt-1">CUIT: {formatCuit(m.operador.cuit)}</p>}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Residuos */}
          <Card>
            <CardHeader title="Residuos Transportados" icon={<Package size={20} />} />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed min-w-[400px]">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '15%' }}>Código</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '45%' }}>Descripción</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Cantidad</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Unidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {(m.residuos || []).map((r: any) => (
                      <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-sm">{r.tipoResiduo?.codigo || '-'}</td>
                        <td className="px-3 py-2.5 text-neutral-700 truncate">{r.tipoResiduo?.nombre || r.descripcion || '-'}</td>
                        <td className="px-3 py-2.5 font-medium">{formatNumber(r.cantidad)}</td>
                        <td className="px-3 py-2.5 text-neutral-600">{r.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-4 bg-neutral-50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-600">
                  <Weight size={18} />
                  <span className="font-medium">Peso total:</span>
                </div>
                <span className="text-xl font-bold text-neutral-900">{formatWeight(totalPeso)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Transportista Card — clickable */}
          <Card>
            <CardHeader title="Transportista" icon={<Truck size={20} />} />
            <CardContent>
              <button
                type="button"
                onClick={() => handleActorClick('transportista', transportistaPos)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left cursor-pointer ${
                  selectedActor === 'transportista'
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-transparent hover:border-orange-200 hover:bg-orange-50/50'
                }`}
              >
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                  <Truck className="text-orange-600" size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-neutral-900">{m.transportista?.razonSocial || '-'}</p>
                  <p className="text-sm text-neutral-500">Hab: {m.transportista?.numeroHabilitacion || '-'}</p>
                </div>
                <Crosshair size={14} className="text-neutral-400 shrink-0" />
              </button>
              {m.transportista?.cuit && (
                <div className="p-3 bg-neutral-50 rounded-lg text-sm text-neutral-600 mt-2">
                  CUIT: <span className="font-mono">{formatCuit(m.transportista.cuit)}</span>
                </div>
              )}
              {m.vehiculo && (
                <div className="mt-2 p-3 bg-neutral-50 rounded-lg">
                  <p className="text-sm text-neutral-600">
                    Vehículo: <span className="font-semibold">{m.vehiculo.patente || '-'}</span>
                  </p>
                  <p className="text-xs text-neutral-400">{m.vehiculo.marca || ''} {m.vehiculo.modelo || ''}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actores — clickable */}
          <Card>
            <CardHeader title="Actores" />
            <CardContent>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleActorClick('generador', origenPos)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left cursor-pointer ${
                    selectedActor === 'generador'
                      ? 'border-purple-400 bg-purple-50 shadow-sm'
                      : 'border-transparent hover:border-purple-200 hover:bg-purple-50/50'
                  }`}
                >
                  <div className="p-2 bg-purple-50 rounded-lg text-purple-600 shrink-0">
                    <User size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-neutral-500">Generador</p>
                    <p className="font-medium text-neutral-900 text-sm">{m.generador?.razonSocial || '-'}</p>
                    <p className="text-xs text-neutral-400">{m.generador?.domicilio || '-'}</p>
                    {m.generador?.cuit && <p className="text-xs text-neutral-400">CUIT: {formatCuit(m.generador.cuit)}</p>}
                  </div>
                  <Crosshair size={14} className="text-neutral-400 shrink-0 mt-2" />
                </button>

                <button
                  type="button"
                  onClick={() => handleActorClick('operador', destinoPos)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left cursor-pointer ${
                    selectedActor === 'operador'
                      ? 'border-green-400 bg-green-50 shadow-sm'
                      : 'border-transparent hover:border-green-200 hover:bg-green-50/50'
                  }`}
                >
                  <div className="p-2 bg-green-50 rounded-lg text-green-600 shrink-0">
                    <Building2 size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-neutral-500">Operador</p>
                    <p className="font-medium text-neutral-900 text-sm">{m.operador?.razonSocial || '-'}</p>
                    <p className="text-xs text-neutral-400">{m.operador?.domicilio || '-'}</p>
                    {m.operador?.cuit && <p className="text-xs text-neutral-400">CUIT: {formatCuit(m.operador.cuit)}</p>}
                  </div>
                  <Crosshair size={14} className="text-neutral-400 shrink-0 mt-2" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Historial del Viaje" icon={<Clock size={20} />} />
            <CardContent>
              {eventos.length === 0 ? (
                <div className="py-6 text-center text-neutral-500 text-sm">Sin eventos registrados</div>
              ) : (
                <div className="relative">
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-neutral-200" />
                  <div className="space-y-4">
                    {eventos.map((ev: any, index: number) => (
                      <div key={ev.id || index} className="relative flex gap-3 pl-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${
                          index === 0 ? 'bg-primary-500 text-white ring-4 ring-primary-100' : 'bg-neutral-200 text-neutral-400'
                        }`}>
                          {index === 0 ? <CheckCircle2 size={12} /> : <span className="text-[10px] font-bold">{eventos.length - index}</span>}
                        </div>
                        <div className="flex-1 pb-2 min-w-0">
                          <p className="text-xs text-neutral-400">{formatDateTime(ev.createdAt)}</p>
                          <p className="font-medium text-sm text-neutral-900">{String(ev.tipo || '').replace(/_/g, ' ')}</p>
                          <p className="text-xs text-neutral-500 truncate">{ev.descripcion || ''}{ev.usuario ? ` — ${ev.usuario.nombre}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action */}
          <Card>
            <CardContent>
              <Link to={isMobile ? `/mobile/manifiestos/${id}` : `/manifiestos/${id}`} className="block">
                <Button fullWidth leftIcon={<ExternalLink size={16} />}>
                  Ver Detalle Completo
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ViajeEnCursoPage;

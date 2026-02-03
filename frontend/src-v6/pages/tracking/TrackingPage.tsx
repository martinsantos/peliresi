/**
 * SITREP v6 - Tracking Page
 * =========================
 * Mapa de seguimiento GPS de manifiestos con Leaflet real
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapPin, Truck, Clock, Navigation, Filter, Layers, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
import { useManifiestos } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate, useLocation } from 'react-router-dom';

// Leaflet icon fix
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
});
L.Marker.prototype.options.icon = DefaultIcon;

const truckIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
});

// Component to fly to a selected marker
function FlyToMarker({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 14, { duration: 0.8 });
    }
  }, [position, map]);
  return null;
}

const TrackingPage: React.FC = () => {
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  // Real API - get manifiestos in transit
  const { data: apiData } = useManifiestos({ estado: EstadoManifiesto.EN_TRANSITO, limit: 50 });

  const trips = useMemo(() => {
    if (!apiData?.items || !Array.isArray(apiData.items) || apiData.items.length === 0) return [];
    const angles = [0, 60, 120, 180, 240, 300];
    return apiData.items.map((m: any, i: number) => {
      // Use real coords if available, otherwise deterministic spread around Mendoza
      const hasCoords = m.ultimaUbicacion?.latitud && m.ultimaUbicacion?.longitud;
      const angle = (angles[i % 6] * Math.PI) / 180;
      const radius = 0.02 + (i % 3) * 0.01;
      return {
        id: m.numero || m.id,
        manifiestoId: m.id,
        transportista: m.transportista?.razonSocial || 'Transportista',
        origen: m.generador?.razonSocial || 'Origen',
        destino: m.operador?.razonSocial || 'Destino',
        estado: 'en_curso',
        lat: hasCoords ? m.ultimaUbicacion.latitud : -32.9287 + Math.cos(angle) * radius,
        lng: hasCoords ? m.ultimaUbicacion.longitud : -68.8535 + Math.sin(angle) * radius,
      };
    });
  }, [apiData]);

  const filteredTrips = trips.filter(
    (trip) =>
      String(trip.id || '').toLowerCase().includes(filter.toLowerCase()) ||
      String(trip.transportista || '').toLowerCase().includes(filter.toLowerCase())
  );

  const selectedTripData = trips.find(t => t.id === selectedTrip);
  const flyToPosition: [number, number] | null = selectedTripData
    ? [selectedTripData.lat, selectedTripData.lng]
    : null;

  // Default center: Mendoza or first trip
  const mapCenter: [number, number] = trips.length > 0
    ? [trips[0].lat, trips[0].lng]
    : [-32.9287, -68.8535];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Tracking GPS</h2>
          <p className="text-neutral-600 mt-1">
            {trips.length} viajes activos en este momento
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Sidebar - Trip list */}
        <Card className="w-full md:w-96 flex flex-col overflow-hidden">
          <CardHeader className="shrink-0">
            <Input
              placeholder="Buscar viaje..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              leftIcon={<Navigation size={18} />}
            />
          </CardHeader>

          <CardContent className="flex-1 overflow-auto p-0">
            <div className="divide-y divide-neutral-100">
              {filteredTrips.length === 0 && (
                <div className="p-8 text-center text-neutral-500 text-sm">
                  No hay viajes en tránsito
                </div>
              )}
              {filteredTrips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => setSelectedTrip(trip.id)}
                  className={`
                    w-full p-4 text-left transition-colors
                    ${selectedTrip === trip.id ? 'bg-primary-50' : 'hover:bg-neutral-50'}
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-neutral-900">
                        {trip.id}
                      </span>
                      <Badge variant="soft" color="success" dot pulse>
                        En tránsito
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <Truck size={14} />
                      <span>{trip.transportista}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <MapPin size={14} />
                      <span className="truncate">
                        {trip.origen} → {trip.destino}
                      </span>
                    </div>
                  </div>

                  {selectedTrip === trip.id && (
                    <div className="mt-3 pt-3 border-t border-neutral-100">
                      <Button
                        size="sm"
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(isMobile ? `/mobile/tracking/${trip.manifiestoId}` : `/tracking/${trip.manifiestoId}`);
                        }}
                      >
                        Ver detalle del viaje
                      </Button>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Real Leaflet Map */}
        <div className="flex-1 rounded-2xl border border-neutral-200 relative overflow-hidden isolate">
          <MapContainer
            center={mapCenter}
            zoom={12}
            style={{ height: '100%', width: '100%', zIndex: 0 }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyToMarker position={flyToPosition} />
            {trips.map((trip) => (
              <Marker
                key={trip.id}
                position={[trip.lat, trip.lng]}
                icon={truckIcon}
                eventHandlers={{
                  click: () => setSelectedTrip(trip.id),
                }}
              >
                <Popup>
                  <div className="min-w-[180px]">
                    <p className="font-bold text-sm">{trip.id}</p>
                    <p className="text-xs text-gray-600">{trip.transportista}</p>
                    <p className="text-xs text-gray-500 mt-1">{trip.origen} → {trip.destino}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {trips.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[400]">
              <p className="text-sm text-neutral-500">No hay viajes en tránsito para mostrar en el mapa</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;

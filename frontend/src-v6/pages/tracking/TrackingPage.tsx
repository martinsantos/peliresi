/**
 * SITREP v6 - Tracking Page
 * =========================
 * Mapa de seguimiento GPS de manifiestos
 */

import React, { useState, useMemo } from 'react';
import { MapPin, Truck, Clock, Navigation, Filter, Layers, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
import { useManifiestos } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';

// Mock data para viajes activos
const activeTrips = [
  {
    id: 'M-2025-089',
    transportista: 'Transportes Andes S.A.',
    chofer: 'Juan Pérez',
    patente: 'AB-123-CD',
    origen: 'Química Mendoza S.A.',
    destino: 'Planta Las Heras',
    estado: 'en_curso',
    progreso: 65,
    eta: '20:30',
    ultimaActualizacion: 'Hace 5 min',
    coordenadas: { lat: -32.8908, lng: -68.8272 },
  },
  {
    id: 'M-2025-090',
    transportista: 'Logística Sur',
    chofer: 'María González',
    patente: 'AC-456-EF',
    origen: 'Industrias del Sur',
    destino: 'Planta Godoy Cruz',
    estado: 'en_curso',
    progreso: 30,
    eta: '21:15',
    ultimaActualizacion: 'Hace 2 min',
    coordenadas: { lat: -32.9167, lng: -68.85 },
  },
  {
    id: 'M-2025-091',
    transportista: 'Transportes Andes S.A.',
    chofer: 'Carlos Rodríguez',
    patente: 'AD-789-GH',
    origen: 'Metalúrgica Argentina',
    destino: 'Planta Las Heras',
    estado: 'detenido',
    progreso: 45,
    eta: '22:00',
    ultimaActualizacion: 'Hace 15 min',
    coordenadas: { lat: -32.95, lng: -68.88 },
  },
];

const TrackingPage: React.FC = () => {
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  // Try real API - get manifiestos in transit
  const { data: apiData } = useManifiestos({ estado: EstadoManifiesto.EN_TRANSITO, limit: 50 });

  const trips = useMemo(() => {
    if (apiData?.items?.length) {
      return apiData.items.map((m: any, i: number) => ({
        id: m.numero,
        transportista: m.transportista?.razonSocial || 'Transportista',
        chofer: 'En ruta',
        patente: '',
        origen: m.generador?.razonSocial || 'Origen',
        destino: m.operador?.razonSocial || 'Destino',
        estado: 'en_curso',
        progreso: Math.min(30 + i * 20, 90),
        eta: '-',
        ultimaActualizacion: 'Ahora',
        coordenadas: { lat: -32.89 + i * 0.03, lng: -68.82 - i * 0.02 },
      }));
    }
    return activeTrips;
  }, [apiData]);

  const filteredTrips = trips.filter(
    (trip) =>
      trip.id.toLowerCase().includes(filter.toLowerCase()) ||
      trip.transportista.toLowerCase().includes(filter.toLowerCase()) ||
      trip.chofer.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Tracking GPS</h2>
          <p className="text-neutral-600 mt-1">
            {activeTrips.length} viajes activos en este momento
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Layers size={18} />}>
            Capas
          </Button>
          <Button variant="outline" leftIcon={<Filter size={18} />}>
            Filtros
          </Button>
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
                      {trip.estado === 'detenido' ? (
                        <Badge variant="soft" color="warning" dot>
                          Detenido
                        </Badge>
                      ) : (
                        <Badge variant="soft" color="success" dot pulse>
                          En curso
                        </Badge>
                      )}
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
                    
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-neutral-500">Progreso</span>
                        <span className="font-medium text-neutral-900">{trip.progreso}%</span>
                      </div>
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            trip.estado === 'detenido'
                              ? 'bg-warning-500'
                              : 'bg-success-500'
                          }`}
                          style={{ width: `${trip.progreso}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 text-xs">
                      <div className="flex items-center gap-1 text-neutral-500">
                        <Clock size={12} />
                        <span>ETA: {trip.eta}</span>
                      </div>
                      <span className="text-neutral-400">
                        {trip.ultimaActualizacion}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Map placeholder */}
        <div className="flex-1 bg-neutral-100 rounded-2xl border border-neutral-200 relative overflow-hidden">
          {/* Mock map background */}
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 to-neutral-100">
            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                  linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
              }}
            />

            {/* Mock map markers */}
            {activeTrips.map((trip, index) => {
              const isSelected = selectedTrip === trip.id;
              const top = 20 + index * 25;
              const left = 30 + index * 20;

              return (
                <button
                  key={trip.id}
                  onClick={() => setSelectedTrip(trip.id)}
                  className={`
                    absolute transform -translate-x-1/2 -translate-y-1/2
                    transition-all duration-300
                    ${isSelected ? 'scale-125 z-10' : 'hover:scale-110'}
                  `}
                  style={{ top: `${top}%`, left: `${left}%` }}
                >
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center shadow-2
                      ${isSelected ? 'bg-primary-500 text-white' : 'bg-white text-primary-500'}
                      ${trip.estado === 'detenido' && !isSelected ? 'text-warning-500' : ''}
                    `}
                  >
                    <Truck size={20} />
                  </div>
                  {isSelected && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white px-3 py-2 rounded-lg shadow-3 whitespace-nowrap">
                      <p className="font-semibold text-sm">{trip.id}</p>
                      <p className="text-xs text-neutral-500">{trip.chofer}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Map controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button className="w-10 h-10 bg-white rounded-lg shadow-2 flex items-center justify-center text-neutral-600 hover:text-neutral-900">
              <span className="text-xl font-bold">+</span>
            </button>
            <button className="w-10 h-10 bg-white rounded-lg shadow-2 flex items-center justify-center text-neutral-600 hover:text-neutral-900">
              <span className="text-xl font-bold">−</span>
            </button>
          </div>

          {/* Legend */}
          <div className="absolute top-4 left-4 bg-white rounded-xl shadow-2 p-3">
            <p className="text-xs font-semibold text-neutral-700 mb-2">Leyenda</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <div className="w-2 h-2 rounded-full bg-success-500" />
                <span>En curso</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <div className="w-2 h-2 rounded-full bg-warning-500" />
                <span>Detenido</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;

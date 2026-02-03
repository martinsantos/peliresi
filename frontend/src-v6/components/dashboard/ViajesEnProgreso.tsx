/**
 * SITREP v6 - Viajes en Progreso (Rediseñado)
 * ============================================
 * Componente de viajes activos con mapa y lista
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  List,
  Truck,
  Clock,
  ChevronRight,
  Navigation,
  Package,
  Phone
} from 'lucide-react';
import { Card } from '../ui/CardV2';
import { Badge } from '../ui/BadgeV2';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';

// Mock data de viajes en progreso
const viajesMock = [
  {
    id: 'M-2025-089',
    estado: 'EN_TRANSITO',
    conductor: 'Juan López',
    vehiculo: 'ABC-123',
    telefono: '+54 261 555-0123',
    origen: 'Química Mendoza S.A.',
    destino: 'Planta Norte',
    progreso: 65,
    eta: '25 min',
    ubicacion: { lat: -32.8908, lng: -68.8272 },
    ultimaActualizacion: 'Hace 2 min',
    tipo: 'Camión Cisterna',
  },
  {
    id: 'M-2025-090',
    estado: 'EN_TRANSITO',
    conductor: 'María García',
    vehiculo: 'XYZ-789',
    telefono: '+54 261 555-0456',
    origen: 'Industrias del Sur',
    destino: 'Operador EcoResiduos',
    progreso: 40,
    eta: '45 min',
    ubicacion: { lat: -32.95, lng: -68.85 },
    ultimaActualizacion: 'Hace 5 min',
    tipo: 'Camión Volcador',
  },
  {
    id: 'M-2025-091',
    estado: 'RECIBIDO',
    conductor: 'Pedro Martínez',
    vehiculo: 'DEF-456',
    telefono: '+54 261 555-0789',
    origen: 'Metalúrgica Argentina',
    destino: 'Planta Este',
    progreso: 90,
    eta: '10 min',
    ubicacion: { lat: -32.91, lng: -68.80 },
    ultimaActualizacion: 'Hace 1 min',
    tipo: 'Camión Cisterna',
  },
  {
    id: 'M-2025-092',
    estado: 'EN_TRANSITO',
    conductor: 'Ana Rodríguez',
    vehiculo: 'GHI-789',
    telefono: '+54 261 555-0321',
    origen: 'Plásticos Argentinos',
    destino: 'Operador Sur',
    progreso: 20,
    eta: '1h 15min',
    ubicacion: { lat: -32.88, lng: -68.78 },
    ultimaActualizacion: 'Hace 8 min',
    tipo: 'Camión Volcador',
  },
];

const estadoConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  EN_TRANSITO: { label: 'En tránsito', color: 'info', icon: <Navigation size={14} className="animate-pulse" /> },
  RECIBIDO: { label: 'Por entregar', color: 'warning', icon: <Package size={14} /> },
};

interface ViajesEnProgresoProps {
  compact?: boolean;
}

export const ViajesEnProgreso: React.FC<ViajesEnProgresoProps> = ({ compact = false }) => {
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  const [vista, setVista] = useState<'mapa' | 'lista'>('lista');
  const [viajeSeleccionado, setViajeSeleccionado] = useState<string | null>(null);

  if (compact) {
    return (
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h3 className="font-semibold text-neutral-900">Viajes en Progreso</h3>
          <div className="flex bg-neutral-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setVista('mapa')}
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all min-w-[80px] ${
                vista === 'mapa' 
                  ? 'bg-white text-primary-600 shadow-sm border border-neutral-200' 
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
              }`}
            >
              <MapPin size={16} className="flex-shrink-0" />
              <span>Mapa</span>
            </button>
            <button
              onClick={() => setVista('lista')}
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all min-w-[80px] ${
                vista === 'lista' 
                  ? 'bg-white text-primary-600 shadow-sm border border-neutral-200' 
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
              }`}
            >
              <List size={16} className="flex-shrink-0" />
              <span>Lista</span>
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-4">
          {vista === 'mapa' ? (
            /* Vista de Mapa Simulado */
            <div className="relative h-48 bg-gradient-to-br from-blue-50 to-green-50 rounded-xl overflow-hidden">
              {/* Grid de fondo */}
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: `
                  linear-gradient(to right, #cbd5e1 1px, transparent 1px),
                  linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px'
              }} />
              
              {/* Ruta simulada */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <path
                  d="M 40 100 Q 100 60 180 80 T 320 120"
                  fill="none"
                  stroke="#0D8A4F"
                  strokeWidth="3"
                  strokeDasharray="8 4"
                  className="opacity-50"
                />
              </svg>

              {/* Marcadores de vehículos - POSICIONES CORREGIDAS */}
              {viajesMock.slice(0, 3).map((viaje, index) => {
                const positions = [
                  { left: '15%', top: '45%' },
                  { left: '45%', top: '30%' },
                  { left: '75%', top: '55%' },
                ];
                const pos = positions[index];
                
                return (
                  <div
                    key={viaje.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 group z-10"
                    style={{ left: pos.left, top: pos.top }}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${
                      viaje.estado === 'EN_TRANSITO' ? 'bg-info-500' : 'bg-warning-500'
                    }`}>
                      <Truck className="text-white" size={18} />
                    </div>
                    <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded-lg shadow-md whitespace-nowrap">
                      <p className="text-xs font-medium text-neutral-900">{viaje.id}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Vista de Lista */
            <div className="space-y-3">
              {viajesMock.slice(0, 3).map((viaje) => {
                const estado = estadoConfig[viaje.estado];
                return (
                  <div
                    key={viaje.id}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors text-left group"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      viaje.estado === 'EN_TRANSITO' ? 'bg-info-50' : 'bg-warning-50'
                    }`}>
                      <Truck className={viaje.estado === 'EN_TRANSITO' ? 'text-info-500' : 'text-warning-500'} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-neutral-900">{viaje.id}</span>
                        <Badge variant="soft" color={estado.color} className="text-[10px]">
                          {estado.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500 truncate">
                        {viaje.origen} → {viaje.destino}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-neutral-900">{viaje.eta}</p>
                      <p className="text-xs text-neutral-500">ETA</p>
                    </div>
                    <ChevronRight size={16} className="text-neutral-400 group-hover:text-primary-500 transition-colors" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-neutral-100">
          <button 
            onClick={() => navigate(mp('/tracking'))}
            className="w-full text-center text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            Ver todos los viajes
          </button>
        </div>
      </Card>
    );
  }

  // Vista completa (página dedicada)
  return (
    <div className="space-y-4">
      {viajesMock.map((viaje) => {
        const estado = estadoConfig[viaje.estado];
        const isSelected = viajeSeleccionado === viaje.id;
        
        return (
          <Card 
            key={viaje.id}
            className={`overflow-hidden transition-all cursor-pointer ${
              isSelected ? 'ring-2 ring-primary-500' : 'hover:shadow-md'
            }`}
            onClick={() => setViajeSeleccionado(isSelected ? null : viaje.id)}
          >
            <div className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    viaje.estado === 'EN_TRANSITO' ? 'bg-info-50' : 'bg-warning-50'
                  }`}>
                    <Truck className={viaje.estado === 'EN_TRANSITO' ? 'text-info-500' : 'text-warning-500'} size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-neutral-900">{viaje.id}</span>
                      <Badge variant="soft" color={estado.color}>
                        <span className="flex items-center gap-1">
                          {estado.icon}
                          {estado.label}
                        </span>
                      </Badge>
                    </div>
                    <p className="text-sm text-neutral-500">
                      {viaje.tipo} • {viaje.vehiculo}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-neutral-900">{viaje.eta}</p>
                  <p className="text-xs text-neutral-500">Tiempo estimado</p>
                </div>
              </div>

              {/* Progreso */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-neutral-600">Progreso del viaje</span>
                  <span className="font-medium text-neutral-900">{viaje.progreso}%</span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      viaje.estado === 'EN_TRANSITO' ? 'bg-info-500' : 'bg-warning-500'
                    }`}
                    style={{ width: `${viaje.progreso}%` }}
                  />
                </div>
              </div>

              {/* Detalles de ruta */}
              <div className="flex items-start gap-4 text-sm">
                <div className="flex-1">
                  <p className="text-xs text-neutral-500 mb-1">Origen</p>
                  <p className="font-medium text-neutral-900">{viaje.origen}</p>
                </div>
                <div className="flex items-center pt-4">
                  <div className="w-16 h-0.5 bg-neutral-200" />
                  <Navigation className="text-neutral-400 mx-1" size={16} />
                  <div className="w-16 h-0.5 bg-neutral-200" />
                </div>
                <div className="flex-1 text-right">
                  <p className="text-xs text-neutral-500 mb-1">Destino</p>
                  <p className="font-medium text-neutral-900">{viaje.destino}</p>
                </div>
              </div>

              {/* Footer info */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100 text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-neutral-600">
                    <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium">{viaje.conductor.split(' ').map(n => n[0]).join('')}</span>
                    </div>
                    <span>{viaje.conductor}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-neutral-500">
                  <Clock size={14} />
                  <span>{viaje.ultimaActualizacion}</span>
                </div>
              </div>

              {/* Acciones expandibles */}
              {isSelected && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-neutral-100 animate-in slide-in-from-top-2">
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-lg font-medium hover:bg-primary-100 transition-colors">
                    <MapPin size={16} />
                    Ver en Mapa
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-neutral-50 text-neutral-700 rounded-lg font-medium hover:bg-neutral-100 transition-colors">
                    <Phone size={16} />
                    Llamar
                  </button>
                  <div
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-400 rounded-lg font-medium cursor-default"
                  >
                    Ver Manifiesto
                  </div>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default ViajesEnProgreso;

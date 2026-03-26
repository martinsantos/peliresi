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
import { useManifiestos } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';
import type { Manifiesto } from '../../types/models';

interface ViajeData {
  id: string;
  numero: string;
  estado: string;
  conductor: string;
  vehiculo: string;
  origen: string;
  destino: string;
  ultimaActualizacion: string;
}

function mapManifiestoToViaje(m: Manifiesto): ViajeData {
  const transportista = m.transportista;
  const generador = m.generador;
  const operador = m.operador;

  const updatedAt = m.updatedAt ? new Date(m.updatedAt) : new Date(m.createdAt);
  const diffMs = Date.now() - updatedAt.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const ultimaAct = diffMin < 1 ? 'Ahora' : diffMin < 60 ? `Hace ${diffMin} min` : `Hace ${Math.floor(diffMin / 60)}h`;

  return {
    id: m.id,
    numero: m.numero || m.id.slice(-8),
    estado: m.estado,
    conductor: transportista?.razonSocial || 'Transportista',
    vehiculo: transportista?.vehiculos?.[0]?.patente || '-',
    origen: generador?.razonSocial || 'Generador',
    destino: operador?.razonSocial || 'Operador',
    ultimaActualizacion: ultimaAct,
  };
}

const estadoConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  EN_TRANSITO: { label: 'En tránsito', color: 'info', icon: <Navigation size={14} className="animate-pulse" /> },
  ENTREGADO: { label: 'Por recibir', color: 'warning', icon: <Package size={14} /> },
};

interface ViajesEnProgresoProps {
  compact?: boolean;
}

export const ViajesEnProgreso: React.FC<ViajesEnProgresoProps> = ({ compact = false }) => {
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  const [vista, setVista] = useState<'mapa' | 'lista'>('lista');
  const [viajeSeleccionado, setViajeSeleccionado] = useState<string | null>(null);

  const { data: enTransitoData, isLoading } = useManifiestos({
    estado: EstadoManifiesto.EN_TRANSITO,
    limit: 10,
  });

  const viajes: ViajeData[] = (enTransitoData?.items || []).map(mapManifiestoToViaje);

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
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-neutral-400">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : viajes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-neutral-400">
              <Truck size={32} className="mb-2 opacity-40" />
              <p className="text-sm">Sin viajes activos</p>
            </div>
          ) : vista === 'mapa' ? (
            /* Vista de Mapa Simulado */
            <div className="relative h-48 bg-gradient-to-br from-blue-50 to-green-50 rounded-xl overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: `
                  linear-gradient(to right, #cbd5e1 1px, transparent 1px),
                  linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px'
              }} />

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

              {viajes.slice(0, 3).map((viaje, index) => {
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
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 bg-info-500">
                      <Truck className="text-white" size={18} />
                    </div>
                    <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded-lg shadow-md whitespace-nowrap">
                      <p className="text-xs font-medium text-neutral-900">{viaje.numero}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Vista de Lista */
            <div className="space-y-3">
              {viajes.slice(0, 3).map((viaje) => {
                const estado = estadoConfig[viaje.estado] || estadoConfig.EN_TRANSITO;
                return (
                  <div
                    key={viaje.id}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors text-left group cursor-pointer"
                    onClick={() => navigate(mp(`/manifiestos/${viaje.id}`))}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-info-50">
                      <Truck className="text-info-500" size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-neutral-900">{viaje.numero}</span>
                        <Badge variant="soft" color={estado.color} className="text-[10px]">
                          {estado.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500 truncate">
                        {viaje.origen} → {viaje.destino}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-500">{viaje.ultimaActualizacion}</p>
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
      {isLoading ? (
        <Card className="p-8 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </Card>
      ) : viajes.length === 0 ? (
        <Card className="p-8 flex flex-col items-center justify-center text-neutral-400">
          <Truck size={48} className="mb-4 opacity-40" />
          <p className="text-lg font-medium">Sin viajes activos</p>
          <p className="text-sm">No hay manifiestos en tránsito actualmente</p>
        </Card>
      ) : (
        viajes.map((viaje) => {
          const estado = estadoConfig[viaje.estado] || estadoConfig.EN_TRANSITO;
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
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-info-50">
                      <Truck className="text-info-500" size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-neutral-900">{viaje.numero}</span>
                        <Badge variant="soft" color={estado.color}>
                          <span className="flex items-center gap-1">
                            {estado.icon}
                            {estado.label}
                          </span>
                        </Badge>
                      </div>
                      <p className="text-sm text-neutral-500">
                        {viaje.conductor} • {viaje.vehiculo}
                      </p>
                    </div>
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
                  <div className="flex items-center gap-2 text-neutral-600">
                    <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium">{viaje.conductor.split(' ').map(n => n[0]).join('')}</span>
                    </div>
                    <span>{viaje.conductor}</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-500">
                    <Clock size={14} />
                    <span>{viaje.ultimaActualizacion}</span>
                  </div>
                </div>

                {/* Acciones expandibles */}
                {isSelected && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-neutral-100 animate-in slide-in-from-top-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(mp(`/manifiestos/${viaje.id}`)); }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-lg font-medium hover:bg-primary-100 transition-colors"
                    >
                      <MapPin size={16} />
                      Ver Detalle
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(mp('/tracking')); }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-neutral-50 text-neutral-700 rounded-lg font-medium hover:bg-neutral-100 transition-colors"
                    >
                      <Navigation size={16} />
                      Tracking
                    </button>
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default ViajesEnProgreso;

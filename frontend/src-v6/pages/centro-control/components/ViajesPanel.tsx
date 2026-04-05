/**
 * CentroControl — Active/Completed Trips Accordion Panel
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../../../components/ui/CardV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { formatDateTime } from '../../../utils/formatters';
import type { EnTransitoItem } from '../../../hooks/useCentroControl';

interface ViajeRealizado {
  id: string;
  numero: string;
  transportista: string;
  origen: string;
  destino: string;
  origenPos: [number, number] | null;
  destinoPos: [number, number] | null;
  estado: string;
  fechaEntrega: string | null;
}

interface ViajesPanelProps {
  filteredEnTransito: EnTransitoItem[];
  viajesRealizados: ViajeRealizado[];
  tripFilter: string;
  onTripFilterChange: (val: string) => void;
  tripPanel: 'activos' | 'realizados';
  onTripPanelChange: (panel: 'activos' | 'realizados') => void;
  selectedTripId: string | null;
  onSelectTrip: (id: string | null) => void;
  selectedRealizadoId: string | null;
  onSelectRealizado: (id: string | null) => void;
  viajesRef: React.RefObject<HTMLDivElement | null>;
}

export const ViajesPanel: React.FC<ViajesPanelProps> = ({
  filteredEnTransito,
  viajesRealizados,
  tripFilter,
  onTripFilterChange,
  tripPanel,
  onTripPanelChange,
  selectedTripId,
  onSelectTrip,
  selectedRealizadoId,
  onSelectRealizado,
  viajesRef,
}) => {
  const navigate = useNavigate();

  return (
    <div ref={viajesRef} className="flex flex-col gap-0 lg:sticky lg:top-[6.5rem] lg:self-start max-h-[calc(100vh-8.5rem)] overflow-hidden lg:z-10">
      {/* Viajes Activos accordion */}
      <Card padding="none" className={`flex flex-col ${tripPanel === 'activos' ? 'flex-1 min-h-0' : ''}`}>
        <button
          onClick={() => onTripPanelChange(tripPanel === 'activos' ? 'realizados' : 'activos')}
          className="flex items-center justify-between p-4 border-b border-neutral-100 w-full text-left hover:bg-neutral-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-amber-600" />
            <h3 className="font-semibold text-neutral-900">Viajes Activos</h3>
            <Badge variant="soft" color="warning">{filteredEnTransito.length}</Badge>
          </div>
          <ChevronDown size={18} className={`text-neutral-400 transition-transform duration-200 ${tripPanel === 'activos' ? 'rotate-180' : ''}`} />
        </button>
        {tripPanel === 'activos' && (
          <>
            <div className="p-3 border-b border-neutral-100">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar por número o transportista..."
                  value={tripFilter}
                  onChange={e => onTripFilterChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-200 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 placeholder:text-neutral-400"
                />
              </div>
            </div>
            <div className="divide-y divide-neutral-100 flex-1 min-h-0 overflow-y-auto">
              {filteredEnTransito.map((m) => {
                const isSelected = m.manifiestoId === selectedTripId;
                return (
                  <div
                    key={m.manifiestoId}
                    className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary-50 border-l-4 border-l-primary-500'
                        : 'row-hover border-l-4 border-l-transparent'
                    }`}
                    onClick={() => onSelectTrip(isSelected ? null : m.manifiestoId)}
                  >
                    <div className={`w-3 h-3 rounded-full bg-red-500 flex-shrink-0 mt-1.5 ${isSelected ? '' : 'animate-pulse'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-semibold text-neutral-900">{m.numero}</p>
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs text-neutral-500 truncate"><span className="font-semibold text-green-700">ORIGEN:</span> {m.origen}</p>
                        <p className="text-xs text-neutral-500 truncate"><span className="font-semibold text-amber-700">TRANSPORTE:</span> {m.transportista}</p>
                        <p className="text-xs text-neutral-500 truncate"><span className="font-semibold text-blue-700">OPERADOR:</span> {m.destino}</p>
                      </div>
                      {isSelected && (
                        <button
                          className="mt-2 w-full text-center text-xs font-semibold text-primary-700 bg-primary-100 hover:bg-primary-200 rounded-lg py-1.5 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/manifiestos/${m.manifiestoId}`);
                          }}
                        >
                          Ver detalle del viaje
                        </button>
                      )}
                    </div>
                    {m.ultimaPosicion?.velocidad != null && (
                      <span className="text-xs font-medium text-neutral-500 flex-shrink-0">
                        {Math.round(m.ultimaPosicion.velocidad)} km/h
                      </span>
                    )}
                  </div>
                );
              })}
              {filteredEnTransito.length === 0 && (
                <div className="p-6 text-center text-sm text-neutral-400">
                  {tripFilter.trim() ? 'Sin resultados para la búsqueda' : 'Sin viajes activos'}
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Viajes Realizados accordion */}
      <Card padding="none" className={`flex flex-col ${tripPanel === 'realizados' ? 'flex-1 min-h-0' : ''} mt-[-1px]`}>
        <button
          onClick={() => onTripPanelChange(tripPanel === 'realizados' ? 'activos' : 'realizados')}
          className="flex items-center justify-between p-4 border-b border-neutral-100 w-full text-left hover:bg-neutral-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <h3 className="font-semibold text-neutral-900">Viajes Realizados</h3>
            <Badge variant="soft" color="success">{viajesRealizados.length}</Badge>
          </div>
          <ChevronDown size={18} className={`text-neutral-400 transition-transform duration-200 ${tripPanel === 'realizados' ? 'rotate-180' : ''}`} />
        </button>
        {tripPanel === 'realizados' && (
          <div className="divide-y divide-neutral-100 flex-1 min-h-0 overflow-y-auto">
            {viajesRealizados.map((m: any) => {
              const isSelected = m.id === selectedRealizadoId;
              return (
                <div
                  key={m.id}
                  className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 border-l-4 border-l-emerald-500'
                      : 'row-hover border-l-4 border-l-transparent'
                  }`}
                  onClick={() => onSelectRealizado(isSelected ? null : m.id)}
                >
                  <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono font-semibold text-neutral-900">{m.numero}</p>
                      <Badge variant="soft" color="success" className="text-[10px] px-1.5 py-0">Entregado</Badge>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-neutral-500 truncate"><span className="font-semibold text-green-700">ORIGEN:</span> {m.origen}</p>
                      <p className="text-xs text-neutral-500 truncate"><span className="font-semibold text-amber-700">TRANSPORTE:</span> {m.transportista}</p>
                      <p className="text-xs text-neutral-500 truncate"><span className="font-semibold text-blue-700">OPERADOR:</span> {m.destino}</p>
                    </div>
                    {m.fechaEntrega && (
                      <p className="text-[10px] text-neutral-400 mt-1">{formatDateTime(m.fechaEntrega)}</p>
                    )}
                    {isSelected && (
                      <button
                        className="mt-2 w-full text-center text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg py-1.5 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/manifiestos/${m.id}`);
                        }}
                      >
                        Ver detalle del viaje
                      </button>
                    )}
                  </div>
                  <ChevronRight size={14} className={`flex-shrink-0 mt-1 ${isSelected ? 'text-emerald-500' : 'text-neutral-300'}`} />
                </div>
              );
            })}
            {viajesRealizados.length === 0 && (
              <div className="p-6 text-center text-sm text-neutral-400">Sin viajes realizados recientes</div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

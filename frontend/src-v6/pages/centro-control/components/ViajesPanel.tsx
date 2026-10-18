/**
 * CentroControl — Active/Completed Trips Accordion Panel
 */
import React, { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Truck,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../../../components/ui/CardV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { formatDateTime } from '../../../utils/formatters';
import { hasInspectionCoordinates, operationSubject, type InspectionOperation } from '../../../services/inspectionOperations.service';
import { INSPECTION_STATE_LABELS, inspectionDate } from '../../inspecciones/inspectionPresentation';
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

export type TripPanel = 'activos' | 'realizados' | 'inspecciones' | null;

interface ViajesPanelProps {
  inspections?: InspectionOperation[];
  inspectionTotal?: number;
  inspectionError?: boolean;
  inspectionLoading?: boolean;
  selectedInspectionId?: string | null;
  onSelectInspection?: (id: string) => void;
  filteredEnTransito: EnTransitoItem[];
  viajesRealizados: ViajeRealizado[];
  tripFilter: string;
  onTripFilterChange: (val: string) => void;
  tripPanel: TripPanel;
  onTripPanelChange: (panel: TripPanel) => void;
  selectedTripId: string | null;
  onSelectTrip: (id: string | null) => void;
  selectedRealizadoId: string | null;
  onSelectRealizado: (id: string | null) => void;
  viajesRef: React.RefObject<HTMLDivElement | null>;
}

export const ViajesPanel: React.FC<ViajesPanelProps> = ({
  inspections, inspectionTotal, inspectionError, inspectionLoading, selectedInspectionId, onSelectInspection,
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
  const panelId = useId();
  const togglePanel = (panel: Exclude<TripPanel, null>) => onTripPanelChange(tripPanel === panel ? null : panel);

  return (
    <div ref={viajesRef} role="region" aria-label="Agenda y viajes" className="flex flex-col gap-0 lg:sticky lg:top-[6.5rem] lg:self-start max-h-[calc(100vh-8.5rem)] overflow-hidden lg:z-10">
      {inspections && <Card padding="none" className={`flex flex-col ${tripPanel === 'inspecciones' ? 'flex-1 min-h-0' : ''}`}>
        <button type="button" aria-expanded={tripPanel === 'inspecciones'} aria-controls={panelId + '-inspecciones'} onClick={() => togglePanel('inspecciones')} className="flex min-h-12 w-full items-center justify-between border-b border-neutral-100 p-4 text-left hover:bg-neutral-50 active:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-700">
          <span className="flex items-center gap-2"><ClipboardCheck size={18} className="text-teal-700" /><span className="font-semibold text-neutral-900">Inspecciones</span><Badge variant="soft" color="neutral">{inspectionError || inspectionLoading ? '—' : inspectionTotal ?? inspections.length}</Badge></span>
          <ChevronDown size={18} className={tripPanel === 'inspecciones' ? 'rotate-180 text-neutral-400' : 'text-neutral-400'} />
        </button>
        {tripPanel === 'inspecciones' && <div id={panelId + '-inspecciones'} className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto">
          <p className="px-4 py-2 text-xs text-neutral-500">Agenda activa · lugares de visita, no ubicación del inspector</p>
          {inspectionError && <p role="status" className="p-3 text-sm text-amber-800">No se pudo actualizar la agenda.</p>}
          {inspectionLoading ? <p className="p-4 text-sm text-neutral-500">Cargando agenda…</p> : inspections.length === 0 && !inspectionError ? <p className="p-4 text-sm text-neutral-500">Sin inspecciones activas</p> : inspections.map((row) => <div key={row.id} className={selectedInspectionId === row.id ? 'bg-teal-50 p-3' : 'p-3 hover:bg-neutral-50'}>
            <button onClick={() => onSelectInspection?.(row.id)} className="w-full text-left"><span className="block font-mono text-sm font-semibold">{row.numero}</span><span className="mt-1 block text-sm">{operationSubject(row)}</span><span className="mt-1 block text-xs text-neutral-600">{INSPECTION_STATE_LABELS[row.estado]} · {row.inspector.nombre} {row.inspector.apellido || ''}</span><span className="mt-1 block text-xs text-neutral-500">{row.fechaProgramada ? inspectionDate(row.fechaProgramada, true) + ' · ' : ''}{hasInspectionCoordinates(row) ? row.ubicacion || 'Ubicación registrada' : 'Sin coordenadas'}</span></button>
            {selectedInspectionId === row.id && <button onClick={() => navigate('/inspecciones/' + row.id)} className="mt-2 min-h-11 w-full rounded-lg bg-teal-100 text-sm font-semibold text-teal-800">Abrir expediente</button>}
          </div>)}
          {!!inspectionTotal && inspectionTotal > inspections.length && <button className="min-h-11 w-full text-sm font-semibold text-primary-800" onClick={() => navigate('/inspecciones')}>Ver las {inspectionTotal} inspecciones</button>}
        </div>}
      </Card>}
      {/* Viajes Activos accordion */}
      <Card padding="none" className={`flex flex-col ${tripPanel === 'activos' ? 'flex-1 min-h-0' : ''}`}>
        <button
          type="button" aria-expanded={tripPanel === 'activos'} aria-controls={panelId + '-activos'}
          onClick={() => togglePanel('activos')}
          className="flex min-h-12 items-center justify-between p-4 border-b border-neutral-100 w-full text-left hover:bg-neutral-50 active:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-amber-600" />
            <h3 className="font-semibold text-neutral-900">Viajes Activos</h3>
            <Badge variant="soft" color="warning">{tripFilter.trim() ? `${filteredEnTransito.length} ${filteredEnTransito.length === 1 ? 'filtrado' : 'filtrados'}` : filteredEnTransito.length}</Badge>
          </div>
          <ChevronDown size={18} className={`text-neutral-400 transition-transform duration-200 ${tripPanel === 'activos' ? 'rotate-180' : ''}`} />
        </button>
        {tripPanel === 'activos' && (
          <div id={panelId + '-activos'} className="flex min-h-0 flex-1 flex-col">
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
                    className={`p-3 flex items-start gap-3 transition-colors ${
                      isSelected
                        ? 'bg-primary-50 border-l-4 border-l-primary-500'
                        : 'row-hover border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full bg-red-500 flex-shrink-0 mt-1.5 ${isSelected ? '' : 'animate-pulse'}`} />
                    <div className="flex-1 min-w-0">
                      <button type="button" aria-label={'Seleccionar viaje ' + m.numero} aria-expanded={isSelected}
                        className="block min-h-11 w-full rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700"
                        onClick={() => onSelectTrip(isSelected ? null : m.manifiestoId)}>
                      <span className="block text-sm font-mono font-semibold text-neutral-900">{m.numero}</span>
                      <span className="mt-1 block space-y-0.5">
                        <span className="block text-xs text-neutral-600 truncate"><span className="font-semibold text-purple-700">ORIGEN:</span> {m.origen}</span>
                        <span className="block text-xs text-neutral-600 truncate"><span className="font-semibold text-orange-700">TRANSPORTE:</span> {m.transportista}</span>
                        <span className="block text-xs text-neutral-600 truncate"><span className="font-semibold text-blue-700">OPERADOR:</span> {m.destino}</span>
                      </span>
                      </button>
                      {isSelected && m.canViewDetail === true && (
                        <button
                          className="mt-2 min-h-11 w-full text-center text-xs font-semibold text-primary-800 bg-primary-100 hover:bg-primary-200 active:bg-primary-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 rounded-lg py-1.5 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/manifiestos/${m.manifiestoId}`);
                          }}
                        >
                          Ver detalle del viaje
                        </button>
                      )}
                      {isSelected && m.canViewDetail !== true && <p className="mt-2 text-xs text-neutral-600">Vista operativa · expediente restringido</p>}
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
          </div>
        )}
      </Card>

      {/* Viajes Realizados accordion */}
      <Card padding="none" className={`flex flex-col ${tripPanel === 'realizados' ? 'flex-1 min-h-0' : ''} mt-[-1px]`}>
        <button
          type="button" aria-expanded={tripPanel === 'realizados'} aria-controls={panelId + '-realizados'}
          onClick={() => togglePanel('realizados')}
          className="flex min-h-12 items-center justify-between p-4 border-b border-neutral-100 w-full text-left hover:bg-neutral-50 active:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <h3 className="font-semibold text-neutral-900">Viajes Realizados</h3>
            <Badge variant="soft" color="success">{viajesRealizados.length}</Badge>
          </div>
          <ChevronDown size={18} className={`text-neutral-400 transition-transform duration-200 ${tripPanel === 'realizados' ? 'rotate-180' : ''}`} />
        </button>
        {tripPanel === 'realizados' && (
          <div id={panelId + '-realizados'} className="divide-y divide-neutral-100 flex-1 min-h-0 overflow-y-auto">
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

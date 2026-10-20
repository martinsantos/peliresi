/**
 * SITREP v6 - Transporte Perfil Page (Mobile)
 * ============================================
 * Perfil del transportista: varios viajes simultáneos, cuenta e historial.
 * All real actions happen in ViajeEnCursoTransportista (GPS, retiro, entrega).
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Navigation,
  Calendar,
  ChevronRight,
  Radio,
  Loader2,
  Settings,
} from 'lucide-react';
import { Badge } from '../../components/ui/BadgeV2';
import { EmptyState } from '../../components/ui/EmptyState';
import { TransportistaTripQueue } from '../../components/mobile/TransportistaTripQueue';
import { AssignedHandoffs } from '../../components/mobile/AssignedHandoffs';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { useAuth } from '../../contexts/AuthContext';
import { useManifiestos } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';
import { ESTADO_LABELS } from '../../utils/constants';
import { manifestFeatureVisible } from '../../utils/manifestFeatures';
import { Button } from '../../components/ui/ButtonV2';

// Badge color helper for manifiesto estado
function estadoBadgeColor(estado: string): 'success' | 'warning' | 'info' | 'error' | 'default' {
  switch (estado) {
    case 'TRATADO': return 'success';
    case 'EN_TRANSITO': return 'info';
    case 'ENTREGADO': return 'warning';
    case 'RECHAZADO':
    case 'CANCELADO': return 'error';
    default: return 'default';
  }
}

const TransportePerfilPage: React.FC = () => {
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  const { currentUser } = useAuth();
  const multiGps=manifestFeatureVisible(import.meta.env.VITE_TRANSPORT_MULTI_GPS_ENABLED,currentUser)&&currentUser?.rol==='TRANSPORTISTA';
  const [activeTab, setActiveTab] = useState<'viaje' | 'info' | 'historial'>('viaje');

  // Active trip - manifiestos EN_TRANSITO for this transportista
  const { data: enTransitoData, isLoading: loadingViaje } = useManifiestos({ estado: EstadoManifiesto.EN_TRANSITO, limit: 50 });
  const viajesEnCurso = enTransitoData?.items || [];
  const viajeEnCurso = viajesEnCurso[0] || null;

  // Assigned trips - manifiestos APROBADO (pending pickup)
  const { data: aprobadosData, isLoading: loadingAprobados } = useManifiestos({ estado: EstadoManifiesto.APROBADO, limit: 50 });
  const viajesAsignados = aprobadosData?.items || [];

  // The carrier's physical journey is over at delivery; the manifest may still
  // await operator reception, treatment or certification.
  const { data: historialData, isLoading: loadingHistorial } = useManifiestos({ fase: 'post_entrega', limit: 50 });
  const historialViajes = historialData?.items || [];

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Status badge */}
      {viajeEnCurso && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success-100 text-success-700 border border-success-200">
            <Radio size={14} className="animate-pulse" />
            <span className="text-xs font-semibold">{viajesEnCurso.length} en tránsito</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
        {[
          { id: 'viaje', label: 'Viajes', icon: Navigation },
          { id: 'info', label: 'Cuenta', icon: Truck },
          { id: 'historial', label: 'Historial', icon: Calendar },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'viaje' | 'info' | 'historial')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all rounded-lg ${
                isActive
                  ? 'text-primary-700 bg-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {/* === TAB: VIAJES === */}
        {activeTab === 'viaje' && (
          <div className="space-y-4">
          {multiGps&&<Button fullWidth leftIcon={<Navigation size={18}/>} onClick={()=>navigate(mp('/transporte/cargas'))}>Cargas en este móvil</Button>}
          <AssignedHandoffs/>
          {(loadingViaje || loadingAprobados)
            ? <p role="status" className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-700">Cargando viajes…</p>
            : <TransportistaTripQueue
                activeTrips={viajesEnCurso}
                pendingTrips={viajesAsignados}
                activeTotal={enTransitoData?.total}
                pendingTotal={aprobadosData?.total}
                simultaneousGpsAvailable={multiGps}
                onOpenTrip={(tripId) => navigate(mp(`/transporte/viaje/${tripId}`))}
              />}
          </div>)}

        {/* === TAB: INFORMACIÓN === */}
        {activeTab === 'info' && (
          <div className="space-y-4 animate-fade-in">
            {/* The account belongs to the carrier. Trip-specific data belongs in each manifest. */}
            <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm">
              <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">Cuenta de transporte</h3>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
                  {currentUser?.avatar || currentUser?.nombre?.charAt(0) || 'T'}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-neutral-900">{currentUser?.nombre || 'Transportista'}</p>
                  <p className="text-sm text-neutral-500">{currentUser?.email || ''}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="soft" color="warning">{currentUser?.rol || 'TRANSPORTISTA'}</Badge>
                  </div>
                </div>
              </div>
              {currentUser?.actorId && (
                <button
                  onClick={() => navigate(mp(`/admin/actores/transportistas/${currentUser.actorId}`))}
                  className="w-full flex items-center justify-center gap-2 mt-3 py-3 bg-primary-50 border border-primary-200 rounded-xl text-primary-700 font-medium hover:bg-primary-100 transition-colors"
                >
                  <Settings size={16} />
                  Ver vehículos y conductores
                </button>
              )}
              {(currentUser?.telefono || currentUser?.ubicacion) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4 pt-4 border-t border-neutral-100">
                  {currentUser.telefono && (
                    <div>
                      <p className="text-xs text-neutral-500">Teléfono</p>
                      <p className="text-sm font-semibold text-neutral-900">{currentUser.telefono}</p>
                    </div>
                  )}
                  {currentUser.ubicacion && (
                    <div>
                      <p className="text-xs text-neutral-500">Ubicación</p>
                      <p className="text-sm font-semibold text-neutral-900">{currentUser.ubicacion}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-sm text-neutral-600">Para ver carga, chofer, móvil y GPS, abrí el manifiesto correspondiente en Viajes.</p>
          </div>
        )}

        {/* === TAB: HISTORIAL === */}
        {activeTab === 'historial' && (
          <div className="space-y-3 animate-fade-in">
            {loadingHistorial ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-neutral-400" size={32} />
              </div>
            ) : historialViajes.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No hay viajes completados"
                description="Los viajes entregados aparecerán aquí, aunque el tratamiento siga pendiente."
              />
            ) : (
              historialViajes.map((m) => (
                <div key={m.id} className="bg-white rounded-xl p-4 border border-neutral-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-neutral-900">#{m.numero}</span>
                    <span className="text-xs text-neutral-500">Entregado {formatDate(m.fechaEntrega || m.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <span className="truncate">{m.generador?.razonSocial || '---'}</span>
                    <ChevronRight size={14} className="text-neutral-400 flex-shrink-0" />
                    <span className="truncate">{m.operador?.razonSocial || '---'}</span>
                  </div>
                  <div className="mt-3">
                    <Badge variant="soft" color={estadoBadgeColor(m.estado)}>
                      {ESTADO_LABELS[m.estado] || m.estado}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransportePerfilPage;

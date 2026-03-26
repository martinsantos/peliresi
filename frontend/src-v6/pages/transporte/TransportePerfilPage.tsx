/**
 * SITREP v6 - Transporte Perfil Page (Mobile)
 * ============================================
 * Perfil del transportista: viajes asignados, viaje en curso, historial.
 * Tab Viaje: EN_TRANSITO → resumen + "Ir al Viaje" (→ ViajeEnCursoTransportista),
 *            APROBADO → lista "Tomar Viaje", vacío → EmptyState.
 * All real actions happen in ViajeEnCursoTransportista (GPS, retiro, entrega).
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Phone,
  MapPin,
  Clock,
  Navigation,
  Package,
  Calendar,
  ChevronRight,
  MessageSquare,
  AlertCircle,
  Flag,
  Radio,
  Loader2,
  Settings,
} from 'lucide-react';
import { Badge } from '../../components/ui/BadgeV2';
import { EmptyState } from '../../components/ui/EmptyState';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { useAuth } from '../../contexts/AuthContext';
import { useManifiestos } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';
import { formatDateTime } from '../../utils/formatters';

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
  const [activeTab, setActiveTab] = useState<'viaje' | 'info' | 'historial'>('viaje');

  // Active trip - manifiestos EN_TRANSITO for this transportista
  const { data: enTransitoData, isLoading: loadingViaje } = useManifiestos({ estado: EstadoManifiesto.EN_TRANSITO, limit: 1 });
  const viajeEnCurso = enTransitoData?.items?.[0] || null;

  // Assigned trips - manifiestos APROBADO (pending pickup)
  const { data: aprobadosData, isLoading: loadingAprobados } = useManifiestos({ estado: EstadoManifiesto.APROBADO, limit: 10 });
  const viajesAsignados = aprobadosData?.items || [];

  // History - completed manifiestos
  const { data: historialData, isLoading: loadingHistorial } = useManifiestos({ estado: EstadoManifiesto.TRATADO, limit: 10 });
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
            <span className="text-xs font-semibold">Viaje en Tránsito</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
        {[
          { id: 'viaje', label: 'Viaje', icon: Navigation },
          { id: 'info', label: 'Info', icon: Truck },
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
        {/* === TAB: VIAJE ACTUAL === */}
        {activeTab === 'viaje' && (
          <>
            {(loadingViaje || loadingAprobados) ? (
              <div className="space-y-4 py-4 animate-pulse">
                <div className="h-24 bg-neutral-200 rounded-2xl" />
                <div className="h-16 bg-neutral-200 rounded-2xl" />
                <div className="h-16 bg-neutral-200 rounded-2xl" />
              </div>
            ) : !viajeEnCurso && viajesAsignados.length > 0 ? (
              /* === VIAJES ASIGNADOS (APROBADO) - Pendientes de retiro === */
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                    <Package className="text-warning-600" size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">Viajes Asignados</h3>
                    <p className="text-xs text-neutral-500">{viajesAsignados.length} manifiesto{viajesAsignados.length !== 1 ? 's' : ''} pendiente{viajesAsignados.length !== 1 ? 's' : ''} de retiro</p>
                  </div>
                </div>

                {viajesAsignados.map((m) => (
                  <div key={m.id} className="bg-white rounded-2xl p-4 border border-warning-200 hover:border-warning-300 transition-colors shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-neutral-100 rounded-full">
                        <span className="text-xs text-neutral-500">Manifiesto</span>
                        <span className="text-sm font-mono font-semibold text-neutral-900">#{m.numero}</span>
                      </div>
                      <Badge variant="soft" color="warning">APROBADO</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-1 text-neutral-500 mb-1">
                          <MapPin size={12} />
                          <span className="text-xs">GENERADOR</span>
                        </div>
                        <p className="text-sm font-medium text-neutral-900 truncate">{m.generador?.razonSocial || '---'}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-neutral-500 mb-1">
                          <Flag size={12} />
                          <span className="text-xs">OPERADOR</span>
                        </div>
                        <p className="text-sm font-medium text-neutral-900 truncate">{m.operador?.razonSocial || '---'}</p>
                      </div>
                    </div>

                    {m.residuos && m.residuos.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {m.residuos.slice(0, 3).map((r: any, i: number) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-600">
                            {r.tipoResiduoId || r.tipoResiduo?.nombre || 'Residuo'} — {r.cantidad} {r.unidad}
                          </span>
                        ))}
                        {m.residuos.length > 3 && (
                          <span className="text-xs px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-500">
                            +{m.residuos.length - 3} más
                          </span>
                        )}
                      </div>
                    )}

                    {m.createdAt && (
                      <p className="text-xs text-neutral-500 mb-3">
                        <Calendar size={11} className="inline mr-1" />
                        Creado: {formatDate(m.createdAt)}
                      </p>
                    )}

                    <button
                      onClick={() => navigate(mp(`/transporte/viaje/${m.id}`))}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold bg-warning-600 text-white hover:bg-warning-500 transition-all"
                    >
                      <Truck size={18} />
                      Tomar Viaje
                    </button>
                  </div>
                ))}
              </div>
            ) : !viajeEnCurso ? (
              <EmptyState
                icon="inbox"
                title="No hay viajes en curso"
                description="Cuando tengas un manifiesto en tránsito o asignado, aparecerá aquí."
              />
            ) : (
              /* === VIAJE EN CURSO (EN_TRANSITO) — Resumen + link a tracking real === */
              <div className="space-y-4 animate-fade-in">
                {/* Viaje activo card */}
                <div className="bg-gradient-to-br from-success-600 to-success-700 rounded-2xl p-5 border border-success-500/30 shadow-lg shadow-success-600/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full">
                      <span className="text-xs text-white/80">Manifiesto</span>
                      <span className="text-sm font-mono font-bold text-white">#{viajeEnCurso.numero}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-full">
                      <Radio size={12} className="text-white animate-pulse" />
                      <span className="text-xs font-semibold text-white">EN TRÁNSITO</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-1 text-white/70 mb-1">
                        <MapPin size={12} />
                        <span className="text-xs">ORIGEN</span>
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{viajeEnCurso.generador?.razonSocial || '---'}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-white/70 mb-1">
                        <Flag size={12} />
                        <span className="text-xs">DESTINO</span>
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{viajeEnCurso.operador?.razonSocial || '---'}</p>
                    </div>
                  </div>

                  {viajeEnCurso.residuos && viajeEnCurso.residuos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {viajeEnCurso.residuos.slice(0, 3).map((r: any, i: number) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-white/15 rounded-full text-white/90">
                          {r.tipoResiduo?.nombre || r.tipoResiduoId || 'Residuo'} — {r.cantidad} {r.unidad}
                        </span>
                      ))}
                      {viajeEnCurso.residuos.length > 3 && (
                        <span className="text-xs px-2 py-0.5 bg-white/15 rounded-full text-white/70">
                          +{viajeEnCurso.residuos.length - 3} más
                        </span>
                      )}
                    </div>
                  )}

                  {viajeEnCurso.fechaRetiro && (
                    <p className="text-xs text-white/60 mb-4">
                      <Clock size={11} className="inline mr-1" />
                      Retiro: {formatDateTime(viajeEnCurso.fechaRetiro)}
                    </p>
                  )}

                  <button
                    onClick={() => navigate(mp(`/transporte/viaje/${viajeEnCurso.id}`))}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold bg-white text-success-700 hover:bg-white/90 transition-all shadow-lg"
                  >
                    <Navigation size={18} />
                    Ir al Viaje
                  </button>
                </div>

                {/* Transportista info */}
                <div className="bg-white rounded-xl p-4 border border-neutral-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck size={14} className="text-neutral-500" />
                    <span className="text-xs text-neutral-500 uppercase">Transportista</span>
                  </div>
                  <p className="text-sm font-semibold text-neutral-900">{viajeEnCurso.transportista?.razonSocial || '---'}</p>
                  {viajeEnCurso.transportista?.cuit && (
                    <p className="text-xs text-neutral-500 mt-1">CUIT: {viajeEnCurso.transportista.cuit}</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* === TAB: INFORMACIÓN === */}
        {activeTab === 'info' && (
          <div className="space-y-4 animate-fade-in">
            {/* User / Conductor info from auth */}
            <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm">
              <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">Conductor</h3>
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
              <div className="grid grid-cols-2 gap-3 mt-4">
                {currentUser?.telefono && (
                  <button className="flex items-center justify-center gap-2 py-3 bg-neutral-100 rounded-xl text-neutral-700 font-medium hover:bg-neutral-200 transition-colors">
                    <Phone size={18} />
                    Llamar
                  </button>
                )}
                <button className="flex items-center justify-center gap-2 py-3 bg-neutral-100 rounded-xl text-neutral-700 font-medium hover:bg-neutral-200 transition-colors">
                  <MessageSquare size={18} />
                  Mensaje
                </button>
              </div>
              {currentUser?.actorId && (
                <button
                  onClick={() => navigate(mp(`/admin/actores/transportistas/${currentUser.actorId}`))}
                  className="w-full flex items-center justify-center gap-2 mt-3 py-3 bg-primary-50 border border-primary-200 rounded-xl text-primary-700 font-medium hover:bg-primary-100 transition-colors"
                >
                  <Settings size={16} />
                  Gestionar vehículos y conductores
                </button>
              )}
              {(currentUser?.telefono || currentUser?.ubicacion) && (
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-100">
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

            {/* Transportista / Trip info */}
            {viajeEnCurso ? (
              <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm">
                <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">Transportista</h3>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center">
                    <Truck className="text-white" size={28} />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-neutral-900">{viajeEnCurso.transportista?.razonSocial || '---'}</p>
                    {viajeEnCurso.transportista?.cuit && (
                      <p className="text-sm text-neutral-500">CUIT: {viajeEnCurso.transportista.cuit}</p>
                    )}
                    {viajeEnCurso.transportista?.numeroHabilitacion && (
                      <p className="text-xs text-neutral-400">Hab. {viajeEnCurso.transportista.numeroHabilitacion}</p>
                    )}
                  </div>
                </div>
                {(viajeEnCurso.transportista?.domicilio || viajeEnCurso.transportista?.telefono) && (
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-100">
                    {viajeEnCurso.transportista.domicilio && (
                      <div>
                        <p className="text-xs text-neutral-500">Domicilio</p>
                        <p className="text-sm font-semibold text-neutral-900">{viajeEnCurso.transportista.domicilio}</p>
                      </div>
                    )}
                    {viajeEnCurso.transportista.telefono && (
                      <div>
                        <p className="text-xs text-neutral-500">Teléfono</p>
                        <p className="text-sm font-semibold text-neutral-900">{viajeEnCurso.transportista.telefono}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm">
                <div className="flex items-center justify-center gap-2 py-6 text-neutral-400">
                  <AlertCircle size={18} />
                  <p className="text-sm">Selecciona un viaje para ver detalles del transportista</p>
                </div>
              </div>
            )}

            {/* Carga - only if trip active and residuos available */}
            {viajeEnCurso && viajeEnCurso.residuos && viajeEnCurso.residuos.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm">
                <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">Carga Transportada</h3>
                <div className="space-y-3 animate-fade-in">
                  {viajeEnCurso.residuos.map((residuo, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                      <div>
                        <p className="font-medium text-neutral-900">{residuo.tipoResiduoId}</p>
                      </div>
                      <span className="text-sm font-mono font-semibold text-primary-600">
                        {residuo.cantidad} {residuo.unidad}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                description="Los manifiestos finalizados aparecerán aquí."
              />
            ) : (
              historialViajes.map((m) => (
                <div key={m.id} className="bg-white rounded-xl p-4 border border-neutral-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-neutral-900">#{m.numero}</span>
                    <span className="text-xs text-neutral-500">{formatDate(m.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <span className="truncate">{m.generador?.razonSocial || '---'}</span>
                    <ChevronRight size={14} className="text-neutral-400 flex-shrink-0" />
                    <span className="truncate">{m.operador?.razonSocial || '---'}</span>
                  </div>
                  <div className="mt-3">
                    <Badge variant="soft" color={estadoBadgeColor(m.estado)}>
                      {m.estado}
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

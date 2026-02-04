/**
 * SITREP v6 - Transporte Perfil Page (Mobile)
 * ============================================
 * Perfil del transportista con viaje en curso
 * Mapa real con OpenStreetMap + Leaflet
 * Uses real API data via useManifiestos hook
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
  CheckCircle2,
  Play,
  Pause,
  Flag,
  AlertTriangle,
  Radio,
  Wifi,
  Battery,
  Share2,
  Map as MapIcon,
  List,
  LocateFixed,
  Loader2,
} from 'lucide-react';
import { Badge } from '../../components/ui/BadgeV2';
import { EmptyState } from '../../components/ui/EmptyState';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { useAuth } from '../../contexts/AuthContext';
import { useManifiestos } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';
import { toast } from '../../components/ui/Toast';

// Importar Leaflet dinámicamente para evitar SSR issues
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix para íconos de Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Iconos personalizados
const origenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const destinoIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const vehiculoIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #3b82f6; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// Default Mendoza coordinates (used when no GPS data available)
const DEFAULT_COORDS = {
  origen: [-32.9287, -68.8535] as [number, number],
  destino: [-32.8908, -68.8272] as [number, number],
  centro: [-32.9050, -68.8400] as [number, number],
  ruta: [
    [-32.9287, -68.8535],
    [-32.9250, -68.8500],
    [-32.9200, -68.8480],
    [-32.9150, -68.8450],
    [-32.9100, -68.8420],
    [-32.9050, -68.8400],
    [-32.9000, -68.8350],
    [-32.8950, -68.8300],
    [-32.8908, -68.8272],
  ] as [number, number][],
};

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
  const [viajeStatus, setViajeStatus] = useState<'ACTIVO' | 'PAUSADO'>('ACTIVO');
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [showIncidenteModal, setShowIncidenteModal] = useState(false);
  const [vistaMapa, setVistaMapa] = useState(true);
  const mapRef = useRef<L.Map | null>(null);

  // Active trip - manifiestos EN_TRANSITO for this transportista
  const { data: enTransitoData, isLoading: loadingViaje } = useManifiestos({ estado: EstadoManifiesto.EN_TRANSITO, limit: 1 });
  const viajeEnCurso = enTransitoData?.items?.[0] || null;

  // History - completed manifiestos
  const { data: historialData, isLoading: loadingHistorial } = useManifiestos({ estado: EstadoManifiesto.TRATADO, limit: 10 });
  const historialViajes = historialData?.items || [];

  // Centrar mapa cuando cambia la vista
  useEffect(() => {
    if (activeTab === 'viaje' && mapRef.current && vistaMapa && viajeEnCurso) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
        mapRef.current?.fitBounds([
          DEFAULT_COORDS.origen,
          DEFAULT_COORDS.destino
        ], { padding: [50, 50] });
      }, 100);
    }
  }, [activeTab, vistaMapa, viajeEnCurso]);

  const handlePausar = () => {
    setViajeStatus(viajeStatus === 'ACTIVO' ? 'PAUSADO' : 'ACTIVO');
  };

  const handleFinalizar = () => {
    setShowFinalizarModal(true);
  };

  const handleIncidente = () => {
    setShowIncidenteModal(true);
  };

  const confirmarFinalizar = () => {
    setShowFinalizarModal(false);
    toast.success('Viaje finalizado exitosamente');
    navigate(mp('/manifiestos'));
  };

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
    <div className="min-h-screen bg-neutral-900">
      {/* Header - Estilo oscuro profesional */}
      <header className="sticky top-0 z-50 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center bg-neutral-800 rounded-xl text-white hover:bg-neutral-700 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <p className="text-xs text-neutral-400 font-medium tracking-wider">
                {viajeEnCurso ? 'VIAJE ACTIVO' : 'TRANSPORTE'}
              </p>
              <h1 className="text-lg font-bold text-white leading-tight">
                {viajeEnCurso ? 'Viaje en Curso' : 'Mi Perfil'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Badge de estado */}
            {viajeEnCurso && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                viajeStatus === 'ACTIVO'
                  ? 'bg-success-500/20 text-success-400 border border-success-500/30'
                  : 'bg-warning-500/20 text-warning-400 border border-warning-500/30'
              }`}>
                <Radio size={14} className={viajeStatus === 'ACTIVO' ? 'animate-pulse' : ''} />
                <span className="text-xs font-semibold">{viajeStatus === 'ACTIVO' ? 'Activo' : 'Pausado'}</span>
              </div>
            )}

            <button className="w-10 h-10 flex items-center justify-center bg-neutral-800 rounded-xl text-white hover:bg-neutral-700">
              <Share2 size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-1">
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
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all rounded-t-lg ${
                  isActive
                    ? 'text-white bg-neutral-800 border-t-2 border-primary-500'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="p-4 space-y-4 pb-32">
        {/* === TAB: VIAJE ACTUAL === */}
        {activeTab === 'viaje' && (
          <>
            {loadingViaje ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-neutral-400" size={32} />
              </div>
            ) : !viajeEnCurso ? (
              <EmptyState
                icon="inbox"
                title="No hay viajes en curso"
                description="Cuando tengas un manifiesto en tránsito, aparecerá aquí con el seguimiento en tiempo real."
                className="text-neutral-400 [&_h3]:text-white [&_p]:text-neutral-400"
              />
            ) : (
              <>
                {/* Trip Status & Manifiesto Info */}
                <div className="bg-neutral-800 rounded-2xl p-5 border border-neutral-700">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Clock className="text-neutral-400" size={20} />
                    <span className="text-2xl font-bold text-white tracking-tight">
                      {viajeEnCurso.estado}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-700">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-neutral-400 mb-1">
                        <Package size={14} />
                        <span className="text-xs">GENERADOR</span>
                      </div>
                      <p className="text-sm font-semibold text-white truncate">
                        {viajeEnCurso.generador?.razonSocial || '---'}
                      </p>
                    </div>
                    <div className="text-center border-l border-neutral-700">
                      <div className="flex items-center justify-center gap-1 text-neutral-400 mb-1">
                        <Flag size={14} />
                        <span className="text-xs">OPERADOR</span>
                      </div>
                      <p className="text-sm font-semibold text-white truncate">
                        {viajeEnCurso.operador?.razonSocial || '---'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* GPS Status */}
                <div className="flex items-center justify-between bg-neutral-800/50 rounded-xl px-4 py-3 border border-neutral-700/50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-success-500/20 rounded-lg flex items-center justify-center">
                      <LocateFixed className="text-success-400" size={16} />
                    </div>
                    <div>
                      <p className="text-xs text-neutral-400">GPS</p>
                      <p className="text-sm text-white font-mono">
                        {DEFAULT_COORDS.centro[0].toFixed(6)}, {DEFAULT_COORDS.centro[1].toFixed(6)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wifi className="text-success-400" size={16} />
                    <Battery className="text-success-400" size={16} />
                  </div>
                </div>

                {/* Manifiesto Badge */}
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 rounded-full border border-neutral-700">
                    <span className="text-xs text-neutral-400">Manifiesto</span>
                    <span className="text-sm font-mono font-semibold text-white">#{viajeEnCurso.numero}</span>
                  </div>
                </div>

                {/* Botones de Acción Principales */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handlePausar}
                    className={`flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition-all ${
                      viajeStatus === 'ACTIVO'
                        ? 'bg-warning-500/20 text-warning-400 border-2 border-warning-500/30 hover:bg-warning-500/30'
                        : 'bg-success-500/20 text-success-400 border-2 border-success-500/30 hover:bg-success-500/30'
                    }`}
                  >
                    {viajeStatus === 'ACTIVO' ? <Pause size={20} /> : <Play size={20} />}
                    {viajeStatus === 'ACTIVO' ? 'Pausar' : 'Reanudar'}
                  </button>

                  <button
                    onClick={handleIncidente}
                    className="flex items-center justify-center gap-2 py-4 rounded-xl font-semibold bg-error-500/20 text-error-400 border-2 border-error-500/30 hover:bg-error-500/30 transition-all"
                  >
                    <AlertTriangle size={20} />
                    Incidente
                  </button>
                </div>

                <button
                  onClick={handleFinalizar}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold bg-success-600 text-white shadow-lg shadow-success-600/25 hover:bg-success-500 transition-all"
                >
                  <CheckCircle2 size={20} />
                  Finalizar Viaje
                </button>

                {/* Toggle Mapa/Lista */}
                <div className="flex bg-neutral-800 rounded-xl p-1">
                  <button
                    onClick={() => setVistaMapa(false)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      !vistaMapa
                        ? 'bg-neutral-700 text-white'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <List size={16} />
                    Detalles
                  </button>
                  <button
                    onClick={() => setVistaMapa(true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      vistaMapa
                        ? 'bg-neutral-700 text-white'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <MapIcon size={16} />
                    Mapa
                  </button>
                </div>

                {/* Mapa Real o Detalles del viaje */}
                {vistaMapa ? (
                  <div className="h-80 rounded-2xl overflow-hidden border-2 border-neutral-700 relative">
                    <MapContainer
                      center={DEFAULT_COORDS.centro}
                      zoom={13}
                      style={{ height: '100%', width: '100%' }}
                      ref={mapRef}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />

                      {/* Ruta */}
                      <Polyline
                        positions={DEFAULT_COORDS.ruta}
                        color="#3b82f6"
                        weight={4}
                        opacity={0.8}
                        dashArray="10, 10"
                      />

                      {/* Marcador Origen */}
                      <Marker position={DEFAULT_COORDS.origen} icon={origenIcon}>
                        <Popup>
                          <div className="text-center">
                            <p className="font-semibold">Origen</p>
                            <p className="text-sm">{viajeEnCurso.generador?.razonSocial || 'Generador'}</p>
                          </div>
                        </Popup>
                      </Marker>

                      {/* Marcador Destino */}
                      <Marker position={DEFAULT_COORDS.destino} icon={destinoIcon}>
                        <Popup>
                          <div className="text-center">
                            <p className="font-semibold">Destino</p>
                            <p className="text-sm">{viajeEnCurso.operador?.razonSocial || 'Operador'}</p>
                          </div>
                        </Popup>
                      </Marker>

                      {/* Marcador Vehículo Actual */}
                      <Marker position={DEFAULT_COORDS.centro} icon={vehiculoIcon}>
                        <Popup>
                          <div className="text-center">
                            <p className="font-semibold">Vehículo en tránsito</p>
                            <p className="text-sm">Manifiesto #{viajeEnCurso.numero}</p>
                          </div>
                        </Popup>
                      </Marker>

                      {/* Círculo de precisión GPS */}
                      <Circle
                        center={DEFAULT_COORDS.centro}
                        radius={100}
                        pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1 }}
                      />
                    </MapContainer>

                    {/* Overlay de info */}
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none">
                      <div className="bg-white/95 backdrop-blur rounded-xl px-3 py-2 shadow-lg pointer-events-auto">
                        <p className="text-xs text-neutral-500">Estado</p>
                        <p className="text-lg font-bold text-neutral-900">{viajeEnCurso.estado}</p>
                      </div>
                      <div className="bg-white/95 backdrop-blur rounded-xl px-3 py-2 shadow-lg pointer-events-auto">
                        <p className="text-xs text-neutral-500">Manifiesto</p>
                        <p className="text-lg font-bold text-primary-600">#{viajeEnCurso.numero}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 animate-fade-in">
                    {/* Trip details from real data */}
                    <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={14} className="text-neutral-400" />
                        <span className="text-xs text-neutral-400 uppercase">Generador (Origen)</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{viajeEnCurso.generador?.razonSocial || '---'}</p>
                      {viajeEnCurso.generador?.domicilio && (
                        <p className="text-xs text-neutral-400 mt-1">{viajeEnCurso.generador.domicilio}</p>
                      )}
                    </div>
                    <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Flag size={14} className="text-neutral-400" />
                        <span className="text-xs text-neutral-400 uppercase">Operador (Destino)</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{viajeEnCurso.operador?.razonSocial || '---'}</p>
                      {viajeEnCurso.operador?.domicilio && (
                        <p className="text-xs text-neutral-400 mt-1">{viajeEnCurso.operador.domicilio}</p>
                      )}
                    </div>
                    <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck size={14} className="text-neutral-400" />
                        <span className="text-xs text-neutral-400 uppercase">Transportista</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{viajeEnCurso.transportista?.razonSocial || '---'}</p>
                      {viajeEnCurso.transportista?.cuit && (
                        <p className="text-xs text-neutral-400 mt-1">CUIT: {viajeEnCurso.transportista.cuit}</p>
                      )}
                    </div>
                    {viajeEnCurso.fechaRetiro && (
                      <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock size={14} className="text-neutral-400" />
                          <span className="text-xs text-neutral-400 uppercase">Fecha de retiro</span>
                        </div>
                        <p className="text-sm font-semibold text-white">{formatDate(viajeEnCurso.fechaRetiro)}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* === TAB: INFORMACIÓN === */}
        {activeTab === 'info' && (
          <div className="space-y-4 animate-fade-in">
            {/* User / Conductor info from auth */}
            <div className="bg-neutral-800 rounded-2xl p-5 border border-neutral-700">
              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Conductor</h3>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
                  {currentUser?.avatar || currentUser?.nombre?.charAt(0) || 'T'}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-white">{currentUser?.nombre || 'Transportista'}</p>
                  <p className="text-sm text-neutral-400">{currentUser?.email || ''}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="soft" color="primary">{currentUser?.rol || 'TRANSPORTISTA'}</Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {currentUser?.telefono && (
                  <button className="flex items-center justify-center gap-2 py-3 bg-neutral-700 rounded-xl text-white font-medium hover:bg-neutral-600 transition-colors">
                    <Phone size={18} />
                    Llamar
                  </button>
                )}
                <button className="flex items-center justify-center gap-2 py-3 bg-neutral-700 rounded-xl text-white font-medium hover:bg-neutral-600 transition-colors">
                  <MessageSquare size={18} />
                  Mensaje
                </button>
              </div>
              {(currentUser?.telefono || currentUser?.ubicacion) && (
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-700">
                  {currentUser.telefono && (
                    <div>
                      <p className="text-xs text-neutral-400">Teléfono</p>
                      <p className="text-sm font-semibold text-white">{currentUser.telefono}</p>
                    </div>
                  )}
                  {currentUser.ubicacion && (
                    <div>
                      <p className="text-xs text-neutral-400">Ubicación</p>
                      <p className="text-sm font-semibold text-white">{currentUser.ubicacion}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Transportista / Trip info */}
            {viajeEnCurso ? (
              <div className="bg-neutral-800 rounded-2xl p-5 border border-neutral-700">
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Transportista</h3>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center">
                    <Truck className="text-white" size={28} />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-white">{viajeEnCurso.transportista?.razonSocial || '---'}</p>
                    {viajeEnCurso.transportista?.cuit && (
                      <p className="text-sm text-neutral-400">CUIT: {viajeEnCurso.transportista.cuit}</p>
                    )}
                    {viajeEnCurso.transportista?.numeroHabilitacion && (
                      <p className="text-xs text-neutral-500">Hab. {viajeEnCurso.transportista.numeroHabilitacion}</p>
                    )}
                  </div>
                </div>
                {(viajeEnCurso.transportista?.domicilio || viajeEnCurso.transportista?.telefono) && (
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-700">
                    {viajeEnCurso.transportista.domicilio && (
                      <div>
                        <p className="text-xs text-neutral-400">Domicilio</p>
                        <p className="text-sm font-semibold text-white">{viajeEnCurso.transportista.domicilio}</p>
                      </div>
                    )}
                    {viajeEnCurso.transportista.telefono && (
                      <div>
                        <p className="text-xs text-neutral-400">Teléfono</p>
                        <p className="text-sm font-semibold text-white">{viajeEnCurso.transportista.telefono}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-neutral-800 rounded-2xl p-5 border border-neutral-700">
                <div className="flex items-center justify-center gap-2 py-6 text-neutral-400">
                  <AlertCircle size={18} />
                  <p className="text-sm">Selecciona un viaje para ver detalles del transportista</p>
                </div>
              </div>
            )}

            {/* Carga - only if trip active and residuos available */}
            {viajeEnCurso && viajeEnCurso.residuos && viajeEnCurso.residuos.length > 0 && (
              <div className="bg-neutral-800 rounded-2xl p-5 border border-neutral-700">
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Carga Transportada</h3>
                <div className="space-y-3 animate-fade-in">
                  {viajeEnCurso.residuos.map((residuo, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-neutral-700/50 rounded-xl">
                      <div>
                        <p className="font-medium text-white">{residuo.tipoResiduoId}</p>
                      </div>
                      <span className="text-sm font-mono font-semibold text-primary-400">
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
                className="text-neutral-400 [&_h3]:text-white [&_p]:text-neutral-400"
              />
            ) : (
              historialViajes.map((m) => (
                <div key={m.id} className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-white">#{m.numero}</span>
                    <span className="text-xs text-neutral-400">{formatDate(m.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-300">
                    <span className="truncate">{m.generador?.razonSocial || '---'}</span>
                    <ChevronRight size={14} className="text-neutral-500 flex-shrink-0" />
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

      {/* Modal Finalizar */}
      {showFinalizarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-800 rounded-2xl p-6 w-full max-w-sm border border-neutral-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-success-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="text-success-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Finalizar Viaje</h3>
              <p className="text-neutral-400">¿Confirmas que has llegado al destino y deseas finalizar el viaje?</p>
            </div>
            <div className="space-y-3 animate-fade-in">
              <button
                onClick={confirmarFinalizar}
                className="w-full py-4 bg-success-600 text-white rounded-xl font-semibold hover:bg-success-500 transition-colors"
              >
                Sí, Finalizar
              </button>
              <button
                onClick={() => setShowFinalizarModal(false)}
                className="w-full py-4 bg-neutral-700 text-white rounded-xl font-semibold hover:bg-neutral-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Incidente */}
      {showIncidenteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-800 rounded-2xl p-6 w-full max-w-sm border border-neutral-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-error-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-error-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Reportar Incidente</h3>
              <p className="text-neutral-400">Selecciona el tipo de incidente:</p>
            </div>
            <div className="space-y-2 mb-4">
              {['Demora en ruta', 'Problema mecánico', 'Accidente', 'Otro'].map((tipo) => (
                <button
                  key={tipo}
                  className="w-full py-3 bg-neutral-700 text-white rounded-xl font-medium hover:bg-neutral-600 transition-colors text-left px-4"
                >
                  {tipo}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowIncidenteModal(false)}
              className="w-full py-3 bg-neutral-700 text-white rounded-xl font-semibold hover:bg-neutral-600 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransportePerfilPage;

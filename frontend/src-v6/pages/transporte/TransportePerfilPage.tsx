/**
 * SITREP v6 - Transporte Perfil Page (Mobile)
 * ============================================
 * Perfil del transportista con viaje en curso
 * Mapa real con OpenStreetMap + Leaflet
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  User,
  Phone,
  MapPin,
  Clock,
  Navigation,
  Package,
  Star,
  TrendingUp,
  Calendar,
  ChevronRight,
  MessageSquare,
  QrCode,
  AlertCircle,
  CheckCircle2,
  Route,
  Gauge,
  Play,
  Pause,
  Flag,
  AlertTriangle,
  Radio,
  Wifi,
  Battery,
  MoreVertical,
  Share2,
  Map as MapIcon,
  List,
  LocateFixed
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';

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

// Mock data del transportista
const transportistaMock = {
  id: 'T-2025-001',
  nombre: 'Transportes Rápidos S.A.',
  cuit: '30-12345678-9',
  telefono: '+54 261 456-7890',
  email: 'contacto@transportesrapidos.com',
  direccion: 'Av. Libertador 1234, Mendoza',
  licenciaTransporte: 'LT-2024-001',
  vencimientoLicencia: '2025-12-31',
  rating: 4.8,
  viajesCompletados: 1247,
  incidencias: 2,
  activoDesde: '2020-03-15',
};

// Mock data del conductor
const conductorMock = {
  nombre: 'Juan Carlos López',
  dni: '25.456.789',
  licencia: 'A-12345678',
  categoria: 'C2 - Transporte de Carga Peligrosa',
  vencimientoLicencia: '2026-05-20',
  telefono: '+54 261 555-0123',
  foto: 'JL',
  experiencia: '5 años',
  viajesHoy: 4,
};

// Mock data del vehículo
const vehiculoMock = {
  patente: 'ABC-123',
  tipo: 'Camión Cisterna',
  marca: 'Mercedes-Benz',
  modelo: 'Actros 2644',
  año: 2022,
  capacidad: '15,000 L',
  seguro: 'Vigente hasta 12/2025',
  ultimaRevision: '2025-01-15',
  proximaRevision: '2025-02-15',
  kmRecorridos: 45678,
};

// Coordenadas reales (Mendoza)
const viajeEnCursoMock = {
  id: 'M-2025-089',
  estado: 'EN_TRANSITO',
  origen: 'Química Mendoza S.A.',
  destino: 'Planta Norte de Tratamiento',
  direccionOrigen: 'Av. San Martín 2345, Guaymallén',
  direccionDestino: 'Ruta 40 Km 1234, Guaymallén',
  horaSalida: '08:00',
  horaEstimadaLlegada: '10:30',
  progreso: 65,
  distanciaTotal: '45 km',
  distanciaRecorrida: '29 km',
  tiempoRestante: '45 min',
  velocidadActual: '65 km/h',
  ultimaActualizacion: 'Hace 2 min',
  coordenadasOrigen: [-32.9287, -68.8535] as [number, number],
  coordenadasDestino: [-32.8908, -68.8272] as [number, number],
  coordenadasActual: [-32.9050, -68.8400] as [number, number],
  // Ruta simulada entre origen y destino
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
  residuos: [
    { tipo: 'Líquidos inflamables', cantidad: '2,500 L', clase: 'Clase 3' },
    { tipo: 'Ácidos', cantidad: '1,200 L', clase: 'Clase 8' },
  ],
};

// Mock historial de viajes
const historialViajes = [
  { id: 'M-2025-088', fecha: '31/01/2025', estado: 'completado', origen: 'Hospital Central', destino: 'Planta Sur' },
  { id: 'M-2025-087', fecha: '31/01/2025', estado: 'completado', origen: 'Industrias del Sur', destino: 'Operador Eco' },
  { id: 'M-2025-086', fecha: '30/01/2025', estado: 'completado', origen: 'Química Mendoza', destino: 'Planta Norte' },
  { id: 'M-2025-085', fecha: '30/01/2025', estado: 'completado', origen: 'Metalúrgica AR', destino: 'Planta Este' },
];

const TransportePerfilPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'viaje' | 'info' | 'historial'>('viaje');
  const [viajeStatus, setViajeStatus] = useState<'ACTIVO' | 'PAUSADO'>('ACTIVO');
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [showIncidenteModal, setShowIncidenteModal] = useState(false);
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState('08:00:04');
  const [vistaMapa, setVistaMapa] = useState(true);
  const mapRef = useRef<L.Map | null>(null);

  const viajeEnCurso = viajeEnCursoMock;

  // Timer del viaje
  useEffect(() => {
    if (viajeStatus !== 'ACTIVO') return;
    
    const timer = setInterval(() => {
      setTiempoTranscurrido(prev => {
        const [h, m, s] = prev.split(':').map(Number);
        let newS = s + 1;
        let newM = m;
        let newH = h;
        if (newS >= 60) { newS = 0; newM++; }
        if (newM >= 60) { newM = 0; newH++; }
        return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(newS).padStart(2, '0')}`;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [viajeStatus]);

  // Centrar mapa cuando cambia la vista
  useEffect(() => {
    if (activeTab === 'viaje' && mapRef.current && vistaMapa) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
        mapRef.current?.fitBounds([
          viajeEnCurso.coordenadasOrigen,
          viajeEnCurso.coordenadasDestino
        ], { padding: [50, 50] });
      }, 100);
    }
  }, [activeTab, vistaMapa]);

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
    // Aquí iría la lógica para finalizar
    alert('Viaje finalizado exitosamente');
    navigate('/mobile/manifiestos');
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
              <p className="text-xs text-neutral-400 font-medium tracking-wider">VIAJE ACTIVO</p>
              <h1 className="text-lg font-bold text-white leading-tight">Viaje en Curso</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Badge de estado */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
              viajeStatus === 'ACTIVO' 
                ? 'bg-success-500/20 text-success-400 border border-success-500/30' 
                : 'bg-warning-500/20 text-warning-400 border border-warning-500/30'
            }`}>
              <Radio size={14} className={viajeStatus === 'ACTIVO' ? 'animate-pulse' : ''} />
              <span className="text-xs font-semibold">{viajeStatus === 'ACTIVO' ? 'Activo' : 'Pausado'}</span>
            </div>
            
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
            {/* Timer y Stats Principales */}
            <div className="bg-neutral-800 rounded-2xl p-5 border border-neutral-700">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Clock className="text-neutral-400" size={20} />
                <span className="text-4xl font-bold text-white tabular-nums tracking-tight">{tiempoTranscurrido}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-700">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-neutral-400 mb-1">
                    <Route size={14} />
                    <span className="text-xs">RECORRIDO</span>
                  </div>
                  <p className="text-xl font-bold text-white">{viajeEnCurso.distanciaRecorrida}</p>
                </div>
                <div className="text-center border-l border-neutral-700">
                  <div className="flex items-center justify-center gap-1 text-neutral-400 mb-1">
                    <MapPin size={14} />
                    <span className="text-xs">RESTANTE</span>
                  </div>
                  <p className="text-xl font-bold text-white">{viajeEnCurso.distanciaTotal}</p>
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
                  <p className="text-sm text-white font-mono">{viajeEnCurso.coordenadasActual[0].toFixed(6)}, {viajeEnCurso.coordenadasActual[1].toFixed(6)}</p>
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
                <span className="text-sm font-mono font-semibold text-white">#{viajeEnCurso.id}</span>
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
                Eventos
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

            {/* Mapa Real o Lista de Eventos */}
            {vistaMapa ? (
              <div className="h-80 rounded-2xl overflow-hidden border-2 border-neutral-700 relative">
                <MapContainer
                  center={viajeEnCurso.coordenadasActual}
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
                    positions={viajeEnCurso.ruta}
                    color="#3b82f6"
                    weight={4}
                    opacity={0.8}
                    dashArray="10, 10"
                  />
                  
                  {/* Marcador Origen */}
                  <Marker position={viajeEnCurso.coordenadasOrigen} icon={origenIcon}>
                    <Popup>
                      <div className="text-center">
                        <p className="font-semibold">Origen</p>
                        <p className="text-sm">{viajeEnCurso.origen}</p>
                      </div>
                    </Popup>
                  </Marker>
                  
                  {/* Marcador Destino */}
                  <Marker position={viajeEnCurso.coordenadasDestino} icon={destinoIcon}>
                    <Popup>
                      <div className="text-center">
                        <p className="font-semibold">Destino</p>
                        <p className="text-sm">{viajeEnCurso.destino}</p>
                      </div>
                    </Popup>
                  </Marker>
                  
                  {/* Marcador Vehículo Actual */}
                  <Marker position={viajeEnCurso.coordenadasActual} icon={vehiculoIcon}>
                    <Popup>
                      <div className="text-center">
                        <p className="font-semibold">Vehículo</p>
                        <p className="text-sm">{vehiculoMock.patente}</p>
                        <p className="text-sm font-mono">{viajeEnCurso.velocidadActual}</p>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Círculo de precisión GPS */}
                  <Circle 
                    center={viajeEnCurso.coordenadasActual}
                    radius={100}
                    pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1 }}
                  />
                </MapContainer>
                
                {/* Overlay de info */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none">
                  <div className="bg-white/95 backdrop-blur rounded-xl px-3 py-2 shadow-lg pointer-events-auto">
                    <p className="text-xs text-neutral-500">Velocidad</p>
                    <p className="text-lg font-bold text-neutral-900">{viajeEnCurso.velocidadActual}</p>
                  </div>
                  <div className="bg-white/95 backdrop-blur rounded-xl px-3 py-2 shadow-lg pointer-events-auto">
                    <p className="text-xs text-neutral-500">Restante</p>
                    <p className="text-lg font-bold text-primary-600">{viajeEnCurso.tiempoRestante}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in">
                {[
                  { hora: '08:00', evento: 'Viaje iniciado', ubicacion: 'Química Mendoza S.A.', tipo: 'inicio' },
                  { hora: '08:15', evento: 'Salida confirmada', ubicacion: 'Puerta 3', tipo: 'normal' },
                  { hora: '08:45', evento: 'Punto de control', ubicacion: 'RN40 Km 1150', tipo: 'checkpoint' },
                  { hora: '09:15', evento: 'En tránsito', ubicacion: 'Ruta 40 Km 1180', tipo: 'normal' },
                ].map((evento, index) => (
                  <div key={index} className="flex items-start gap-3 bg-neutral-800 rounded-xl p-4 border border-neutral-700">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      evento.tipo === 'inicio' ? 'bg-success-500' :
                      evento.tipo === 'checkpoint' ? 'bg-primary-500' :
                      'bg-neutral-500'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">{evento.evento}</p>
                        <span className="text-xs text-neutral-400 font-mono">{evento.hora}</span>
                      </div>
                      <p className="text-xs text-neutral-400">{evento.ubicacion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Progreso */}
            <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-neutral-400">Progreso del viaje</span>
                <span className="text-lg font-bold text-white">{viajeEnCurso.progreso}%</span>
              </div>
              <div className="h-3 bg-neutral-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-success-500 to-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${viajeEnCurso.progreso}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-neutral-400">
                <span>Salida: {viajeEnCurso.horaSalida}</span>
                <span>Llegada: {viajeEnCurso.horaEstimadaLlegada}</span>
              </div>
            </div>
          </>
        )}

        {/* === TAB: INFORMACIÓN === */}
        {activeTab === 'info' && (
          <div className="space-y-4 animate-fade-in">
            {/* Conductor */}
            <div className="bg-neutral-800 rounded-2xl p-5 border border-neutral-700">
              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Conductor</h3>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
                  {conductorMock.foto}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-white">{conductorMock.nombre}</p>
                  <p className="text-sm text-neutral-400">Lic. {conductorMock.licencia}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="soft" color="success">{conductorMock.experiencia}</Badge>
                    <Badge variant="soft" color="primary">{conductorMock.viajesHoy} viajes hoy</Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button className="flex items-center justify-center gap-2 py-3 bg-neutral-700 rounded-xl text-white font-medium hover:bg-neutral-600 transition-colors">
                  <Phone size={18} />
                  Llamar
                </button>
                <button className="flex items-center justify-center gap-2 py-3 bg-neutral-700 rounded-xl text-white font-medium hover:bg-neutral-600 transition-colors">
                  <MessageSquare size={18} />
                  Mensaje
                </button>
              </div>
            </div>

            {/* Vehículo */}
            <div className="bg-neutral-800 rounded-2xl p-5 border border-neutral-700">
              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Vehículo</h3>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center">
                  <Truck className="text-white" size={28} />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-white">{vehiculoMock.patente}</p>
                  <p className="text-sm text-neutral-400">{vehiculoMock.tipo}</p>
                  <p className="text-xs text-neutral-500">{vehiculoMock.marca} {vehiculoMock.modelo}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-700">
                <div>
                  <p className="text-xs text-neutral-400">Capacidad</p>
                  <p className="text-sm font-semibold text-white">{vehiculoMock.capacidad}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Kilometraje</p>
                  <p className="text-sm font-semibold text-white">{vehiculoMock.kmRecorridos.toLocaleString()} km</p>
                </div>
              </div>
            </div>

            {/* Carga */}
            <div className="bg-neutral-800 rounded-2xl p-5 border border-neutral-700">
              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Carga Transportada</h3>
              <div className="space-y-3 animate-fade-in">
                {viajeEnCurso.residuos.map((residuo, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-neutral-700/50 rounded-xl">
                    <div>
                      <p className="font-medium text-white">{residuo.tipo}</p>
                      <p className="text-xs text-neutral-400">{residuo.clase}</p>
                    </div>
                    <span className="text-sm font-mono font-semibold text-primary-400">{residuo.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* === TAB: HISTORIAL === */}
        {activeTab === 'historial' && (
          <div className="space-y-3 animate-fade-in">
            {historialViajes.map((viaje) => (
              <div key={viaje.id} className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-white">#{viaje.id}</span>
                  <span className="text-xs text-neutral-400">{viaje.fecha}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-300">
                  <span className="truncate">{viaje.origen}</span>
                  <ChevronRight size={14} className="text-neutral-500 flex-shrink-0" />
                  <span className="truncate">{viaje.destino}</span>
                </div>
                <div className="mt-3">
                  <Badge variant="soft" color="success">Completado</Badge>
                </div>
              </div>
            ))}
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

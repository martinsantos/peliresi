/**
 * SITREP v6 - Viaje en Curso Page
 * ================================
 * Vista detallada de viaje activo con mapa y tracking
 */

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Phone,
  MessageSquare,
  Package,
  Clock,
  Truck,
  User,
  AlertCircle,
  CheckCircle2,
  Share2,
  QrCode,
  MoreVertical,
  Maximize2,
  Route
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { QRCodeModal } from '../../components/ui/QRCode';

// Mock data del viaje
const viajeMock = {
  id: 'M-2025-089',
  estado: 'EN_TRANSITO',
  conductor: {
    nombre: 'Juan López',
    telefono: '+54 261 555-0123',
    foto: 'JL',
    licencia: 'A-12345678',
    experiencia: '5 años',
  },
  vehiculo: {
    patente: 'ABC-123',
    tipo: 'Camión Cisterna',
    capacidad: '15,000 L',
    modelo: 'Mercedes-Benz Actros 2022',
  },
  origen: {
    nombre: 'Química Mendoza S.A.',
    direccion: 'Av. San Martín 2345, Guaymallén',
    hora: '08:00',
  },
  destino: {
    nombre: 'Planta Norte de Tratamiento',
    direccion: 'Ruta 40 Km 1234, Guaymallén',
    horaEstimada: '10:30',
  },
  residuos: [
    { tipo: 'Líquidos inflamables', cantidad: '2,500 L', clase: 'Clase 3' },
    { tipo: 'Ácidos', cantidad: '1,200 L', clase: 'Clase 8' },
  ],
  progreso: 65,
  distanciaTotal: '45 km',
  distanciaRecorrida: '29 km',
  tiempoTranscurrido: '1h 15min',
  tiempoRestante: '45 min',
  velocidadActual: '65 km/h',
  ultimaActualizacion: 'Hace 2 min',
  coordenadas: {
    lat: -32.8908,
    lng: -68.8272,
  },
  historial: [
    { hora: '08:00', evento: 'Salida del origen', ubicacion: 'Química Mendoza S.A.' },
    { hora: '08:45', evento: 'Punto de control RN40', ubicacion: 'Km 1150' },
    { hora: '09:15', evento: 'En tránsito', ubicacion: 'Ruta 40 Km 1180' },
  ],
};

const ViajeEnCursoPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showQR, setShowQR] = useState(false);
  const [vistaMapa, setVistaMapa] = useState(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'EN_TRANSITO':
        return { bg: 'bg-info-50', text: 'text-info-600', badge: 'info' as const };
      case 'RECIBIDO':
        return { bg: 'bg-warning-50', text: 'text-warning-600', badge: 'warning' as const };
      case 'ENTREGADO':
        return { bg: 'bg-success-50', text: 'text-success-600', badge: 'success' as const };
      default:
        return { bg: 'bg-neutral-50', text: 'text-neutral-600', badge: 'neutral' as const };
    }
  };

  const estadoColor = getEstadoColor(viajeMock.estado);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header Sticky */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-semibold text-neutral-900">Viaje en Curso</h1>
              <p className="text-xs text-neutral-500">{viajeMock.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQR(true)}
              className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <QrCode size={20} />
            </button>
            <button className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
              <Share2 size={20} />
            </button>
            <button className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 pb-24">
        {/* Status Banner */}
        <div className={`${estadoColor.bg} rounded-xl p-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm`}>
              <Truck className={estadoColor.text} size={24} />
            </div>
            <div>
              <Badge variant="soft" color={estadoColor.badge}>
                <span className="flex items-center gap-1">
                  <Navigation size={12} className="animate-pulse" />
                  En tránsito
                </span>
              </Badge>
              <p className={`text-sm font-medium ${estadoColor.text} mt-1`}>
                Llegada estimada: {viajeMock.destino.horaEstimada}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-neutral-900">{viajeMock.tiempoRestante}</p>
            <p className="text-xs text-neutral-500">restante</p>
          </div>
        </div>

        {/* Mapa */}
        <Card className="overflow-hidden">
          <div className="relative h-64 bg-gradient-to-br from-blue-50 via-green-50 to-blue-50">
            {/* Grid de fondo */}
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: `
                linear-gradient(to right, #94a3b8 1px, transparent 1px),
                linear-gradient(to bottom, #94a3b8 1px, transparent 1px)
              `,
              backgroundSize: '30px 30px'
            }} />
            
            {/* Ruta curvada */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0D8A4F" />
                  <stop offset="100%" stopColor="#3B82F6" />
                </linearGradient>
              </defs>
              <path
                d="M 60 180 Q 150 120 280 140 T 340 60"
                fill="none"
                stroke="url(#routeGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="8 4"
                className="opacity-60"
              />
              {/* Punto de progreso */}
              <circle cx="220" cy="130" r="6" fill="#0D8A4F" />
            </svg>

            {/* Marcador origen */}
            <div className="absolute left-[60px] bottom-[40px] transform -translate-x-1/2">
              <div className="relative">
                <div className="w-10 h-10 bg-neutral-900 rounded-full flex items-center justify-center shadow-lg">
                  <MapPin className="text-white" size={20} />
                </div>
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  Origen
                </div>
              </div>
            </div>

            {/* Marcador destino */}
            <div className="absolute right-[60px] top-[40px] transform translate-x-1/2">
              <div className="relative">
                <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="text-white" size={20} />
                </div>
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  Destino
                </div>
              </div>
            </div>

            {/* Vehículo actual */}
            <div 
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{ left: '65%', top: '45%' }}
            >
              <div className="relative">
                <div className="w-14 h-14 bg-info-500 rounded-full flex items-center justify-center shadow-xl animate-pulse">
                  <Truck className="text-white" size={24} />
                </div>
                {/* Radio de señal */}
                <div className="absolute inset-0 bg-info-500 rounded-full animate-ping opacity-20" />
                {/* Label */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-lg shadow-md whitespace-nowrap">
                  <p className="text-xs font-medium text-neutral-900">{viajeMock.velocidadActual}</p>
                </div>
              </div>
            </div>

            {/* Botón expandir */}
            <button 
              className="absolute top-4 right-4 p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
              onClick={() => setVistaMapa(true)}
            >
              <Maximize2 size={18} />
            </button>
          </div>
        </Card>

        {/* Progreso */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-neutral-600">Progreso del viaje</span>
            <span className="font-semibold text-neutral-900">{viajeMock.progreso}%</span>
          </div>
          <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-info-500 rounded-full transition-all duration-1000"
              style={{ width: `${viajeMock.progreso}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-neutral-500">
            <div className="flex items-center gap-1">
              <Route size={14} />
              <span>{viajeMock.distanciaRecorrida} / {viajeMock.distanciaTotal}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>{viajeMock.tiempoTranscurrido} transcurrido</span>
            </div>
          </div>
        </Card>

        {/* Conductor y Vehículo */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
                <User className="text-purple-600" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-neutral-500">Conductor</p>
                <p className="font-medium text-neutral-900 truncate">{viajeMock.conductor.nombre}</p>
                <p className="text-xs text-neutral-400">Lic: {viajeMock.conductor.licencia}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-50 text-primary-600 rounded-lg text-xs font-medium hover:bg-primary-100 transition-colors">
                <Phone size={14} />
                Llamar
              </button>
              <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-50 text-neutral-700 rounded-lg text-xs font-medium hover:bg-neutral-100 transition-colors">
                <MessageSquare size={14} />
                Mensaje
              </button>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-secondary-50 rounded-full flex items-center justify-center">
                <Truck className="text-secondary-600" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-neutral-500">Vehículo</p>
                <p className="font-medium text-neutral-900">{viajeMock.vehiculo.patente}</p>
                <p className="text-xs text-neutral-400 truncate">{viajeMock.vehiculo.tipo}</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-neutral-500">
              <p>Capacidad: {viajeMock.vehiculo.capacidad}</p>
              <p className="truncate">{viajeMock.vehiculo.modelo}</p>
            </div>
          </Card>
        </div>

        {/* Ruta Origen → Destino */}
        <Card className="p-4">
          <h3 className="font-semibold text-neutral-900 mb-4">Ruta</h3>
          <div className="relative pl-6">
            {/* Línea vertical */}
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-neutral-200" />
            
            {/* Origen */}
            <div className="relative mb-6">
              <div className="absolute left-[-17px] w-5 h-5 bg-neutral-900 rounded-full flex items-center justify-center">
                <MapPin className="text-white" size={12} />
              </div>
              <p className="font-medium text-neutral-900">{viajeMock.origen.nombre}</p>
              <p className="text-sm text-neutral-500">{viajeMock.origen.direccion}</p>
              <p className="text-xs text-neutral-400 mt-1">Salida: {viajeMock.origen.hora}</p>
            </div>

            {/* Destino */}
            <div className="relative">
              <div className="absolute left-[-17px] w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                <CheckCircle2 className="text-white" size={12} />
              </div>
              <p className="font-medium text-neutral-900">{viajeMock.destino.nombre}</p>
              <p className="text-sm text-neutral-500">{viajeMock.destino.direccion}</p>
              <p className="text-xs text-neutral-400 mt-1">Llegada estimada: {viajeMock.destino.horaEstimada}</p>
            </div>
          </div>
        </Card>

        {/* Residuos Transportados */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Package className="text-neutral-400" size={20} />
            <h3 className="font-semibold text-neutral-900">Residuos Transportados</h3>
          </div>
          <div className="space-y-3 animate-fade-in">
            {viajeMock.residuos.map((residuo, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div>
                  <p className="font-medium text-neutral-900">{residuo.tipo}</p>
                  <p className="text-xs text-neutral-500">{residuo.clase}</p>
                </div>
                <Badge variant="soft" color="neutral">
                  {residuo.cantidad}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Historial */}
        <Card className="p-4">
          <h3 className="font-semibold text-neutral-900 mb-4">Historial del Viaje</h3>
          <div className="space-y-4 animate-fade-in">
            {viajeMock.historial.map((evento, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 bg-primary-500 rounded-full" />
                  {index < viajeMock.historial.length - 1 && (
                    <div className="w-0.5 h-full bg-neutral-200 mt-1" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-xs text-neutral-400">{evento.hora}</p>
                  <p className="font-medium text-neutral-900">{evento.evento}</p>
                  <p className="text-sm text-neutral-500">{evento.ubicacion}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* QR Modal */}
      <QRCodeModal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        manifiestoId={viajeMock.id}
      />

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 safe-area-bottom">
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1"
            leftIcon={<Phone size={18} />}
          >
            Llamar
          </Button>
          <Button 
            className="flex-1"
            leftIcon={<MapPin size={18} />}
          >
            Ver en Mapa
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ViajeEnCursoPage;

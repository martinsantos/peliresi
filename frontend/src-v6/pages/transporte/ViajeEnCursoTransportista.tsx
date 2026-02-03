/**
 * SITREP v6 - Viaje en Curso (Transportista)
 * Fondo claro, consistente con el resto de la app
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Truck, Phone, MapPin, Clock, Navigation, Package,
  Play, Pause, CheckCircle2, AlertTriangle, Radio, Map as MapIcon, List,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

let DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const origenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41]
});

const destinoIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41]
});

const viajeMock = {
  id: 'M-2025-089',
  manifiestoId: 'M-2025-089',
  estado: 'EN_TRANSITO',
  origen: { nombre: 'Quimica Mendoza S.A.', direccion: 'Av. San Martin 2345', coordenadas: [-32.9287, -68.8535] },
  destino: { nombre: 'Planta Norte', direccion: 'Ruta 40 Km 1234', coordenadas: [-32.8908, -68.8272] },
  coordenadasActual: [-32.9050, -68.8400],
  ruta: [[-32.9287, -68.8535], [-32.9050, -68.8400], [-32.8908, -68.8272]],
  horaSalida: '08:00',
  horaEstimadaLlegada: '10:30',
  progreso: 65,
  distanciaTotal: '45 km',
  distanciaRecorrida: '29 km',
  tiempoRestante: '45 min',
  velocidadActual: '65 km/h',
  tiempoTranscurrido: '08:00:31',
  residuos: [
    { tipo: 'Liquidos inflamables', cantidad: '2,500 L', clase: 'Clase 3' },
    { tipo: 'Acidos', cantidad: '1,200 L', clase: 'Clase 8' }
  ]
};

const ViajeEnCursoTransportista: React.FC = () => {
  const navigate = useNavigate();
  const [viajeStatus, setViajeStatus] = useState<'ACTIVO' | 'PAUSADO'>('ACTIVO');
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [showIncidenteModal, setShowIncidenteModal] = useState(false);
  const [vistaMapa, setVistaMapa] = useState(true);
  const [viaje] = useState(viajeMock);

  const handlePausar = () => setViajeStatus(viajeStatus === 'ACTIVO' ? 'PAUSADO' : 'ACTIVO');
  const handleFinalizar = () => setShowFinalizarModal(true);
  const handleIncidente = () => setShowIncidenteModal(true);
  const confirmarFinalizar = () => { setShowFinalizarModal(false); navigate('/mobile/manifiestos'); };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <div>
              <p className="text-xs text-neutral-500 font-medium">VIAJE ACTIVO</p>
              <h1 className="text-lg font-bold text-neutral-900">Viaje en Curso</h1>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${viajeStatus === 'ACTIVO' ? 'bg-success-50 text-success-700 border border-success-200' : 'bg-warning-50 text-warning-700 border border-warning-200'}`}>
            <Radio size={14} className={viajeStatus === 'ACTIVO' ? 'animate-pulse' : ''} />
            <span className="text-xs font-semibold">{viajeStatus === 'ACTIVO' ? 'Activo' : 'Pausado'}</span>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Timer */}
        <Card variant="elevated" className="bg-gradient-to-br from-primary-600 to-primary-700 text-white border-none shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Clock className="text-white/80" size={20} />
              <span className="text-4xl font-bold tabular-nums text-white drop-shadow-sm">{viaje.tiempoTranscurrido}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/30">
              <div className="text-center">
                <p className="text-xs text-white/90 mb-1 font-medium tracking-wide">RECORRIDO</p>
                <p className="text-2xl font-bold text-white drop-shadow-sm">{viaje.distanciaRecorrida}</p>
              </div>
              <div className="text-center border-l border-white/30">
                <p className="text-xs text-white/90 mb-1 font-medium tracking-wide">RESTANTE</p>
                <p className="text-2xl font-bold text-white drop-shadow-sm">{viaje.distanciaTotal}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manifiesto */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-neutral-200 shadow-sm">
            <span className="text-xs text-neutral-500">Manifiesto</span>
            <span className="text-sm font-mono font-semibold text-neutral-900">#{viaje.manifiestoId}</span>
          </div>
        </div>

        {/* Botones */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handlePausar} className={`flex items-center justify-center gap-2 py-4 rounded-xl font-semibold border-2 transition-all ${viajeStatus === 'ACTIVO' ? 'bg-warning-50 text-warning-700 border-warning-200' : 'bg-success-50 text-success-700 border-success-200'}`}>
            {viajeStatus === 'ACTIVO' ? <Pause size={20} /> : <Play size={20} />}
            {viajeStatus === 'ACTIVO' ? 'Pausar' : 'Reanudar'}
          </button>
          <button onClick={handleIncidente} className="flex items-center justify-center gap-2 py-4 rounded-xl font-semibold bg-error-50 text-error-700 border-2 border-error-200 hover:bg-error-100">
            <AlertTriangle size={20} /> Incidente
          </button>
        </div>

        <Button fullWidth onClick={handleFinalizar} className="flex items-center justify-center">
          <CheckCircle2 size={20} className="mr-2 flex-shrink-0" /> 
          <span>Finalizar Viaje</span>
        </Button>

        {/* Toggle */}
        <div className="flex bg-neutral-100 rounded-xl p-1">
          <button onClick={() => setVistaMapa(false)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${!vistaMapa ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'}`}>
            <List size={16} /> Eventos
          </button>
          <button onClick={() => setVistaMapa(true)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${vistaMapa ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'}`}>
            <MapIcon size={16} /> Mapa
          </button>
        </div>

        {/* Mapa */}
        {vistaMapa ? (
          <div className="relative z-0">
            <Card className="overflow-hidden p-0 border-2 border-neutral-200">
              <div className="h-64 relative isolate">
                <MapContainer 
                  center={viaje.coordenadasActual} 
                  zoom={13} 
                  style={{ height: '100%', width: '100%', zIndex: 0 }}
                  className="z-0"
                >
                  <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Polyline positions={viaje.ruta} color="#0D8A4F" weight={4} opacity={0.8} dashArray="8, 8" />
                  <Marker position={viaje.origen.coordenadas} icon={origenIcon}><Popup>Origen</Popup></Marker>
                  <Marker position={viaje.destino.coordenadas} icon={destinoIcon}><Popup>Destino</Popup></Marker>
                </MapContainer>
                <div className="absolute bottom-3 left-3 right-3 flex justify-between z-[400]">
                  <div className="bg-white rounded-lg px-3 py-2 shadow-lg border border-neutral-200">
                    <p className="text-xs text-neutral-500">Velocidad</p>
                    <p className="text-sm font-bold text-neutral-900">{viaje.velocidadActual}</p>
                  </div>
                  <div className="bg-white rounded-lg px-3 py-2 shadow-lg border border-neutral-200">
                    <p className="text-xs text-neutral-500">Restante</p>
                    <p className="text-sm font-bold text-primary-600">{viaje.tiempoRestante}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            {['Viaje iniciado', 'Salida confirmada', 'En transito'].map((e, i) => (
              <Card key={i} className="p-3"><p className="font-medium text-neutral-900">{e}</p></Card>
            ))}
          </div>
        )}

        {/* Progreso */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Progreso</span>
              <span className="text-lg font-bold text-neutral-900">{viaje.progreso}%</span>
            </div>
            <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary-500 to-info-500 rounded-full" style={{ width: `${viaje.progreso}%` }} />
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-neutral-500">
              <span>Salida: {viaje.horaSalida}</span>
              <span>Llegada: {viaje.horaEstimadaLlegada}</span>
            </div>
          </CardContent>
        </Card>

        {/* Contacto */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" fullWidth leftIcon={<Phone size={18} />}>Llamar</Button>
          <Button variant="outline" fullWidth leftIcon={<MessageSquare size={18} />}>Mensaje</Button>
        </div>
      </div>

      {/* Modal Finalizar */}
      {showFinalizarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="text-success-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Finalizar Viaje?</h3>
              <div className="space-y-3 mt-6">
                <Button fullWidth onClick={confirmarFinalizar}>Si, Finalizar</Button>
                <Button variant="outline" fullWidth onClick={() => setShowFinalizarModal(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Incidente */}
      {showIncidenteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="text-error-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-neutral-900">Reportar Incidente</h3>
              </div>
              <div className="space-y-2 mb-4">
                {['Demora', 'Problema mecanico', 'Accidente'].map((tipo) => (
                  <button key={tipo} className="w-full text-left px-4 py-3 bg-neutral-50 rounded-xl font-medium text-neutral-700 hover:bg-neutral-100">{tipo}</button>
                ))}
              </div>
              <Button variant="outline" fullWidth onClick={() => setShowIncidenteModal(false)}>Cancelar</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ViajeEnCursoTransportista;

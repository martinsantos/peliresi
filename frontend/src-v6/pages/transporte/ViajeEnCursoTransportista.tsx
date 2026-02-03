/**
 * SITREP v6 - Viaje en Curso (Transportista)
 * Conectado a API real con GPS tracking
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Truck, Phone, MapPin, Clock, Navigation, Package,
  Play, Pause, CheckCircle2, AlertTriangle, Radio, Map as MapIcon, List,
  MessageSquare, Loader2
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { toast } from '../../components/ui/Toast';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  useManifiesto,
  useConfirmarRetiro,
  useConfirmarEntrega,
  useRegistrarIncidente,
} from '../../hooks/useManifiestos';
import { manifiestoService } from '../../services/manifiesto.service';
import { EstadoManifiesto } from '../../types/models';
import { formatDateTime, formatWeight } from '../../utils/formatters';

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

const truckIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41]
});

// Component to recenter map when position changes
function RecenterMap({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom());
  }, [position, map]);
  return null;
}

const ViajeEnCursoTransportista: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  // Real data from API
  const { data: apiData, isLoading, isError } = useManifiesto(id || '');
  const manifiesto = (apiData as any)?.data || apiData;
  const m = manifiesto || {};

  // Mutations
  const confirmarRetiro = useConfirmarRetiro();
  const confirmarEntrega = useConfirmarEntrega();
  const registrarIncidente = useRegistrarIncidente();

  // UI state
  const [viajeStatus, setViajeStatus] = useState<'ACTIVO' | 'PAUSADO'>('ACTIVO');
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [showIncidenteModal, setShowIncidenteModal] = useState(false);
  const [incidenteTipo, setIncidenteTipo] = useState('');
  const [incidenteDescripcion, setIncidenteDescripcion] = useState('');
  const [vistaMapa, setVistaMapa] = useState(true);

  // GPS state
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [trackPoints, setTrackPoints] = useState<[number, number][]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActionPending = confirmarRetiro.isPending || confirmarEntrega.isPending || registrarIncidente.isPending;

  // Default center (Mendoza, Argentina)
  const defaultCenter: [number, number] = [-32.9287, -68.8535];

  // Start GPS tracking when EN_TRANSITO
  useEffect(() => {
    if (m.estado !== EstadoManifiesto.EN_TRANSITO || viajeStatus === 'PAUSADO') return;

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const point: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setCurrentPosition(point);
          setTrackPoints(prev => [...prev, point]);
        },
        (err) => {
          console.warn('GPS error:', err.message);
          // Fallback: use default position
          if (!currentPosition) setCurrentPosition(defaultCenter);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    }

    // Send location to backend every 30s
    sendIntervalRef.current = setInterval(() => {
      if (currentPosition && id) {
        manifiestoService.actualizarUbicacion(id, currentPosition[0], currentPosition[1]).catch(() => {});
      }
    }, 30000);

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
    };
  }, [m.estado, viajeStatus, id]);

  // Timer
  useEffect(() => {
    if (m.estado !== EstadoManifiesto.EN_TRANSITO || viajeStatus === 'PAUSADO') return;
    timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [m.estado, viajeStatus]);

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const min = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${min}:${s}`;
  };

  // Action handlers
  const handleConfirmarRetiro = async () => {
    try {
      await confirmarRetiro.mutateAsync({ id: id! });
      toast.success('Retiro confirmado — viaje iniciado');
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo confirmar el retiro');
    }
  };

  const handleConfirmarEntrega = async () => {
    try {
      await confirmarEntrega.mutateAsync({ id: id! });
      toast.success('Entrega confirmada exitosamente');
      // Stop GPS
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
      setShowFinalizarModal(false);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo confirmar la entrega');
    }
  };

  const handleRegistrarIncidente = async () => {
    if (!incidenteTipo) {
      toast.warning('Selecciona un tipo de incidente');
      return;
    }
    try {
      await registrarIncidente.mutateAsync({ id: id!, tipo: incidenteTipo, descripcion: incidenteDescripcion || undefined });
      toast.success('Incidente registrado');
      setShowIncidenteModal(false);
      setIncidenteTipo('');
      setIncidenteDescripcion('');
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo registrar el incidente');
    }
  };

  const handlePausar = () => setViajeStatus(viajeStatus === 'ACTIVO' ? 'PAUSADO' : 'ACTIVO');

  const mapCenter = currentPosition || defaultCenter;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if (!manifiesto || isError) {
    return (
      <div className="min-h-screen bg-neutral-50 p-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold">Manifiesto no encontrado</h1>
        </div>
        <Card><CardContent className="py-8 text-center text-neutral-500">No se pudo cargar el manifiesto</CardContent></Card>
      </div>
    );
  }

  const totalPeso = Array.isArray(m.residuos) ? m.residuos.reduce((sum: number, r: any) => sum + (r.cantidad || 0), 0) : 0;
  const eventos = Array.isArray(m.eventos) ? m.eventos : [];

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <div>
              <p className="text-xs text-neutral-500 font-medium">{m.numero || id}</p>
              <h1 className="text-lg font-bold text-neutral-900">
                {m.estado === EstadoManifiesto.APROBADO ? 'Confirmar Retiro' :
                 m.estado === EstadoManifiesto.EN_TRANSITO ? 'Viaje en Curso' :
                 m.estado === EstadoManifiesto.ENTREGADO ? 'Entrega Completada' : 'Viaje'}
              </h1>
            </div>
          </div>
          {m.estado === EstadoManifiesto.EN_TRANSITO && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${viajeStatus === 'ACTIVO' ? 'bg-success-50 text-success-700 border border-success-200' : 'bg-warning-50 text-warning-700 border border-warning-200'}`}>
              <Radio size={14} className={viajeStatus === 'ACTIVO' ? 'animate-pulse' : ''} />
              <span className="text-xs font-semibold">{viajeStatus === 'ACTIVO' ? 'Activo' : 'Pausado'}</span>
            </div>
          )}
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* APROBADO state: Show confirm pickup */}
        {m.estado === EstadoManifiesto.APROBADO && (
          <>
            <Card variant="elevated" className="border-2 border-primary-200">
              <CardContent className="p-5 text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Truck className="text-primary-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">Listo para retirar</h3>
                <p className="text-neutral-600 mb-1">Generador: <span className="font-semibold">{m.generador?.razonSocial || '-'}</span></p>
                <p className="text-sm text-neutral-500">{m.generador?.domicilio || '-'}</p>
                <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
                  <p className="text-sm text-neutral-600">Residuos: <span className="font-semibold">{m.residuos?.length || 0} items</span> — {formatWeight(totalPeso)}</p>
                </div>
              </CardContent>
            </Card>
            <Button
              fullWidth
              size="lg"
              onClick={handleConfirmarRetiro}
              disabled={isActionPending}
              leftIcon={confirmarRetiro.isPending ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
            >
              Confirmar Retiro
            </Button>
          </>
        )}

        {/* EN_TRANSITO state: Active trip */}
        {m.estado === EstadoManifiesto.EN_TRANSITO && (
          <>
            {/* Timer */}
            <Card variant="elevated" className="bg-gradient-to-br from-primary-600 to-primary-700 text-white border-none shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Clock className="text-white/80" size={20} />
                  <span className="text-4xl font-bold tabular-nums text-white drop-shadow-sm">{formatTimer(elapsedTime)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/30">
                  <div className="text-center">
                    <p className="text-xs text-white/90 mb-1 font-medium tracking-wide">DESTINO</p>
                    <p className="text-sm font-bold text-white drop-shadow-sm">{m.operador?.razonSocial || '-'}</p>
                  </div>
                  <div className="text-center border-l border-white/30">
                    <p className="text-xs text-white/90 mb-1 font-medium tracking-wide">PESO TOTAL</p>
                    <p className="text-lg font-bold text-white drop-shadow-sm">{formatWeight(totalPeso)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Manifiesto badge */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-neutral-200 shadow-sm">
                <span className="text-xs text-neutral-500">Manifiesto</span>
                <span className="text-sm font-mono font-semibold text-neutral-900">#{m.numero || id}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handlePausar} className={`flex items-center justify-center gap-2 py-4 rounded-xl font-semibold border-2 transition-all ${viajeStatus === 'ACTIVO' ? 'bg-warning-50 text-warning-700 border-warning-200' : 'bg-success-50 text-success-700 border-success-200'}`}>
                {viajeStatus === 'ACTIVO' ? <Pause size={20} /> : <Play size={20} />}
                {viajeStatus === 'ACTIVO' ? 'Pausar' : 'Reanudar'}
              </button>
              <button onClick={() => setShowIncidenteModal(true)} className="flex items-center justify-center gap-2 py-4 rounded-xl font-semibold bg-error-50 text-error-700 border-2 border-error-200 hover:bg-error-100">
                <AlertTriangle size={20} /> Incidente
              </button>
            </div>

            <Button fullWidth onClick={() => setShowFinalizarModal(true)} disabled={isActionPending}>
              <CheckCircle2 size={20} className="mr-2 flex-shrink-0" />
              <span>Confirmar Entrega</span>
            </Button>

            {/* Toggle map/events */}
            <div className="flex bg-neutral-100 rounded-xl p-1">
              <button onClick={() => setVistaMapa(false)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${!vistaMapa ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'}`}>
                <List size={16} /> Eventos
              </button>
              <button onClick={() => setVistaMapa(true)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${vistaMapa ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'}`}>
                <MapIcon size={16} /> Mapa
              </button>
            </div>

            {/* Map or events */}
            {vistaMapa ? (
              <div className="relative z-0">
                <Card className="overflow-hidden p-0 border-2 border-neutral-200">
                  <div className="h-64 relative isolate">
                    <MapContainer
                      center={mapCenter}
                      zoom={13}
                      style={{ height: '100%', width: '100%', zIndex: 0 }}
                      className="z-0"
                    >
                      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {trackPoints.length > 1 && <Polyline positions={trackPoints} color="#0D8A4F" weight={4} opacity={0.8} />}
                      {currentPosition && <Marker position={currentPosition} icon={truckIcon}><Popup>Tu posicion actual</Popup></Marker>}
                      <RecenterMap position={currentPosition} />
                    </MapContainer>
                    {currentPosition && (
                      <div className="absolute bottom-3 left-3 z-[400] bg-white rounded-lg px-3 py-2 shadow-lg border border-neutral-200">
                        <p className="text-xs text-neutral-500">GPS</p>
                        <p className="text-xs font-mono font-bold text-neutral-900">{currentPosition[0].toFixed(4)}, {currentPosition[1].toFixed(4)}</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in">
                {eventos.length === 0 ? (
                  <Card className="p-4 text-center text-neutral-500">Sin eventos registrados</Card>
                ) : (
                  eventos.map((ev: any, i: number) => (
                    <Card key={ev.id || i} className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-neutral-900">{String(ev.tipo || '').replace(/_/g, ' ')}</p>
                          <p className="text-sm text-neutral-500">{ev.descripcion || ''}</p>
                        </div>
                        <span className="text-xs text-neutral-400">{formatDateTime(ev.createdAt)}</span>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* ENTREGADO state: Trip completed */}
        {m.estado === EstadoManifiesto.ENTREGADO && (
          <Card variant="elevated" className="border-2 border-success-200">
            <CardContent className="p-5 text-center">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="text-success-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Entrega Completada</h3>
              <p className="text-neutral-600">Esperando confirmacion de recepcion del operador</p>
              <p className="text-sm text-neutral-500 mt-2">Operador: {m.operador?.razonSocial || '-'}</p>
            </CardContent>
          </Card>
        )}

        {/* Residuos info (always visible) */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package size={18} className="text-neutral-500" />
              <span className="font-semibold text-neutral-900">Residuos</span>
            </div>
            <div className="space-y-2">
              {(m.residuos || []).map((r: any) => (
                <div key={r.id} className="flex justify-between items-center p-2 bg-neutral-50 rounded-lg">
                  <span className="text-sm text-neutral-700">{r.tipoResiduo?.nombre || r.descripcion || 'Residuo'}</span>
                  <span className="text-sm font-semibold text-neutral-900">{r.cantidad} {r.unidad}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Finalizar / Confirmar Entrega */}
      {showFinalizarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="text-success-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Confirmar Entrega?</h3>
              <p className="text-neutral-600 text-sm mb-4">Se confirmara la entrega en {m.operador?.razonSocial || 'destino'}</p>
              <div className="space-y-3">
                <Button fullWidth onClick={handleConfirmarEntrega} disabled={confirmarEntrega.isPending}>
                  {confirmarEntrega.isPending ? 'Confirmando...' : 'Si, Confirmar Entrega'}
                </Button>
                <Button variant="outline" fullWidth onClick={() => setShowFinalizarModal(false)} disabled={confirmarEntrega.isPending}>
                  Cancelar
                </Button>
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
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="text-error-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-neutral-900">Reportar Incidente</h3>
              </div>
              <div className="space-y-3 mb-4">
                <select
                  value={incidenteTipo}
                  onChange={(e) => setIncidenteTipo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none"
                >
                  <option value="">Seleccionar tipo</option>
                  <option value="accidente">Accidente vehicular</option>
                  <option value="derrame">Derrame de residuos</option>
                  <option value="robo">Robo o asalto</option>
                  <option value="desvio">Desvio de ruta</option>
                  <option value="averia">Averia mecanica</option>
                  <option value="otro">Otro</option>
                </select>
                <textarea
                  value={incidenteDescripcion}
                  onChange={(e) => setIncidenteDescripcion(e.target.value)}
                  placeholder="Describe el incidente..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none"
                />
              </div>
              <div className="space-y-2">
                <Button fullWidth onClick={handleRegistrarIncidente} disabled={registrarIncidente.isPending}>
                  {registrarIncidente.isPending ? 'Registrando...' : 'Registrar Incidente'}
                </Button>
                <Button variant="outline" fullWidth onClick={() => { setShowIncidenteModal(false); setIncidenteTipo(''); setIncidenteDescripcion(''); }} disabled={registrarIncidente.isPending}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ViajeEnCursoTransportista;

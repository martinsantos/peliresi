/**
 * SITREP v6 - Viaje en Curso Page
 * ================================
 * Vista de tracking para admin/generador — conectado a API real con mapa Leaflet
 */

import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
  Loader2,
  Route
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useManifiesto } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';
import { formatDateTime, formatEstado, formatWeight, formatNumber, formatCuit } from '../../utils/formatters';

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

function getEstadoBadgeColor(estado: string): 'info' | 'success' | 'warning' | 'error' | 'neutral' {
  switch (estado) {
    case EstadoManifiesto.EN_TRANSITO: return 'info';
    case EstadoManifiesto.ENTREGADO:
    case EstadoManifiesto.RECIBIDO:
    case EstadoManifiesto.TRATADO: return 'success';
    case EstadoManifiesto.EN_TRATAMIENTO: return 'warning';
    case EstadoManifiesto.RECHAZADO:
    case EstadoManifiesto.CANCELADO: return 'error';
    default: return 'neutral';
  }
}

const ViajeEnCursoPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  // Real data from API
  const { data: apiData, isLoading, isError } = useManifiesto(id || '');
  const manifiesto = (apiData as any)?.data || apiData;
  const m = manifiesto || {};

  // Default map center (Mendoza)
  const defaultCenter: [number, number] = [-32.9287, -68.8535];

  // Try to get last known position from tracking data
  const lastPosition: [number, number] | null = m.ultimaUbicacion
    ? [m.ultimaUbicacion.latitud, m.ultimaUbicacion.longitud]
    : null;

  const mapCenter = lastPosition || defaultCenter;

  // Build track points from tracking history if available
  const trackPoints: [number, number][] = Array.isArray(m.tracking)
    ? m.tracking.map((t: any) => [t.latitud, t.longitud] as [number, number])
    : [];

  const totalPeso = Array.isArray(m.residuos) ? m.residuos.reduce((sum: number, r: any) => sum + (r.cantidad || 0), 0) : 0;
  const eventos = Array.isArray(m.eventos) ? m.eventos : [];

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
        <Card className="p-8 text-center text-neutral-500">No se pudo cargar el manifiesto</Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-semibold text-neutral-900">Seguimiento de Viaje</h1>
              <p className="text-xs text-neutral-500">{m.numero || id}</p>
            </div>
          </div>
          <Badge variant="soft" color={getEstadoBadgeColor(m.estado || '')}>
            {formatEstado(m.estado || '')}
          </Badge>
        </div>
      </header>

      <div className="p-4 space-y-4 pb-24">
        {/* Status Banner */}
        <div className="bg-info-50 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <Truck className="text-info-600" size={24} />
            </div>
            <div>
              <Badge variant="soft" color={getEstadoBadgeColor(m.estado || '')}>
                <span className="flex items-center gap-1">
                  {m.estado === EstadoManifiesto.EN_TRANSITO && <Navigation size={12} className="animate-pulse" />}
                  {formatEstado(m.estado || '')}
                </span>
              </Badge>
              <p className="text-sm font-medium text-info-600 mt-1">
                Transportista: {m.transportista?.razonSocial || '-'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-neutral-900">{formatWeight(totalPeso)}</p>
            <p className="text-xs text-neutral-500">peso total</p>
          </div>
        </div>

        {/* Mapa Leaflet */}
        <Card className="overflow-hidden p-0">
          <div className="h-64 relative isolate">
            <MapContainer
              center={mapCenter}
              zoom={13}
              style={{ height: '100%', width: '100%', zIndex: 0 }}
              className="z-0"
            >
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {trackPoints.length > 1 && (
                <Polyline positions={trackPoints} color="#0D8A4F" weight={4} opacity={0.8} />
              )}
              {lastPosition && (
                <Marker position={lastPosition} icon={truckIcon}>
                  <Popup>
                    <strong>{m.transportista?.razonSocial || 'Transportista'}</strong><br />
                    {m.numero || id}
                  </Popup>
                </Marker>
              )}
            </MapContainer>
            {!lastPosition && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[400]">
                <p className="text-sm text-neutral-500">Sin datos de ubicacion GPS disponibles</p>
              </div>
            )}
          </div>
        </Card>

        {/* Ruta Origen → Destino */}
        <Card className="p-4">
          <h3 className="font-semibold text-neutral-900 mb-4">Ruta</h3>
          <div className="relative pl-6">
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-neutral-200" />

            <div className="relative mb-6">
              <div className="absolute left-[-17px] w-5 h-5 bg-neutral-900 rounded-full flex items-center justify-center">
                <MapPin className="text-white" size={12} />
              </div>
              <p className="font-medium text-neutral-900">{m.generador?.razonSocial || 'Generador'}</p>
              <p className="text-sm text-neutral-500">{m.generador?.domicilio || '-'}</p>
              {m.generador?.cuit && <p className="text-xs text-neutral-400 mt-1">CUIT: {formatCuit(m.generador.cuit)}</p>}
            </div>

            <div className="relative">
              <div className="absolute left-[-17px] w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                <CheckCircle2 className="text-white" size={12} />
              </div>
              <p className="font-medium text-neutral-900">{m.operador?.razonSocial || 'Operador'}</p>
              <p className="text-sm text-neutral-500">{m.operador?.domicilio || '-'}</p>
              {m.operador?.cuit && <p className="text-xs text-neutral-400 mt-1">CUIT: {formatCuit(m.operador.cuit)}</p>}
            </div>
          </div>
        </Card>

        {/* Transportista info */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-secondary-50 rounded-full flex items-center justify-center">
              <Truck className="text-secondary-600" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-neutral-500">Transportista</p>
              <p className="font-medium text-neutral-900">{m.transportista?.razonSocial || '-'}</p>
              <p className="text-xs text-neutral-400">Hab: {m.transportista?.numeroHabilitacion || '-'}</p>
            </div>
          </div>
          {m.vehiculo && (
            <div className="mt-3 p-3 bg-neutral-50 rounded-lg">
              <p className="text-sm text-neutral-600">Vehiculo: <span className="font-medium">{m.vehiculo.patente || '-'}</span> — {m.vehiculo.marca || ''} {m.vehiculo.modelo || ''}</p>
            </div>
          )}
        </Card>

        {/* Residuos */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Package className="text-neutral-400" size={20} />
            <h3 className="font-semibold text-neutral-900">Residuos Transportados</h3>
          </div>
          <div className="space-y-3 animate-fade-in">
            {(m.residuos || []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div>
                  <p className="font-medium text-neutral-900">{r.tipoResiduo?.nombre || r.descripcion || 'Residuo'}</p>
                  <p className="text-xs text-neutral-500">{r.tipoResiduo?.codigo || ''}</p>
                </div>
                <Badge variant="soft" color="neutral">
                  {formatNumber(r.cantidad)} {r.unidad}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Timeline / Historial */}
        <Card className="p-4">
          <h3 className="font-semibold text-neutral-900 mb-4">Historial del Viaje</h3>
          {eventos.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-4">Sin eventos registrados</p>
          ) : (
            <div className="space-y-4 animate-fade-in">
              {eventos.map((ev: any, index: number) => (
                <div key={ev.id || index} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 bg-primary-500 rounded-full" />
                    {index < eventos.length - 1 && (
                      <div className="w-0.5 h-full bg-neutral-200 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-xs text-neutral-400">{formatDateTime(ev.createdAt)}</p>
                    <p className="font-medium text-neutral-900">{String(ev.tipo || '').replace(/_/g, ' ')}</p>
                    <p className="text-sm text-neutral-500">{ev.descripcion || ''}{ev.usuario ? ` — ${ev.usuario.nombre}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom bar: link to detail */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 safe-area-bottom">
        <Button
          fullWidth
          onClick={() => navigate(isMobile ? `/mobile/manifiestos/${id}` : `/manifiestos/${id}`)}
          leftIcon={<Package size={18} />}
        >
          Ver Detalle del Manifiesto
        </Button>
      </div>
    </div>
  );
};

export default ViajeEnCursoPage;

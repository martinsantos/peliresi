/**
 * SITREP v6 - Manifiesto Detail Page
 * ==================================
 * Detalle de manifiesto con timeline - Conectado a API
 */

import React, { useState, useMemo } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  User,
  Truck,
  FlaskConical,
  Weight,
  Package,
  Loader2,
  AlertCircle,
  QrCode,
  Download,
  Copy,
  Check,
  Award,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ACTOR_ICONS, ACTOR_COLORS } from '../../utils/map-icons';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Skeleton } from '../../components/ui/Skeleton';
import BlockchainPanel from '../../components/BlockchainPanel';
import { toast } from '../../components/ui/Toast';
import {
  useManifiesto,
  useFirmarManifiesto,
  useConfirmarRetiro,
  useConfirmarEntrega,
  useConfirmarRecepcion,
  usePesaje,
  useRegistrarTratamiento,
  useCerrarManifiesto,
  useRechazarManifiesto,
  useRegistrarIncidente,
  useRevertirEstado,
} from '../../hooks/useManifiestos';
import { useAuth } from '../../contexts/AuthContext';
import { manifiestoService } from '../../services/manifiesto.service';
import { formatDateTime, formatNumber, formatWeight, formatEstado, formatCuit } from '../../utils/formatters';
import type { Manifiesto } from '../../types/models';
import { EstadoManifiesto } from '../../types/models';
import ManifiestoTimeline from './components/ManifiestoTimeline';
import ManifiestoActions from './components/ManifiestoActions';

function getEstadoBadgeColor(estado: EstadoManifiesto): 'info' | 'success' | 'warning' | 'error' | 'neutral' {
  switch (estado) {
    case EstadoManifiesto.EN_TRANSITO: return 'info';
    case EstadoManifiesto.TRATADO:
    case EstadoManifiesto.RECIBIDO:
    case EstadoManifiesto.ENTREGADO: return 'success';
    case EstadoManifiesto.PENDIENTE_APROBACION:
    case EstadoManifiesto.EN_TRATAMIENTO: return 'warning';
    case EstadoManifiesto.RECHAZADO:
    case EstadoManifiesto.CANCELADO: return 'error';
    default: return 'neutral';
  }
}

const ManifiestoDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = location.pathname.startsWith('/mobile');
  const isApp = location.pathname.startsWith('/app');
  const { data: apiData, isLoading, isError } = useManifiesto(id || '');
  const [qrCopied, setQrCopied] = React.useState(false);

  // Auth context for role-based visibility
  const { currentUser, isAdmin } = useAuth();
  const userRol = currentUser?.rol || '';

  // Action mutations
  const firmar = useFirmarManifiesto();
  const confirmarRetiro = useConfirmarRetiro();
  const confirmarEntrega = useConfirmarEntrega();
  const confirmarRecepcion = useConfirmarRecepcion();
  const pesaje = usePesaje();
  const registrarTratamiento = useRegistrarTratamiento();
  const cerrar = useCerrarManifiesto();
  const rechazar = useRechazarManifiesto();
  const registrarIncidente = useRegistrarIncidente();
  const revertir = useRevertirEstado();

  // Cancel state (managed here because it navigates)
  const [isCancelling, setIsCancelling] = useState(false);

  // Track which action is in progress
  const isActionPending = firmar.isPending || confirmarRetiro.isPending || confirmarEntrega.isPending
    || confirmarRecepcion.isPending || pesaje.isPending || registrarTratamiento.isPending || cerrar.isPending
    || rechazar.isPending || registrarIncidente.isPending || revertir.isPending;

  // Use API data only
  const manifiesto = apiData;
  const m = (manifiesto || {}) as Partial<Manifiesto>;
  const totalPeso = Array.isArray(m.residuos) ? m.residuos.reduce((sum, r) => sum + (typeof r.cantidad === 'number' ? r.cantidad : 0), 0) : 0;

  // --- Tracking route for GPS map ---
  const trackingRoute = useMemo(() => {
    const points = m?.tracking || [];
    if (!points.length) return null;
    const sorted = [...points].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    return {
      points: sorted.map((t: any) => [t.latitud, t.longitud] as [number, number]),
      start: [sorted[0].latitud, sorted[0].longitud] as [number, number],
      end: [sorted[sorted.length - 1].latitud, sorted[sorted.length - 1].longitud] as [number, number],
      startTime: sorted[0].timestamp,
      endTime: sorted[sorted.length - 1].timestamp,
      count: sorted.length,
    };
  }, [m]);

  // Generador and Operador locations for planned route
  const generadorPos = useMemo(() => {
    const g = m.generador;
    return g?.latitud && g?.longitud ? [g.latitud, g.longitud] as [number, number] : null;
  }, [m]);
  const operadorPos = useMemo(() => {
    const o = m.operador;
    return o?.latitud && o?.longitud ? [o.latitud, o.longitud] as [number, number] : null;
  }, [m]);

  // Combined bounds: tracking points + generador/operador positions
  const mapBounds = useMemo(() => {
    const allPoints: [number, number][] = [];
    if (trackingRoute) allPoints.push(...trackingRoute.points);
    if (generadorPos) allPoints.push(generadorPos);
    if (operadorPos) allPoints.push(operadorPos);
    if (allPoints.length < 1) return null;
    if (allPoints.length === 1) {
      const [lat, lng] = allPoints[0];
      return L.latLngBounds([[lat - 0.01, lng - 0.01], [lat + 0.01, lng + 0.01]]);
    }
    return L.latLngBounds(allPoints);
  }, [trackingRoute, generadorPos, operadorPos]);

  const showMap = !!mapBounds;

  // --- Action Handlers ---
  // M4: actionInFlight ref prevents double-tap before React re-renders isPending
  const actionInFlightRef = React.useRef(false);
  const handleAction = async (
    action: () => Promise<any>,
    successMsg: string,
  ) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    try {
      await action();
      toast.success(successMsg);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || err?.message || 'Ocurrio un error');
    } finally {
      actionInFlightRef.current = false;
    }
  };

  const handleFirmar = () => handleAction(
    () => firmar.mutateAsync({ id: id! }),
    'Manifiesto firmado exitosamente',
  );

  const handleConfirmarRetiro = () => handleAction(
    () => confirmarRetiro.mutateAsync({ id: id! }),
    'Retiro confirmado exitosamente',
  );

  const handleConfirmarEntrega = () => handleAction(
    () => confirmarEntrega.mutateAsync({ id: id! }),
    'Entrega confirmada exitosamente',
  );

  const handleConfirmarRecepcion = () => handleAction(
    () => confirmarRecepcion.mutateAsync({ id: id! }),
    'Recepcion confirmada exitosamente',
  );

  const handlePesaje = (residuos: { id: string; cantidadRecibida: number }[], observaciones?: string) => {
    handleAction(
      () => pesaje.mutateAsync({ id: id!, residuos, observaciones }),
      'Pesaje registrado exitosamente',
    );
  };

  const handleTratamiento = (metodo: string, observaciones?: string) => {
    handleAction(
      () => registrarTratamiento.mutateAsync({ id: id!, metodo, observaciones }),
      'Tratamiento registrado exitosamente',
    );
  };

  const handleCerrar = () => handleAction(
    () => cerrar.mutateAsync(id!),
    'Manifiesto cerrado exitosamente',
  );

  const handleRechazar = (motivo: string, descripcion?: string) => {
    handleAction(
      () => rechazar.mutateAsync({ id: id!, motivo, descripcion }),
      'Carga rechazada exitosamente',
    );
  };

  const handleIncidente = (tipo: string, descripcion?: string) => {
    handleAction(
      () => registrarIncidente.mutateAsync({ id: id!, tipo, descripcion }),
      'Incidente registrado exitosamente',
    );
  };

  const handleCancelar = async () => {
    setIsCancelling(true);
    try {
      await manifiestoService.delete(id!);
      toast.success('Manifiesto cancelado');
      navigate(isMobile ? '/mobile/manifiestos' : '/manifiestos');
    } catch (err: any) {
      toast.error('Error al cancelar', err?.response?.data?.message || 'No se pudo cancelar el manifiesto');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRevertir = (estadoNuevo: string, motivo?: string) => {
    handleAction(
      () => revertir.mutateAsync({ id: id!, estadoNuevo, motivo }),
      'Estado revertido exitosamente',
    );
  };

  const handleDescargarPDF = async () => {
    try {
      const blob = await manifiestoService.downloadPdf(id!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `manifiesto-${m.numero || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Error al descargar PDF', err?.message || '');
    }
  };

  const handleDescargarCertificado = async () => {
    try {
      const blob = await manifiestoService.downloadCertificado(id!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado-${m.numero || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Error al descargar certificado', err?.message || '');
    }
  };

  // Redirect TRANSPORTISTA to the trip view for actionable states
  const isTransportista = userRol === 'TRANSPORTISTA';
  const transportistaStates = [EstadoManifiesto.APROBADO, EstadoManifiesto.EN_TRANSITO, EstadoManifiesto.ENTREGADO];
  if (!isLoading && manifiesto && isTransportista && m.estado && transportistaStates.includes(m.estado as EstadoManifiesto)) {
    const prefix = isApp ? '/app' : isMobile ? '/mobile' : '';
    navigate(`${prefix}/transporte/viaje/${id}`, { replace: true });
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24" />
          <div className="flex-1">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!manifiesto && (isError || !isLoading)) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Link to={isMobile ? "/mobile/manifiestos" : "/manifiestos"}>
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />}>Volver</Button>
          </Link>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <AlertCircle size={48} className="mx-auto text-warning-400 mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Manifiesto no encontrado</h3>
            <p className="text-neutral-600">No se pudo cargar el manifiesto solicitado. Verifica que el ID sea correcto o intenta nuevamente.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={isMobile ? "/mobile/manifiestos" : "/manifiestos"} className="shrink-0">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />}>
              Volver
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 truncate">{m.numero || id}</h2>
              <Badge variant="soft" color={getEstadoBadgeColor(m.estado || EstadoManifiesto.BORRADOR)} className="shrink-0">
                {formatEstado(m.estado || EstadoManifiesto.BORRADOR)}
              </Badge>
              {isError && (
                <Badge variant="soft" color="warning" className="shrink-0">
                  <AlertCircle size={12} className="mr-1" />
                  Error al cargar
                </Badge>
              )}
            </div>
            <p className="text-neutral-600 mt-1 text-sm sm:text-base">
              Creado el {m.createdAt ? formatDateTime(m.createdAt) : '-'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" leftIcon={<Download size={16} />} onClick={handleDescargarPDF}>
            Descargar PDF
          </Button>
          {m.estado === EstadoManifiesto.TRATADO && (
            <Button variant="outline" size="sm" leftIcon={<Award size={16} />} onClick={handleDescargarCertificado} className="!border-success-300 !text-success-700 hover:!bg-success-50">
              Certificado
            </Button>
          )}
          {m.estado === EstadoManifiesto.BORRADOR && (isAdmin || userRol === 'GENERADOR') && (
            <Button size="sm" onClick={() => navigate(isMobile ? `/mobile/manifiestos/${id}/editar` : `/manifiestos/${id}/editar`)}>
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Actores */}
          <Card>
            <CardHeader title="Información general" icon={<FileText size={20} />} />
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                  className={`flex items-start gap-3 p-2 -m-2 rounded-lg transition-colors ${isAdmin ? 'cursor-pointer hover:bg-purple-50/50 group' : ''}`}
                  onClick={() => isAdmin && m.generadorId && navigate(`${isMobile ? '/mobile' : ''}/admin/actores/generadores/${m.generadorId}`)}
                >
                  <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                    <User size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-500">Generador</p>
                    <p className={`font-medium text-neutral-900 ${isAdmin ? 'group-hover:text-purple-700' : ''}`}>{m.generador?.razonSocial || '-'}</p>
                    <p className="text-sm text-neutral-600">CUIT: {m.generador?.cuit ? formatCuit(m.generador.cuit) : '-'}</p>
                  </div>
                  {isAdmin && m.generadorId && <ExternalLink size={12} className="text-neutral-300 group-hover:text-purple-400 mt-1 shrink-0" />}
                </div>
                <div
                  className={`flex items-start gap-3 p-2 -m-2 rounded-lg transition-colors ${isAdmin ? 'cursor-pointer hover:bg-orange-50/50 group' : ''}`}
                  onClick={() => isAdmin && m.transportistaId && navigate(`${isMobile ? '/mobile' : ''}/admin/actores/transportistas/${m.transportistaId}`)}
                >
                  <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                    <Truck size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-500">Transportista</p>
                    <p className={`font-medium text-neutral-900 ${isAdmin ? 'group-hover:text-orange-700' : ''}`}>{m.transportista?.razonSocial || '-'}</p>
                    <p className="text-sm text-neutral-600">Hab: {m.transportista?.numeroHabilitacion || '-'}</p>
                  </div>
                  {isAdmin && m.transportistaId && <ExternalLink size={12} className="text-neutral-300 group-hover:text-orange-400 mt-1 shrink-0" />}
                </div>
                <div
                  className={`flex items-start gap-3 p-2 -m-2 rounded-lg transition-colors ${isAdmin ? 'cursor-pointer hover:bg-blue-50/50 group' : ''}`}
                  onClick={() => isAdmin && m.operadorId && navigate(`${isMobile ? '/mobile' : ''}/admin/actores/operadores/${m.operadorId}`)}
                >
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <FlaskConical size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-500">Operador</p>
                    <p className={`font-medium text-neutral-900 ${isAdmin ? 'group-hover:text-blue-700' : ''}`}>{m.operador?.razonSocial || '-'}</p>
                    <p className="text-sm text-neutral-600">Hab: {m.operador?.numeroHabilitacion || '-'}</p>
                  </div>
                  {isAdmin && m.operadorId && <ExternalLink size={12} className="text-neutral-300 group-hover:text-blue-400 mt-1 shrink-0" />}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Residuos */}
          <Card>
            <CardHeader title="Residuos transportados" icon={<Package size={20} />} />
            <CardContent>
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '15%' }}>Código</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '45%' }}>Descripción</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Cantidad</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Unidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {(m.residuos || []).map((residuo) => (
                      <tr key={residuo.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-sm">{residuo.tipoResiduo?.codigo || '-'}</td>
                        <td className="px-3 py-2.5 text-neutral-700 truncate" title={residuo.tipoResiduo?.nombre || residuo.descripcion || '-'}>{residuo.tipoResiduo?.nombre || residuo.descripcion || '-'}</td>
                        <td className="px-3 py-2.5 font-medium">{formatNumber(residuo.cantidad)}</td>
                        <td className="px-3 py-2.5 text-neutral-600">{residuo.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              <div className="mt-4 p-4 bg-neutral-50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-600">
                  <Weight size={18} />
                  <span className="font-medium">Peso total:</span>
                </div>
                <span className="text-xl font-bold text-neutral-900">{formatWeight(totalPeso)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Ruta del Viaje */}
          {showMap && (
            <Card>
              <div className="p-4 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-primary-600" />
                  <h3 className="font-semibold text-neutral-900">
                    {trackingRoute ? 'Ruta del Viaje' : 'Mapa de Ruta'}
                  </h3>
                  {trackingRoute && (
                    <Badge variant="soft" color="info">{trackingRoute.count} puntos GPS</Badge>
                  )}
                  {!trackingRoute && m.estado === EstadoManifiesto.EN_TRANSITO && (
                    <Badge variant="soft" color="warning">En tránsito — esperando GPS</Badge>
                  )}
                </div>
                {trackingRoute && (
                  <p className="text-xs text-neutral-500 mt-1">
                    {formatDateTime(trackingRoute.startTime)} → {formatDateTime(trackingRoute.endTime)}
                  </p>
                )}
              </div>
              <div style={{ height: 400 }} className="relative isolate">
                <MapContainer
                  bounds={mapBounds!}
                  boundsOptions={{ padding: [40, 40] }}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />

                  {/* Ruta planificada (generador → operador) */}
                  {generadorPos && operadorPos && (
                    <Polyline
                      positions={[generadorPos, operadorPos]}
                      color="#6366f1"
                      weight={3}
                      opacity={0.5}
                      dashArray="10, 8"
                    />
                  )}

                  {/* Ruta GPS realizada */}
                  {trackingRoute && (
                    <Polyline positions={trackingRoute.points} color="#0D8A4F" weight={4} opacity={0.8} />
                  )}

                  {/* Marcadores inicio/fin GPS */}
                  {trackingRoute && (
                    <>
                      <Marker position={trackingRoute.start} icon={ACTOR_ICONS.gpsStart}>
                        <Popup>Inicio del viaje GPS</Popup>
                      </Marker>
                      <Marker position={trackingRoute.end} icon={ACTOR_ICONS.gpsEnd}>
                        <Popup>Fin del viaje GPS</Popup>
                      </Marker>
                    </>
                  )}

                  {/* Generador (origen) */}
                  {generadorPos && (
                    <Marker position={generadorPos} icon={ACTOR_ICONS.generador}>
                      <Popup>
                        <strong>Generador</strong><br />
                        {m.generador?.razonSocial || '-'}<br />
                        <span style={{ fontSize: 11, color: '#666' }}>{m.generador?.domicilio || ''}</span>
                      </Popup>
                    </Marker>
                  )}

                  {/* Operador (destino) */}
                  {operadorPos && (
                    <Marker position={operadorPos} icon={ACTOR_ICONS.operador}>
                      <Popup>
                        <strong>Operador</strong><br />
                        {m.operador?.razonSocial || '-'}<br />
                        <span style={{ fontSize: 11, color: '#666' }}>{m.operador?.domicilio || ''}</span>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
              {/* Leyenda */}
              <div className="px-4 py-2.5 border-t border-neutral-100 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-600">
                {trackingRoute && (
                  <span className="flex items-center gap-1.5">
                    <span style={{ width: 20, height: 3, background: '#0D8A4F', display: 'inline-block', borderRadius: 2 }} />
                    Ruta realizada
                  </span>
                )}
                {generadorPos && operadorPos && (
                  <span className="flex items-center gap-1.5">
                    <span style={{ width: 20, height: 3, background: '#6366f1', display: 'inline-block', borderRadius: 2, borderTop: '1px dashed #6366f1' }} />
                    Ruta planificada
                  </span>
                )}
                {generadorPos && (
                  <span className="flex items-center gap-1.5">
                    <span style={{ width: 10, height: 10, background: ACTOR_COLORS.generador, borderRadius: 3, display: 'inline-block' }} />
                    Generador
                  </span>
                )}
                {operadorPos && (
                  <span className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 14 14"><polygon points="7,1 13,4 13,10 7,13 1,10 1,4" fill={ACTOR_COLORS.operador}/></svg>
                    Operador
                  </span>
                )}
                {trackingRoute && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span style={{ width: 8, height: 8, background: ACTOR_COLORS.gpsStart, borderRadius: '50%', display: 'inline-block' }} />
                      Inicio GPS
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span style={{ width: 8, height: 8, background: ACTOR_COLORS.gpsEnd, borderRadius: '50%', display: 'inline-block' }} />
                      Fin GPS
                    </span>
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Timeline */}
          <ManifiestoTimeline eventos={m.eventos} manifiesto={m} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6 animate-fade-in min-w-0">
          {/* Blockchain Certification */}
          {m.estado !== 'BORRADOR' && (
            <BlockchainPanel
              manifiestoId={id!}
              manifiestoEstado={m.estado as string}
              blockchainStatus={m.blockchainStatus}
            />
          )}

          {/* QR Code */}
          <Card>
            <CardHeader title="QR de Control" icon={<QrCode size={20} />} />
            <CardContent>
              {(() => {
                const numero = m.numero || id || 'M-2025-089';
                const qrUrl = `${window.location.origin}/manifiestos/verificar/${encodeURIComponent(numero)}`;
                return (
                  <div className="flex flex-col items-center gap-4">
                    <div className="qr-control-svg bg-white p-4 rounded-xl border border-neutral-100 shadow-sm">
                      <QRCodeSVG
                        value={qrUrl}
                        size={180}
                        level="H"
                        includeMargin={false}
                        bgColor="#FFFFFF"
                        fgColor="#1B5E3C"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-neutral-900">{numero}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Escanear para verificar estado
                      </p>
                    </div>
                    <div className="flex gap-2 w-full min-w-0">
                      <Button
                        variant="outline"
                        size="sm"
                        fullWidth
                        leftIcon={qrCopied ? <Check size={14} /> : <Copy size={14} />}
                        onClick={() => {
                          navigator.clipboard.writeText(qrUrl);
                          setQrCopied(true);
                          setTimeout(() => setQrCopied(false), 2000);
                        }}
                      >
                        {qrCopied ? 'Copiado' : 'Copiar enlace'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        fullWidth
                        leftIcon={<Download size={14} />}
                        onClick={() => {
                          const svg = document.querySelector('.qr-control-svg svg') as SVGElement;
                          if (!svg) return;
                          const svgData = new XMLSerializer().serializeToString(svg);
                          const canvas = document.createElement('canvas');
                          canvas.width = 400;
                          canvas.height = 400;
                          const ctx = canvas.getContext('2d');
                          const img = new Image();
                          img.onload = () => {
                            ctx?.drawImage(img, 0, 0, 400, 400);
                            const a = document.createElement('a');
                            a.download = `QR-${numero}.png`;
                            a.href = canvas.toDataURL('image/png');
                            a.click();
                          };
                          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                        }}
                      >
                        Descargar
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Actions + Modals */}
          <ManifiestoActions
            manifiesto={m}
            manifiestoId={id!}
            isAdmin={isAdmin}
            userRol={userRol}
            isActionPending={isActionPending}
            mutations={{
              firmar, confirmarRetiro, confirmarEntrega, confirmarRecepcion,
              pesaje, registrarTratamiento, cerrar, rechazar, registrarIncidente, revertir,
            }}
            onFirmar={handleFirmar}
            onConfirmarRetiro={handleConfirmarRetiro}
            onConfirmarEntrega={handleConfirmarEntrega}
            onConfirmarRecepcion={handleConfirmarRecepcion}
            onPesaje={handlePesaje}
            onTratamiento={handleTratamiento}
            onCerrar={handleCerrar}
            onRechazar={handleRechazar}
            onIncidente={handleIncidente}
            onCancelar={handleCancelar}
            onRevertir={handleRevertir}
            onDescargarPDF={handleDescargarPDF}
            onDescargarCertificado={handleDescargarCertificado}
            isCancelling={isCancelling}
          />

          <Card>
            <CardHeader title="Documentos" />
            <CardContent>
              <div className="space-y-2 animate-fade-in">
                <button
                  onClick={handleDescargarPDF}
                  className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl w-full hover:bg-neutral-100 transition-colors text-left"
                >
                  <FileText size={20} className="text-primary-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-neutral-900 truncate">Manifiesto PDF</p>
                    <p className="text-xs text-neutral-500">Descargar documento oficial</p>
                  </div>
                </button>
                {m.estado === EstadoManifiesto.TRATADO && (
                  <button
                    onClick={handleDescargarCertificado}
                    className="flex items-center gap-3 p-3 bg-success-50 rounded-xl w-full hover:bg-success-100 transition-colors text-left"
                  >
                    <Award size={20} className="text-success-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-success-900 truncate">Certificado de Disposición</p>
                      <p className="text-xs text-success-600">Certificado de tratamiento final</p>
                    </div>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default ManifiestoDetailPage;

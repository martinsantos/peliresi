import { manifestWorkspaceReturn } from '../../utils/manifestListReturn';
import { TrainingCertificates } from './components/TrainingCertificates';
import { TransportLegs } from './components/TransportLegs';
import { transportTrackSegments } from '../../utils/transportTrackSegments';
import { manifestFeatureVisible } from '../../utils/manifestFeatures';
/**
 * SITREP v6 - Manifiesto Detail Page
 * ==================================
 * Detalle de manifiesto con timeline - Conectado a API
 */

import React, { useState, useMemo } from 'react';
import { useParams, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Factory,
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
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './components/manifest-gps-map.css';
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
  useConfirmarRecepcionInSitu,
  usePesaje,
  useRegistrarTratamiento,
  useCerrarManifiesto,
  useCancelarManifiesto,
  useRechazarManifiesto,
  useRegistrarIncidente,
  useRevertirEstado,
} from '../../hooks/useManifiestos';
import { useAuth, type User } from '../../contexts/AuthContext';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { usePendingDeliveryIds } from '../../hooks/usePendingDeliveryIds';
import { useQueryOwner } from '../../hooks/useQueryOwner';
import { gpsContextScope } from '../../services/gpsQueue';
import { supportRequestContext } from '../../utils/supportSession';
import { canReadActorDetail, type ActorReadType } from '../../utils/actorReadAccess';
import { manifiestoService } from '../../services/manifiesto.service';
import { formatDateTime, formatEstado, formatCuit } from '../../utils/formatters';
import { declaredQuantities, formatDeclaredQuantity } from '../../utils/declaredQuantities';
import type { Manifiesto } from '../../types/models';
import { EstadoManifiesto } from '../../types/models';
import ManifiestoTimeline from './components/ManifiestoTimeline';
import { companyGeneratorView } from '../../utils/enterprisePresentation';
import ManifiestoActions from './components/ManifiestoActions';
import { PendingGpsReceipts } from '../../components/mobile/PendingGpsReceipts';
import { subscribeDeliveryConfirmed } from '../../services/offlineSyncEvents';
import PersonalManifestNoticeAction from '../../components/PersonalManifestNoticeAction';
import { needsPersonalManifestChoice } from '../../utils/notificationNavigation';
import { tripAccessDenied } from '../../services/tripSnapshot';

const ACTOR_SUMMARY = {
  GENERADOR: { label: 'Generador', Icon: Factory, icon: 'bg-purple-50 text-purple-600', interactive: 'hover:bg-purple-50/50' },
  TRANSPORTISTA: { label: 'Transportista', Icon: Truck, icon: 'bg-orange-50 text-orange-600', interactive: 'hover:bg-orange-50/50' },
  OPERADOR: { label: 'Operador', Icon: FlaskConical, icon: 'bg-blue-50 text-blue-600', interactive: 'hover:bg-blue-50/50' },
};

const gpsReceptionFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Mendoza', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const gpsReceptionDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Mendoza', year: 'numeric', month: '2-digit', day: '2-digit',
});
const gpsReceptionTime = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Mendoza', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
function formatGpsReception(value: string, timeOnly = false): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? (timeOnly ? gpsReceptionTime : gpsReceptionFormatter).format(date) : 'Fecha no disponible';
}
function sameGpsReceptionDay(a: string, b: string): boolean {
  const first = new Date(a), last = new Date(b);
  return Number.isFinite(first.getTime()) && Number.isFinite(last.getTime()) && gpsReceptionDay.format(first) === gpsReceptionDay.format(last);
}
const gpsWindowIcon = (latest: boolean) => L.divIcon({ className: '', iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -12],
  html: `<span style="display:flex;width:44px;height:44px;align-items:center;justify-content:center"><span style="display:block;width:16px;height:16px;border-radius:50%;box-sizing:border-box;border:${latest ? '4px solid white;background:#08623b' : '3px solid #08623b;background:white'};box-shadow:0 1px 4px #0005"></span></span>`,
});
const gpsFirstShownIcon = gpsWindowIcon(false);
const gpsLatestIcon = gpsWindowIcon(true);

function ActorSummary({ type, actorId, user, name, detail, to, returnTo, roleLabel }: {
  type: ActorReadType; actorId?: string; user: User | null; name: string; detail: string; to: string; returnTo: string; roleLabel?: string;
}) {
  const { label: defaultLabel, Icon, icon, interactive } = ACTOR_SUMMARY[type];
  const label = roleLabel || defaultLabel;
  const readable = canReadActorDetail(user, type, actorId);
  const content = <>
    <span className={`shrink-0 rounded-lg p-2 ${icon}`}><Icon size={20} aria-hidden="true" /></span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm text-neutral-500">{label}</span>
      <span className="block break-words font-medium text-neutral-900">{name}</span>
      <span className="block break-words text-sm text-neutral-600">{detail}</span>
    </span>
    {readable && <ExternalLink size={14} aria-hidden="true" className="mt-1 shrink-0 text-neutral-500" />}
  </>;
  const base = 'flex min-h-11 items-start gap-3 rounded-lg p-2';
  return readable ? <Link to={to} state={{ actorReturn: returnTo }} aria-label={`Abrir ficha de ${label.toLowerCase()}: ${name}`}
    className={`${base} !no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 ${interactive}`}>
    {content}
  </Link> : <div className={base}>{content}</div>;
}

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
  const mp = useMobilePrefix();
  const returnContext = manifestWorkspaceReturn(location.state, mp('/manifiestos'));
  const returnToList = returnContext.path;
  const isApp = location.pathname.startsWith('/app');
  const { data: apiData, isLoading, isError, error: loadError, refetch: reloadManifest } = useManifiesto(id || '');
  const [qrCopied, setQrCopied] = React.useState(false);

  // Auth context for role-based visibility
  const { currentUser, isAdmin } = useAuth();
  const workspaceOwner = useQueryOwner();
  const requestContext = React.useMemo(() => supportRequestContext(), [currentUser, workspaceOwner]);
  const contextOwner = gpsContextScope(workspaceOwner, requestContext);
  const userRol = currentUser?.rol || '';
  const pendingDeliveries = usePendingDeliveryIds(['TRANSPORTISTA', 'ADMIN'].includes(userRol));
  React.useEffect(() => subscribeDeliveryConfirmed(event => {
    const detail = (event as CustomEvent<{ id: string; owner: string }>).detail;
    if (detail?.id === id) void reloadManifest();
  }), [id, reloadManifest]);

  // Action mutations
  const firmar = useFirmarManifiesto();
  const confirmarRetiro = useConfirmarRetiro();
  const confirmarEntrega = useConfirmarEntrega();
  const confirmarRecepcion = useConfirmarRecepcion();
  const confirmarRecepcionInSitu = useConfirmarRecepcionInSitu();
  const pesaje = usePesaje();
  const registrarTratamiento = useRegistrarTratamiento();
  const cerrar = useCerrarManifiesto();
  const rechazar = useRechazarManifiesto();
  const registrarIncidente = useRegistrarIncidente(id);
  const revertir = useRevertirEstado();
  const cancelar = useCancelarManifiesto();

  // Cancel state (managed here because it navigates)
  const [isCancelling, setIsCancelling] = useState(false);

  // Track which action is in progress
  const isActionPending = firmar.isPending || confirmarRetiro.isPending || confirmarEntrega.isPending
    || confirmarRecepcion.isPending || confirmarRecepcionInSitu.isPending || pesaje.isPending || registrarTratamiento.isPending || cerrar.isPending
    || rechazar.isPending || registrarIncidente.isPending || revertir.isPending;

  // Use API data only
  // Do not keep a cached dossier visible after the server revokes access.
  const manifiesto = isError && tripAccessDenied(loadError) ? undefined : apiData;
  const m = (manifiesto || {}) as Partial<Manifiesto>;
  const isInSitu = m.modalidad === 'IN_SITU' || (!m.modalidad && !m.transportistaId);
  const quantityTotals = declaredQuantities(Array.isArray(m.residuos) ? m.residuos : []);

  // --- Tracking route for GPS map ---
  const trackingRoute = useMemo(() => {
    const points = m?.tracking || [];
    if (!points.length) return null;
    const sorted = [...points].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() || a.id.localeCompare(b.id)
    );
    return {
      segments:transportTrackSegments(sorted),
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
    const g = companyGeneratorView(m.generador,m.contextoEmpresa);
    return g?.latitud!=null && g?.longitud!=null ? [g.latitud, g.longitud] as [number, number] : null;
  }, [m]);
  const operadorPos = useMemo(() => {
    const o = m.operador;
    return o?.latitud != null && o?.longitud != null ? [o.latitud, o.longitud] as [number, number] : null;
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

  const showMap = !!mapBounds && !isInSitu;

  // --- Action Handlers ---
  // M4: actionInFlight ref prevents double-tap before React re-renders isPending
  const actionInFlightRef = React.useRef(false);
  const handleAction = async (
    action: () => Promise<any>,
    successMsg: string,
  ) => {
    if (actionInFlightRef.current) return false;
    actionInFlightRef.current = true;
    try {
      await action();
      toast.success(successMsg);
      return true;
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || err?.message || 'Ocurrio un error');
      return false;
    } finally {
      actionInFlightRef.current = false;
    }
  };

  const handleFirmar = (firma: string) => handleAction(
    () => firmar.mutateAsync({ id: id!, firma }),
    'Manifiesto firmado exitosamente',
  );

  const handleConfirmarRetiro = () => handleAction(
    () => confirmarRetiro.mutateAsync({ id: id! }),
    'Retiro confirmado exitosamente',
  );

  const handleConfirmarEntrega = async () => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    try {
      const result = await confirmarEntrega.mutateAsync({ id: id! });
      if (result.status === 'confirmed') toast.success('Entrega confirmada exitosamente');
      else toast.info('Entrega pendiente', result.message);
    } catch (err: any) {
      toast.error('No se pudo preparar la entrega', err?.response?.data?.message || err?.message || 'Revisá el almacenamiento y la sesión.');
    } finally { actionInFlightRef.current = false; }
  };

  const handleConfirmarRecepcion = () => handleAction(
    () => confirmarRecepcion.mutateAsync({ id: id! }),
    'Recepcion confirmada exitosamente',
  );

  const handleConfirmarRecepcionInSitu = () => handleAction(
    () => confirmarRecepcionInSitu.mutateAsync({ id: id! }),
    'Recepcion in situ confirmada exitosamente',
  );

  const handlePesaje = (residuos: { id: string; cantidadRecibida: number }[], observaciones?: string) => {
    return handleAction(
      () => pesaje.mutateAsync({ id: id!, residuos, observaciones }),
      'Pesaje registrado exitosamente',
    );
  };

  const handleTratamiento = (metodo: string, observaciones?: string) => {
    return handleAction(
      () => registrarTratamiento.mutateAsync({ id: id!, metodo, observaciones }),
      'Tratamiento registrado exitosamente',
    );
  };

  const handleCerrar = () => handleAction(
    () => cerrar.mutateAsync(id!),
    'Manifiesto cerrado exitosamente',
  );

  const handleRechazar = (motivo: string, descripcion?: string) => {
    return handleAction(
      () => rechazar.mutateAsync({ id: id!, motivo, descripcion }),
      'Carga rechazada exitosamente',
    );
  };

  const handleIncidente = async (tipo: string, descripcion: string) => {
    if (actionInFlightRef.current) return false;
    actionInFlightRef.current = true;
    try {
      const result = await registrarIncidente.mutateAsync({ id: id!, tipo, descripcion });
      if (result.cleaned) toast.success('Incidente registrado exitosamente');
      else toast.info('Incidente registrado', 'No pudimos actualizar la copia local. Conservá este dispositivo y comprobá el envío.');
      return true;
    } catch (err: any) {
      toast.error('No se pudo confirmar el incidente', err?.message || 'Comprobá el envío antes de registrar otro.');
      return false;
    } finally { actionInFlightRef.current = false; }
  };

  const handleCancelar = async () => {
    if (actionInFlightRef.current) return false;
    actionInFlightRef.current = true;
    setIsCancelling(true);
    try {
      await cancelar.mutateAsync({ id: id! });
      toast.success('Manifiesto cancelado');
      navigate('/manifiestos');
      return true;
    } catch (err: any) {
      toast.error('Error al cancelar', err?.response?.data?.message || 'No se pudo cancelar el manifiesto');
      return false;
    } finally {
      actionInFlightRef.current = false;
      setIsCancelling(false);
    }
  };

  const handleRevertir = (estadoNuevo: string, motivo?: string) => {
    return handleAction(
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
  const historicalApproved = m.estado === EstadoManifiesto.APROBADO && !m.eventos?.some(e => e.tipo === 'PROPUESTA_PARTES_V1');
  if (!isLoading && manifiesto && isTransportista && !isInSitu && !historicalApproved && m.estado && transportistaStates.includes(m.estado as EstadoManifiesto)) {
    const prefix = isApp ? '/app' : '';
    return <Navigate to={`${prefix}/transporte/viaje/${id}`} replace />;
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
    const status = (loadError as { response?: { status?: number } } | null)?.response?.status;
    const chooseActivity = (status === 403 || status === 404) && !!id && !!currentUser && needsPersonalManifestChoice(currentUser);
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" aria-label={`Volver a ${returnContext.label}`} onClick={() => navigate(returnToList)} leftIcon={<ArrowLeft size={18} />}>{returnContext.label}</Button>
        <Card>
          <CardContent className="py-16 text-center">
            <AlertCircle size={48} className="mx-auto text-warning-400 mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">{chooseActivity ? 'Manifiesto no disponible en esta actividad' : 'Manifiesto no encontrado'}</h3>
            <p className="text-neutral-600">{chooseActivity ? 'Comprobá si otra de tus actividades puede abrirlo.' : 'No se pudo cargar el manifiesto solicitado. Verificá el enlace o intentá nuevamente.'}</p>
            {chooseActivity && id && currentUser && <div className="mx-auto mt-4 max-w-lg"><PersonalManifestNoticeAction manifestId={id}
              target={'/manifiestos/' + id + location.search + location.hash} user={currentUser} onCurrent={() => void reloadManifest()} /></div>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4" data-operational-page>
      {/* Header */}
      <div className="space-y-3">
        <Button variant="ghost" aria-label={`Volver a ${returnContext.label}`} onClick={() => navigate(returnToList)} leftIcon={<ArrowLeft size={18} />}>{returnContext.label}</Button>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h2 className="text-lg sm:text-2xl font-bold text-neutral-900 truncate">{m.numero || id}</h2>
          <Badge variant="soft" color={historicalApproved ? 'warning' : getEstadoBadgeColor(m.estado || EstadoManifiesto.BORRADOR)} className="shrink-0">
            {historicalApproved ? 'Aprobado · registro anterior' : formatEstado(m.estado || EstadoManifiesto.BORRADOR)}
          </Badge>
          {m.modalidad === 'IN_SITU' && <Badge variant="soft" color="info">En origen · sin traslado</Badge>}
          {isError && (
            <Badge variant="soft" color="warning" className="shrink-0">
              <AlertCircle size={12} className="mr-1" />
              Error al cargar
            </Badge>
          )}
        </div>
        <p className="text-neutral-600 text-sm sm:text-base">
          Creado el {m.createdAt ? formatDateTime(m.createdAt) : '-'}
        </p>
        <div className="flex flex-wrap gap-2">
          {m.estado === EstadoManifiesto.BORRADOR && (isAdmin || userRol === 'GENERADOR') && (
            <Button size="sm" onClick={() => navigate(mp(`/manifiestos/${id}/editar`))}>
              Editar
            </Button>
          )}
        </div>
      </div>

      {id && currentUser?.id != null && ['TRANSPORTISTA', 'ADMIN'].includes(userRol) && !isInSitu && m.estado !== EstadoManifiesto.EN_TRANSITO && <PendingGpsReceipts key={`${contextOwner}:${id}`} ownerId={currentUser.id} contextOwner={contextOwner} manifestId={id} />}

      {/* One action surface, before the long field context on every screen size. */}
      <ManifiestoActions
        onRetryApprovalCheck={() => void reloadManifest()}
        manifiesto={m}
        manifiestoId={id!}
        isAdmin={isAdmin}
        userRol={userRol}
        isActionPending={isActionPending}
        deliveryPending={!!id && pendingDeliveries.ids.has(id)}
        deliveryChecking={m.estado === EstadoManifiesto.EN_TRANSITO && pendingDeliveries.checking}
        deliveryCheckError={m.estado === EstadoManifiesto.EN_TRANSITO && pendingDeliveries.error}
        onRetryDeliveryCheck={pendingDeliveries.retry}
        incidentNotice={['TRANSPORTISTA', 'ADMIN'].includes(userRol) ? {
          pending: registrarIncidente.pendingIncident, storageError: registrarIncidente.incidentStorageError,
          checking: registrarIncidente.checkingIncident, busy: registrarIncidente.isPending,
          onRetry: () => registrarIncidente.retryIncident(), onRefresh: registrarIncidente.refreshIncident,
        } : undefined}
        isInSitu={isInSitu}
        mutations={{
          firmar, confirmarRetiro, confirmarEntrega, confirmarRecepcion,
          confirmarRecepcionInSitu,
          pesaje, registrarTratamiento, cerrar, rechazar, registrarIncidente, revertir,
        }}
        onFirmar={handleFirmar}
        onConfirmarRetiro={handleConfirmarRetiro}
        onConfirmarEntrega={handleConfirmarEntrega}
        onConfirmarRecepcion={handleConfirmarRecepcion}
        onConfirmarRecepcionInSitu={handleConfirmarRecepcionInSitu}
        onPesaje={handlePesaje}
        onTratamiento={handleTratamiento}
        onCerrar={handleCerrar}
        onRechazar={handleRechazar}
        onIncidente={handleIncidente}
        onCancelar={handleCancelar}
        onRevertir={handleRevertir}
        onDescargarPDF={handleDescargarPDF}
        training={currentUser?.training}
        onDescargarCertificado={handleDescargarCertificado}
        isCancelling={isCancelling}
      />

      {manifestFeatureVisible(import.meta.env.VITE_MANIFEST_ADDENDA_ENABLED, currentUser) && <Link to={mp(`/manifiestos/${id}/adendas`)} className="inline-flex min-h-11 items-center text-primary-700 underline">Adendas y revisión posterior</Link>}

      {(currentUser?.training || import.meta.env.VITE_MANIFEST_CERTIFICATES_ENABLED === 'true' || m.eventos?.some(e=>['CERTIFICACION_OPERADOR_V1','CERTIFICADO_OPERADOR_V1'].includes(e.tipo))) && <TrainingCertificates key={m.id} manifest={m} />}
      {m.transportistaId&&m.modalidad!=='IN_SITU'&&m.estado!==EstadoManifiesto.BORRADOR&&<TransportLegs id={id!}/>}

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Actores */}
          <Card>
            <CardHeader title="Información general" icon={<FileText size={20} />} />
            <CardContent>
              {m.contextoEmpresa?.rol==='GENERADOR'&&<dl className="mb-5 grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-neutral-600">Domicilio legal al declarar</dt><dd className="break-words">{m.contextoEmpresa.domicilioLegal.calle||'No informado'}</dd></div><div><dt className="text-sm text-neutral-600">Establecimiento y domicilio productivo</dt><dd className="break-words">{m.contextoEmpresa.establecimiento?.nombre||'No identificado'} · {m.contextoEmpresa.establecimiento?.domicilio||'Por completar'}</dd></div></dl>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ActorSummary type="GENERADOR" actorId={m.generadorId} user={currentUser}
                  name={m.generador?.razonSocial || '-'} detail={`CUIT: ${m.generador?.cuit ? formatCuit(m.generador.cuit) : '-'}`}
                  to={mp(`/admin/actores/generadores/${encodeURIComponent(m.generadorId || '')}`)}
                  returnTo={location.pathname + location.search + location.hash} />
                {m.transportistaId ? (
                  <ActorSummary type="TRANSPORTISTA" actorId={m.transportistaId} user={currentUser}
                    name={m.transportista?.razonSocial || '-'} detail={`Hab: ${m.transportista?.numeroHabilitacion || '-'}`}
                    roleLabel={isInSitu ? 'Transporte aprobador' : undefined}
                    to={mp(`/admin/actores/transportistas/${encodeURIComponent(m.transportistaId)}`)}
                    returnTo={location.pathname + location.search + location.hash} />
                ) : (
                  <div className="flex items-start gap-3 p-2 -m-2 rounded-lg">
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                      <MapPin size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-500">Modalidad</p>
                      <Badge variant="soft" color="success">In Situ</Badge>
                      <p className="text-xs text-neutral-500 mt-1">Operador trabaja en sitio del generador</p>
                    </div>
                  </div>
                )}
                <ActorSummary type="OPERADOR" actorId={m.operadorId} user={currentUser}
                  name={m.operador?.razonSocial || '-'} detail={`Hab: ${m.operador?.numeroHabilitacion || '-'}`}
                  to={mp(`/admin/actores/operadores/${encodeURIComponent(m.operadorId || '')}`)}
                  returnTo={location.pathname + location.search + location.hash} />
              </div>
            </CardContent>
          </Card>

          {/* Residuos */}
          {m.transportistaId && !isInSitu && <Card>
            <CardHeader title="Transporte asignado" icon={<Truck size={20} />} />
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0"><dt className="text-sm text-neutral-600">Vehículo</dt>
                  <dd className="break-words text-sm font-medium text-neutral-900">{m.asignacionTransporte?.version === 1 && m.asignacionTransporte.transportistaId === m.transportistaId && m.asignacionTransporte.vehiculo
                    ? `${m.asignacionTransporte.vehiculo.patente} · ${m.asignacionTransporte.vehiculo.marca} ${m.asignacionTransporte.vehiculo.modelo}`
                    : 'Sin asignación registrada'}</dd></div>
                <div className="min-w-0"><dt className="text-sm text-neutral-600">Chofer</dt>
                  <dd className="break-words text-sm font-medium text-neutral-900">{m.asignacionTransporte?.version === 1 && m.asignacionTransporte.transportistaId === m.transportistaId && m.asignacionTransporte.chofer
                    ? `${m.asignacionTransporte.chofer.nombre} ${m.asignacionTransporte.chofer.apellido}`
                    : 'Sin asignación registrada'}</dd></div>
              </dl>
            </CardContent>
          </Card>}
          <Card>
            <CardHeader title={isInSitu ? 'Residuos declarados' : 'Residuos transportados'} icon={<Package size={20} />} />
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
                        <td className="px-3 py-2.5 font-medium">{formatDeclaredQuantity(residuo.cantidad)}</td>
                        <td className="px-3 py-2.5 text-neutral-600">{residuo.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              <div className="mt-4 p-4 bg-neutral-50 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-neutral-600">
                  <Weight size={18} />
                  <span className="font-medium">Totales declarados:</span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-lg font-bold text-neutral-900">
                  {quantityTotals.length ? quantityTotals.map(total => <span key={total.unidad}>{formatDeclaredQuantity(total.cantidad)} {total.unidad}</span>) : <span>Sin cantidades informadas</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Posiciones recibidas, limitadas por la consulta de detalle */}
          {showMap && (
            <Card>
              <div className="p-4 border-b border-neutral-100">
                <div className="flex flex-wrap items-center gap-2">
                  <MapPin size={18} className="shrink-0 text-primary-600" aria-hidden="true" />
                  <h3 className="min-w-0 font-semibold text-neutral-900">
                    {trackingRoute ? 'Ubicaciones GPS recibidas' : 'Ubicaciones de establecimientos'}
                  </h3>
                  {trackingRoute && (
                    <Badge variant="soft" color="info">{trackingRoute.count >= 100 ? 'Últimos 100 puntos' : `${trackingRoute.count} ${trackingRoute.count === 1 ? 'punto mostrado' : 'puntos mostrados'}`}</Badge>
                  )}
                  {!trackingRoute && m.estado === EstadoManifiesto.EN_TRANSITO && (
                    <Badge variant="soft" color="warning">En tránsito — esperando GPS</Badge>
                  )}
                </div>
                {trackingRoute ? <div className="mt-2 space-y-1 text-sm leading-5 text-neutral-700">
                  <p>
                    {trackingRoute.count === 1 ? 'Recepción · ' : 'Recepciones · '}
                    <time dateTime={trackingRoute.startTime}>{formatGpsReception(trackingRoute.startTime)}</time>
                    {trackingRoute.count > 1 && <> → <time dateTime={trackingRoute.endTime}>{formatGpsReception(trackingRoute.endTime, sameGpsReceptionDay(trackingRoute.startTime, trackingRoute.endTime))}</time></>}
                    {' '}· Mendoza
                  </p>
                  <p>La hora de captura no está disponible.
                    {trackingRoute.segments.some(segment => segment.length > 1) && ' Las líneas no confirman el recorrido.'}</p>
                </div> : <p className="mt-2 text-sm leading-5 text-neutral-700">
                  Datos actuales de los establecimientos.{generadorPos && operadorPos && ' La referencia no es una ruta confirmada.'}
                </p>}
              </div>
              <div style={{ height: 400 }} className="manifest-gps-map relative isolate" role="region" aria-label="Mapa de ubicaciones recibidas y establecimientos">
                <MapContainer
                  bounds={mapBounds!}
                  boundsOptions={{ padding: [40, 40] }}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />

                  {/* Referencia entre ubicaciones actuales, no ruta vial */}
                  {generadorPos && operadorPos && (
                    <Polyline
                      positions={[generadorPos, operadorPos]}
                      color="#6366f1"
                      weight={3}
                      opacity={0.5}
                      dashArray="10, 8"
                    />
                  )}

                  {/* Conexiones visuales entre puntos de un mismo tramo */}
                  {trackingRoute && (
                    <>{trackingRoute.segments.map((segment,index)=>segment.length > 1 && <Polyline key={index} positions={segment} color="#0D8A4F" weight={4} opacity={0.8} />)}</>
                  )}

                  {/* Primera y última posiciones de la ventana mostrada */}
                  {trackingRoute && (
                    trackingRoute.count === 1 ?
                      <Marker position={trackingRoute.start} icon={gpsLatestIcon} title="Única posición recibida">
                        <Popup>Única posición recibida</Popup>
                      </Marker> : <>
                        <Marker position={trackingRoute.start} icon={gpsFirstShownIcon} title="Primera posición mostrada">
                          <Popup>Primera posición mostrada</Popup>
                        </Marker>
                        <Marker position={trackingRoute.end} icon={gpsLatestIcon} title="Última posición recibida">
                          <Popup>Última posición recibida</Popup>
                        </Marker>
                      </>
                  )}

                  {/* Generador (origen) */}
                  {generadorPos && (
                    <Marker position={generadorPos} icon={ACTOR_ICONS.generador}>
                      <Popup>
                        <strong>Generador</strong><br />
                        {m.generador?.razonSocial || '-'}<br />
                        <span style={{ fontSize: 11, color: '#666' }}>{companyGeneratorView(m.generador,m.contextoEmpresa)?.domicilio || ''}</span>
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
              <div className="px-4 py-2.5 border-t border-neutral-100 flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-700">
                {trackingRoute && trackingRoute.segments.some(segment => segment.length > 1) && (
                  <span className="flex items-center gap-1.5">
                    <span style={{ width: 20, height: 3, background: '#0D8A4F', display: 'inline-block', borderRadius: 2 }} />
                    Posiciones conectadas
                  </span>
                )}
                {generadorPos && operadorPos && (
                  <span className="flex items-center gap-1.5">
                    <span style={{ width: 20, height: 3, background: '#6366f1', display: 'inline-block', borderRadius: 2, borderTop: '1px dashed #6366f1' }} />
                    Referencia entre establecimientos
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
                    <FlaskConical size={14} color={ACTOR_COLORS.operador} />
                    Operador
                  </span>
                )}
                {trackingRoute && trackingRoute.count > 1 && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span style={{ width: 12, height: 12, background: 'white', border: '2px solid #08623b', borderRadius: '50%', display: 'inline-block' }} />
                      Primera posición mostrada
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span style={{ width: 12, height: 12, background: '#08623b', border: '2px solid white', outline: '1px solid #08623b', borderRadius: '50%', display: 'inline-block' }} />
                      Última posición recibida
                    </span>
                  </>
                )}
                {trackingRoute && trackingRoute.count === 1 && (
                  <span className="flex items-center gap-1.5">
                    <span style={{ width: 12, height: 12, background: '#08623b', border: '2px solid white', outline: '1px solid #08623b', borderRadius: '50%', display: 'inline-block' }} />
                    Única posición recibida
                  </span>
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
          {m.estado !== 'BORRADOR' && (!currentUser?.empresaContexto || currentUser.empresaContexto.todasSedes) && (
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
                const numero = m.numero || id!;
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
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(qrUrl);
                            setQrCopied(true);
                            setTimeout(() => setQrCopied(false), 2000);
                          } catch {
                            toast.error('No se pudo copiar el enlace', 'El navegador no permitió usar el portapapeles.');
                          }
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

        </div>
      </div>
    </div>
  );
};

export default ManifiestoDetailPage;

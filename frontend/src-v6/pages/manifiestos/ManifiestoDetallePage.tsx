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
  Calendar,
  Weight,
  Package,
  CheckCircle,
  Loader2,
  AlertCircle,
  QrCode,
  Download,
  Copy,
  Check,
  PenTool,
  ClipboardCheck,
  Scale,
  Beaker,
  XCircle,
  Award,
  RotateCcw,
  Flame,
  Leaf,
  Recycle,
  Microscope,
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
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
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
import { ESTADO_COLORS } from '../../utils/constants';
import type { Manifiesto, EventoManifiesto } from '../../types/models';
import { EstadoManifiesto } from '../../types/models';
import { SignaturePad } from '../../components/ui/SignaturePad';

// Timeline entry shape
type TimelineEntry = { id: string; date: string; title: string; description: string; status: string };

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

function buildTimeline(manifiesto: Partial<Manifiesto>): TimelineEntry[] {
  if (!manifiesto.eventos || !Array.isArray(manifiesto.eventos) || manifiesto.eventos.length === 0) return [];

  const estadoOrder = [
    EstadoManifiesto.BORRADOR,
    EstadoManifiesto.PENDIENTE_APROBACION,
    EstadoManifiesto.APROBADO,
    EstadoManifiesto.EN_TRANSITO,
    EstadoManifiesto.ENTREGADO,
    EstadoManifiesto.RECIBIDO,
    EstadoManifiesto.EN_TRATAMIENTO,
    EstadoManifiesto.TRATADO,
  ];

  const currentIdx = estadoOrder.indexOf(manifiesto.estado || EstadoManifiesto.BORRADOR);

  return manifiesto.eventos.map((ev, i) => ({
    id: ev.id,
    date: formatDateTime(ev.createdAt),
    title: String(ev.tipo || '').replace(/_/g, ' '),
    description: String(ev.descripcion || '') + (ev.usuario ? ` - ${ev.usuario.nombre}` : ''),
    status: i < currentIdx ? 'completed' : i === currentIdx ? 'current' : 'pending',
  }));
}

const METODOS_TRATAMIENTO: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'INCINERACION', label: 'Incineración', icon: <Flame size={16} className="inline" /> },
  { id: 'TRATAMIENTO_FISICOQUIMICO', label: 'Fisicoquímico', icon: <FlaskConical size={16} className="inline" /> },
  { id: 'TRATAMIENTO_BIOLOGICO', label: 'Biológico', icon: <Leaf size={16} className="inline" /> },
  { id: 'RECICLADO', label: 'Reciclaje', icon: <Recycle size={16} className="inline" /> },
  { id: 'RELLENO_SEGURIDAD', label: 'Relleno seguridad', icon: <Package size={16} className="inline" /> },
  { id: 'OTRO', label: 'Otro', icon: <Microscope size={16} className="inline" /> },
];

const ESTADOS_FLUJO = [
  EstadoManifiesto.BORRADOR,
  EstadoManifiesto.PENDIENTE_APROBACION,
  EstadoManifiesto.APROBADO,
  EstadoManifiesto.EN_TRANSITO,
  EstadoManifiesto.ENTREGADO,
  EstadoManifiesto.RECIBIDO,
  EstadoManifiesto.EN_TRATAMIENTO,
  EstadoManifiesto.TRATADO,
];

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

  // Modal state for pesaje
  const [showPesajeModal, setShowPesajeModal] = useState(false);
  const [pesajeData, setPesajeData] = useState<Record<string, number>>({});
  const [pesajeObs, setPesajeObs] = useState('');

  // Modal state for tratamiento
  const [showTratamientoModal, setShowTratamientoModal] = useState(false);
  const [tratamientoMetodo, setTratamientoMetodo] = useState('');
  const [tratamientoObs, setTratamientoObs] = useState('');

  // Modal state for rechazar
  const [showRechazarModal, setShowRechazarModal] = useState(false);
  const [rechazarMotivo, setRechazarMotivo] = useState('');
  const [rechazarDescripcion, setRechazarDescripcion] = useState('');

  // Modal state for incidente
  const [showIncidenteModal, setShowIncidenteModal] = useState(false);
  const [incidenteTipo, setIncidenteTipo] = useState('');
  const [incidenteDescripcion, setIncidenteDescripcion] = useState('');

  // Cancel confirmation
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Modal state for reversion
  const [showReversionModal, setShowReversionModal] = useState(false);
  const [reversionEstado, setReversionEstado] = useState('');
  const [reversionMotivo, setReversionMotivo] = useState('');

  // Modal state for firma digital
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [firmaBase64, setFirmaBase64] = useState('');

  // Track which action is in progress
  const isActionPending = firmar.isPending || confirmarRetiro.isPending || confirmarEntrega.isPending
    || confirmarRecepcion.isPending || pesaje.isPending || registrarTratamiento.isPending || cerrar.isPending
    || rechazar.isPending || registrarIncidente.isPending || revertir.isPending;

  // Use API data only
  const manifiesto = (apiData as any)?.data || apiData;
  const m = (manifiesto || {}) as Partial<Manifiesto>;
  const timeline = buildTimeline(m);
  const totalPeso = Array.isArray(m.residuos) ? m.residuos.reduce((sum, r) => sum + (typeof r.cantidad === 'number' ? r.cantidad : 0), 0) : 0;

  // --- Tracking route for GPS map ---
  const trackingRoute = useMemo(() => {
    const points = (m as any)?.tracking || [];
    if (!points.length) return null;
    const sorted = [...points].sort((a: any, b: any) =>
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
    const g = m.generador as any;
    return g?.latitud && g?.longitud ? [g.latitud, g.longitud] as [number, number] : null;
  }, [m]);
  const operadorPos = useMemo(() => {
    const o = m.operador as any;
    return o?.latitud && o?.longitud ? [o.latitud, o.longitud] as [number, number] : null;
  }, [m]);

  // Combined bounds: tracking points + generador/operador positions
  // Shows map if we have ANY geo data (tracking, generador, or operador)
  const mapBounds = useMemo(() => {
    const allPoints: [number, number][] = [];
    if (trackingRoute) allPoints.push(...trackingRoute.points);
    if (generadorPos) allPoints.push(generadorPos);
    if (operadorPos) allPoints.push(operadorPos);
    if (allPoints.length < 1) return null;
    // If only one point, create a small bounding box around it
    if (allPoints.length === 1) {
      const [lat, lng] = allPoints[0];
      return L.latLngBounds([[lat - 0.01, lng - 0.01], [lat + 0.01, lng + 0.01]]);
    }
    return L.latLngBounds(allPoints);
  }, [trackingRoute, generadorPos, operadorPos]);

  // Show map for manifiestos that are in transit or beyond (have route relevance)
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

  const handlePesaje = () => {
    const residuosData = Object.entries(pesajeData).map(([resId, cant]) => ({
      id: resId,
      cantidadRecibida: cant,
    }));
    if (residuosData.length === 0) {
      toast.warning('Datos incompletos', 'Ingresa al menos un peso');
      return;
    }
    handleAction(
      () => pesaje.mutateAsync({ id: id!, residuos: residuosData, observaciones: pesajeObs || undefined }),
      'Pesaje registrado exitosamente',
    ).then(() => setShowPesajeModal(false));
  };

  const handleTratamiento = () => {
    if (!tratamientoMetodo) {
      toast.warning('Datos incompletos', 'Selecciona un metodo de tratamiento');
      return;
    }
    handleAction(
      () => registrarTratamiento.mutateAsync({ id: id!, metodo: tratamientoMetodo, observaciones: tratamientoObs || undefined }),
      'Tratamiento registrado exitosamente',
    ).then(() => setShowTratamientoModal(false));
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
      setShowCancelModal(false);
    }
  };

  const handleRechazar = () => {
    if (!rechazarMotivo) {
      toast.warning('Datos incompletos', 'Selecciona un motivo de rechazo');
      return;
    }
    handleAction(
      () => rechazar.mutateAsync({ id: id!, motivo: rechazarMotivo, descripcion: rechazarDescripcion || undefined }),
      'Carga rechazada exitosamente',
    ).then(() => {
      setShowRechazarModal(false);
      setRechazarMotivo('');
      setRechazarDescripcion('');
    });
  };

  const handleIncidente = () => {
    if (!incidenteTipo) {
      toast.warning('Datos incompletos', 'Selecciona un tipo de incidente');
      return;
    }
    handleAction(
      () => registrarIncidente.mutateAsync({ id: id!, tipo: incidenteTipo, descripcion: incidenteDescripcion || undefined }),
      'Incidente registrado exitosamente',
    ).then(() => {
      setShowIncidenteModal(false);
      setIncidenteTipo('');
      setIncidenteDescripcion('');
    });
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

  const handleRevertir = () => {
    if (!reversionEstado) {
      toast.warning('Datos incompletos', 'Selecciona un estado destino');
      return;
    }
    handleAction(
      () => revertir.mutateAsync({ id: id!, estadoNuevo: reversionEstado, motivo: reversionMotivo || undefined }),
      'Estado revertido exitosamente',
    ).then(() => {
      setShowReversionModal(false);
      setReversionEstado('');
      setReversionMotivo('');
    });
  };

  const handleFirmaConfirm = () => {
    handleAction(
      () => firmar.mutateAsync({ id: id! }),
      'Manifiesto firmado exitosamente',
    ).then(() => {
      setShowFirmaModal(false);
      setFirmaBase64('');
    });
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

          {/* Ruta del Viaje — se muestra si hay tracking GPS, o posiciones de generador/operador */}
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
                        <span style={{ fontSize: 11, color: '#666' }}>{(m.generador as any)?.domicilio || ''}</span>
                      </Popup>
                    </Marker>
                  )}

                  {/* Operador (destino) */}
                  {operadorPos && (
                    <Marker position={operadorPos} icon={ACTOR_ICONS.operador}>
                      <Popup>
                        <strong>Operador</strong><br />
                        {m.operador?.razonSocial || '-'}<br />
                        <span style={{ fontSize: 11, color: '#666' }}>{(m.operador as any)?.domicilio || ''}</span>
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
          <Card>
            <CardHeader title="Historial de estados" icon={<Calendar size={20} />} />
            <CardContent>
              {timeline.length === 0 ? (
                <div className="py-8 text-center text-neutral-500">No hay eventos registrados para este manifiesto</div>
              ) : (
              <div className="relative">
                {/* Line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-200" />

                {/* Events */}
                <div className="space-y-6 animate-fade-in">
                  {timeline.map((event, index) => (
                    <div key={event.id} className="relative flex gap-4">
                      {/* Dot */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                          event.status === 'completed'
                            ? 'bg-success-500 text-white'
                            : event.status === 'current'
                            ? 'bg-info-500 text-white ring-4 ring-info-100'
                            : 'bg-neutral-200 text-neutral-400'
                        }`}
                      >
                        {event.status === 'completed' ? (
                          <CheckCircle size={16} />
                        ) : (
                          <span className="text-xs font-bold">{index + 1}</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className={`font-semibold ${
                              event.status === 'pending' ? 'text-neutral-400' : 'text-neutral-900'
                            }`}>
                              {event.title}
                            </p>
                            <p className={`text-sm mt-0.5 ${
                              event.status === 'pending' ? 'text-neutral-400' : 'text-neutral-600'
                            }`}>
                              {event.description}
                            </p>
                          </div>
                          <span className={`text-sm ${
                            event.status === 'pending' ? 'text-neutral-400' : 'text-neutral-500'
                          }`}>
                            {event.date}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 animate-fade-in">
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
                    <div className="flex gap-2 w-full">
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

          <Card>
            <CardHeader title="Acciones" />
            <CardContent>
              <div className="space-y-2 animate-fade-in">
                {/* State-based action buttons with role guards */}
                {m.estado === EstadoManifiesto.BORRADOR && (isAdmin || userRol === 'GENERADOR') && (
                  <Button
                    fullWidth
                    leftIcon={firmar.isPending ? <Loader2 size={16} className="animate-spin" /> : <PenTool size={16} />}
                    onClick={() => setShowFirmaModal(true)}
                    disabled={isActionPending}
                  >
                    Firmar Manifiesto
                  </Button>
                )}

                {m.estado === EstadoManifiesto.APROBADO && (isAdmin || userRol === 'TRANSPORTISTA') && (
                  <Button
                    fullWidth
                    leftIcon={confirmarRetiro.isPending ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
                    onClick={handleConfirmarRetiro}
                    disabled={isActionPending}
                  >
                    Confirmar Retiro
                  </Button>
                )}

                {m.estado === EstadoManifiesto.EN_TRANSITO && (isAdmin || userRol === 'TRANSPORTISTA') && (
                  <Button
                    fullWidth
                    leftIcon={confirmarEntrega.isPending ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
                    onClick={handleConfirmarEntrega}
                    disabled={isActionPending}
                  >
                    Confirmar Entrega
                  </Button>
                )}

                {m.estado === EstadoManifiesto.EN_TRANSITO && (isAdmin || userRol === 'TRANSPORTISTA') && (
                  <Button
                    fullWidth
                    variant="outline"
                    leftIcon={registrarIncidente.isPending ? <Loader2 size={16} className="animate-spin" /> : <AlertCircle size={16} />}
                    onClick={() => setShowIncidenteModal(true)}
                    disabled={isActionPending}
                  >
                    Registrar Incidente
                  </Button>
                )}

                {m.estado === EstadoManifiesto.ENTREGADO && (isAdmin || userRol === 'OPERADOR') && (
                  <Button
                    fullWidth
                    leftIcon={confirmarRecepcion.isPending ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
                    onClick={handleConfirmarRecepcion}
                    disabled={isActionPending}
                  >
                    Confirmar Recepcion
                  </Button>
                )}

                {m.estado === EstadoManifiesto.ENTREGADO && (isAdmin || userRol === 'OPERADOR') && (
                  <Button
                    fullWidth
                    variant="outline"
                    leftIcon={rechazar.isPending ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                    onClick={() => setShowRechazarModal(true)}
                    disabled={isActionPending}
                    className="!text-error-600 !border-error-200 hover:!bg-error-50"
                  >
                    Rechazar Carga
                  </Button>
                )}

                {m.estado === EstadoManifiesto.RECIBIDO && (isAdmin || userRol === 'OPERADOR') && (
                  <Button
                    fullWidth
                    leftIcon={<Scale size={16} />}
                    onClick={() => setShowPesajeModal(true)}
                    disabled={isActionPending}
                  >
                    Registrar Pesaje
                  </Button>
                )}

                {m.estado === EstadoManifiesto.RECIBIDO && (isAdmin || userRol === 'OPERADOR') && (
                  <Button
                    fullWidth
                    leftIcon={<Beaker size={16} />}
                    onClick={() => setShowTratamientoModal(true)}
                    disabled={isActionPending}
                  >
                    Registrar Tratamiento
                  </Button>
                )}

                {(m.estado === EstadoManifiesto.EN_TRATAMIENTO || m.estado === EstadoManifiesto.RECIBIDO) && (isAdmin || userRol === 'OPERADOR') && (
                  <Button
                    fullWidth
                    leftIcon={cerrar.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    onClick={() => handleAction(() => cerrar.mutateAsync(id!), 'Manifiesto cerrado exitosamente')}
                    disabled={isActionPending}
                    className="!bg-success-600 hover:!bg-success-700"
                  >
                    Cerrar Manifiesto
                  </Button>
                )}

                <Button variant="outline" fullWidth leftIcon={<Download size={16} />} onClick={handleDescargarPDF}>
                  Descargar PDF
                </Button>

                {m.estado === EstadoManifiesto.TRATADO && (
                  <Button fullWidth leftIcon={<Award size={16} />} onClick={handleDescargarCertificado} className="!bg-success-600 hover:!bg-success-700">
                    Descargar Certificado
                  </Button>
                )}

                {m.estado !== EstadoManifiesto.CANCELADO && m.estado !== EstadoManifiesto.TRATADO && (isAdmin || userRol === 'GENERADOR') && (
                  <Button variant="danger" fullWidth leftIcon={<XCircle size={16} />} onClick={() => setShowCancelModal(true)}>
                    Cancelar Manifiesto
                  </Button>
                )}

                {isAdmin && m.estado !== EstadoManifiesto.BORRADOR && (
                  <Button
                    variant="outline"
                    fullWidth
                    leftIcon={<RotateCcw size={16} />}
                    onClick={() => setShowReversionModal(true)}
                    className="!text-amber-600 !border-amber-200 hover:!bg-amber-50"
                  >
                    Revertir Estado
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

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

      {/* Pesaje Modal */}
      {showPesajeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-2 sm:mx-4">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <Scale size={20} /> Registrar Pesaje
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {(m.residuos || []).map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">{r.tipoResiduo?.nombre || r.descripcion || 'Residuo'}</p>
                    <p className="text-xs text-neutral-500">Declarado: {formatNumber(r.cantidad)} {r.unidad}</p>
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      placeholder="Peso real"
                      value={pesajeData[r.id] || ''}
                      onChange={(e) => setPesajeData({ ...pesajeData, [r.id]: Number(e.target.value) })}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Observaciones</label>
              <textarea
                value={pesajeObs}
                onChange={(e) => setPesajeObs(e.target.value)}
                placeholder="Observaciones del pesaje..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowPesajeModal(false)} disabled={pesaje.isPending}>
                Cancelar
              </Button>
              <Button onClick={handlePesaje} disabled={pesaje.isPending}>
                {pesaje.isPending ? 'Registrando...' : 'Confirmar Pesaje'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tratamiento Modal */}
      {showTratamientoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-2 sm:mx-4">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <Beaker size={20} /> Registrar Tratamiento
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Método de Tratamiento *</label>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS_TRATAMIENTO.map((met) => (
                    <button
                      key={met.id}
                      type="button"
                      onClick={() => setTratamientoMetodo(met.id)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                        tratamientoMetodo === met.id
                          ? 'border-primary-500 bg-primary-50 shadow-sm'
                          : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="text-2xl">{met.icon}</span>
                      <span className={`text-xs font-medium ${
                        tratamientoMetodo === met.id ? 'text-primary-700' : 'text-neutral-600'
                      }`}>{met.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Observaciones</label>
                <textarea
                  value={tratamientoObs}
                  onChange={(e) => setTratamientoObs(e.target.value)}
                  placeholder="Observaciones del tratamiento..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowTratamientoModal(false)} disabled={registrarTratamiento.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleTratamiento} disabled={registrarTratamiento.isPending}>
                {registrarTratamiento.isPending ? 'Registrando...' : 'Confirmar Tratamiento'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rechazar Modal */}
      {showRechazarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-2 sm:mx-4">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <XCircle size={20} className="text-error-500" /> Rechazar Carga
            </h3>
            <div className="space-y-3">
              <div>
                <Select
                  label="Motivo de rechazo *"
                  value={rechazarMotivo}
                  onChange={(val) => setRechazarMotivo(val)}
                  options={[
                    { value: 'documentacion_incompleta', label: 'Documentación incompleta' },
                    { value: 'carga_no_coincide', label: 'Carga no coincide con manifiesto' },
                    { value: 'residuo_no_autorizado', label: 'Residuo no autorizado' },
                    { value: 'capacidad_excedida', label: 'Capacidad excedida' },
                    { value: 'condiciones_inseguras', label: 'Condiciones inseguras' },
                    { value: 'otro', label: 'Otro' },
                  ]}
                  placeholder="Seleccionar motivo"
                  size="sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Descripcion</label>
                <textarea
                  value={rechazarDescripcion}
                  onChange={(e) => setRechazarDescripcion(e.target.value)}
                  placeholder="Detalle del motivo de rechazo..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowRechazarModal(false)} disabled={rechazar.isPending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleRechazar} disabled={rechazar.isPending}>
                {rechazar.isPending ? 'Rechazando...' : 'Confirmar Rechazo'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Incidente Modal */}
      {showIncidenteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-2 sm:mx-4">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-warning-500" /> Registrar Incidente
            </h3>
            <div className="space-y-3">
              <div>
                <Select
                  label="Tipo de incidente *"
                  value={incidenteTipo}
                  onChange={(val) => setIncidenteTipo(val)}
                  options={[
                    { value: 'accidente', label: 'Accidente vehicular' },
                    { value: 'derrame', label: 'Derrame de residuos' },
                    { value: 'robo', label: 'Robo o asalto' },
                    { value: 'desvio', label: 'Desvío de ruta' },
                    { value: 'averia', label: 'Avería mecánica' },
                    { value: 'otro', label: 'Otro' },
                  ]}
                  placeholder="Seleccionar tipo"
                  size="sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Descripcion</label>
                <textarea
                  value={incidenteDescripcion}
                  onChange={(e) => setIncidenteDescripcion(e.target.value)}
                  placeholder="Describe el incidente..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setShowIncidenteModal(false)} disabled={registrarIncidente.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleIncidente} disabled={registrarIncidente.isPending}>
                {registrarIncidente.isPending ? 'Registrando...' : 'Registrar Incidente'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-2 sm:mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-error-50 rounded-full flex items-center justify-center">
                <XCircle size={20} className="text-error-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Cancelar Manifiesto</h3>
                <p className="text-sm text-neutral-500">Esta accion no se puede deshacer</p>
              </div>
            </div>
            <p className="text-neutral-700 mb-6">
              Estas seguro de que deseas cancelar el manifiesto <span className="font-mono font-semibold">{m.numero || id}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCancelModal(false)} disabled={isCancelling}>
                Volver
              </Button>
              <Button variant="danger" onClick={handleCancelar} disabled={isCancelling}>
                {isCancelling ? 'Cancelando...' : 'Cancelar Manifiesto'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reversion Modal */}
      {showReversionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-2 sm:mx-4">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <RotateCcw size={20} className="text-amber-500" /> Revertir Estado
            </h3>
            <p className="text-sm text-neutral-600 mb-4">
              Estado actual: <Badge variant="soft" color={getEstadoBadgeColor(m.estado || EstadoManifiesto.BORRADOR)}>{formatEstado(m.estado || EstadoManifiesto.BORRADOR)}</Badge>
            </p>
            <div className="space-y-3">
              <div>
                <Select
                  label="Estado destino *"
                  value={reversionEstado}
                  onChange={(val) => setReversionEstado(val)}
                  options={ESTADOS_FLUJO
                    .filter((est) => {
                      const currentIdx = ESTADOS_FLUJO.indexOf(m.estado as EstadoManifiesto);
                      const estIdx = ESTADOS_FLUJO.indexOf(est);
                      return estIdx < currentIdx && estIdx >= 0;
                    })
                    .map((est) => ({
                      value: est,
                      label: formatEstado(est),
                    }))}
                  placeholder="Seleccionar estado"
                  size="sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Motivo (opcional)</label>
                <textarea
                  value={reversionMotivo}
                  onChange={(e) => setReversionMotivo(e.target.value)}
                  placeholder="Motivo de la reversión..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:border-primary-500 focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => { setShowReversionModal(false); setReversionEstado(''); setReversionMotivo(''); }} disabled={revertir.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleRevertir} disabled={revertir.isPending} className="!bg-amber-600 hover:!bg-amber-700">
                {revertir.isPending ? 'Revirtiendo...' : 'Confirmar Reversión'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Firma Digital Modal */}
      {showFirmaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-2 sm:mx-4">
            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <PenTool size={20} className="text-primary-600" /> Firma Digital del Manifiesto
            </h3>

            {/* Resumen */}
            <div className="bg-neutral-50 rounded-xl p-4 mb-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Manifiesto:</span>
                <span className="font-mono font-semibold text-neutral-900">{m.numero || id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Generador:</span>
                <span className="text-neutral-900">{m.generador?.razonSocial || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Transportista:</span>
                <span className="text-neutral-900">{m.transportista?.razonSocial || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Operador:</span>
                <span className="text-neutral-900">{m.operador?.razonSocial || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Fecha/Hora:</span>
                <span className="text-neutral-900">{new Date().toLocaleString('es-AR')}</span>
              </div>
            </div>

            {/* Firma */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">Firma del responsable</label>
              {firmaBase64 ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-xl border border-success-300 bg-success-50 p-2">
                    <img src={firmaBase64} alt="Firma" className="max-h-32" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFirmaBase64('')}
                    className="text-sm text-neutral-500 hover:text-neutral-700 underline"
                  >
                    Volver a firmar
                  </button>
                </div>
              ) : (
                <SignaturePad
                  onConfirm={(dataUrl) => setFirmaBase64(dataUrl)}
                />
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowFirmaModal(false); setFirmaBase64(''); }} disabled={firmar.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleFirmaConfirm} disabled={firmar.isPending || !firmaBase64}>
                {firmar.isPending ? 'Firmando...' : 'Confirmar y Firmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManifiestoDetailPage;

/**
 * SITREP v6 - Alertas Page
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  Check,
  AlertCircle,
  Info,
  Loader2,
  Settings,
  Plus,
  Edit,
  ExternalLink,
  Mail,
  Users,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { Table, type Column } from '../../components/ui/Table';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import { useAlertas, useResolverAlerta, useReglasAlerta, useCreateReglaAlerta, useUpdateReglaAlerta, useDeleteReglaAlerta, useEvaluarSeguimiento } from '../../hooks/useAlertas';
import { useNotificaciones, useMarcarLeida, useMarcarTodasLeidas } from '../../hooks/useNotificaciones';
import { useAuth } from '../../contexts/AuthContext';
import { alertaService, type FollowupPreview, type CataloguePreview } from '../../services/alerta.service';
import { cataloguePath } from '../../utils/alertCatalogue';
import { notificationFollowup } from '../../utils/notificationFollowup';
import { EstadoAlerta } from '../../types/models';
import { formatRelativeTime } from '../../utils/formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AlertaLocal {
  id: string;
  tipo: 'critical' | 'warning' | 'info' | 'success';
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
  manifiestoId?: string;
  manifiestoNumero?: string;
  estadoActual?: string;
  evento?: string;
  estado: string;
  notas?: string;
  fechaResolucion?: string;
  destino?: string;
  seguimiento?: string;
}

// ─── Visual config ────────────────────────────────────────────────────────────

const estadoLabels: Record<string, string> = {
  PENDIENTE: 'Pendiente', EN_REVISION: 'En revisión', RESUELTA: 'Resuelta', DESCARTADA: 'Descartada',
};

const tipoConfig = {
  critical: {
    icon: AlertCircle,
    dot: 'bg-error-500',
    iconBg: 'bg-error-50',
    iconColor: 'text-error-600',
    border: 'border-l-error-500',
    title: 'text-neutral-900',
    badge: 'error' as const,
  },
  warning: {
    icon: AlertTriangle,
    dot: 'bg-warning-500',
    iconBg: 'bg-warning-50',
    iconColor: 'text-warning-600',
    border: 'border-l-warning-500',
    title: 'text-neutral-900',
    badge: 'warning' as const,
  },
  info: {
    icon: Info,
    dot: 'bg-info-500',
    iconBg: 'bg-info-50',
    iconColor: 'text-info-600',
    border: 'border-l-info-500',
    title: 'text-neutral-900',
    badge: 'info' as const,
  },
  success: {
    icon: CheckCircle,
    dot: 'bg-success-500',
    iconBg: 'bg-success-50',
    iconColor: 'text-success-600',
    border: 'border-l-success-500',
    title: 'text-neutral-500',
    badge: 'success' as const,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTipoFromNotifTipo(tipo: string): AlertaLocal['tipo'] {
  if (tipo?.includes('RECHAZADO') || tipo?.includes('INCIDENTE')) return 'critical';
  if (tipo?.includes('ANOMALIA') || tipo?.includes('ALERTA')) return 'warning';
  if (tipo?.includes('TRATADO') || tipo?.includes('RECIBIDO')) return 'success';
  return 'info';
}

function getTipoFromEvento(evento: string | undefined, estado: string): AlertaLocal['tipo'] {
  if (estado === 'RESUELTA' || estado === 'DESCARTADA') return 'success';
  switch (evento) {
    case 'INCIDENTE':
    case 'RECHAZO_CARGA':
      return 'critical';
    case 'ANOMALIA_GPS':
    case 'DIFERENCIA_PESO':
    case 'TIEMPO_EXCESIVO':
    case 'DESVIO_RUTA':
      return 'warning';
    default:
      return 'info';
  }
}

function parseMensaje(datosRaw: string | undefined | null, evento?: string): string {
  if (!datosRaw) return 'Sin detalles';
  let d: Record<string, any> = {};
  try {
    d = typeof datosRaw === 'string' ? JSON.parse(datosRaw) : datosRaw;
  } catch {
    return String(datosRaw);
  }
  if (d.descripcion) return String(d.descripcion);
  const num = d.numero ? `Manifiesto ${d.numero}` : '';
  switch (evento) {
    case 'CAMBIO_ESTADO': {
      const de = d.estadoAnterior ? d.estadoAnterior.replace(/_/g, ' ') : '?';
      const a = d.estadoNuevo ? d.estadoNuevo.replace(/_/g, ' ') : '?';
      return `${de} → ${a}${num ? ` · ${num}` : ''}`;
    }
    case 'INCIDENTE':
      return `Incidente en tránsito${num ? ` · ${num}` : ''}${d.tipo ? ` — ${d.tipo}` : ''}`;
    case 'RECHAZO_CARGA':
      return `Rechazo de carga${num ? ` · ${num}` : ''}${d.motivo ? ` — ${d.motivo}` : ''}`;
    case 'DIFERENCIA_PESO':
      return `Diferencia de peso${num ? ` · ${num}` : ''}${d.delta ? ` (${d.delta})` : ''}`;
    case 'TIEMPO_EXCESIVO':
      return `Tiempo excesivo en tránsito${num ? ` · ${num}` : ''}`;
    case 'ANOMALIA_GPS':
      return `Anomalía GPS detectada${num ? ` · ${num}` : ''}`;
    case 'VENCIMIENTO':
      return `Vencimiento próximo${num ? ` · ${num}` : ''}`;
    case 'DESVIO_RUTA':
      return `Desvío de ruta${num ? ` · ${num}` : ''}`;
    default:
      return num || 'Alerta registrada';
  }
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const alertDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (alertDay.getTime() === today.getTime()) return 'Hoy';
  if (alertDay.getTime() === yesterday.getTime()) return 'Ayer';

  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupByDay(alertas: AlertaLocal[]): { label: string; items: AlertaLocal[] }[] {
  const groups: { label: string; items: AlertaLocal[] }[] = [];
  const seen = new Map<string, AlertaLocal[]>();

  for (const a of alertas) {
    const d = new Date(a.fecha);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!seen.has(key)) {
      const label = formatDateLabel(a.fecha);
      seen.set(key, []);
      groups.push({ label, items: seen.get(key)! });
    }
    seen.get(key)!.push(a);
  }
  return groups;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const EVENTO_OPTIONS = [
  { value: 'CAMBIO_ESTADO', label: 'Cambio de Estado' },
  { value: 'INCIDENTE', label: 'Incidente en Tránsito' },
  { value: 'RECHAZO_CARGA', label: 'Rechazo de Carga' },
  { value: 'DIFERENCIA_PESO', label: 'Diferencia de Peso' },
  { value: 'TIEMPO_EXCESIVO', label: 'Tiempo Excesivo' },
  { value: 'DESVIO_RUTA', label: 'Desvío de Ruta' },
  { value: 'VENCIMIENTO', label: 'Vencimiento Próximo' },
  { value: 'ANOMALIA_GPS', label: 'Anomalía GPS' },
];

const EVENTO_LABELS: Record<string, string> = Object.fromEntries(
  EVENTO_OPTIONS.map(o => [o.value, o.label])
);

const ROLES_DESTINATARIOS = [
  { value: 'ADMIN', label: 'Administración central' },
  { value: 'ADMIN_GENERADOR', label: 'Administración de generadores' },
  { value: 'ADMIN_TRANSPORTISTA', label: 'Administración de transportistas' },
  { value: 'ADMIN_OPERADOR', label: 'Administración de operadores' },
  { value: 'GENERADOR', label: 'Generador involucrado' },
  { value: 'TRANSPORTISTA', label: 'Transportista involucrado' },
  { value: 'OPERADOR', label: 'Operador involucrado' },
  { value: 'INSPECCIONADO', label: 'Actor vinculado al expediente' },
  { value: 'INSPECTOR_ASIGNADO', label: 'Inspector asignado al expediente' },
];

const CONDITION_PRESETS: Record<string, Array<{ label: string; value: string }>> = {
  CAMBIO_ESTADO: [{ label: 'Cualquier cambio de estado', value: '{}' }, { label: 'Sólo rechazo', value: '{"estadoNuevo":"RECHAZADO"}' }, { label: 'Sólo tratamiento finalizado', value: '{"estadoNuevo":"TRATADO"}' }],
  INCIDENTE: [{ label: 'Cualquier incidente', value: '{}' }],
  RECHAZO_CARGA: [{ label: 'Cualquier rechazo', value: '{}' }],
  DIFERENCIA_PESO: [{ label: 'Cualquier diferencia', value: '{}' }, { label: 'Diferencia igual o mayor a 10%', value: '{"deltaPorcentaje":{"gte":10}}' }],
  TIEMPO_EXCESIVO: [{ label: 'Más de 24 horas', value: '{"horasTransito":{"gte":24}}' }, { label: 'Más de 48 horas', value: '{"horasTransito":{"gte":48}}' }],
  DESVIO_RUTA: [{ label: 'Más de 50 km fuera del corredor autorizado', value: '{"distanciaKm":{"gt":50}}' }],
  VENCIMIENTO: [{ label: 'Dentro de 30 días', value: '{"diasRestantes":{"lte":30}}' }, { label: 'Dentro de 7 días', value: '{"diasRestantes":{"lte":7}}' }],
  ANOMALIA_GPS: [{ label: 'Cualquier anomalía GPS', value: '{}' }, { label: 'Sólo severidad alta', value: '{"severidad":{"in":["ALTA","CRITICA"]}}' }],
};

const PERIOD_OPTIONS = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: 'todo', label: 'Todo' },
];

const defaultReglaForm = {
  nombre: '',
  descripcion: '',
  evento: '',
  condicion: '{}',
  activa: true,
  destinatarios: [] as string[],
  emails: '',
};

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map(e => e.trim())
    .filter(e => e.includes('@'))
    .map(e => `email:${e}`);
}

function periodStart(period: string): Date | null {
  const now = new Date();
  if (period === 'hoy') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === '7d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AlertasPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isAnyAdmin } = useAuth();
  const [periodo, setPeriodo] = useState<string>('30d');
  const [filtroEvento, setFiltroEvento] = useState<string>('');
  const [filtroLeidas, setFiltroLeidas] = useState<string>('todas');
  const [page, setPage] = useState(1);
  const since = useMemo(() => periodStart(periodo)?.toISOString(), [periodo]);

  // Any admin role: alertas generadas por reglas | Non-admin: notificaciones del usuario
  const { data: apiAlertas, isLoading: isLoadingAlertas, isError: isErrorAlertas, refetch: refetchAlertas } = useAlertas({ page, limit: PAGE_SIZE,
    evento: filtroEvento || undefined, fechaDesde: since,
    estado: filtroLeidas === 'no-leidas' ? 'PENDIENTE,EN_REVISION' : filtroLeidas === 'leidas' ? 'RESUELTA,DESCARTADA' : undefined }, isAnyAdmin);
  const { data: apiNotifs, isLoading: isLoadingNotifs, isError: isErrorNotifs } = useNotificaciones(undefined);
  const isLoading = isAnyAdmin ? isLoadingAlertas : isLoadingNotifs;
  const isError = isAnyAdmin ? isErrorAlertas : isErrorNotifs;
  const resolverMutation = useResolverAlerta();
  const marcarLeidaMutation = useMarcarLeida();
  const marcarTodasLeidasMutation = useMarcarTodasLeidas();

  const { data: reglas, isError: reglasError, isPending: reglasPending, refetch: refetchReglas } = useReglasAlerta(isAnyAdmin);
  const createRegla = useCreateReglaAlerta();
  const updateRegla = useUpdateReglaAlerta();
  const deleteRegla = useDeleteReglaAlerta();
  const evaluarSeguimiento = useEvaluarSeguimiento();
  const evaluarCatalogo = useEvaluarSeguimiento(true);

  const [activeTab, setActiveTab] = useState('alertas');
  const [showReglaModal, setShowReglaModal] = useState(false);
  const [editingRegla, setEditingRegla] = useState<any | null>(null);
  const [deletingRegla, setDeletingRegla] = useState<any | null>(null);
  const [reglaForm, setReglaForm] = useState(defaultReglaForm);

  const [caseToManage, setCaseToManage] = useState<AlertaLocal | null>(null);
  const [caseState, setCaseState] = useState(EstadoAlerta.EN_REVISION);
  const [caseReason, setCaseReason] = useState('');
  const [caseError, setCaseError] = useState('');
  const [preview, setPreview] = useState<{ condition: string; result: FollowupPreview | CataloguePreview } | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  let followupDays: number | null = null;
  try { const condition = JSON.parse(reglaForm.condicion); if (condition.tipo === 'seguimiento_cierre') followupDays = condition.diasRecepcion?.gte ?? 0; } catch { /* advanced condition validated on save */ }
  let catalogue: { tipo: string; anticipacionDias?: number; entidades?: string[] } | null = null;
  try { const value = JSON.parse(reglaForm.condicion); if (['requerimiento_inspeccion', 'vencimiento_documental'].includes(value.tipo)) catalogue = value; } catch { /* validated on save */ }
  const ruleKind = catalogue?.tipo || (followupDays !== null ? 'seguimiento' : 'evento');
  const recipientsAllowed = catalogue?.tipo === 'requerimiento_inspeccion' ? ['INSPECCIONADO', 'INSPECTOR_ASIGNADO', 'ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR']
    : catalogue ? ['TRANSPORTISTA', 'OPERADOR', 'ADMIN', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'] : followupDays !== null ? ['OPERADOR', 'ADMIN', 'ADMIN_OPERADOR'] : ROLES_DESTINATARIOS.filter(role => !role.value.startsWith('INSPEC')).map(role => role.value);

  const alertas: AlertaLocal[] = useMemo(() => {
    if (!isAnyAdmin) {
      // Non-admin: map notificaciones to AlertaLocal format
      const notifs = Array.isArray(apiNotifs) ? apiNotifs
        : (apiNotifs as { items?: unknown[]; data?: { notificaciones?: unknown[] }; notificaciones?: unknown[] })?.items
          || (apiNotifs as { data?: { notificaciones?: unknown[] } })?.data?.notificaciones
          || (apiNotifs as { notificaciones?: unknown[] })?.notificaciones
          || [];
      return notifs
        .map((n: any) => ({
          id: n.id,
          tipo: getTipoFromNotifTipo(n.tipo),
          titulo: n.titulo || 'Notificacion',
          mensaje: n.mensaje || '',
          fecha: n.createdAt,
          leida: n.leida || false,
          manifiestoId: n.manifiestoId,
          manifiestoNumero: undefined,
          evento: n.tipo,
          estado: n.leida ? 'RESUELTA' : 'PENDIENTE',
          destino: cataloguePath(n.datos, true) || undefined,
          seguimiento: notificationFollowup(n) || undefined,
        }));
    }
    // Admin: alertas generadas by rules
    const items = Array.isArray(apiAlertas?.items) ? apiAlertas.items : [];
    return items
      .map((a: any) => {
        const evento = a.regla?.evento;
        const estado = a.estado || 'PENDIENTE';
        return {
          id: a.id,
          tipo: getTipoFromEvento(evento, estado),
          titulo: a.regla?.nombre || 'Alerta',
          mensaje: parseMensaje(a.datos, a.regla?.evento),
          fecha: a.createdAt,
          leida: estado === 'RESUELTA' || estado === 'DESCARTADA',
          manifiestoId: a.manifiestoId || a.manifiesto?.id,
          manifiestoNumero: a.manifiesto?.numero,
          estadoActual: a.manifiesto?.estado,
          evento,
          estado,
          notas: a.notas || undefined,
          fechaResolucion: a.fechaResolucion || undefined,
          destino: cataloguePath(a.datos) || undefined,
        };
      });
  }, [isAnyAdmin, apiAlertas, apiNotifs]);

  const alertasFiltradas = useMemo(() => {
    if (isAnyAdmin) return alertas;
    const since = periodStart(periodo);
    return alertas.filter(a => {
      if (since && new Date(a.fecha) < since) return false;
      if (filtroEvento && a.evento !== filtroEvento) return false;
      if (filtroLeidas === 'no-leidas' && a.leida) return false;
      if (filtroLeidas === 'leidas' && !a.leida) return false;
      return true;
    });
  }, [isAnyAdmin, alertas, periodo, filtroEvento, filtroLeidas]);

  // Reset page when filters change
  const totalPages = isAnyAdmin ? apiAlertas?.totalPages || 1 : Math.max(1, Math.ceil(alertasFiltradas.length / PAGE_SIZE));
  useEffect(() => {
    if (isAnyAdmin && apiAlertas?.page === page && page > totalPages) setPage(totalPages);
  }, [isAnyAdmin, apiAlertas?.page, page, totalPages]);
  const currentPage = Math.min(page, totalPages);
  const alertasPagina = isAnyAdmin ? alertasFiltradas : alertasFiltradas.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const grupos = groupByDay(alertasPagina);

  const noLeidasCount = alertas.filter(a => !a.leida).length;

  const changeFilter = (setter: (v: any) => void, v: any) => {
    setter(v);
    setPage(1);
  };

  // ─── Actions ───────────────────────────────────────────────────────────────

  const marcarComoLeida = (id: string) => {
      marcarLeidaMutation.mutate(id, {
        onSuccess: () => {
          toast.success('Leida', 'Notificacion marcada como leida');
        },
      });
  };
  const saveCase = () => {
    if (!caseToManage || !caseReason.trim()) { setCaseError('Registrá el motivo antes de guardar.'); return; }
    resolverMutation.mutate({ id: caseToManage.id, estado: caseState, notas: caseReason }, {
      onSuccess: () => { setCaseToManage(null); toast.success('Estado del caso actualizado'); },
      onError: () => setCaseError('No se pudo guardar. El caso mantiene su estado anterior; podés reintentar.'),
    });
  };

  // ─── Reglas handlers ───────────────────────────────────────────────────────

  const openCreateRegla = () => {
    setEditingRegla(null);
    setReglaForm(defaultReglaForm);
    setPreview(null);
    setShowReglaModal(true);
  };

  const openEditRegla = (regla: any) => {
    setEditingRegla(regla);
    setPreview(null);
    let destList: string[] = [];
    try {
      const parsed = JSON.parse(regla.destinatarios || '[]');
      destList = Array.isArray(parsed) ? parsed : [];
    } catch { /* noop */ }
    const roles = destList.filter((d: string) => !d.startsWith('email:'));
    const emailList = destList.filter((d: string) => d.startsWith('email:')).map((d: string) => d.replace('email:', ''));
    setReglaForm({
      nombre: regla.nombre || '',
      descripcion: regla.descripcion || '',
      evento: regla.evento || '',
      condicion: regla.condicion || '',
      activa: regla.activa ?? true,
      destinatarios: roles,
      emails: emailList.join('\n'),
    });
    setShowReglaModal(true);
  };

  const handleSaveRegla = () => {
    if (!reglaForm.nombre.trim() || !reglaForm.evento || !reglaForm.condicion.trim()) {
      toast.error('Campos requeridos', 'Nombre, evento y condición son obligatorios');
      return;
    }
    try {
      const condition = JSON.parse(reglaForm.condicion);
      if (!condition || Array.isArray(condition) || typeof condition !== 'object') throw new Error();
    } catch {
      toast.error('Condición inválida', 'Usá una condición sugerida o corregí el JSON avanzado.');
      return;
    }
    if (reglaForm.destinatarios.length === 0 && parseEmails(reglaForm.emails).length === 0) {
      toast.error('Destinatarios requeridos', 'Elegí al menos un destinatario o agregá un email.');
      return;
    }
    const destinatariosJson = JSON.stringify([
      ...reglaForm.destinatarios,
      ...parseEmails(reglaForm.emails),
    ]);
    const payload = {
      nombre: reglaForm.nombre,
      descripcion: reglaForm.descripcion,
      evento: reglaForm.evento,
      condicion: reglaForm.condicion,
      activa: reglaForm.activa,
      destinatarios: destinatariosJson,
    };
    if (editingRegla) {
      updateRegla.mutate(
        { id: editingRegla.id, data: payload },
        {
          onSuccess: () => { toast.success('Regla actualizada'); setShowReglaModal(false); },
          onError: () => toast.error('Error', 'No se pudo actualizar la regla'),
        }
      );
    } else {
      createRegla.mutate(payload, {
        onSuccess: () => { toast.success('Regla creada'); setShowReglaModal(false); },
        onError: () => toast.error('Error', 'No se pudo crear la regla'),
      });
    }
  };

  const handleDeleteRegla = () => {
    if (!deletingRegla) return;
    deleteRegla.mutate(deletingRegla.id, {
      onSuccess: () => { toast.success('Regla eliminada'); setDeletingRegla(null); },
      onError: () => toast.error('Error', 'No se pudo eliminar la regla'),
    });
  };

  const toggleDestRole = (role: string) => {
    setReglaForm(prev => ({
      ...prev,
      destinatarios: prev.destinatarios.includes(role)
        ? prev.destinatarios.filter(r => r !== role)
        : [...prev.destinatarios, role],
    }));
  };

  // ─── Reglas table ──────────────────────────────────────────────────────────

  const reglasColumns: Column<any>[] = [
    { key: 'nombre', header: 'Nombre', sortable: true },
    {
      key: 'evento',
      header: 'Evento',
      render: (r) => <Badge variant="soft" color="info" size="sm">{EVENTO_LABELS[r.evento] || r.evento}</Badge>,
    },
    {
      key: 'destinatarios',
      header: 'Destinatarios',
      hiddenBelow: 'md',
      render: (r) => {
        let destList: string[] = [];
        try {
          const parsed = JSON.parse(r.destinatarios || '[]');
          destList = Array.isArray(parsed) ? parsed : [];
        } catch { /* noop */ }
        const roles = destList.filter((d: string) => !d.startsWith('email:'));
        const emailCount = destList.filter((d: string) => d.startsWith('email:')).length;
        if (destList.length === 0) return <span className="text-neutral-400 text-xs">Sin destinatarios</span>;
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {roles.map(rol => <Badge key={rol} variant="soft" color="neutral" size="sm">{rol}</Badge>)}
            {emailCount > 0 && <Badge variant="soft" color="info" size="sm">+{emailCount} email{emailCount > 1 ? 's' : ''}</Badge>}
          </div>
        );
      },
    },
    {
      key: 'activa',
      header: 'Activa',
      align: 'center',
      render: (r) => <Badge variant="soft" color={r.activa ? 'success' : 'neutral'} size="sm">{r.activa ? 'Sí' : 'No'}</Badge>,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {isAdmin && <><Button variant="ghost" aria-label={`Editar regla: ${r.nombre}`} onClick={() => openEditRegla(r)}><Edit size={14} /></Button>
          {r.id !== 'seguimiento_cierre_v1' && <Button variant="ghost" aria-label={`Eliminar regla: ${r.nombre}`} className="text-error-500" onClick={() => setDeletingRegla(r)}><Trash2 size={14} /></Button>}</>}
        </div>
      ),
    },
  ];

  // ─── Alertas content ───────────────────────────────────────────────────────

  const alertasContent = (
    <div className="space-y-5">

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period pills */}
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
          <Calendar size={13} className="text-neutral-500 ml-1" />
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.value}
              onClick={() => changeFilter(setPeriodo, p.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                periodo === p.value
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Event type */}
        <Select
          value={filtroEvento}
          onChange={(val) => changeFilter(setFiltroEvento, val)}
          placeholder="Todos los eventos"
          options={[
            { value: '', label: 'Todos los eventos' },
            ...EVENTO_OPTIONS.map(o => ({ value: o.value, label: o.label })),
          ]}
          size="sm"
          isFullWidth={false}
        />

        {/* Read/unread */}
        <Select
          value={filtroLeidas}
          onChange={(val) => changeFilter(setFiltroLeidas, val)}
          options={[
            { value: 'todas', label: 'Todas' },
            { value: 'no-leidas', label: 'Pendientes' },
            { value: 'leidas', label: isAnyAdmin ? 'Resueltas / descartadas' : 'Leídas' },
          ]}
          size="sm"
          isFullWidth={false}
        />

        <span className="ml-auto text-xs text-neutral-400">
          {isAnyAdmin ? apiAlertas?.total ?? 0 : alertasFiltradas.length} {isAnyAdmin ? 'casos' : 'avisos'}
        </span>
      </div>

      {/* List */}
      {isLoading ? <p role="status">Cargando alertas…</p> : isError ? <div role="alert" className="rounded-lg border border-error-200 p-4"><p>No se pudieron cargar las alertas. No es una lista vacía.</p><Button variant="outline" onClick={() => { if (isAnyAdmin) void refetchAlertas(); else window.location.reload(); }}>Reintentar</Button></div> : alertasFiltradas.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center">
            <Bell size={26} className="text-neutral-300" />
          </div>
          <p className="text-sm text-neutral-500">No hay alertas para los filtros seleccionados</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map((grupo) => (
            <div key={grupo.label}>
              {/* Day separator */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide whitespace-nowrap">
                  {grupo.label}
                </span>
                <div className="flex-1 h-px bg-neutral-100" />
              </div>

              {/* Cards for this day */}
              <div className="space-y-2">
                {grupo.items.map((alerta) => {
                  const cfg = tipoConfig[alerta.tipo];
                  const Icon = cfg.icon;
                  return (
                    <article
                      key={alerta.id}
                      aria-label={`Caso: ${alerta.titulo} · ${alerta.manifiestoNumero || alerta.id}`}
                      className={`
                        group relative bg-white rounded-xl border border-neutral-100 border-l-4 ${cfg.border}
                        flex items-start gap-3 px-4 py-3
                        transition-all hover:shadow-sm
                      `}
                    >
                      {/* Icon */}
                      <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg ${cfg.iconBg} flex items-center justify-center`}>
                        <Icon size={15} className={cfg.iconColor} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-sm font-semibold text-neutral-800">{alerta.titulo}</span>
                              {isAnyAdmin ? <Badge variant="soft" color={alerta.leida ? 'neutral' : 'warning'} size="sm">{estadoLabels[alerta.estado] || alerta.estado}</Badge> : !alerta.leida && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-100 text-primary-700 uppercase tracking-wide">
                                  Nueva
                                </span>
                              )}
                              {alerta.manifiestoNumero && (
                                <button
                                  onClick={() => alerta.manifiestoId && navigate(`/manifiestos/${alerta.manifiestoId}`)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-neutral-50 border border-neutral-200 text-[11px] font-mono text-neutral-500 hover:border-primary-300 hover:text-primary-600 transition-colors"
                                >
                                  {alerta.manifiestoNumero}
                                  <ExternalLink size={9} />
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-neutral-600 leading-snug">{alerta.mensaje}</p>
                            {alerta.seguimiento && <p className="mt-1 text-sm font-medium text-primary-800">{alerta.seguimiento}</p>}
                            {isAnyAdmin && alerta.estadoActual && <p className="mt-1 text-xs text-neutral-600">Estado actual del manifiesto: {alerta.estadoActual.replaceAll('_', ' ').toLowerCase()}. El caso conserva la situación registrada al detectarlo.</p>}
                            {isAnyAdmin && alerta.notas && <div className="mt-2 border-l-2 border-neutral-300 pl-3 text-sm text-neutral-700"><p className="font-medium">Última decisión{alerta.fechaResolucion ? ` · ${new Date(alerta.fechaResolucion).toLocaleString('es-AR')}` : ''}</p><p className="whitespace-pre-wrap break-words">{alerta.notas}</p></div>}
                          </div>
                          {/* Time + delete */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-neutral-400 flex items-center gap-1">
                              <Clock size={11} />
                              {formatRelativeTime(alerta.fecha)}
                            </span>
                          </div>
                        </div>

                        {/* Actions row */}
                        {(alerta.destino || alerta.manifiestoId || !alerta.leida || isAnyAdmin) && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {alerta.destino && <Button variant="outline" leftIcon={<ExternalLink size={12} />} onClick={() => navigate(alerta.destino!)}>Abrir origen</Button>}
                            {alerta.manifiestoId && (
                              <Button variant="outline"
                                onClick={() => navigate(`/manifiestos/${alerta.manifiestoId}`)}
                                className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-primary-600 transition-colors"
                              >
                                <ExternalLink size={12} />
                                Ver manifiesto
                              </Button>
                            )}
                            {isAnyAdmin ? <Button variant="outline" onClick={() => { setCaseToManage(alerta); setCaseState(alerta.estado as EstadoAlerta); setCaseReason(''); setCaseError(''); }}>Gestionar caso</Button> : !alerta.leida && (
                              <Button variant="ghost"
                                onClick={() => marcarComoLeida(alerta.id)}
                                disabled={marcarLeidaMutation.isPending}
                                className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-success-600 transition-colors"
                              >
                                <Check size={12} />
                                Marcar leída
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
          <span className="text-xs text-neutral-400">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Página anterior de alertas"
              className="p-1.5 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pg = totalPages <= 7 ? i + 1 : (
                currentPage <= 4 ? i + 1 :
                currentPage >= totalPages - 3 ? totalPages - 6 + i :
                currentPage - 3 + i
              );
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                    pg === currentPage
                      ? 'bg-primary-600 text-white'
                      : 'text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Siguiente página de alertas"
              className="p-1.5 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Reglas content ────────────────────────────────────────────────────────

  const reglasContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {reglasError ? 'No se pudieron cargar las reglas' : reglasPending ? 'Cargando reglas…' : `${Array.isArray(reglas) ? reglas.length : 0} reglas configuradas`}
        </p>
        {isAdmin && <Button variant="primary" leftIcon={<Plus size={15} />} onClick={openCreateRegla}>
          Nueva Regla
        </Button>}
      </div>
      {reglasError && <div role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3 text-error-800"><p>No se puede confirmar la configuración. No equivale a cero reglas.</p><Button variant="outline" onClick={() => refetchReglas()}>Reintentar reglas</Button></div>}
      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {(Array.isArray(reglas) ? reglas : []).map((r: any) => (
          <div key={r.id} className="bg-white rounded-xl border border-neutral-100 p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm text-neutral-900 truncate flex-1">{r.nombre}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.activa ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                {r.activa ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">{r.evento || r.tipo}</p>
            {isAdmin && <Button variant="outline" aria-label={`Editar regla: ${r.nombre}`} className="mt-2" onClick={() => openEditRegla(r)}>Editar regla</Button>}
          </div>
        ))}
      </div>
      {/* Desktop table */}
      <Card className={`hidden md:block ${reglasError || reglasPending ? 'hidden md:hidden' : ''}`}>
        <Table
          data={Array.isArray(reglas) ? reglas : []}
          columns={reglasColumns}
          keyExtractor={(r) => r.id}
          emptyMessage="No hay reglas de alerta configuradas"
          compact
        />
      </Card>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <Bell size={20} className="text-primary-600" />
            </div>
            {!isAnyAdmin && noLeidasCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-error-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {noLeidasCount > 99 ? '99+' : noLeidasCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Alertas</h2>
            <p className="text-sm text-neutral-500">
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> Cargando…
                </span>
              ) : (
                isAnyAdmin ? 'Casos detectados y reglas. Leer un aviso no resuelve un caso.' : `${noLeidasCount} sin leer en esta lista`
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isAnyAdmin && <Button
            variant="outline"
            size="sm"
            leftIcon={<Check size={15} />}
            onClick={() => marcarTodasLeidasMutation.mutate(undefined, { onSuccess: () => toast.success('Avisos marcados como leídos'), onError: () => toast.error('No se pudo guardar el cambio') })}
            disabled={noLeidasCount === 0}
          >
            Marcar todas
          </Button>}
          {isAdmin && <Button variant="outline" disabled={evaluarSeguimiento.isPending} onClick={() => evaluarSeguimiento.mutate(undefined, { onSuccess: result => toast.success('Seguimiento evaluado', `${result.avisosActualizados} avisos internos actualizados. Sin correo ni push.`), onError: () => toast.error('No se completó la evaluación', 'Puede haber un resultado parcial. Reintentá; no se duplican avisos.') })}>Evaluar seguimiento ahora</Button>}
          {isAdmin && <Button variant="outline" disabled={evaluarCatalogo.isPending} onClick={() => evaluarCatalogo.mutate(undefined, { onSuccess: result => toast.success('Catálogo evaluado', `${result.avisosActualizados} avisos internos actualizados. Sin correo ni push.`), onError: () => toast.error('No se completó el catálogo', 'Puede haber un resultado parcial. Reintentá; las identidades de caso se conservan.') })}>Evaluar inspecciones y vencimientos</Button>}
        </div>
      </div>

      {/* Tabs (admin) or direct list */}
      {isAnyAdmin ? (
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabList>
            <Tab id="alertas">Alertas</Tab>
            <Tab id="reglas"><Settings size={14} className="inline mr-1 -mt-0.5" />Reglas</Tab>
          </TabList>
          <TabPanel id="alertas">
            <div className="mt-5">{alertasContent}</div>
          </TabPanel>
          <TabPanel id="reglas">
            <div className="mt-5">{reglasContent}</div>
          </TabPanel>
        </Tabs>
      ) : (
        alertasContent
      )}

      <Modal isOpen={!!caseToManage} onClose={() => setCaseToManage(null)} title="Gestionar caso" isBusy={resolverMutation.isPending} footer={<div className="flex justify-end gap-2"><Button variant="outline" disabled={resolverMutation.isPending} onClick={() => setCaseToManage(null)}>Cancelar</Button><Button onClick={saveCase} disabled={resolverMutation.isPending}>Guardar estado</Button></div>}>
        <div className="space-y-4"><p className="text-sm text-neutral-700">{caseToManage?.titulo} · {caseToManage?.manifiestoNumero}</p>
          <Select label="Estado del caso" value={caseState} options={[{ value: 'PENDIENTE', label: 'Pendiente' }, { value: 'EN_REVISION', label: 'En revisión' }, { value: 'RESUELTA', label: 'Resuelta' }, { value: 'DESCARTADA', label: 'Descartada' }]} onChange={value => setCaseState(value as EstadoAlerta)} />
          <label className="block text-sm font-medium text-neutral-700">Motivo del cambio<textarea className="mt-1 w-full rounded-lg border border-neutral-300 p-3 text-base sm:text-sm" rows={3} maxLength={2000} value={caseReason} onChange={event => setCaseReason(event.target.value)} /></label>
          {caseError && <p role="alert" className="text-sm text-error-700">{caseError}</p>}
        </div>
      </Modal>

      {/* Modal crear/editar regla — con scroll interno */}
      <Modal
        isOpen={showReglaModal}
        onClose={() => setShowReglaModal(false)}
        title={editingRegla ? 'Editar Regla' : 'Nueva Regla'}
        size="base"
        isBusy={createRegla.isPending || updateRegla.isPending}
        footer={<div className="flex justify-end gap-2"><Button variant="outline" disabled={createRegla.isPending || updateRegla.isPending} onClick={() => setShowReglaModal(false)}>Cancelar</Button><Button onClick={handleSaveRegla} disabled={createRegla.isPending || updateRegla.isPending}>{editingRegla ? 'Guardar cambios' : 'Crear regla'}</Button></div>}
      >
        <div className="overflow-y-auto max-h-[calc(100vh-200px)] pr-1 space-y-4">
          <Select label="Tipo de regla" value={ruleKind} disabled={editingRegla?.id === 'seguimiento_cierre_v1'} options={[
            { value: 'evento', label: 'Evento del workflow' },
            { value: 'seguimiento', label: 'Manifiesto pendiente de tratamiento o cierre' },
            { value: 'requerimiento_inspeccion', label: 'Inspección · requerimiento sin respuesta' },
            { value: 'vencimiento_documental', label: 'Habilitaciones y licencias · vigencia' },
            { value: 'ddjj', label: 'DDJJ · requiere calendario aprobado', disabled: true },
            { value: 'tef', label: 'TEF · requiere obligación y saldo conciliados', disabled: true },
            { value: 'ocr', label: 'Recibos OCR · requiere extracción verificable', disabled: true },
          ]} onChange={value => { setPreview(null); setReglaForm(prev => value === 'seguimiento' ? { ...prev, nombre: prev.nombre || 'Seguimiento de manifiesto', evento: 'TIEMPO_EXCESIVO', condicion: '{"tipo":"seguimiento_cierre","diasRecepcion":{"gte":0}}', destinatarios: ['OPERADOR'], emails: '', activa: false }
            : value === 'requerimiento_inspeccion' ? { ...prev, evento: 'TIEMPO_EXCESIVO', condicion: JSON.stringify({ tipo: value }), destinatarios: ['INSPECCIONADO', 'INSPECTOR_ASIGNADO'], emails: '', activa: false }
            : value === 'vencimiento_documental' ? { ...prev, evento: 'VENCIMIENTO', condicion: JSON.stringify({ tipo: value, anticipacionDias: 30, entidades: ['TRANSPORTISTA', 'OPERADOR', 'VEHICULO', 'CHOFER'] }), destinatarios: ['TRANSPORTISTA', 'OPERADOR'], emails: '', activa: false }
            : { ...prev, condicion: '{}', evento: '', destinatarios: [], emails: '' }); }} />
          <Input
            label="Nombre"
            placeholder="Nombre de la regla"
            value={reglaForm.nombre}
            onChange={(e) => setReglaForm(prev => ({ ...prev, nombre: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Descripción</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none resize-none"
              placeholder="Descripción opcional"
              value={reglaForm.descripcion}
              onChange={(e) => setReglaForm(prev => ({ ...prev, descripcion: e.target.value }))}
              rows={2}
            />
          </div>
          {followupDays === null && !catalogue ? <><Select
            label="Evento"
            placeholder="Seleccionar evento…"
            options={EVENTO_OPTIONS}
            value={reglaForm.evento}
            onChange={(val) => setReglaForm(prev => ({ ...prev, evento: val, condicion: CONDITION_PRESETS[val]?.[0]?.value || '{}' }))}
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Cuándo se activa</label>
            <Select value={CONDITION_PRESETS[reglaForm.evento]?.some((preset) => preset.value === reglaForm.condicion) ? reglaForm.condicion : '__custom__'} onChange={value => value !== '__custom__' && setReglaForm(prev => ({ ...prev, condicion: value }))} options={[...(CONDITION_PRESETS[reglaForm.evento] || [{ label: 'Cualquier evento', value: '{}' }]), { value: '__custom__', label: 'Condición avanzada personalizada' }]} />
            <details open={!CONDITION_PRESETS[reglaForm.evento]?.some((preset) => preset.value === reglaForm.condicion)} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3"><summary className="cursor-pointer text-xs font-bold text-neutral-700">JSON avanzado</summary><p className="mt-2 text-xs leading-relaxed text-neutral-500">Operadores admitidos: eq, neq, gt, gte, lt, lte, in y contains. Esta condición se valida y se evalúa en cada evento.</p>
            <textarea
              className="mt-2 w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm font-mono focus:border-primary-500 focus:outline-none resize-none"
              placeholder="{}"
              value={reglaForm.condicion}
              onChange={(e) => setReglaForm(prev => ({ ...prev, condicion: e.target.value }))}
              rows={2}
            />
            </details>
          </div></> : <div className="space-y-3">
            {!catalogue ? <><Input label="Días desde la recepción" type="number" min={0} max={365} step={1} value={followupDays ?? 0} onChange={event => { setPreview(null); setReglaForm(prev => ({ ...prev, condicion: JSON.stringify({ tipo: 'seguimiento_cierre', diasRecepcion: { gte: Number(event.target.value) } }) })); }} />
            <p className="text-sm text-neutral-600">Umbral operativo, no vencimiento legal. Se revisa diariamente a las 08:00 de Mendoza. Cero incluye todos los recibidos o en tratamiento.</p></>
              : catalogue.tipo === 'requerimiento_inspeccion' ? <p className="text-sm text-neutral-700">Usa el plazo registrado de cada requerimiento. Leer, responder a otro pedido o una respuesta de la autoridad no lo contestan. Una respuesta vinculada detiene el aviso de ausencia, sin aceptar la subsanación.</p>
              : <><Input label="Días de anticipación" type="number" min={0} max={365} step={1} value={catalogue.anticipacionDias ?? 30} onChange={event => { setPreview(null); setReglaForm(prev => ({ ...prev, condicion: JSON.stringify({ ...JSON.parse(prev.condicion), anticipacionDias: Number(event.target.value) }) })); }} />
                <fieldset className="space-y-2"><legend className="text-sm font-medium text-neutral-700">Fuentes con fecha registrada</legend>{[['TRANSPORTISTA', 'Transportistas'], ['OPERADOR', 'Operadores'], ['VEHICULO', 'Vehículos'], ['CHOFER', 'Conductores']].map(([value, label]) => <label key={value} className="flex min-h-11 items-center gap-3 rounded-lg border border-neutral-200 px-3"><input type="checkbox" className="h-4 w-4 accent-primary-600" checked={catalogue?.entidades?.includes(value) || false} onChange={event => { setPreview(null); setReglaForm(prev => { const current = JSON.parse(prev.condicion); return { ...prev, condicion: JSON.stringify({ ...current, entidades: event.target.checked ? [...current.entidades, value] : current.entidades.filter((entity: string) => entity !== value) }) }; }); }} />{label}</label>)}</fieldset><p className="text-sm text-neutral-600">Incluye vencidos. Cero incluye sólo fechas alcanzadas. Sin fecha no se inventa vencimiento; una renovación conserva el caso anterior.</p></>}
            {catalogue && <p className="text-xs text-neutral-600">Evaluación diaria a las 08:05 de Mendoza. Sólo bandeja interna web/app.</p>}
            <Button variant="outline" disabled={previewPending} onClick={async () => {
              if (followupDays === null && !catalogue) return;
              const condition = reglaForm.condicion; setPreviewPending(true);
              try { setPreview({ condition, result: catalogue ? await alertaService.simularCatalogo(condition) : await alertaService.simularSeguimiento(followupDays!) }); }
              catch { toast.error('No se pudo simular', 'Verificá los días y reintentá. No se crearon casos ni avisos.'); }
              finally { setPreviewPending(false); }
            }}>Simular sin enviar</Button>
            {preview?.condition === reglaForm.condicion && <div role="status" className="rounded-lg border border-neutral-200 p-3 text-sm">
              <p>{preview.result.total} {catalogue ? 'objetos' : 'manifiestos'} coinciden con la condición. Sin crear casos ni avisos.</p>
              <ul className="mt-2 space-y-1">{preview.result.ejemplos.map(example => <li key={('entidad' in example ? example.entidad : '') + example.id}>{catalogue ? <span className="block py-2 break-words">{example.numero} · {example.estado.replaceAll('_', ' ').toLowerCase()}{'vencimiento' in example ? ` · ${new Date(example.vencimiento).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza', hour12: false })} (Mendoza)` : ''}</span> : <button type="button" className="min-h-11 text-primary-700 underline underline-offset-2" onClick={() => navigate(`/manifiestos/${example.id}`)}>{example.numero} · {example.estado === 'RECIBIDO' ? 'Recibido' : 'En tratamiento'}</button>}</li>)}</ul>
              {preview.result.total > preview.result.ejemplos.length && <p className="mt-2 text-neutral-600">Muestra de {preview.result.ejemplos.length} casos; total contado en servidor.</p>}
            </div>}
          </div>}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              <Users size={13} className="inline mr-1 -mt-0.5 text-neutral-400" />
              Destinatarios
            </label>
            <p className="mb-2 text-xs leading-relaxed text-neutral-600">Sólo el actor involucrado, inspector asignado o administración del ámbito elegido; nunca todo el padrón. Reglas distintas pueden generar casos distintos sobre el mismo objeto.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ROLES_DESTINATARIOS.filter(rol => recipientsAllowed.includes(rol.value)).map(rol => (
                <label key={rol.value} className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={reglaForm.destinatarios.includes(rol.value)}
                    onChange={() => toggleDestRole(rol.value)}
                    className="w-4 h-4 rounded border-neutral-300 text-primary-600 accent-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-neutral-800">{rol.value}</p>
                    <p className="text-xs text-neutral-400">{rol.label}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {followupDays === null && !catalogue && <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              <Mail size={13} className="inline mr-1 -mt-0.5 text-neutral-400" />
              Emails adicionales
            </label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none resize-none"
              placeholder="uno@empresa.com, otro@empresa.com"
              value={reglaForm.emails}
              onChange={(e) => setReglaForm(prev => ({ ...prev, emails: e.target.value }))}
              rows={2}
            />
            <p className="text-xs text-neutral-400 mt-1">Requiere Postfix configurado en el servidor</p>
          </div>}

          <label className="flex items-center gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={reglaForm.activa}
              onChange={(e) => setReglaForm(prev => ({ ...prev, activa: e.target.checked }))}
              className="w-4 h-4 rounded border-neutral-300 text-primary-600 accent-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700">Regla activa</span>
          </label>

        </div>
      </Modal>

      {/* Confirm delete regla */}
      <ConfirmModal
        isOpen={!!deletingRegla}
        onClose={() => setDeletingRegla(null)}
        onConfirm={handleDeleteRegla}
        title="Eliminar regla"
        description={`¿Estás seguro de que deseas eliminar la regla "${deletingRegla?.nombre}"?`}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};

export default AlertasPage;

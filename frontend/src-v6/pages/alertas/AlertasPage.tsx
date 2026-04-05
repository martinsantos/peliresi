/**
 * SITREP v6 - Alertas Page
 */

import React, { useState, useMemo } from 'react';
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
  X,
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
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { Table, type Column } from '../../components/ui/Table';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import { useAlertas, useResolverAlerta, useReglasAlerta, useCreateReglaAlerta, useUpdateReglaAlerta, useDeleteReglaAlerta } from '../../hooks/useAlertas';
import { useNotificaciones, useMarcarLeida, useMarcarTodasLeidas } from '../../hooks/useNotificaciones';
import { useAuth } from '../../contexts/AuthContext';
import { alertaService } from '../../services/alerta.service';
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
  evento?: string;
  estado: string;
}

// ─── Visual config ────────────────────────────────────────────────────────────

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
  { value: 'ADMIN', label: 'Administradores' },
  { value: 'GENERADOR', label: 'Generadores' },
  { value: 'TRANSPORTISTA', label: 'Transportistas' },
  { value: 'OPERADOR', label: 'Operadores' },
];

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
  condicion: '',
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

  // Any admin role: alertas generadas por reglas | Non-admin: notificaciones del usuario
  const { data: apiAlertas, isLoading: isLoadingAlertas, isError: isErrorAlertas } = useAlertas(undefined, isAnyAdmin);
  const { data: apiNotifs, isLoading: isLoadingNotifs, isError: isErrorNotifs } = useNotificaciones(undefined);
  const isLoading = isAnyAdmin ? isLoadingAlertas : isLoadingNotifs;
  const isError = isAnyAdmin ? isErrorAlertas : isErrorNotifs;
  const resolverMutation = useResolverAlerta();
  const marcarLeidaMutation = useMarcarLeida();
  const marcarTodasLeidasMutation = useMarcarTodasLeidas();

  const { data: reglas } = useReglasAlerta();
  const createRegla = useCreateReglaAlerta();
  const updateRegla = useUpdateReglaAlerta();
  const deleteRegla = useDeleteReglaAlerta();

  const [activeTab, setActiveTab] = useState('alertas');
  const [showReglaModal, setShowReglaModal] = useState(false);
  const [editingRegla, setEditingRegla] = useState<any | null>(null);
  const [deletingRegla, setDeletingRegla] = useState<any | null>(null);
  const [reglaForm, setReglaForm] = useState(defaultReglaForm);

  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  // Filters
  const [periodo, setPeriodo] = useState<string>('30d');
  const [filtroEvento, setFiltroEvento] = useState<string>('');
  const [filtroLeidas, setFiltroLeidas] = useState<string>('todas');
  const [showClearModal, setShowClearModal] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  const alertas: AlertaLocal[] = useMemo(() => {
    if (!isAnyAdmin) {
      // Non-admin: map notificaciones to AlertaLocal format
      const notifs = Array.isArray(apiNotifs) ? apiNotifs
        : (apiNotifs as { items?: unknown[]; data?: { notificaciones?: unknown[] }; notificaciones?: unknown[] })?.items
          || (apiNotifs as { data?: { notificaciones?: unknown[] } })?.data?.notificaciones
          || (apiNotifs as { notificaciones?: unknown[] })?.notificaciones
          || [];
      return notifs
        .filter((n: any) => !deletedIds.has(n.id))
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
        }));
    }
    // Admin: alertas generadas by rules
    const items = Array.isArray(apiAlertas?.items) ? apiAlertas.items : [];
    return items
      .filter((a: any) => !deletedIds.has(a.id))
      .map((a: any) => {
        const evento = a.regla?.evento;
        const estado = resolvedIds.has(a.id) ? 'RESUELTA' : (a.estado || 'PENDIENTE');
        return {
          id: a.id,
          tipo: getTipoFromEvento(evento, estado),
          titulo: a.regla?.nombre || 'Alerta',
          mensaje: parseMensaje(a.datos, a.regla?.evento),
          fecha: a.createdAt,
          leida: estado !== 'PENDIENTE',
          manifiestoId: a.manifiestoId || a.manifiesto?.id,
          manifiestoNumero: a.manifiesto?.numero,
          evento,
          estado,
        };
      });
  }, [isAnyAdmin, apiAlertas, apiNotifs, deletedIds, resolvedIds]);

  const alertasFiltradas = useMemo(() => {
    const since = periodStart(periodo);
    return alertas.filter(a => {
      if (since && new Date(a.fecha) < since) return false;
      if (filtroEvento && a.evento !== filtroEvento) return false;
      if (filtroLeidas === 'no-leidas' && a.leida) return false;
      if (filtroLeidas === 'leidas' && !a.leida) return false;
      return true;
    });
  }, [alertas, periodo, filtroEvento, filtroLeidas]);

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(alertasFiltradas.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const alertasPagina = alertasFiltradas.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const grupos = groupByDay(alertasPagina);

  const noLeidasCount = alertas.filter(a => !a.leida).length;

  const changeFilter = (setter: (v: any) => void, v: any) => {
    setter(v);
    setPage(1);
  };

  // ─── Actions ───────────────────────────────────────────────────────────────

  const marcarComoLeida = (id: string) => {
    if (!isAnyAdmin) {
      marcarLeidaMutation.mutate(id, {
        onSuccess: () => {
          setResolvedIds(prev => new Set(prev).add(id));
          toast.success('Leida', 'Notificacion marcada como leida');
        },
      });
      return;
    }
    resolverMutation.mutate(
      { id, notas: 'Marcada como leida' },
      {
        onSuccess: () => {
          setResolvedIds(prev => new Set(prev).add(id));
          toast.success('Alerta resuelta', 'La alerta fue marcada como leida');
        },
        onError: () => {
          setResolvedIds(prev => new Set(prev).add(id));
          toast.error('Error', 'No se pudo marcar la alerta');
        },
      }
    );
  };

  const marcarTodasComoLeidas = () => {
    alertas.filter(a => !a.leida).forEach(a => {
      resolverMutation.mutate(
        { id: a.id, notas: 'Marcada como leida (batch)' },
        { onSuccess: () => setResolvedIds(prev => new Set(prev).add(a.id)) }
      );
    });
    toast.success('Listo', 'Todas las alertas fueron marcadas como leídas');
  };

  const eliminarAlerta = (id: string) => {
    alertaService.resolverAlerta(id, 'Eliminada por usuario').then(() => {
      setDeletedIds(prev => new Set(prev).add(id));
    }).catch(() => {
      setDeletedIds(prev => new Set(prev).add(id));
    });
  };

  const limpiarTodas = () => {
    setDeletedIds(new Set(alertas.map(a => a.id)));
    setShowClearModal(false);
    toast.success('Alertas limpiadas', 'Se eliminaron todas las alertas');
  };

  // ─── Reglas handlers ───────────────────────────────────────────────────────

  const openCreateRegla = () => {
    setEditingRegla(null);
    setReglaForm(defaultReglaForm);
    setShowReglaModal(true);
  };

  const openEditRegla = (regla: any) => {
    setEditingRegla(regla);
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
          <Button variant="ghost" size="sm" onClick={() => openEditRegla(r)}><Edit size={14} /></Button>
          <Button variant="ghost" size="sm" className="text-error-500" onClick={() => setDeletingRegla(r)}><Trash2 size={14} /></Button>
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
            { value: 'leidas', label: 'Leídas' },
          ]}
          size="sm"
          isFullWidth={false}
        />

        <span className="ml-auto text-xs text-neutral-400">
          {alertasFiltradas.length} alerta{alertasFiltradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      {alertasFiltradas.length === 0 ? (
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
                    <div
                      key={alerta.id}
                      className={`
                        group relative bg-white rounded-xl border border-neutral-100 border-l-4 ${cfg.border}
                        flex items-start gap-3 px-4 py-3
                        transition-all hover:shadow-sm
                        ${!alerta.leida ? '' : 'opacity-60'}
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
                              {!alerta.leida && (
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
                          </div>
                          {/* Time + delete */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-neutral-400 flex items-center gap-1">
                              <Clock size={11} />
                              {formatRelativeTime(alerta.fecha)}
                            </span>
                            <button
                              onClick={() => eliminarAlerta(alerta.id)}
                              className="p-1 rounded hover:bg-neutral-100 text-neutral-300 hover:text-neutral-500"
                              title="Eliminar"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Actions row */}
                        {(alerta.manifiestoId || !alerta.leida) && (
                          <div className="flex items-center gap-2 mt-2">
                            {alerta.manifiestoId && (
                              <button
                                onClick={() => navigate(`/manifiestos/${alerta.manifiestoId}`)}
                                className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-primary-600 transition-colors"
                              >
                                <ExternalLink size={12} />
                                Ver manifiesto
                              </button>
                            )}
                            {!alerta.leida && (
                              <button
                                onClick={() => marcarComoLeida(alerta.id)}
                                disabled={resolverMutation.isPending}
                                className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-success-600 transition-colors"
                              >
                                <Check size={12} />
                                Marcar leída
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
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
          {Array.isArray(reglas) ? reglas.length : 0} reglas configuradas
        </p>
        <Button variant="primary" size="sm" leftIcon={<Plus size={15} />} onClick={openCreateRegla}>
          Nueva Regla
        </Button>
      </div>
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
          </div>
        ))}
      </div>
      {/* Desktop table */}
      <Card className="hidden md:block">
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
            {noLeidasCount > 0 && (
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
                `${noLeidasCount} pendiente${noLeidasCount !== 1 ? 's' : ''} · ${alertas.length} total${alertas.length !== 1 ? 'es' : ''}`
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Check size={15} />}
            onClick={marcarTodasComoLeidas}
            disabled={noLeidasCount === 0}
          >
            Marcar todas
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Trash2 size={15} />}
            onClick={() => setShowClearModal(true)}
            disabled={alertas.length === 0}
          >
            Limpiar
          </Button>
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

      {/* Confirm clear */}
      <ConfirmModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={limpiarTodas}
        title="Limpiar todas las alertas"
        description="¿Estás seguro de que deseas eliminar todas las alertas? Esta acción no se puede deshacer."
        confirmText="Sí, limpiar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Modal crear/editar regla — con scroll interno */}
      <Modal
        isOpen={showReglaModal}
        onClose={() => setShowReglaModal(false)}
        title={editingRegla ? 'Editar Regla' : 'Nueva Regla'}
        size="base"
      >
        <div className="overflow-y-auto max-h-[calc(100vh-200px)] pr-1 space-y-4">
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
          <Select
            label="Evento"
            placeholder="Seleccionar evento…"
            options={EVENTO_OPTIONS}
            value={reglaForm.evento}
            onChange={(val) => setReglaForm(prev => ({ ...prev, evento: val }))}
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Condición <span className="text-neutral-400 font-normal">(JSON)</span></label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-sm font-mono focus:border-primary-500 focus:outline-none resize-none"
              placeholder="{}"
              value={reglaForm.condicion}
              onChange={(e) => setReglaForm(prev => ({ ...prev, condicion: e.target.value }))}
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              <Users size={13} className="inline mr-1 -mt-0.5 text-neutral-400" />
              Destinatarios
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES_DESTINATARIOS.map(rol => (
                <label key={rol.value} className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={reglaForm.destinatarios.includes(rol.value)}
                    onChange={() => toggleDestRole(rol.value)}
                    className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-neutral-800">{rol.value}</p>
                    <p className="text-xs text-neutral-400">{rol.label}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
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
          </div>

          <label className="flex items-center gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={reglaForm.activa}
              onChange={(e) => setReglaForm(prev => ({ ...prev, activa: e.target.checked }))}
              className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700">Regla activa</span>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
            <Button variant="outline" size="sm" onClick={() => setShowReglaModal(false)}>Cancelar</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveRegla}
              disabled={createRegla.isPending || updateRegla.isPending}
            >
              {(createRegla.isPending || updateRegla.isPending) && <Loader2 size={13} className="animate-spin mr-1" />}
              {editingRegla ? 'Guardar cambios' : 'Crear regla'}
            </Button>
          </div>
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

/**
 * SITREP v6 - Alertas Page
 * ========================
 * Gestion de alertas y notificaciones - Real API + fallback mock
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
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
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { Table, type Column } from '../../components/ui/Table';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import { useAlertas, useResolverAlerta, useReglasAlerta, useCreateReglaAlerta, useUpdateReglaAlerta, useDeleteReglaAlerta } from '../../hooks/useAlertas';
import { useAuth } from '../../contexts/AuthContext';
import { alertaService } from '../../services/alerta.service';
import { formatRelativeTime } from '../../utils/formatters';

// Local alert shape used by UI
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

const tipoConfig = {
  critical: { label: 'Critica', icon: AlertCircle, color: 'error', bgColor: 'bg-error-50', borderColor: 'border-error-200', textColor: 'text-error-800' },
  warning: { label: 'Advertencia', icon: AlertTriangle, color: 'warning', bgColor: 'bg-warning-50', borderColor: 'border-warning-200', textColor: 'text-warning-800' },
  info: { label: 'Informacion', icon: Info, color: 'info', bgColor: 'bg-info-50', borderColor: 'border-info-200', textColor: 'text-info-800' },
  success: { label: 'Resuelta', icon: CheckCircle, color: 'success', bgColor: 'bg-success-50', borderColor: 'border-success-200', textColor: 'text-success-800' },
};

// Mapear evento a tipo visual (no basado en estado PENDIENTE)
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
    case 'CAMBIO_ESTADO':
    case 'VENCIMIENTO':
    default:
      return 'info';
  }
}

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

export const AlertasPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Real API data
  const { data: apiAlertas, isLoading, isError } = useAlertas();
  const resolverMutation = useResolverAlerta();

  // Reglas hooks
  const { data: reglas } = useReglasAlerta();
  const createRegla = useCreateReglaAlerta();
  const updateRegla = useUpdateReglaAlerta();
  const deleteRegla = useDeleteReglaAlerta();

  // Tabs & Reglas state
  const [activeTab, setActiveTab] = useState('alertas');
  const [showReglaModal, setShowReglaModal] = useState(false);
  const [editingRegla, setEditingRegla] = useState<any | null>(null);
  const [deletingRegla, setDeletingRegla] = useState<any | null>(null);
  const [reglaForm, setReglaForm] = useState(defaultReglaForm);

  // Local state for optimistic updates
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  // Use only API data
  const alertas: AlertaLocal[] = useMemo(() => {
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
          mensaje: (() => {
            try {
              return typeof a.datos === 'string' ? (JSON.parse(a.datos)?.descripcion || a.datos) : 'Sin detalles';
            } catch {
              return String(a.datos || 'Sin detalles');
            }
          })(),
          fecha: a.createdAt,
          leida: estado !== 'PENDIENTE',
          manifiestoId: a.manifiestoId || a.manifiesto?.id,
          manifiestoNumero: a.manifiesto?.numero,
          evento,
          estado,
        };
      });
  }, [apiAlertas, deletedIds, resolvedIds]);

  const [filtroTipo, setFiltroTipo] = useState<string>('todas');
  const [filtroLeidas, setFiltroLeidas] = useState<string>('todas');
  const [showClearModal, setShowClearModal] = useState(false);

  const alertasFiltradas = alertas.filter(alerta => {
    const matchTipo = filtroTipo === 'todas' || alerta.tipo === filtroTipo;
    const matchLeidas = filtroLeidas === 'todas' ||
      (filtroLeidas === 'leidas' && alerta.leida) ||
      (filtroLeidas === 'no-leidas' && !alerta.leida);
    return matchTipo && matchLeidas;
  });

  const noLeidasCount = alertas.filter(a => !a.leida).length;

  const marcarComoLeida = (id: string) => {
    resolverMutation.mutate(
      { id, notas: 'Marcada como leida' },
      {
        onSuccess: () => {
          setResolvedIds(prev => new Set(prev).add(id));
          toast.success('Alerta resuelta', 'La alerta fue marcada como leida');
        },
        onError: () => {
          setResolvedIds(prev => new Set(prev).add(id));
          toast.error('Error', 'No se pudo marcar la alerta como leida');
        },
      }
    );
  };

  const marcarTodasComoLeidas = () => {
    const noLeidas = alertas.filter(a => !a.leida);
    noLeidas.forEach(a => {
      resolverMutation.mutate(
        { id: a.id, notas: 'Marcada como leida (batch)' },
        {
          onSuccess: () => setResolvedIds(prev => new Set(prev).add(a.id)),
          onError: () => setResolvedIds(prev => new Set(prev).add(a.id)),
        }
      );
    });
    toast.success('Alertas marcadas', 'Todas las alertas fueron marcadas como leidas');
  };

  const eliminarAlerta = (id: string) => {
    alertaService.resolverAlerta(id, 'Eliminada por usuario').then(() => {
      setDeletedIds(prev => new Set(prev).add(id));
      toast.success('Alerta eliminada', 'La alerta fue eliminada correctamente');
    }).catch(() => {
      setDeletedIds(prev => new Set(prev).add(id));
      toast.error('Error', 'No se pudo eliminar la alerta en el servidor');
    });
  };

  const limpiarTodas = () => {
    const allIds = new Set(alertas.map(a => a.id));
    setDeletedIds(allIds);
    setShowClearModal(false);
    toast.success('Alertas limpiadas', 'Todas las alertas fueron eliminadas');
  };

  // --- Reglas handlers ---
  const openCreateRegla = () => {
    setEditingRegla(null);
    setReglaForm(defaultReglaForm);
    setShowReglaModal(true);
  };

  const openEditRegla = (regla: any) => {
    setEditingRegla(regla);
    // Parse existing destinatarios
    let destList: string[] = [];
    try {
      const parsed = JSON.parse(regla.destinatarios || '[]');
      destList = Array.isArray(parsed) ? parsed : [];
    } catch { /* noop */ }
    const roles = destList.filter((d: string) => !d.startsWith('email:'));
    const emailList = destList
      .filter((d: string) => d.startsWith('email:'))
      .map((d: string) => d.replace('email:', ''));
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
      toast.error('Campos requeridos', 'Nombre, evento y condicion son obligatorios');
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
          onSuccess: () => {
            toast.success('Regla actualizada', 'La regla fue actualizada correctamente');
            setShowReglaModal(false);
          },
          onError: () => toast.error('Error', 'No se pudo actualizar la regla'),
        }
      );
    } else {
      createRegla.mutate(payload, {
        onSuccess: () => {
          toast.success('Regla creada', 'La regla fue creada correctamente');
          setShowReglaModal(false);
        },
        onError: () => toast.error('Error', 'No se pudo crear la regla'),
      });
    }
  };

  const handleDeleteRegla = () => {
    if (!deletingRegla) return;
    deleteRegla.mutate(deletingRegla.id, {
      onSuccess: () => {
        toast.success('Regla eliminada', 'La regla fue eliminada correctamente');
        setDeletingRegla(null);
      },
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

  const reglasColumns: Column<any>[] = [
    { key: 'nombre', header: 'Nombre', sortable: true },
    {
      key: 'evento',
      header: 'Evento',
      render: (r) => {
        const label = EVENTO_LABELS[r.evento] || r.evento;
        return <Badge variant="soft" color="info" size="sm">{label}</Badge>;
      },
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
            {roles.map(rol => (
              <Badge key={rol} variant="soft" color="neutral" size="sm">{rol}</Badge>
            ))}
            {emailCount > 0 && (
              <Badge variant="soft" color="info" size="sm">+{emailCount} email{emailCount > 1 ? 's' : ''}</Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'activa',
      header: 'Activa',
      align: 'center',
      render: (r) => (
        <Badge variant="soft" color={r.activa ? 'success' : 'neutral'} size="sm">
          {r.activa ? 'Si' : 'No'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditRegla(r)}>
            <Edit size={14} />
          </Button>
          <Button variant="ghost" size="sm" className="text-error-500" onClick={() => setDeletingRegla(r)}>
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  // --- Alertas content ---
  const alertasContent = (
    <>
      {/* Filtros */}
      <Card padding="base">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-neutral-400" />
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="todas">Todas las alertas</option>
              <option value="critical">Criticas</option>
              <option value="warning">Advertencias</option>
              <option value="info">Informacion</option>
              <option value="success">Resueltas</option>
            </select>
          </div>
          <select
            value={filtroLeidas}
            onChange={(e) => setFiltroLeidas(e.target.value)}
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="todas">Todas</option>
            <option value="no-leidas">Pendientes</option>
            <option value="leidas">Resueltas / leidas</option>
          </select>
        </div>
      </Card>

      {/* Lista de alertas */}
      <div className="space-y-3">
        {alertasFiltradas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell size={32} className="text-neutral-400" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">No hay alertas</h3>
              <p className="text-neutral-600">No se encontraron alertas con los filtros seleccionados</p>
            </CardContent>
          </Card>
        ) : (
          alertasFiltradas.map((alerta) => {
            const config = tipoConfig[alerta.tipo];
            const Icon = config.icon;

            return (
              <div
                key={alerta.id}
                className={`
                  relative p-4 rounded-xl border-l-4 transition-all
                  ${config.bgColor} ${config.borderColor}
                  ${!alerta.leida ? 'shadow-sm' : 'opacity-75'}
                `}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg bg-white ${config.textColor}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className={`font-semibold ${config.textColor}`}>{alerta.titulo}</h4>
                          {!alerta.leida && (
                            <Badge variant="solid" color={config.color as any} size="sm">
                              Nueva
                            </Badge>
                          )}
                          {alerta.evento && (
                            <Badge variant="outline" color="neutral" size="sm">
                              {EVENTO_LABELS[alerta.evento] || alerta.evento}
                            </Badge>
                          )}
                          {alerta.manifiestoNumero && (
                            <button
                              onClick={() => alerta.manifiestoId && navigate(`/manifiestos/${alerta.manifiestoId}`)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-neutral-200 text-xs font-mono text-neutral-700 hover:border-primary-400 hover:text-primary-600 transition-colors"
                            >
                              {alerta.manifiestoNumero}
                              <ExternalLink size={10} />
                            </button>
                          )}
                        </div>
                        <p className={`text-sm ${config.textColor} opacity-90`}>
                          {alerta.mensaje}
                        </p>
                      </div>
                      <span className="text-xs text-neutral-500 whitespace-nowrap flex items-center gap-1 shrink-0">
                        <Clock size={12} />
                        {formatRelativeTime(alerta.fecha)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      {alerta.manifiestoId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => navigate(`/manifiestos/${alerta.manifiestoId}`)}
                        >
                          <ExternalLink size={14} className="mr-1" />
                          Ver Manifiesto
                        </Button>
                      )}
                      {!alerta.leida && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => marcarComoLeida(alerta.id)}
                          disabled={resolverMutation.isPending}
                        >
                          <Check size={14} className="mr-1" />
                          Marcar leida
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-neutral-400 hover:text-error-500 ml-auto"
                        onClick={() => eliminarAlerta(alerta.id)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  // --- Reglas content ---
  const reglasContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          {Array.isArray(reglas) ? reglas.length : 0} reglas configuradas
        </p>
        <Button variant="primary" size="sm" leftIcon={<Plus size={16} />} onClick={openCreateRegla}>
          Nueva Regla
        </Button>
      </div>
      <Card>
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell size={28} className="text-neutral-700" />
            {noLeidasCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-error-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {noLeidasCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Alertas</h2>
            <p className="text-neutral-600">
              {isLoading ? (
                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando alertas...</span>
              ) : (
                <>{noLeidasCount} alertas sin leer de {alertas.length} totales {isError ? '(error al cargar)' : ''}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            leftIcon={<Check size={18} />}
            onClick={marcarTodasComoLeidas}
            disabled={noLeidasCount === 0}
          >
            Marcar todas
          </Button>
          <Button
            variant="outline"
            leftIcon={<Trash2 size={18} />}
            onClick={() => setShowClearModal(true)}
            disabled={alertas.length === 0}
          >
            Limpiar
          </Button>
        </div>
      </div>

      {/* Main content: Tabs for admin, direct list for non-admin */}
      {isAdmin ? (
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabList>
            <Tab id="alertas">Alertas</Tab>
            <Tab id="reglas"><Settings size={16} className="inline mr-1 -mt-0.5" />Reglas</Tab>
          </TabList>
          <TabPanel id="alertas">
            <div className="space-y-4 mt-4">
              {alertasContent}
            </div>
          </TabPanel>
          <TabPanel id="reglas">
            <div className="mt-4">
              {reglasContent}
            </div>
          </TabPanel>
        </Tabs>
      ) : (
        alertasContent
      )}

      {/* Modal de confirmacion - Limpiar alertas */}
      <ConfirmModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={limpiarTodas}
        title="Limpiar todas las alertas"
        description="Estas seguro de que deseas eliminar todas las alertas? Esta accion no se puede deshacer."
        confirmText="Si, limpiar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Modal crear/editar regla */}
      <Modal
        isOpen={showReglaModal}
        onClose={() => setShowReglaModal(false)}
        title={editingRegla ? 'Editar Regla' : 'Nueva Regla'}
        size="base"
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            placeholder="Nombre de la regla"
            value={reglaForm.nombre}
            onChange={(e) => setReglaForm(prev => ({ ...prev, nombre: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Descripción</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none resize-y"
              placeholder="Descripción opcional de la regla"
              value={reglaForm.descripcion}
              onChange={(e) => setReglaForm(prev => ({ ...prev, descripcion: e.target.value }))}
              rows={2}
            />
          </div>
          <Select
            label="Evento"
            placeholder="Seleccionar evento..."
            options={EVENTO_OPTIONS}
            value={reglaForm.evento}
            onChange={(val) => setReglaForm(prev => ({ ...prev, evento: val }))}
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Condicion</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none resize-y min-h-[80px]"
              placeholder="Condicion de la regla (ej: cantidad > 100)"
              value={reglaForm.condicion}
              onChange={(e) => setReglaForm(prev => ({ ...prev, condicion: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Destinatarios por rol */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              <Users size={14} className="inline mr-1 -mt-0.5" />
              Destinatarios (notificaciones in-app)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES_DESTINATARIOS.map(rol => (
                <label key={rol.value} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={reglaForm.destinatarios.includes(rol.value)}
                    onChange={() => toggleDestRole(rol.value)}
                    className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{rol.value}</p>
                    <p className="text-xs text-neutral-500">{rol.label}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Emails adicionales */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              <Mail size={14} className="inline mr-1 -mt-0.5" />
              Emails adicionales (uno por línea o separados por coma)
            </label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none resize-y"
              placeholder="coordinador@empresa.com&#10;supervisor@empresa.com"
              value={reglaForm.emails}
              onChange={(e) => setReglaForm(prev => ({ ...prev, emails: e.target.value }))}
              rows={3}
            />
            <p className="text-xs text-neutral-400 mt-1">Requiere Postfix configurado en el servidor</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={reglaForm.activa}
              onChange={(e) => setReglaForm(prev => ({ ...prev, activa: e.target.checked }))}
              className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700">Regla activa</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowReglaModal(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={handleSaveRegla}
              disabled={createRegla.isPending || updateRegla.isPending}
            >
              {(createRegla.isPending || updateRegla.isPending) && <Loader2 size={14} className="animate-spin mr-1" />}
              {editingRegla ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal confirmar eliminacion de regla */}
      <ConfirmModal
        isOpen={!!deletingRegla}
        onClose={() => setDeletingRegla(null)}
        onConfirm={handleDeleteRegla}
        title="Eliminar regla"
        description={`Estas seguro de que deseas eliminar la regla "${deletingRegla?.nombre}"? Esta accion no se puede deshacer.`}
        confirmText="Si, eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};

export default AlertasPage;

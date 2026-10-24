import { useMobilePrefix } from '../../hooks/useMobilePrefix';
/**
 * SITREP v6 - Admin Transportistas Page
 * ======================================
 * Panel administrativo para transportistas de residuos peligrosos
 * Patrón admin: Header + Stats + Filtros + Table + Pagination + Modals
 */

import React, { useState, useMemo } from 'react';
import { useActorListNavigation } from '../../hooks/useActorListNavigation';
import { useLocation } from 'react-router-dom';
import {
  Truck,
  Search,
  AlertTriangle,
  CheckCircle,
  Phone,
  Mail,
  Edit,
  Eye,
  Trash2,
  Download,
  FileDown,
  Loader2,
  MapPin,
  Clock,
  Printer,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { RecordListToolbar } from '../../components/crud/RecordListToolbar';
import { RecordListFilters } from '../../components/crud/RecordListFilters';
import { CRUDSummary } from '../../components/crud/CRUDSummary';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Table, Pagination } from '../../components/ui/Table';
import { toast } from '../../components/ui/Toast';
import { downloadCsv } from '../../utils/exportCsv';
import { exportReportePDF } from '../../utils/exportPdf';
import { useAuth } from '../../contexts/AuthContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { formatRelativeTime } from '../../utils/formatters';
import {
  useTransportistas,
  useCreateTransportista,
  useUpdateTransportista,
  useDeleteTransportista,
} from '../../hooks/useActores';

const INITIAL_FORM = {
  razonSocial: '',
  cuit: '',
  domicilio: '',
  localidad: '',
  telefono: '',
  email: '',
  password: '',
  nombre: '',
  numeroHabilitacion: '',
  vencimientoHabilitacion: '',
  coordenadas: '',
  corrientesAutorizadas: '',
  expedienteDPA: '',
  resolucionDPA: '',
  resolucionSSP: '',
  actaInspeccion: '',
  actaInspeccion2: '',
};

const TransportistasPage: React.FC = () => {
  const list = useActorListNavigation();
  const navigate = list.open;
  const mp = useMobilePrefix();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { impersonateUser } = useImpersonation();
  const busqueda = list.text('q'), setBusqueda = (value: string) => list.set('q', value);
  const filtroEstado = list.text('estado', 'todos'), setFiltroEstado = (value: string) => list.set('estado', value);
  const filtroLocalidad = list.text('localidad', 'todas'), setFiltroLocalidad = (value: string) => list.set('localidad', value);
  const currentPage = list.number('page', 1), setCurrentPage = (value: number) => list.set('page', value);
  const sortBy = list.text('sortBy', 'ultimaActividad'), setSortBy = (value: string) => list.set('sortBy', value);
  const sortOrder = list.text('sortOrder', 'desc') === 'asc' ? 'asc' : 'desc';
  const setSortOrder = (value: 'asc' | 'desc') => list.set('sortOrder', value);
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; razonSocial: string } | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  // API hooks
  const { data: apiData, isLoading, isError, error } = useTransportistas({ page: currentPage, limit: 20, search: busqueda || undefined, activo: filtroEstado === 'todos' ? undefined : filtroEstado === 'activo', localidad: filtroLocalidad === 'todas' ? undefined : filtroLocalidad, sortBy, sortOrder });
  const createMutation = useCreateTransportista();
  const updateMutation = useUpdateTransportista();
  const deleteMutation = useDeleteTransportista();

  const transportistasData = Array.isArray(apiData?.items) ? apiData.items : [];
  const total = apiData?.total || transportistasData.length;
  const totalPages = apiData?.totalPages || 1;

  // Map to display format
  const tableData = useMemo(() =>
    transportistasData.map((t: any) => ({
      id: t.id,
      razonSocial: t.razonSocial || '',
      cuit: t.cuit || '',
      domicilio: t.domicilio || '',
      localidad: t.localidad || '',
      telefono: t.telefono || '',
      email: t.email || t.usuario?.email || '',
      numeroHabilitacion: t.numeroHabilitacion || '-',
      vencimientoHabilitacion: t.vencimientoHabilitacion ? new Date(t.vencimientoHabilitacion) : null,
      vehiculosCount: Array.isArray(t.vehiculos) ? t.vehiculos.length : 0,
      choferesCount: Array.isArray(t.choferes) ? t.choferes.length : 0,
      activo: t.activo !== false,
      createdAt: t.createdAt,
      ultimaActividad: t.ultimaActividad || null,
      _raw: t,
    })),
    [transportistasData]
  );

  const localidadesUnicas = [...new Set([...(apiData?.localidades || []), ...(filtroLocalidad === 'todas' ? [] : [filtroLocalidad])])].sort();

  const hoy = new Date();
  const en30dias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);

  function getVencimientoStatus(fecha: Date | null): 'vencida' | 'pronto' | 'vigente' | null {
    if (!fecha) return null;
    if (fecha < hoy) return 'vencida';
    if (fecha < en30dias) return 'pronto';
    return 'vigente';
  }

  const filteredData = tableData;

  const TRANS_COL_MAP: Record<string, string> = {
    transportista: 'razonSocial',
    localidad: 'localidad',
    flota: 'vehiculosCount',
    choferes: 'choferesCount',
    ultimaActividad: 'ultimaActividad',
    estado: 'activo',
  };

  const handleSort = (key: string, direction: 'asc' | 'desc') => {
    setSortBy(TRANS_COL_MAP[key] ?? key);
    setSortOrder(direction);
    setCurrentPage(1);
  };

  const porVencer = tableData.filter(t =>
    t.vencimientoHabilitacion && t.vencimientoHabilitacion < en30dias && t.vencimientoHabilitacion >= hoy
  ).length;

  const stats = {
    total,
    activos: transportistasData.filter((t: any) => t.activo !== false).length,
    inactivos: transportistasData.filter((t: any) => t.activo === false).length,
    porVencer,
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const parseCoords = (coords: string) => {
    const parts = coords?.split(',').map(s => s.trim()).filter(Boolean);
    const lat = parts?.[0] ? Number(parts[0]) : undefined;
    const lng = parts?.[1] ? Number(parts[1]) : undefined;
    return lat && lng && !isNaN(lat) && !isNaN(lng) ? { latitud: lat, longitud: lng } : {};
  };

  const handleCrear = async () => {
    if (!form.razonSocial || !form.cuit || !form.email) {
      toast.error('Campos requeridos', 'Razón social, CUIT y email son obligatorios');
      return;
    }
    try {
      await createMutation.mutateAsync({
        email: form.email,
        password: form.password || 'TempPass123!',
        nombre: form.nombre || form.razonSocial,
        razonSocial: form.razonSocial,
        cuit: form.cuit,
        domicilio: form.domicilio,
        localidad: form.localidad || undefined,
        telefono: form.telefono,
        numeroHabilitacion: form.numeroHabilitacion,
        vencimientoHabilitacion: form.vencimientoHabilitacion || undefined,
        ...parseCoords(form.coordenadas),
        corrientesAutorizadas: form.corrientesAutorizadas || undefined,
        expedienteDPA: form.expedienteDPA || undefined,
        resolucionDPA: form.resolucionDPA || undefined,
        resolucionSSP: form.resolucionSSP || undefined,
        actaInspeccion: form.actaInspeccion || undefined,
        actaInspeccion2: form.actaInspeccion2 || undefined,
      });
      toast.success('Creado', `Transportista ${form.razonSocial} creado`);
      setModalCrear(false);
      setForm(INITIAL_FORM);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo crear el transportista');
    }
  };

  const handleEditar = async () => {
    if (!editId) return;
    try {
      await updateMutation.mutateAsync({
        id: editId,
        data: {
          razonSocial: form.razonSocial,
          cuit: form.cuit,
          domicilio: form.domicilio,
          localidad: form.localidad || undefined,
          telefono: form.telefono,
          email: form.email,
          numeroHabilitacion: form.numeroHabilitacion,
          vencimientoHabilitacion: form.vencimientoHabilitacion || undefined,
          ...parseCoords(form.coordenadas),
          corrientesAutorizadas: form.corrientesAutorizadas || undefined,
          expedienteDPA: form.expedienteDPA || undefined,
          resolucionDPA: form.resolucionDPA || undefined,
          resolucionSSP: form.resolucionSSP || undefined,
          actaInspeccion: form.actaInspeccion || undefined,
          actaInspeccion2: form.actaInspeccion2 || undefined,
        },
      });
      toast.success('Actualizado', `Transportista ${form.razonSocial} actualizado`);
      setModalEditar(false);
      setEditId(null);
      setForm(INITIAL_FORM);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo actualizar');
    }
  };

  const openEditar = (row: typeof tableData[0]) => {
    navigate(mp(`/admin/actores/transportistas/${row.id}/editar`));
    return;
    // Legacy modal code below - kept for reference
    setEditId(row.id);
    setForm({
      razonSocial: row.razonSocial || '',
      cuit: row.cuit || '',
      domicilio: row.domicilio || '',
      localidad: row.localidad || '',
      telefono: row.telefono || '',
      email: row.email || '',
      password: '',
      nombre: '',
      numeroHabilitacion: row.numeroHabilitacion !== '-' ? row.numeroHabilitacion : '',
      vencimientoHabilitacion: row.vencimientoHabilitacion
        ? new Date(row.vencimientoHabilitacion as Date).toISOString().split('T')[0]
        : '',
      coordenadas: row._raw?.latitud ? `${row._raw.latitud}, ${row._raw.longitud}` : '',
      corrientesAutorizadas: row._raw?.corrientesAutorizadas || '',
      expedienteDPA: row._raw?.expedienteDPA || '',
      resolucionDPA: row._raw?.resolucionDPA || '',
      resolucionSSP: row._raw?.resolucionSSP || '',
      actaInspeccion: row._raw?.actaInspeccion || '',
      actaInspeccion2: row._raw?.actaInspeccion2 || '',
    });
    setModalEditar(true);
  };

  const handleEliminar = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Eliminado', `Transportista ${deleteTarget.razonSocial} eliminado`);
      setModalEliminar(false);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo eliminar');
    }
  };

  const handleExport = () => {
    downloadCsv(
      filteredData.map(t => ({
        'Razón Social': t.razonSocial,
        CUIT: t.cuit,
        Habilitación: t.numeroHabilitacion,
        Email: t.email,
        Teléfono: t.telefono,
        Domicilio: t.domicilio,
        Vehículos: t.vehiculosCount,
        Choferes: t.choferesCount,
        Estado: t.activo ? 'Activo' : 'Inactivo',
        Alta: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '',
      })),
      'admin-transportistas',
      {
        titulo: 'Transportistas',
        periodo: 'Todos los periodos',
        filtros: [filtroEstado !== 'todos' ? `Estado: ${filtroEstado}` : '', filtroLocalidad !== 'todas' ? `Localidad: ${filtroLocalidad}` : ''].filter(Boolean).join(', ') || 'Sin filtros',
        total: filteredData.length,
      }
    );
    toast.success('Exportar', 'CSV descargado');
  };

  const handleExportPdf = () => {
    const totalVehiculos = filteredData.reduce((sum, t) => sum + t.vehiculosCount, 0);
    exportReportePDF({
      titulo: 'Transportistas',
      subtitulo: 'Panel de gestión de transportistas de residuos peligrosos',
      periodo: `Total: ${stats.total} transportistas`,
      kpis: [
        { label: 'Total', value: stats.total },
        { label: 'Activos', value: stats.activos },
        { label: 'Inactivos', value: stats.inactivos },
        { label: 'Vehículos', value: totalVehiculos },
      ],
      tabla: {
        headers: ['Razón Social', 'CUIT', 'Habilitación', 'Email', 'Vehículos', 'Choferes', 'Estado'],
        rows: filteredData.map(t => [
          t.razonSocial,
          t.cuit,
          t.numeroHabilitacion,
          t.email,
          t.vehiculosCount,
          t.choferesCount,
          t.activo ? 'Activo' : 'Inactivo',
        ]),
      },
    });
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Input label="Razón Social" value={form.razonSocial} onChange={(e) => updateField('razonSocial', e.target.value)} placeholder="Empresa S.A." />
        <Input label="CUIT" value={form.cuit} onChange={(e) => updateField('cuit', e.target.value)} placeholder="30-12345678-9" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Input label="Email" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="contacto@empresa.com" />
        <Input label="Teléfono" value={form.telefono} onChange={(e) => updateField('telefono', e.target.value)} placeholder="+54 261 ..." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Input label="Domicilio" value={form.domicilio} onChange={(e) => updateField('domicilio', e.target.value)} placeholder="Av. Libertador 1234, Mendoza" />
        <Input label="Localidad" value={form.localidad} onChange={(e) => updateField('localidad', e.target.value)} placeholder="Godoy Cruz, Mendoza" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Input label="N° Habilitación" value={form.numeroHabilitacion} onChange={(e) => updateField('numeroHabilitacion', e.target.value)} placeholder="HAB-TR-2024-XXXX" />
        <Input label="Vencimiento Habilitación" type="date" value={form.vencimientoHabilitacion} onChange={(e) => updateField('vencimientoHabilitacion', e.target.value)} />
      </div>
      <Input label="Coordenadas Geograficas" value={form.coordenadas} onChange={(e) => updateField('coordenadas', e.target.value)} placeholder="-32.89, -68.83" />
      {/* Datos DPA */}
      <div className="border-t border-neutral-100 pt-4 mt-2">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Datos DPA</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Input label="Expediente DPA" value={form.expedienteDPA} onChange={(e) => updateField('expedienteDPA', e.target.value)} placeholder="EXP-DPA-XXXX" />
          <Input label="Resolución DPA" value={form.resolucionDPA} onChange={(e) => updateField('resolucionDPA', e.target.value)} placeholder="0359/24" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4">
          <Input label="Resolución SSP" value={form.resolucionSSP} onChange={(e) => updateField('resolucionSSP', e.target.value)} placeholder="SSP-XXXX" />
          <Input label="Corrientes Autorizadas" value={form.corrientesAutorizadas} onChange={(e) => updateField('corrientesAutorizadas', e.target.value)} placeholder="Y4, Y8, Y9" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4">
          <Input label="Acta Inspección" value={form.actaInspeccion} onChange={(e) => updateField('actaInspeccion', e.target.value)} placeholder="rp-g000040" />
          <Input label="Acta Inspección 2" value={form.actaInspeccion2} onChange={(e) => updateField('actaInspeccion2', e.target.value)} placeholder="" />
        </div>
      </div>
      {!editId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Input label="Nombre Responsable" value={form.nombre} onChange={(e) => updateField('nombre', e.target.value)} placeholder="Juan Perez" />
          <Input label="Password inicial" type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Min. 8 caracteres" />
        </div>
      )}
    </div>
  );

  const columns = [
    {
      key: 'transportista',
      // Leave remaining space to the actor, not to narrow status/action columns.
      header: 'Transportista',
      sortable: true,
      render: (row: typeof tableData[0]) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Truck size={20} className="text-orange-600" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-neutral-900 text-sm leading-tight line-clamp-2">{row.razonSocial}</p>
            <span className="text-xs text-neutral-500 font-mono">{row.cuit}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'habilitacion',
      width: '8rem',
      header: 'Habilitación',
      hiddenBelow: 'xl' as const,
      render: (row: typeof tableData[0]) => {
        const status = getVencimientoStatus(row.vencimientoHabilitacion);
        return (
          <div className="space-y-1">
            <span className="text-sm font-mono text-neutral-700">{row.numeroHabilitacion}</span>
            {status === 'vencida' && (
              <Badge variant="soft" color="error"><AlertTriangle size={10} className="mr-1" />VENCIDA</Badge>
            )}
            {status === 'pronto' && (
              <Badge variant="soft" color="warning"><Clock size={10} className="mr-1" />VENCE PRONTO</Badge>
            )}
            {status === 'vigente' && (
              <Badge variant="soft" color="success"><CheckCircle size={10} className="mr-1" />VIGENTE</Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'localidad',
      width: '7rem',
      header: 'Localidad',
      sortable: true,
      hiddenBelow: 'xl' as const,
      render: (row: typeof tableData[0]) => (
        <div className="flex items-center gap-1 text-xs text-neutral-600">
          {row.localidad ? (
            <>
              <MapPin size={11} className="text-neutral-400 flex-shrink-0" />
              <span className="truncate">{row.localidad}</span>
            </>
          ) : (
            <span className="text-neutral-400">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'flota',
      width: '7.5rem',
      header: 'Vehículos',
      sortable: true,
      hiddenBelow: 'xl' as const,
      render: (row: typeof tableData[0]) => (
        <div className="text-center">
          <p className="text-sm font-bold text-neutral-900">{row.vehiculosCount}</p>
          <p className="text-[10px] text-neutral-500">Vehículos</p>
        </div>
      ),
    },
    {
      key: 'choferes',
      width: '7rem',
      header: 'Choferes',
      sortable: true,
      hiddenBelow: 'xl' as const,
      render: (row: typeof tableData[0]) => (
        <div className="text-center">
          <p className="text-sm font-bold text-neutral-900">{row.choferesCount}</p>
          <p className="text-[10px] text-neutral-500">Choferes</p>
        </div>
      ),
    },
    {
      key: 'contacto',
      width: '9rem',
      header: 'Contacto',
      hiddenBelow: '2xl' as const,
      render: (row: typeof tableData[0]) => (
        <div className="text-xs min-w-0">
          {row.email && (
            <p className="text-neutral-600 truncate flex items-center gap-1">
              <Mail size={11} className="flex-shrink-0" />
              <span className="truncate">{row.email}</span>
            </p>
          )}
          {row.telefono && (
            <p className="text-neutral-500 flex items-center gap-1 mt-0.5">
              <Phone size={11} className="flex-shrink-0" />
              <span className="truncate">{row.telefono}</span>
            </p>
          )}
          {!row.email && !row.telefono && <span className="text-neutral-400">-</span>}
        </div>
      ),
    },
    {
      key: 'ultimaActividad',
      width: '7rem',
      header: 'Actividad',
      sortable: true,
      hiddenBelow: '2xl' as const,
      render: (row: typeof tableData[0]) => row.ultimaActividad ? (
        <span className="text-xs text-neutral-600">{formatRelativeTime(row.ultimaActividad)}</span>
      ) : (
        <span className="text-xs text-neutral-400">Sin actividad</span>
      ),
    },
    {
      key: 'estado',
      width: '6rem',
      header: 'Estado',
      sortable: true,
      render: (row: typeof tableData[0]) => (
        <Badge variant="soft" color={row.activo ? 'success' : 'warning'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      width: '10rem',
      header: '',
      align: 'right' as const,
      render: (row: typeof tableData[0]) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {isAdmin && row._raw?.usuarioId && row.activo && (
            <button
              className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
              title="Acceso Comodín — ver como este transportista"
              onClick={async (e) => {
                e.stopPropagation();
                try { await impersonateUser(row._raw.usuarioId); }
                catch (err: any) { toast.error(err?.response?.data?.message || 'No se pudo acceder como este usuario'); }
              }}
            >
              <Eye size={16} />
            </button>
          )}
          <button
            className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(mp(`/admin/actores/transportistas/${row.id}`)); }}
            title="Ver"
          >
            <Eye size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); openEditar(row); }}
            title="Editar"
          >
            <Edit size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: row.id, razonSocial: row.razonSocial }); setModalEliminar(true); }}
            title="Eliminar"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <RecordListToolbar title="Transportistas" newLabel="Nuevo transportista" onNew={() => navigate(mp('/admin/actores/transportistas/nuevo'))} exports={[
        {label: 'Descargar CSV', icon: <Download size={16} />, onClick: handleExport, disabled: isLoading || isError || !filteredData.length},
        {label: 'Descargar PDF', icon: <FileDown size={16} />, onClick: handleExportPdf, disabled: isLoading || isError || !filteredData.length},
        {label: 'Imprimir', icon: <Printer size={16} />, onClick: () => window.print(), disabled: isLoading || isError},
      ]} />

      {/* Stats */}
      <CRUDSummary stats={[
        { label: 'Total Transportistas', value: stats.total, icon: <Truck size={20} className="text-orange-600" />, iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
        { label: 'Activos · esta página', value: stats.activos, icon: <CheckCircle size={20} className="text-success-600" />, iconBg: 'bg-success-100', iconColor: 'text-success-600' },
        { label: 'Inactivos · esta página', value: stats.inactivos, icon: <AlertTriangle size={20} className="text-warning-600" />, iconBg: 'bg-warning-100', iconColor: 'text-warning-600' },
        { label: 'Vencen en 30 días · esta página', value: stats.porVencer, icon: <Clock size={20} className="text-orange-600" />, iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
      ]} />

      <RecordListFilters title="Transportistas" value={busqueda} onChange={v => { setBusqueda(v); setCurrentPage(1); }} placeholder="Razón social o CUIT" filters={[
        {key: 'estado', label: 'Estado', placeholder: 'Todos los estados', value: filtroEstado, onChange: v => { setFiltroEstado(v); setCurrentPage(1); }, options: [{value:'todos',label:'Todos los estados'},{value:'activo',label:'Activo'},{value:'inactivo',label:'Inactivo'}]},
        {key: 'localidad', label: 'Localidad', placeholder: 'Todas las localidades', value: filtroLocalidad, onChange: v => { setFiltroLocalidad(v); setCurrentPage(1); }, options: [{value:'todas',label:'Todas las localidades'},...localidadesUnicas.map(loc=>({value:loc,label:loc}))]},
      ]} />

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-primary-500" />
            <span className="ml-3 text-neutral-600">Cargando transportistas...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 text-error-600">
            <span>Error al cargar datos: {(error as Error)?.message || 'Error desconocido'}</span>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2 p-3">
              {filteredData.length === 0 ? (
                <p className="text-center text-neutral-500 py-8 text-sm">No se encontraron transportistas</p>
              ) : (
                filteredData.map(row => (
                  <button type="button" key={row.id} aria-label={`Abrir ${row.razonSocial}`} className="block w-full text-left bg-white rounded-xl border border-neutral-100 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700" onClick={() => navigate(mp(`/admin/actores/transportistas/${row.id}`))}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                          <Truck size={16} className="text-orange-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-neutral-900 truncate">{row.razonSocial}</p>
                          <p className="text-xs text-neutral-500 font-mono">{row.cuit}</p>
                        </div>
                      </div>
                      <Badge variant="soft" color={row.activo ? 'success' : 'warning'} className="shrink-0 ml-2">
                        {row.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500">
                      <span>{row.numeroHabilitacion || '—'}</span>
                      <span>{row.vehiculosCount} veh.</span>
                      <span>{row.choferesCount} chof.</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <Table
                className="[&_table]:min-w-[40rem] xl:[&_table]:min-w-[57rem] 2xl:[&_table]:min-w-[73rem]"
                data={filteredData}
                columns={columns}
                keyExtractor={(row) => row.id}
                sortable={true}
                onSort={handleSort}
                onRowClick={(row) => navigate(mp(`/admin/actores/transportistas/${row.id}`))}
                emptyMessage="No se encontraron transportistas"
                stickyHeader
                fixedLayout
              />
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={20}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

      {/* Modal crear */}
      <Modal
        isOpen={modalCrear}
        onClose={() => { setModalCrear(false); setForm(INITIAL_FORM); }}
        title="Nuevo Transportista"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalCrear(false); setForm(INITIAL_FORM); }}>Cancelar</Button>
            <Button onClick={handleCrear} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Guardando...' : 'Crear Transportista'}
            </Button>
          </>
        }
      >
        {renderForm()}
      </Modal>

      {/* Modal editar */}
      <Modal
        isOpen={modalEditar}
        onClose={() => { setModalEditar(false); setEditId(null); setForm(INITIAL_FORM); }}
        title="Editar Transportista"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalEditar(false); setEditId(null); setForm(INITIAL_FORM); }}>Cancelar</Button>
            <Button onClick={handleEditar} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </>
        }
      >
        {renderForm()}
      </Modal>

      {/* Modal eliminar */}
      <ConfirmModal
        isOpen={modalEliminar}
        onClose={() => { setModalEliminar(false); setDeleteTarget(null); }}
        onConfirm={handleEliminar}
        title="Eliminar Transportista"
        description={`¿Está seguro que desea eliminar a "${deleteTarget?.razonSocial}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default TransportistasPage;

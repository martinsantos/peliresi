/**
 * SITREP v6 - Admin Transportistas Page
 * ======================================
 * Panel administrativo para transportistas de residuos peligrosos
 * Patrón admin: Header + Stats + Filtros + Table + Pagination + Modals
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Truck,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  Phone,
  Mail,
  Edit,
  Eye,
  Trash2,
  Download,
  Loader2,
  MapPin,
  Clock,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Table, Pagination } from '../../components/ui/Table';
import { SearchInput } from '../../components/ui/SearchInput';
import { toast } from '../../components/ui/Toast';
import { downloadCsv } from '../../utils/exportCsv';
import { useAuth } from '../../contexts/AuthContext';
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
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isMobile = location.pathname.startsWith('/mobile');
  const { isAdmin, impersonateUser } = useAuth();
  const [busqueda, setBusqueda] = useState(searchParams.get('q') || '');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroLocalidad, setFiltroLocalidad] = useState('todas');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; razonSocial: string } | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  // API hooks
  const { data: apiData, isLoading, isError, error } = useTransportistas({ page: currentPage, limit: 20, search: busqueda || undefined, sortBy, sortOrder });
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
      _raw: t,
    })),
    [transportistasData]
  );

  // Localidades únicas para filtro
  const localidadesUnicas = useMemo(() => {
    const set = new Set(tableData.map(t => t.localidad).filter(Boolean));
    return Array.from(set).sort();
  }, [tableData]);

  const hoy = new Date();
  const en30dias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);

  function getVencimientoStatus(fecha: Date | null): 'vencida' | 'pronto' | 'vigente' | null {
    if (!fecha) return null;
    if (fecha < hoy) return 'vencida';
    if (fecha < en30dias) return 'pronto';
    return 'vigente';
  }

  // Client-side filters (estado + localidad); sort is server-side
  const filteredData = useMemo(() => {
    return tableData.filter((t) => {
      const matchesEstado = filtroEstado === 'todos' ||
                            (filtroEstado === 'activo' && t.activo) ||
                            (filtroEstado === 'inactivo' && !t.activo);
      const matchesLocalidad = filtroLocalidad === 'todas' || t.localidad === filtroLocalidad;
      return matchesEstado && matchesLocalidad;
    });
  }, [tableData, filtroEstado, filtroLocalidad]);

  const TRANS_COL_MAP: Record<string, string> = {
    transportista: 'razonSocial',
    localidad: 'localidad',
    flota: 'vehiculosCount',
    choferes: 'choferesCount',
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
        telefono: form.telefono,
        numeroHabilitacion: form.numeroHabilitacion,
        ...parseCoords(form.coordenadas),
      } as any);
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
        ? new Date(row.vencimientoHabilitacion).toISOString().split('T')[0]
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
      'admin-transportistas'
    );
    toast.success('Exportar', 'CSV descargado');
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Razón Social" value={form.razonSocial} onChange={(e) => updateField('razonSocial', e.target.value)} placeholder="Empresa S.A." />
        <Input label="CUIT" value={form.cuit} onChange={(e) => updateField('cuit', e.target.value)} placeholder="30-12345678-9" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Email" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="contacto@empresa.com" />
        <Input label="Teléfono" value={form.telefono} onChange={(e) => updateField('telefono', e.target.value)} placeholder="+54 261 ..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Domicilio" value={form.domicilio} onChange={(e) => updateField('domicilio', e.target.value)} placeholder="Av. Libertador 1234, Mendoza" />
        <Input label="Localidad" value={form.localidad} onChange={(e) => updateField('localidad', e.target.value)} placeholder="Godoy Cruz, Mendoza" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="N° Habilitación" value={form.numeroHabilitacion} onChange={(e) => updateField('numeroHabilitacion', e.target.value)} placeholder="HAB-TR-2024-XXXX" />
        <Input label="Vencimiento Habilitación" type="date" value={form.vencimientoHabilitacion} onChange={(e) => updateField('vencimientoHabilitacion', e.target.value)} />
      </div>
      <Input label="Coordenadas Geograficas" value={form.coordenadas} onChange={(e) => updateField('coordenadas', e.target.value)} placeholder="-32.89, -68.83" />
      {/* Datos DPA */}
      <div className="border-t border-neutral-100 pt-4 mt-2">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Datos DPA</p>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Expediente DPA" value={form.expedienteDPA} onChange={(e) => updateField('expedienteDPA', e.target.value)} placeholder="EXP-DPA-XXXX" />
          <Input label="Resolución DPA" value={form.resolucionDPA} onChange={(e) => updateField('resolucionDPA', e.target.value)} placeholder="0359/24" />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Input label="Resolución SSP" value={form.resolucionSSP} onChange={(e) => updateField('resolucionSSP', e.target.value)} placeholder="SSP-XXXX" />
          <Input label="Corrientes Autorizadas" value={form.corrientesAutorizadas} onChange={(e) => updateField('corrientesAutorizadas', e.target.value)} placeholder="Y4, Y8, Y9" />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Input label="Acta Inspección" value={form.actaInspeccion} onChange={(e) => updateField('actaInspeccion', e.target.value)} placeholder="rp-g000040" />
          <Input label="Acta Inspección 2" value={form.actaInspeccion2} onChange={(e) => updateField('actaInspeccion2', e.target.value)} placeholder="" />
        </div>
      </div>
      {!editId && (
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre Responsable" value={form.nombre} onChange={(e) => updateField('nombre', e.target.value)} placeholder="Juan Perez" />
          <Input label="Password inicial" type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Min. 8 caracteres" />
        </div>
      )}
    </div>
  );

  const columns = [
    {
      key: 'transportista',
      width: '24%',
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
      width: '14%',
      header: 'Habilitación',
      hiddenBelow: 'md' as const,
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
      width: '12%',
      header: 'Localidad',
      sortable: true,
      hiddenBelow: 'lg' as const,
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
      width: '7%',
      header: 'Vehículos',
      sortable: true,
      hiddenBelow: 'md' as const,
      render: (row: typeof tableData[0]) => (
        <div className="text-center">
          <p className="text-sm font-bold text-neutral-900">{row.vehiculosCount}</p>
          <p className="text-[10px] text-neutral-500">Vehículos</p>
        </div>
      ),
    },
    {
      key: 'choferes',
      width: '7%',
      header: 'Choferes',
      sortable: true,
      hiddenBelow: 'md' as const,
      render: (row: typeof tableData[0]) => (
        <div className="text-center">
          <p className="text-sm font-bold text-neutral-900">{row.choferesCount}</p>
          <p className="text-[10px] text-neutral-500">Choferes</p>
        </div>
      ),
    },
    {
      key: 'contacto',
      width: '18%',
      header: 'Contacto',
      hiddenBelow: 'lg' as const,
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
      key: 'estado',
      width: '8%',
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
      width: '10%',
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
            onClick={(e) => { e.stopPropagation(); navigate(isMobile ? `/mobile/actores/transportistas/${row.id}` : `/admin/actores/transportistas/${row.id}`); }}
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 rounded-xl">
            <Truck size={24} className="text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Admin Transportistas</h2>
            <p className="text-neutral-600">Panel de gestión de transportistas de residuos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={18} />} onClick={handleExport}>
            Exportar
          </Button>
          <Button leftIcon={<Plus size={18} />} onClick={() => { setForm(INITIAL_FORM); setModalCrear(true); }}>
            Nuevo Transportista
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Truck size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
                <p className="text-sm text-neutral-600">Total Transportistas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-100 rounded-lg">
                <CheckCircle size={20} className="text-success-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.activos}</p>
                <p className="text-sm text-neutral-600">Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning-100 rounded-lg">
                <AlertTriangle size={20} className="text-warning-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.inactivos}</p>
                <p className="text-sm text-neutral-600">Inactivos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.porVencer}</p>
                <p className="text-sm text-neutral-600">Vencen en 30 días</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={busqueda}
                onChange={(v) => { setBusqueda(v); setCurrentPage(1); }}
                placeholder="Buscar por razón social, CUIT o habilitación..."
                size="md"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filtroEstado}
                onChange={(e) => { setFiltroEstado(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
              <select
                value={filtroLocalidad}
                onChange={(e) => { setFiltroLocalidad(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="todas">Todas las localidades</option>
                {localidadesUnicas.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <Table
              data={filteredData}
              columns={columns}
              keyExtractor={(row) => row.id}
              sortable={true}
              onSort={handleSort}
              onRowClick={(row) => navigate(isMobile ? `/mobile/actores/transportistas/${row.id}` : `/admin/actores/transportistas/${row.id}`)}
              emptyMessage="No se encontraron transportistas"
              stickyHeader
              fixedLayout
            />
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

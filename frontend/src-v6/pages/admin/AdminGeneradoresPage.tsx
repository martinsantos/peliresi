/**
 * SITREP v6 - Admin Generadores Page
 * ==================================
 * Panel administrativo para generadores de residuos
 * Integra datos de la API + enriquecimiento JSON (certificado, rubro, actividad, categorías Y)
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Factory,
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
import {
  useGeneradores,
  useCreateGenerador,
  useUpdateGenerador,
  useDeleteGenerador,
} from '../../hooks/useActores';
import { GENERADORES_DATA, TOP_RUBROS, type GeneradorEnriched } from '../../data/generadores-enrichment';
import { CORRIENTES_Y } from '../../data/corrientes-y';

const INITIAL_FORM = {
  razonSocial: '',
  cuit: '',
  domicilio: '',
  telefono: '',
  email: '',
  password: '',
  nombre: '',
  numeroInscripcion: '',
  categoria: '',
};

const AdminGeneradoresPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroRubro, setFiltroRubro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; razonSocial: string } | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  // API hooks
  const { data: apiData, isLoading, isError, error } = useGeneradores({ page: currentPage, limit: 20, search: busqueda || undefined });
  const createMutation = useCreateGenerador();
  const updateMutation = useUpdateGenerador();
  const deleteMutation = useDeleteGenerador();

  const generadoresData = Array.isArray(apiData?.items) ? apiData.items : [];
  const total = apiData?.total || generadoresData.length;
  const totalPages = apiData?.totalPages || 1;

  // Map to display format + merge JSON enrichment
  const tableData = useMemo(() =>
    generadoresData.map((g: any) => {
      const enriched: GeneradorEnriched | null = GENERADORES_DATA[g.cuit] || null;

      return {
        id: g.id,
        razonSocial: g.razonSocial || '',
        cuit: g.cuit || '',
        categoria: g.categoria || '-',
        domicilio: g.domicilio || '',
        telefono: g.telefono || '',
        email: g.email || g.usuario?.email || '',
        numeroInscripcion: g.numeroInscripcion || '-',
        activo: g.activo !== false,
        createdAt: g.createdAt,
        _raw: g,
        // JSON enrichment
        certificado: enriched?.certificado || null,
        rubro: enriched?.rubro || null,
        actividad: enriched?.actividad || null,
        categoriasControl: enriched?.categoriasControl || [],
        emailOriginal: enriched?.emailOriginal || null,
        emailGenerado: enriched?.emailGenerado || false,
      };
    }),
    [generadoresData]
  );

  // Client-side filters
  const filteredData = tableData.filter((g) => {
    if (filtroRubro && g.rubro !== filtroRubro) return false;
    const matchesCategoria = !filtroCategoria || g.categoria.toLowerCase().includes(filtroCategoria.toLowerCase());
    const matchesEstado = filtroEstado === 'todos' ||
                          (filtroEstado === 'activo' && g.activo) ||
                          (filtroEstado === 'inactivo' && !g.activo);
    return matchesCategoria && matchesEstado;
  });

  const stats = {
    total,
    activos: generadoresData.filter((g: any) => g.activo !== false).length,
    inactivos: generadoresData.filter((g: any) => g.activo === false).length,
    filtrados: filteredData.length,
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleCrear = async () => {
    try {
      await createMutation.mutateAsync({
        email: form.email,
        password: form.password || 'TempPass123!',
        nombre: form.nombre || form.razonSocial,
        razonSocial: form.razonSocial,
        cuit: form.cuit,
        domicilio: form.domicilio,
        telefono: form.telefono,
        numeroInscripcion: form.numeroInscripcion,
        categoria: form.categoria,
      });
      setModalCrear(false);
      setForm(INITIAL_FORM);
    } catch (err) {
      // Error handled by React Query
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
          telefono: form.telefono,
          email: form.email,
          numeroInscripcion: form.numeroInscripcion,
          categoria: form.categoria,
        },
      });
      setModalEditar(false);
      setEditId(null);
      setForm(INITIAL_FORM);
    } catch (err) {
      // Error handled by React Query
    }
  };

  const openEditar = (generador: any) => {
    setEditId(generador.id);
    setForm({
      razonSocial: generador.razonSocial || '',
      cuit: generador.cuit || '',
      domicilio: generador.domicilio || '',
      telefono: generador.telefono || '',
      email: generador.email || '',
      password: '',
      nombre: '',
      numeroInscripcion: generador.numeroInscripcion || '',
      categoria: generador.categoria || '',
    });
    setModalEditar(true);
  };

  const handleEliminar = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setModalEliminar(false);
      setDeleteTarget(null);
    } catch (err) {
      // Error handled by React Query
    }
  };

  const handleExport = () => {
    downloadCsv(
      filteredData.map(g => ({
        'Razón Social': g.razonSocial,
        CUIT: g.cuit,
        Certificado: g.certificado || '',
        Categoría: g.categoria,
        Rubro: g.rubro || '',
        Actividad: g.actividad || '',
        'Categorías Y': g.categoriasControl.join(', '),
        'Email (original)': g.emailOriginal || '',
        Email: g.email,
        Teléfono: g.telefono,
        Domicilio: g.domicilio,
        Inscripción: g.numeroInscripcion,
        Estado: g.activo ? 'Activo' : 'Inactivo',
        Alta: g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '',
      })),
      'admin-generadores'
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
      <Input label="Domicilio" value={form.domicilio} onChange={(e) => updateField('domicilio', e.target.value)} placeholder="Av. San Martin 1234, Mendoza" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="N° Inscripción" value={form.numeroInscripcion} onChange={(e) => updateField('numeroInscripcion', e.target.value)} placeholder="G-000XXX" />
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Categoría</label>
          <select
            value={form.categoria}
            onChange={(e) => updateField('categoria', e.target.value)}
            className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm"
          >
            <option value="">Seleccionar...</option>
            <option value="Grandes Generadores">Grandes Generadores</option>
            <option value="Medianos Generadores">Medianos Generadores</option>
            <option value="Pequeños Generadores">Pequeños Generadores</option>
          </select>
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
      key: 'generador',
      width: '24%',
      header: 'Generador',
      render: (row: typeof tableData[0]) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Factory size={20} className="text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-neutral-900 truncate">{row.razonSocial}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-neutral-500 font-mono">{row.cuit}</span>
              {row.certificado && (
                <span className="text-[10px] font-mono text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">{row.certificado}</span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'rubro',
      width: '14%',
      header: 'Rubro',
      hiddenBelow: 'md' as const,
      render: (row: typeof tableData[0]) => row.rubro ? (
        <span className="text-xs text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-full truncate inline-block max-w-[160px]" title={row.rubro}>
          {row.rubro}
        </span>
      ) : (
        <span className="text-xs text-neutral-400">{row.categoria !== '-' ? row.categoria : '-'}</span>
      ),
    },
    {
      key: 'actividad',
      width: '14%',
      header: 'Actividad',
      hiddenBelow: 'lg' as const,
      render: (row: typeof tableData[0]) => row.actividad ? (
        <p className="text-xs text-neutral-600 line-clamp-2" title={row.actividad}>
          {row.actividad}
        </p>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'categoriasY',
      width: '14%',
      header: 'Categorías Y',
      hiddenBelow: 'lg' as const,
      render: (row: typeof tableData[0]) => row.categoriasControl.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {row.categoriasControl.slice(0, 3).map((code: string) => (
            <Badge key={code} variant="outline" color="warning" className="text-xs" title={CORRIENTES_Y[code] || code}>
              {code}
            </Badge>
          ))}
          {row.categoriasControl.length > 3 && (
            <Badge variant="soft" color="neutral" className="text-xs" title={row.categoriasControl.join(', ')}>
              +{row.categoriasControl.length - 3}
            </Badge>
          )}
        </div>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'contacto',
      width: '14%',
      header: 'Contacto',
      hiddenBelow: 'lg' as const,
      render: (row: typeof tableData[0]) => {
        const mail = row.emailOriginal || row.email;
        return (
          <div className="text-xs min-w-0">
            {mail && (
              <p className="text-neutral-600 truncate flex items-center gap-1">
                <Mail size={11} className="flex-shrink-0" />
                <span className="truncate">{mail.split(',')[0].trim()}</span>
              </p>
            )}
            {row.telefono && (
              <p className="text-neutral-500 flex items-center gap-1 mt-0.5">
                <Phone size={11} className="flex-shrink-0" />
                <span className="truncate">{row.telefono}</span>
              </p>
            )}
            {!mail && !row.telefono && <span className="text-neutral-400">-</span>}
          </div>
        );
      },
    },
    {
      key: 'estado',
      width: '8%',
      header: 'Estado',
      render: (row: typeof tableData[0]) => (
        <Badge variant="soft" color={row.activo ? 'success' : 'warning'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      width: '8%',
      header: '',
      align: 'right' as const,
      render: (row: typeof tableData[0]) => (
        <div className="flex items-center justify-end gap-1">
          <button
            className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(isMobile ? `/mobile/admin/actores/generadores/${row.id}` : `/admin/actores/generadores/${row.id}`); }}
            title="Ver"
          >
            <Eye size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); openEditar(row._raw); }}
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
          <div className="p-3 bg-purple-100 rounded-xl">
            <Factory size={24} className="text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Admin Generadores</h2>
            <p className="text-neutral-600">Panel de gestión de generadores de residuos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={18} />} onClick={handleExport}>
            Exportar
          </Button>
          <Button leftIcon={<Plus size={18} />} onClick={() => { setForm(INITIAL_FORM); setModalCrear(true); }}>
            Nuevo Generador
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Factory size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
                <p className="text-sm text-neutral-600">Total Generadores</p>
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
              <div className="p-2 bg-info-100 rounded-lg">
                <Search size={20} className="text-info-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.filtrados}</p>
                <p className="text-sm text-neutral-600">Filtrados</p>
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
                placeholder="Buscar por razón social, CUIT o domicilio..."
                size="md"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filtroRubro}
                onChange={(e) => { setFiltroRubro(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Todos los rubros</option>
                {TOP_RUBROS.map(r => (
                  <option key={r} value={r}>{r.length > 35 ? r.substring(0, 33) + '...' : r}</option>
                ))}
              </select>
              <select
                value={filtroCategoria}
                onChange={(e) => { setFiltroCategoria(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Todas las categorías</option>
                <option value="Grandes">Grandes Generadores</option>
                <option value="Medianos">Medianos Generadores</option>
                <option value="Pequeños">Pequeños Generadores</option>
              </select>
              <select
                value={filtroEstado}
                onChange={(e) => { setFiltroEstado(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
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
            <span className="ml-3 text-neutral-600">Cargando generadores...</span>
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
              onRowClick={(row) => navigate(isMobile ? `/mobile/admin/actores/generadores/${row.id}` : `/admin/actores/generadores/${row.id}`)}
              emptyMessage="No se encontraron generadores"
              stickyHeader
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
        title="Nuevo Generador"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalCrear(false); setForm(INITIAL_FORM); }}>Cancelar</Button>
            <Button onClick={handleCrear} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Guardando...' : 'Crear Generador'}
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
        title="Editar Generador"
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
        title="Eliminar Generador"
        description={`¿Está seguro que desea eliminar a "${deleteTarget?.razonSocial}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default AdminGeneradoresPage;

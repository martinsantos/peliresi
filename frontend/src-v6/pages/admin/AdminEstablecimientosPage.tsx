/**
 * SITREP v6 - Admin Establecimientos Page
 * ========================================
 * Gestión de establecimientos/generadores
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Phone,
  Mail,
  Users,
  FileText,
  MoreVertical,
  Filter,
  Download,
  Edit,
  Trash2,
  Eye,
  Loader2
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Table, Pagination } from '../../components/ui/Table';
import { SearchInput } from '../../components/ui/SearchInput';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { useGeneradores, useCreateGenerador, useDeleteGenerador } from '../../hooks/useActores';

const tipoEstablecimiento = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinica', label: 'Clínica Privada' },
  { value: 'laboratorio', label: 'Laboratorio' },
  { value: 'centro_medico', label: 'Centro Médico' },
  { value: 'farmacia', label: 'Farmacia' },
  { value: 'otro', label: 'Otro' },
];

export const AdminEstablecimientosPage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = typeof window !== 'undefined' && window.location.pathname.includes('/mobile');

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  // CRUD state
  const [modalEditar, setModalEditar] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nombre: string } | null>(null);
  const [form, setForm] = useState({
    razonSocial: '',
    cuit: '',
    domicilio: '',
    telefono: '',
    email: '',
    password: '',
    nombre: '',
    categoria: '',
    numeroInscripcion: '',
  });

  const { data: paginatedData, isLoading, isError, error } = useGeneradores({ page: currentPage, limit: 20 });
  const createMutation = useCreateGenerador();
  const deleteMutation = useDeleteGenerador();

  const items = Array.isArray(paginatedData?.items) ? paginatedData.items : [];
  const total = paginatedData?.total || 0;
  const totalPages = paginatedData?.totalPages || 1;

  // Map API data to display format
  const establecimientosData = useMemo(() =>
    (Array.isArray(items) ? items : []).map(g => ({
      id: g.id,
      nombre: g.razonSocial,
      tipo: g.categoria || 'Generador',
      cuit: g.cuit,
      contacto: g.usuario?.nombre || g.email || '',
      telefono: g.telefono || '',
      direccion: g.domicilio || '',
      estado: g.activo ? 'activo' : 'inactivo',
    })),
    [items]
  );

  // Computed stats
  const statsTotal = total || items.length;
  const statsActivos = items.filter(g => g.activo).length;
  const statsInactivos = items.filter(g => !g.activo).length;

  const filteredData = establecimientosData.filter(est => {
    const matchesSearch = String(est.nombre || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         String(est.cuit || '').includes(searchQuery) ||
                         String(est.direccion || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEstado = filtroEstado === 'todos' || est.estado === filtroEstado;
    return matchesSearch && matchesEstado;
  });

  // Helpers
  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const resetForm = () => setForm({ razonSocial: '', cuit: '', domicilio: '', telefono: '', email: '', password: '', nombre: '', categoria: '', numeroInscripcion: '' });

  // Handlers
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
        categoria: form.categoria,
        numeroInscripcion: form.numeroInscripcion,
      });
      setIsModalOpen(false);
      resetForm();
    } catch {
      // Error handled by React Query
    }
  };

  const handleEliminar = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setModalEliminar(false);
      setDeleteTarget(null);
    } catch {
      // Error handled by React Query
    }
  };

  const columns = [
    {
      key: 'nombre',
      width: '30%',
      header: 'Establecimiento',
      render: (row: typeof establecimientosData[0]) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <Building2 size={20} className="text-primary-600" />
          </div>
          <div>
            <p className="font-medium text-neutral-900">{row.nombre}</p>
            <p className="text-xs text-neutral-500">{row.tipo}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'cuit',
      width: '15%',
      header: 'CUIT',
      render: (row: typeof establecimientosData[0]) => (
        <span className="font-mono text-sm text-neutral-600">{row.cuit}</span>
      ),
    },
    {
      key: 'contacto',
      width: '20%',
      hiddenBelow: 'md' as const,
      header: 'Contacto',
      render: (row: typeof establecimientosData[0]) => (
        <div className="text-sm">
          <p className="text-neutral-900">{row.contacto}</p>
          <p className="text-neutral-500 flex items-center gap-1">
            <Phone size={12} />
            {row.telefono}
          </p>
        </div>
      ),
    },
    {
      key: 'ubicacion',
      width: '15%',
      hiddenBelow: 'md' as const,
      header: 'Ubicación',
      render: (row: typeof establecimientosData[0]) => (
        <div className="flex items-center gap-1 text-sm text-neutral-600">
          <MapPin size={14} />
          <span className="truncate max-w-[150px]">{row.direccion}</span>
        </div>
      ),
    },
    {
      key: 'estado',
      width: '10%',
      header: 'Estado',
      render: (row: typeof establecimientosData[0]) => {
        const estadoConfig: Record<string, { label: string; color: string }> = {
          activo: { label: 'Activo', color: 'success' },
          inactivo: { label: 'Inactivo', color: 'neutral' },
          pendiente: { label: 'Pendiente', color: 'warning' },
        };
        const config = estadoConfig[row.estado] || estadoConfig.inactivo;
        return <Badge variant="soft" color={config.color as any}>{config.label}</Badge>;
      },
    },
    {
      key: 'acciones',
      width: '10%',
      header: '',
      align: 'right' as const,
      render: (row: typeof establecimientosData[0]) => (
        <div className="flex items-center justify-end gap-1">
          <button
            className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(isMobile ? '/mobile/admin/generadores/' + row.id : '/admin/generadores/' + row.id); }}
          >
            <Eye size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(isMobile ? '/mobile/admin/generadores/' + row.id : '/admin/generadores/' + row.id); }}
          >
            <Edit size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: row.id, nombre: row.nombre }); setModalEliminar(true); }}
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
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Establecimientos</h2>
          <p className="text-neutral-600 mt-1">
            Gestión de establecimientos generadores de residuos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={18} />} disabled title="Próximamente">
            Exportar
          </Button>
          <Button leftIcon={<Plus size={18} />} onClick={() => setIsModalOpen(true)}>
            Nuevo Establecimiento
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Building2 size={20} className="text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{statsTotal}</p>
                <p className="text-sm text-neutral-600">Total Establecimientos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-100 rounded-lg">
                <Users size={20} className="text-success-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{statsActivos}</p>
                <p className="text-sm text-neutral-600">Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning-100 rounded-lg">
                <FileText size={20} className="text-warning-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{statsInactivos}</p>
                <p className="text-sm text-neutral-600">Inactivos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-100 rounded-lg">
                <MapPin size={20} className="text-info-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">
                  {new Set(items.map(g => {
                    const domicilio = String(g.domicilio || '');
                    const parts = domicilio.split(',');
                    return parts.length > 0 ? String(parts[parts.length - 1] || '').trim() : '';
                  }).filter(Boolean)).size}
                </p>
                <p className="text-sm text-neutral-600">Departamentos</p>
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
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Buscar por nombre, CUIT o dirección..."
                size="md"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="pendiente">Pendiente</option>
                <option value="inactivo">Inactivo</option>
              </select>
              <Button variant="outline" leftIcon={<Filter size={18} />} disabled title="Próximamente">
                Más filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-primary-500" />
            <span className="ml-3 text-neutral-600">Cargando establecimientos...</span>
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
              selectable
              selectedKeys={selectedRows}
              onSelectionChange={setSelectedRows}
              onRowClick={(row) => navigate(isMobile ? '/mobile/admin/generadores/' + row.id : '/admin/generadores/' + row.id)}
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

      {/* Modal Nuevo Establecimiento */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title="Nuevo Establecimiento"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCrear} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Guardando...' : 'Crear Establecimiento'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Nombre del Establecimiento *
              </label>
              <input
                type="text"
                className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none"
                placeholder="Ej: Hospital Central"
                value={form.razonSocial}
                onChange={(e) => updateField('razonSocial', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Tipo *
              </label>
              <select
                className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none"
                value={form.categoria}
                onChange={(e) => updateField('categoria', e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {tipoEstablecimiento.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                CUIT *
              </label>
              <input
                type="text"
                className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none"
                placeholder="30-12345678-9"
                value={form.cuit}
                onChange={(e) => updateField('cuit', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Nombre Contacto
              </label>
              <input
                type="text"
                className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none"
                placeholder="Nombre del contacto"
                value={form.nombre}
                onChange={(e) => updateField('nombre', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Dirección *
            </label>
            <input
              type="text"
              className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none"
              placeholder="Calle, número, localidad, departamento"
              value={form.domicilio}
              onChange={(e) => updateField('domicilio', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none"
                placeholder="261-1234567"
                value={form.telefono}
                onChange={(e) => updateField('telefono', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none"
                placeholder="contacto@ejemplo.com"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <ConfirmModal
        isOpen={modalEliminar}
        onClose={() => { setModalEliminar(false); setDeleteTarget(null); }}
        onConfirm={handleEliminar}
        title="Eliminar Establecimiento"
        description={`¿Está seguro que desea eliminar "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default AdminEstablecimientosPage;

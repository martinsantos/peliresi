/**
 * SITREP v6 - Admin Residuos Page
 * ================================
 * Catálogo de residuos con CRUD completo y enriquecimiento de corrientes Y y operadores
 */

import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  AlertTriangle,
  Leaf,
  Beaker,
  Download,
  Loader2,
  Flame,
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Table, Pagination } from '../../components/ui/Table';
import { SearchInput } from '../../components/ui/SearchInput';
import { useTiposResiduo, useCreateTipoResiduo, useUpdateTipoResiduo, useDeleteTipoResiduo } from '../../hooks/useCatalogos';
import { toast } from '../../components/ui/Toast';
import { downloadCsv } from '../../utils/exportCsv';
import { CORRIENTES_Y, CORRIENTES_Y_CODES } from '../../data/corrientes-y';
import { useOperadoresEnrichment } from '../../hooks/useEnrichment';

interface ResiduoDisplay {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  caracteristicas: string;
  tipo: string;
  peligrosidad: string;
  activo: boolean;
  corrienteY: string | null;
  corrienteDesc: string | null;
  operadoresCount: number;
  tecnologias: string[];
}

const INITIAL_FORM = {
  codigo: '',
  nombre: '',
  descripcion: '',
  categoria: '',
  caracteristicas: '',
  peligrosidad: 'ninguna',
};

export const AdminResiduosPage: React.FC = () => {
  const { data: enrichmentData } = useOperadoresEnrichment();
  const OPERADORES_DATA = enrichmentData?.operadores || {};
  const OPERADORES_POR_CORRIENTE = enrichmentData?.porCorriente || {};

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [corrienteFilter, setCorrienteFilter] = useState('');
  const [peligrosidadFilter, setPeligrosidadFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // CRUD modal state
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; codigo: string } | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  // API hooks
  const { data: tiposResiduoRaw, isLoading, isError, error } = useTiposResiduo();
  const tiposResiduo = tiposResiduoRaw || [];
  const createMutation = useCreateTipoResiduo();
  const updateMutation = useUpdateTipoResiduo();
  const deleteMutation = useDeleteTipoResiduo();

  // Map API data + enrich with corrientes Y and operadores
  const residuosData: ResiduoDisplay[] = useMemo(() =>
    tiposResiduo.map(r => {
      const cat = r.categoria || '';
      const yMatch = cat.match(/Y\d+/);
      const corrienteY = yMatch ? yMatch[0] : null;
      const corrienteDesc = corrienteY ? CORRIENTES_Y[corrienteY] || null : null;

      const operadoresCuits = corrienteY ? (OPERADORES_POR_CORRIENTE[corrienteY] || []) : [];
      const operadoresCount = operadoresCuits.length;

      const tecnologias: string[] = [];
      const tecSet = new Set<string>();
      for (const cuit of operadoresCuits.slice(0, 10)) {
        const op = OPERADORES_DATA[cuit];
        if (op?.tecnologia) {
          const parts = op.tecnologia.split(/,\s*(?=[A-Z])/).map(t => t.trim());
          for (const p of parts) {
            const clean = p.replace(/:\s*Y\d+[^,]*/g, '').trim();
            if (clean.length > 5 && !tecSet.has(clean)) {
              tecSet.add(clean);
              tecnologias.push(clean);
            }
          }
        }
      }

      return {
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        descripcion: r.descripcion || r.nombre,
        categoria: r.categoria || 'Sin categoría',
        caracteristicas: r.caracteristicas || '',
        tipo: r.peligrosidad === 'alta' || r.peligrosidad === 'media' ? 'Peligroso' : 'No Peligroso',
        peligrosidad: r.peligrosidad || 'ninguna',
        activo: r.activo,
        corrienteY,
        corrienteDesc,
        operadoresCount,
        tecnologias: tecnologias.slice(0, 5),
      };
    }),
    [tiposResiduo]
  );

  // Stats
  const statsPeligrosos = residuosData.filter(r => r.tipo === 'Peligroso').length;
  const statsNoPeligrosos = residuosData.filter(r => r.tipo === 'No Peligroso').length;
  const statsTotal = residuosData.length;
  const corrientesActivas = useMemo(() => {
    const codes = new Set(residuosData.map(r => r.corrienteY).filter(Boolean));
    return codes.size;
  }, [residuosData]);

  // Filter + sort
  const filteredData = useMemo(() => {
    let result = residuosData.filter(r => {
      if (corrienteFilter && r.corrienteY !== corrienteFilter) return false;
      if (peligrosidadFilter && r.peligrosidad !== peligrosidadFilter) return false;
      if (estadoFilter === 'activo' && !r.activo) return false;
      if (estadoFilter === 'inactivo' && r.activo) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.codigo.toLowerCase().includes(q) ||
        r.descripcion.toLowerCase().includes(q) ||
        r.categoria.toLowerCase().includes(q) ||
        (r.corrienteY || '').toLowerCase().includes(q)
      );
    });
    if (sortConfig) {
      const PELIGROSIDAD_ORDER: Record<string, number> = { alta: 3, media: 2, baja: 1, ninguna: 0 };
      result = [...result].sort((a, b) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        switch (sortConfig.key) {
          case 'residuo': return dir * a.codigo.localeCompare(b.codigo, 'es');
          case 'corrienteY': return dir * (a.corrienteY || '').localeCompare(b.corrienteY || '', 'es');
          case 'peligrosidad': return dir * ((PELIGROSIDAD_ORDER[a.peligrosidad] || 0) - (PELIGROSIDAD_ORDER[b.peligrosidad] || 0));
          case 'operadores': return dir * (a.operadoresCount - b.operadoresCount);
          case 'estado': return dir * (Number(b.activo) - Number(a.activo));
          default: return 0;
        }
      });
    }
    return result;
  }, [residuosData, corrienteFilter, peligrosidadFilter, estadoFilter, searchQuery, sortConfig]);

  // Pagination
  const itemsPerPage = 15;
  const totalFilteredPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Form helpers
  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleCrear = async () => {
    if (!form.codigo || !form.nombre || !form.categoria || !form.peligrosidad) {
      toast.error('Campos requeridos', 'Código, nombre, categoría y peligrosidad son obligatorios');
      return;
    }
    try {
      await createMutation.mutateAsync({
        codigo: form.codigo,
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        categoria: form.categoria,
        caracteristicas: form.caracteristicas || null,
        peligrosidad: form.peligrosidad,
      });
      toast.success('Creado', `Tipo de residuo ${form.codigo} creado`);
      setModalCrear(false);
      setForm(INITIAL_FORM);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo crear el tipo de residuo');
    }
  };

  const openEditar = (r: ResiduoDisplay) => {
    setEditId(r.id);
    setForm({
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion || '',
      categoria: r.categoria,
      caracteristicas: r.caracteristicas || '',
      peligrosidad: r.peligrosidad,
    });
    setModalEditar(true);
  };

  const handleEditar = async () => {
    if (!editId) return;
    try {
      await updateMutation.mutateAsync({
        id: editId,
        data: {
          codigo: form.codigo,
          nombre: form.nombre,
          descripcion: form.descripcion || null,
          categoria: form.categoria,
          caracteristicas: form.caracteristicas || null,
          peligrosidad: form.peligrosidad,
        },
      });
      toast.success('Actualizado', `Tipo de residuo ${form.codigo} actualizado`);
      setModalEditar(false);
      setEditId(null);
      setForm(INITIAL_FORM);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo actualizar');
    }
  };

  const handleEliminar = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Eliminado', `Tipo de residuo ${deleteTarget.codigo} eliminado`);
      setModalEliminar(false);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo eliminar');
    }
  };

  const handleExport = () => {
    downloadCsv(
      filteredData.map(r => ({
        Código: r.codigo,
        Nombre: r.nombre,
        Descripción: r.descripcion,
        Categoría: r.categoria,
        'Corriente Y': r.corrienteY || '',
        'Desc. Corriente': r.corrienteDesc || '',
        Tipo: r.tipo,
        Peligrosidad: r.peligrosidad,
        'Operadores Autorizados': r.operadoresCount,
        Tecnologías: r.tecnologias.join('; '),
        Estado: r.activo ? 'Activo' : 'Inactivo',
      })),
      'catalogo-residuos'
    );
    toast.success('Exportar', 'CSV descargado');
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Código *" value={form.codigo} onChange={(e) => updateField('codigo', e.target.value)} placeholder="Y1-001" />
        <Input label="Nombre *" value={form.nombre} onChange={(e) => updateField('nombre', e.target.value)} placeholder="Desechos clínicos" />
      </div>
      <Input label="Descripción" value={form.descripcion} onChange={(e) => updateField('descripcion', e.target.value)} placeholder="Descripción del tipo de residuo" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Categoría *" value={form.categoria} onChange={(e) => updateField('categoria', e.target.value)} placeholder="Y1 - Desechos clínicos" />
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Peligrosidad *</label>
          <select
            value={form.peligrosidad}
            onChange={(e) => updateField('peligrosidad', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
            <option value="ninguna">Ninguna</option>
          </select>
        </div>
      </div>
      <Input label="Características" value={form.caracteristicas} onChange={(e) => updateField('caracteristicas', e.target.value)} placeholder="Inflamable, tóxico, corrosivo..." />
    </div>
  );

  const columns = [
    {
      key: 'residuo',
      width: '28%',
      header: 'Residuo',
      sortable: true,
      render: (row: ResiduoDisplay) => (
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            row.peligrosidad === 'alta' ? 'bg-error-100' :
            row.peligrosidad === 'media' ? 'bg-warning-100' :
            'bg-success-100'
          }`}>
            {row.peligrosidad === 'alta' ? (
              <AlertTriangle size={20} className="text-error-600" />
            ) : row.peligrosidad === 'media' ? (
              <Beaker size={20} className="text-warning-600" />
            ) : (
              <Leaf size={20} className="text-success-600" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-neutral-900">{row.codigo}</p>
            <p className="text-xs text-neutral-500 line-clamp-1 max-w-[220px]" title={row.descripcion}>{row.descripcion}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'corrienteY',
      width: '8%',
      header: 'Corriente Y',
      sortable: true,
      hiddenBelow: 'md' as const,
      render: (row: ResiduoDisplay) => row.corrienteY ? (
        <Badge variant="outline" color="warning" title={row.corrienteDesc || ''}>
          {row.corrienteY}
        </Badge>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'peligrosidad',
      width: '10%',
      header: 'Peligrosidad',
      sortable: true,
      render: (row: ResiduoDisplay) => {
        const colors: Record<string, string> = {
          alta: 'error',
          media: 'warning',
          baja: 'info',
          ninguna: 'success',
        };
        return (
          <Badge variant="soft" color={colors[row.peligrosidad]}>
            {row.peligrosidad.charAt(0).toUpperCase() + row.peligrosidad.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: 'operadores',
      width: '12%',
      header: 'Operadores',
      sortable: true,
      hiddenBelow: 'lg' as const,
      render: (row: ResiduoDisplay) => row.operadoresCount > 0 ? (
        <div className="flex items-center gap-1.5">
          <FlaskConical size={14} className="text-blue-500" />
          <span className="text-sm font-medium text-neutral-700">{row.operadoresCount}</span>
          <span className="text-xs text-neutral-400">autorizados</span>
        </div>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'estado',
      width: '8%',
      header: 'Estado',
      sortable: true,
      render: (row: ResiduoDisplay) => (
        <Badge variant="soft" color={row.activo ? 'success' : 'neutral'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      width: '10%',
      header: 'Acciones',
      render: (row: ResiduoDisplay) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEditar(row)}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-primary-600 transition-colors"
            title="Editar"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => { setDeleteTarget({ id: row.id, codigo: row.codigo }); setModalEliminar(true); }}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-error-600 transition-colors"
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
          <div className="p-3 bg-primary-100 rounded-xl">
            <FlaskConical size={24} className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Catálogo de Residuos</h2>
            <p className="text-neutral-600">Tipos de residuos, corrientes Y y operadores autorizados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={18} />} onClick={handleExport}>
            Exportar
          </Button>
          <Button leftIcon={<Plus size={18} />} onClick={() => { setForm(INITIAL_FORM); setModalCrear(true); }}>
            Nuevo Tipo
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-100 rounded-lg">
                <FlaskConical size={20} className="text-info-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{statsTotal}</p>
                <p className="text-sm text-neutral-600">Total Tipos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-error-100 rounded-lg">
                <AlertTriangle size={20} className="text-error-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{statsPeligrosos}</p>
                <p className="text-sm text-neutral-600">Peligrosos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-100 rounded-lg">
                <Leaf size={20} className="text-success-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{statsNoPeligrosos}</p>
                <p className="text-sm text-neutral-600">No Peligrosos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning-100 rounded-lg">
                <Flame size={20} className="text-warning-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{corrientesActivas}</p>
                <p className="text-sm text-neutral-600">Corrientes Y activas</p>
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
                onChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
                placeholder="Buscar por código, descripción o corriente Y..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={corrienteFilter}
                onChange={(e) => { setCorrienteFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Todas las corrientes</option>
                {CORRIENTES_Y_CODES.map(code => (
                  <option key={code} value={code}>{code} — {CORRIENTES_Y[code].substring(0, 40)}</option>
                ))}
              </select>
              <select
                value={peligrosidadFilter}
                onChange={(e) => { setPeligrosidadFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Todas las peligrosidades</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
                <option value="ninguna">Ninguna</option>
              </select>
              <select
                value={estadoFilter}
                onChange={(e) => { setEstadoFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>
          {(corrienteFilter || peligrosidadFilter || estadoFilter) && (
            <div className="flex items-center gap-2 mt-3 p-2 bg-primary-50 rounded-lg">
              <span className="text-sm text-primary-700">Filtros:</span>
              {corrienteFilter && (
                <Badge variant="solid" color="primary">
                  {corrienteFilter}
                  <button className="ml-1.5" onClick={() => { setCorrienteFilter(''); setCurrentPage(1); }}>&times;</button>
                </Badge>
              )}
              {peligrosidadFilter && (
                <Badge variant="solid" color="primary">
                  {peligrosidadFilter}
                  <button className="ml-1.5" onClick={() => { setPeligrosidadFilter(''); setCurrentPage(1); }}>&times;</button>
                </Badge>
              )}
              {estadoFilter && (
                <Badge variant="solid" color="primary">
                  {estadoFilter}
                  <button className="ml-1.5" onClick={() => { setEstadoFilter(''); setCurrentPage(1); }}>&times;</button>
                </Badge>
              )}
              <button
                className="ml-auto text-sm text-primary-600 hover:text-primary-800 font-medium"
                onClick={() => { setCorrienteFilter(''); setPeligrosidadFilter(''); setEstadoFilter(''); setCurrentPage(1); }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-primary-500" />
            <span className="ml-3 text-neutral-600">Cargando residuos...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 text-error-600">
            <span>Error al cargar datos: {(error as Error)?.message || 'Error desconocido'}</span>
          </div>
        ) : (
          <>
            <Table
              data={paginatedData}
              columns={columns}
              keyExtractor={(row) => row.id}
              sortable={true}
              onSort={(key, dir) => setSortConfig({ key, direction: dir })}
              stickyHeader
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalFilteredPages}
              totalItems={filteredData.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

      {/* Modal Crear */}
      <Modal
        isOpen={modalCrear}
        onClose={() => setModalCrear(false)}
        title="Nuevo Tipo de Residuo"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalCrear(false)}>Cancelar</Button>
            <Button onClick={handleCrear} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creando...' : 'Crear'}
            </Button>
          </>
        }
      >
        {renderForm()}
      </Modal>

      {/* Modal Editar */}
      <Modal
        isOpen={modalEditar}
        onClose={() => { setModalEditar(false); setEditId(null); }}
        title="Editar Tipo de Residuo"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalEditar(false); setEditId(null); }}>Cancelar</Button>
            <Button onClick={handleEditar} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        {renderForm()}
      </Modal>

      {/* Modal Eliminar */}
      <ConfirmModal
        isOpen={modalEliminar}
        onClose={() => { setModalEliminar(false); setDeleteTarget(null); }}
        onConfirm={handleEliminar}
        title="Eliminar Tipo de Residuo"
        description={`¿Estás seguro de eliminar el tipo de residuo "${deleteTarget?.codigo}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default AdminResiduosPage;

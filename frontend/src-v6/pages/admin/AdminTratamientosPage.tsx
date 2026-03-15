/**
 * SITREP v6 - Admin Tratamientos Page
 * ====================================
 * Tab 1: Catálogo de referencia (static) con 10 categorías y 58 métodos.
 * Tab 2: Autorizaciones CRUD (DB-backed TratamientoAutorizado).
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOperadores } from '../../hooks/useActores';
import {
  useAllTratamientos,
  useCreateTratamiento,
  useUpdateTratamiento,
  useDeleteTratamiento,
  useTiposResiduo,
} from '../../hooks/useCatalogos';
import {
  Search,
  Download,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Info,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, Pagination } from '../../components/ui/Table';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { toast } from '../../components/ui/Toast';
import { downloadCsv } from '../../utils/exportCsv';
import { CORRIENTES_Y } from '../../data/corrientes-y';
import {
  CATEGORIAS_TRATAMIENTO,
  TODOS_LOS_METODOS,
  STATS_TRATAMIENTOS,
  getRiesgoMetodo,
  getOperadorEnriched,
  type CategoriaId,
  type MetodoTratamiento,
} from '../../data/tratamientos-catalogo';

// ---------------------------------------------------------------------------
// Risk config
// ---------------------------------------------------------------------------

const RIESGO_CONFIG = {
  critico: { label: 'Crítico', color: 'error' as const, icon: <AlertCircle size={12} /> },
  alto: { label: 'Alto', color: 'warning' as const, icon: <AlertTriangle size={12} /> },
  medio: { label: 'Medio', color: 'info' as const, icon: <Info size={12} /> },
  bajo: { label: 'Bajo', color: 'success' as const, icon: <CheckCircle2 size={12} /> },
};

const CAT_COLORS: Record<string, string> = {
  biologico: 'bg-green-50 text-green-700',
  fisicoquimico: 'bg-blue-50 text-blue-700',
  termico: 'bg-red-50 text-red-700',
  extraccion_vapores: 'bg-cyan-50 text-cyan-700',
  extraccion_liquidos: 'bg-indigo-50 text-indigo-700',
  remediacion: 'bg-amber-50 text-amber-700',
  asbesto: 'bg-orange-50 text-orange-700',
  almacenamiento: 'bg-slate-50 text-slate-700',
  reciclaje: 'bg-teal-50 text-teal-700',
  industrial: 'bg-purple-50 text-purple-700',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminTratamientosPage: React.FC = () => {
  const navigate = useNavigate();

  // Shared: operadores lookup
  const { data: operadoresApi } = useOperadores({ limit: 500 });
  const operadoresList = useMemo(() => {
    return Array.isArray(operadoresApi?.items) ? operadoresApi.items : [];
  }, [operadoresApi]);
  const cuitToId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of operadoresList) if (o.cuit) map[o.cuit] = o.id;
    return map;
  }, [operadoresList]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
          <BarChart3 className="text-primary-600" size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Tratamientos</h2>
          <p className="text-neutral-500 text-sm mt-0.5">
            Catálogo de referencia y autorizaciones por operador
          </p>
        </div>
      </div>

      <Tabs defaultTab="autorizaciones" variant="underline">
        <TabList>
          <Tab id="autorizaciones" icon={<ShieldCheck size={16} />}>Autorizaciones</Tab>
          <Tab id="catalogo" icon={<BarChart3 size={16} />}>Catálogo de Métodos</Tab>
        </TabList>

        <TabPanel id="autorizaciones">
          <AutorizacionesTab operadoresList={operadoresList} />
        </TabPanel>

        <TabPanel id="catalogo">
          <CatalogoTab navigate={navigate} cuitToId={cuitToId} />
        </TabPanel>
      </Tabs>
    </div>
  );
};

// ===========================================================================
// TAB 1: AUTORIZACIONES (DB-backed CRUD)
// ===========================================================================

interface TratamientoDB {
  id: string;
  operadorId: string;
  tipoResiduoId: string;
  metodo: string;
  descripcion: string | null;
  capacidad: number | null;
  activo: boolean;
  tipoResiduo?: { id: string; codigo: string; nombre: string };
  operador?: { id: string; razonSocial: string; cuit: string };
}

const AutorizacionesTab: React.FC<{ operadoresList: any[] }> = ({ operadoresList }) => {
  const { data: tratamientos, isLoading } = useAllTratamientos();
  const { data: tiposResiduo } = useTiposResiduo();
  const createMutation = useCreateTratamiento();
  const updateMutation = useUpdateTratamiento();
  const deleteMutation = useDeleteTratamiento();

  const [searchTerm, setSearchTerm] = useState('');
  const [filtroOperador, setFiltroOperador] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TratamientoDB | null>(null);
  const [deleteItem, setDeleteItem] = useState<TratamientoDB | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const itemsPerPage = 15;

  // Form state
  const [formOperadorId, setFormOperadorId] = useState('');
  const [formTipoResiduoId, setFormTipoResiduoId] = useState('');
  const [formMetodo, setFormMetodo] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formCapacidad, setFormCapacidad] = useState('');
  const [formActivo, setFormActivo] = useState(true);

  const allTratamientos: TratamientoDB[] = tratamientos || [];
  const tiposResiduoList = tiposResiduo || [];

  const filtered = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    let result = allTratamientos.filter(t => {
      if (filtroOperador && t.operadorId !== filtroOperador) return false;
      if (search) {
        const haystack = `${t.operador?.razonSocial || ''} ${t.tipoResiduo?.codigo || ''} ${t.tipoResiduo?.nombre || ''} ${t.metodo} ${t.descripcion || ''}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        switch (sortConfig.key) {
          case 'operador': return dir * (a.operador?.razonSocial || '').localeCompare(b.operador?.razonSocial || '', 'es');
          case 'residuo': return dir * (a.tipoResiduo?.codigo || '').localeCompare(b.tipoResiduo?.codigo || '', 'es');
          case 'metodo': return dir * a.metodo.localeCompare(b.metodo, 'es');
          default: return 0;
        }
      });
    }
    return result;
  }, [allTratamientos, searchTerm, filtroOperador, sortConfig]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginados = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const openCreate = () => {
    setEditingItem(null);
    setFormOperadorId('');
    setFormTipoResiduoId('');
    setFormMetodo('');
    setFormDescripcion('');
    setFormCapacidad('');
    setFormActivo(true);
    setShowModal(true);
  };

  const openEdit = (item: TratamientoDB) => {
    setEditingItem(item);
    setFormOperadorId(item.operadorId);
    setFormTipoResiduoId(item.tipoResiduoId);
    setFormMetodo(item.metodo);
    setFormDescripcion(item.descripcion || '');
    setFormCapacidad(item.capacidad ? String(item.capacidad) : '');
    setFormActivo(item.activo);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formMetodo.trim()) {
      toast.warning('Campo requerido', 'El método es obligatorio');
      return;
    }

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          data: {
            metodo: formMetodo,
            descripcion: formDescripcion || undefined,
            capacidad: formCapacidad ? Number(formCapacidad) : undefined,
            activo: formActivo,
          },
        });
        toast.success('Actualizado', 'Tratamiento autorizado actualizado');
      } else {
        if (!formOperadorId || !formTipoResiduoId) {
          toast.warning('Campos requeridos', 'Operador y tipo de residuo son obligatorios');
          return;
        }
        await createMutation.mutateAsync({
          operadorId: formOperadorId,
          tipoResiduoId: formTipoResiduoId,
          metodo: formMetodo,
          descripcion: formDescripcion || undefined,
          capacidad: formCapacidad ? Number(formCapacidad) : undefined,
        });
        toast.success('Creado', 'Tratamiento autorizado creado');
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || err?.message || 'Error inesperado');
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await deleteMutation.mutateAsync(deleteItem.id);
      toast.success('Eliminado', 'Tratamiento autorizado eliminado');
      setDeleteItem(null);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || err?.message || 'Error inesperado');
    }
  };

  const columns = [
    {
      key: 'operador',
      header: 'Operador',
      sortable: true,
      width: '30%',
      render: (t: TratamientoDB) => (
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <FlaskConical size={18} className="text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-neutral-900 truncate">{t.operador?.razonSocial || '-'}</p>
            <p className="text-xs text-neutral-400 font-mono">{t.operador?.cuit || ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'residuo',
      header: 'Tipo Residuo',
      sortable: true,
      width: '25%',
      render: (t: TratamientoDB) => (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block px-2 py-1 text-xs font-mono font-bold rounded bg-primary-100 text-primary-800">
              {t.tipoResiduo?.codigo || '-'}
            </span>
            {t.activo && (
              <Badge variant="soft" color="success" className="text-[10px]">
                Activo
              </Badge>
            )}
            {!t.activo && (
              <Badge variant="soft" color="error" className="text-[10px]">
                Inactivo
              </Badge>
            )}
          </div>
          <p className="text-sm text-neutral-600">{t.tipoResiduo?.nombre || ''}</p>
        </div>
      ),
    },
    {
      key: 'metodo',
      header: 'Método y Capacidad',
      sortable: true,
      width: '30%',
      render: (t: TratamientoDB) => (
        <div>
          <p className="font-medium text-neutral-900 mb-1">{t.metodo}</p>
          {t.descripcion && (
            <p className="text-xs text-neutral-500 line-clamp-2 mb-1">{t.descripcion}</p>
          )}
          {t.capacidad && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
              <span className="text-xs font-semibold text-primary-700">
                {t.capacidad} tn/mes
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      width: '15%',
      render: (t: TratamientoDB) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Pencil size={14} />}
            onClick={(e) => { e.stopPropagation(); openEdit(t); }}
            className="!px-3 !py-1.5"
          >
            Editar
          </Button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteItem(t); }}
            className="p-2 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors"
            title="Eliminar"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  const handleExport = () => {
    const rows = filtered.map(t => ({
      Operador: t.operador?.razonSocial || '',
      CUIT: t.operador?.cuit || '',
      'Tipo Residuo': t.tipoResiduo?.codigo || '',
      'Nombre Residuo': t.tipoResiduo?.nombre || '',
      Método: t.metodo,
      Descripción: t.descripcion || '',
      'Capacidad (tn/mes)': t.capacidad || '',
      Estado: t.activo ? 'Activo' : 'Inactivo',
    }));
    downloadCsv(rows, 'autorizaciones-tratamiento');
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Stats Cards - Spectacular Design */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 border-l-4 border-l-primary-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
              <ShieldCheck size={24} className="text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider">Total Autorizaciones</p>
              <p className="text-3xl font-bold text-neutral-900">{allTratamientos.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-green-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider">Activas</p>
              <p className="text-3xl font-bold text-green-700">{allTratamientos.filter(t => t.activo).length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <FlaskConical size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider">Operadores</p>
              <p className="text-3xl font-bold text-neutral-900">{new Set(allTratamientos.map(t => t.operadorId)).size}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={24} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider">Inactivas</p>
              <p className="text-3xl font-bold text-amber-700">{allTratamientos.filter(t => !t.activo).length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters + Actions */}
      <Card padding="base" className="shadow-sm">
        <div className="flex flex-col md:flex-row flex-wrap gap-3">
          <div className="flex-1">
            <Input
              placeholder="Buscar por operador, residuo o método..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              leftIcon={<Search size={18} />}
            />
          </div>
          <select
            value={filtroOperador}
            onChange={(e) => { setFiltroOperador(e.target.value); setCurrentPage(1); }}
            className="px-4 py-2.5 rounded-xl border-2 border-neutral-200 bg-white text-sm font-medium focus:border-primary-500 focus:outline-none hover:border-neutral-300 transition-colors"
          >
            <option value="">Todos los operadores ({operadoresList.length})</option>
            {operadoresList.map((o: any) => (
              <option key={o.id} value={o.id}>{o.razonSocial || o.nombre}</option>
            ))}
          </select>
          <Button variant="outline" leftIcon={<Download size={16} />} onClick={handleExport}>
            Exportar CSV
          </Button>
          <Button leftIcon={<Plus size={16} />} onClick={openCreate}>
            Nueva Autorización
          </Button>
        </div>
        {(searchTerm || filtroOperador) && (
          <div className="mt-3 flex items-center gap-2 pt-3 border-t border-neutral-100">
            <span className="text-sm text-neutral-600">
              Mostrando <span className="font-semibold text-primary-600">{filtered.length}</span> de {allTratamientos.length} autorizaciones
            </span>
            <button
              onClick={() => { setSearchTerm(''); setFiltroOperador(''); setCurrentPage(1); }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium hover:underline"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-primary-500 mb-3" />
            <p className="text-sm text-neutral-500">Cargando autorizaciones...</p>
          </div>
        ) : paginados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
              <ShieldCheck size={32} className="text-neutral-400" />
            </div>
            <p className="text-lg font-semibold text-neutral-900 mb-2">
              {searchTerm || filtroOperador ? 'No se encontraron resultados' : 'No hay autorizaciones registradas'}
            </p>
            <p className="text-sm text-neutral-500 mb-6 text-center max-w-md">
              {searchTerm || filtroOperador
                ? 'Intenta ajustar los filtros para encontrar lo que buscas'
                : 'Comienza creando la primera autorización de tratamiento'}
            </p>
            {!(searchTerm || filtroOperador) && (
              <Button leftIcon={<Plus size={16} />} onClick={openCreate}>
                Nueva Autorización
              </Button>
            )}
          </div>
        ) : (
          <Table
            data={paginados}
            columns={columns}
            keyExtractor={(t) => t.id}
            sortable={true}
            onSort={(key, dir) => setSortConfig({ key, direction: dir })}
            stickyHeader
            emptyMessage="No hay tratamientos autorizados registrados"
          />
        )}
      </Card>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? 'Editar Autorización' : 'Nueva Autorización'}
        size="base"
      >
        <div className="space-y-4">
          {!editingItem && (
            <>
              <Select
                label="Operador *"
                value={formOperadorId}
                onChange={setFormOperadorId}
                options={operadoresList.map((o: any) => ({
                  value: o.id,
                  label: `${o.razonSocial || o.nombre}${o.cuit ? ` — ${o.cuit}` : ''}`,
                }))}
                placeholder="Seleccionar operador..."
                searchable
                size="sm"
              />
              <Select
                label="Tipo de Residuo *"
                value={formTipoResiduoId}
                onChange={setFormTipoResiduoId}
                options={tiposResiduoList.map((r: any) => ({
                  value: r.id,
                  label: `${r.codigo} - ${r.nombre || r.descripcion}`,
                }))}
                placeholder="Seleccionar tipo de residuo..."
                searchable
                size="sm"
              />
            </>
          )}
          <Input
            label="Método de Tratamiento *"
            value={formMetodo}
            onChange={(e) => setFormMetodo(e.target.value)}
            placeholder="Ej: Incineración, Reciclaje..."
          />
          <Input
            label="Descripción"
            value={formDescripcion}
            onChange={(e) => setFormDescripcion(e.target.value)}
            placeholder="Descripción del tratamiento"
          />
          <Input
            label="Capacidad (tn/mes)"
            type="number"
            value={formCapacidad}
            onChange={(e) => setFormCapacidad(e.target.value)}
            placeholder="0"
          />
          {editingItem && (
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={formActivo}
                onChange={(e) => setFormActivo(e.target.checked)}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              Activo
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              leftIcon={(createMutation.isPending || updateMutation.isPending) ? <Loader2 size={16} className="animate-spin" /> : undefined}
            >
              {editingItem ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Eliminar Autorización"
        description={`¿Eliminar la autorización de "${deleteItem?.operador?.razonSocial || ''}" para "${deleteItem?.tipoResiduo?.nombre || deleteItem?.metodo || ''}"?`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

// ===========================================================================
// TAB 2: CATÁLOGO DE MÉTODOS (static reference)
// ===========================================================================

const CatalogoTab: React.FC<{
  navigate: ReturnType<typeof useNavigate>;
  cuitToId: Record<string, string>;
}> = ({ navigate, cuitToId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaId | ''>('');
  const [filtroRiesgo, setFiltroRiesgo] = useState('');
  const [filtroCorriente, setFiltroCorriente] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const itemsPerPage = 15;

  const metodosFiltrados = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    return TODOS_LOS_METODOS.filter(m => {
      if (filtroCategoria) {
        const cat = CATEGORIAS_TRATAMIENTO.find(c => c.metodos.includes(m));
        if (cat?.id !== filtroCategoria) return false;
      }
      if (search) {
        const catName = CATEGORIAS_TRATAMIENTO.find(c => c.metodos.includes(m))?.nombre || '';
        const haystack = `${m.nombre} ${m.nombreCorto} ${m.descripcion} ${catName}`.toLowerCase();
        const operadorMatch = m.operadores.some(o => {
          const enr = getOperadorEnriched(o.cuit);
          return enr && enr.empresa.toLowerCase().includes(search);
        });
        if (!haystack.includes(search) && !operadorMatch) return false;
      }
      if (filtroRiesgo && getRiesgoMetodo(m) !== filtroRiesgo) return false;
      if (filtroCorriente && !m.corrientesY.includes(filtroCorriente)) return false;
      return true;
    });
  }, [searchTerm, filtroCategoria, filtroRiesgo, filtroCorriente]);

  const totalPages = Math.ceil(metodosFiltrados.length / itemsPerPage);
  const paginados = metodosFiltrados.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const corrientesUnicas = useMemo(() => {
    const set = new Set<string>();
    for (const m of TODOS_LOS_METODOS) for (const y of m.corrientesY) set.add(y);
    return Array.from(set).sort((a, b) => parseInt(a.replace('Y', '')) - parseInt(b.replace('Y', '')));
  }, []);

  const handleExport = () => {
    const rows = metodosFiltrados.map(m => {
      const cat = CATEGORIAS_TRATAMIENTO.find(c => c.metodos.includes(m));
      return {
        Categoría: cat?.nombre || '',
        Método: m.nombre,
        Descripción: m.descripcion,
        'Corrientes Y': m.corrientesY.join(', '),
        'Cant. Operadores': m.operadores.length,
        Operadores: m.operadores.map(o => {
          const enr = getOperadorEnriched(o.cuit);
          return enr ? `${enr.empresa} (${o.tipo})` : o.cuit;
        }).join('; '),
        Riesgo: getRiesgoMetodo(m),
      };
    });
    downloadCsv(rows, 'catalogo-tratamientos');
  };

  const getCatForMetodo = (m: MetodoTratamiento) =>
    CATEGORIAS_TRATAMIENTO.find(c => c.metodos.includes(m));

  const columns = [
    {
      key: 'metodo',
      header: 'Método de Tratamiento',
      width: '30%',
      render: (m: MetodoTratamiento) => {
        const cat = getCatForMetodo(m);
        const isExpanded = expandedRow === m.id;
        return (
          <div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); setExpandedRow(isExpanded ? null : m.id); }} className="shrink-0">
                {isExpanded ? <ChevronDown size={14} className="text-neutral-400" /> : <ChevronRight size={14} className="text-neutral-400" />}
              </button>
              <div className="min-w-0">
                <p className="font-semibold text-neutral-900 truncate">{m.nombre}</p>
                {cat && (
                  <span className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded mt-0.5 ${CAT_COLORS[cat.id] || 'bg-neutral-50 text-neutral-700'}`}>
                    {cat.nombre}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'riesgo',
      header: 'Riesgo',
      width: '10%',
      render: (m: MetodoTratamiento) => {
        const r = getRiesgoMetodo(m);
        const rc = RIESGO_CONFIG[r];
        return (
          <Badge variant="soft" color={rc.color}>
            <span className="flex items-center gap-1">{rc.icon} {rc.label}</span>
          </Badge>
        );
      },
    },
    {
      key: 'operadores',
      header: 'Operadores',
      width: '10%',
      render: (m: MetodoTratamiento) => {
        const fijo = m.operadores.filter(o => o.tipo === 'FIJO' || o.tipo === 'AMBOS').length;
        const inSitu = m.operadores.filter(o => o.tipo === 'IN SITU' || o.tipo === 'AMBOS').length;
        return (
          <div className="text-center">
            <p className="text-lg font-bold text-neutral-900">{m.operadores.length}</p>
            <div className="flex items-center justify-center gap-1 text-[10px] text-neutral-500">
              {fijo > 0 && <span>{fijo}F</span>}
              {fijo > 0 && inSitu > 0 && <span>/</span>}
              {inSitu > 0 && <span>{inSitu}IS</span>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'corrientes',
      header: 'Corrientes Y',
      width: '25%',
      hiddenBelow: 'md' as const,
      render: (m: MetodoTratamiento) => (
        <div className="flex flex-wrap gap-1">
          {m.corrientesY.slice(0, 6).map(y => (
            <span key={y} className="inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-neutral-100 text-neutral-700">
              {y}
            </span>
          ))}
          {m.corrientesY.length > 6 && (
            <span className="text-[10px] text-neutral-400 font-medium self-center">+{m.corrientesY.length - 6}</span>
          )}
        </div>
      ),
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      width: '25%',
      hiddenBelow: 'lg' as const,
      render: (m: MetodoTratamiento) => (
        <p className="text-xs text-neutral-500 line-clamp-2">{m.descripcion}</p>
      ),
    },
  ];

  return (
    <div className="space-y-4 mt-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <Card className="p-3">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Métodos</p>
          <p className="text-2xl font-bold text-neutral-900">{STATS_TRATAMIENTOS.totalMetodos}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Categorías</p>
          <p className="text-2xl font-bold text-neutral-900">{STATS_TRATAMIENTOS.totalCategorias}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Operadores</p>
          <p className="text-2xl font-bold text-neutral-900">{STATS_TRATAMIENTOS.totalOperadores}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Corrientes Y</p>
          <p className="text-2xl font-bold text-neutral-900">{STATS_TRATAMIENTOS.corrientesYCubiertas}</p>
        </Card>
        <Card className="p-3 border-l-4 border-l-red-400">
          <p className="text-xs text-red-600 uppercase tracking-wider">Riesgo Crítico</p>
          <p className="text-2xl font-bold text-red-700">{STATS_TRATAMIENTOS.metodosCriticos}</p>
        </Card>
        <Card className="p-3 border-l-4 border-l-amber-400">
          <p className="text-xs text-amber-600 uppercase tracking-wider">Riesgo Alto</p>
          <p className="text-2xl font-bold text-amber-700">{STATS_TRATAMIENTOS.metodosAltoRiesgo}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="base">
        <div className="flex flex-col md:flex-row flex-wrap gap-3">
          <div className="flex-1">
            <Input
              placeholder="Buscar método, descripción u operador..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              leftIcon={<Search size={18} />}
            />
          </div>
          <select
            value={filtroCategoria}
            onChange={(e) => { setFiltroCategoria(e.target.value as CategoriaId | ''); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS_TRATAMIENTO.map(c => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.metodos.length})</option>
            ))}
          </select>
          <select
            value={filtroCorriente}
            onChange={(e) => { setFiltroCorriente(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">Todas las corrientes</option>
            {corrientesUnicas.map(y => (
              <option key={y} value={y}>{y} — {(CORRIENTES_Y[y] || '').substring(0, 40)}</option>
            ))}
          </select>
          <select
            value={filtroRiesgo}
            onChange={(e) => { setFiltroRiesgo(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">Todos los riesgos</option>
            <option value="critico">Crítico (1 operador)</option>
            <option value="alto">Alto (2 operadores)</option>
            <option value="medio">Medio (3-4)</option>
            <option value="bajo">Bajo (5+)</option>
          </select>
          <Button variant="outline" leftIcon={<Download size={16} />} onClick={handleExport}>
            CSV
          </Button>
        </div>
        {(searchTerm || filtroCategoria || filtroRiesgo || filtroCorriente) && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-neutral-500">
              {metodosFiltrados.length} de {STATS_TRATAMIENTOS.totalMetodos} métodos
            </span>
            <button
              onClick={() => { setSearchTerm(''); setFiltroCategoria(''); setFiltroRiesgo(''); setFiltroCorriente(''); setCurrentPage(1); }}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </Card>

      {/* Table */}
      <Table
        data={paginados}
        columns={columns}
        keyExtractor={(m) => m.id}
        onRowClick={(m) => setExpandedRow(expandedRow === m.id ? null : m.id)}
        stickyHeader
        emptyMessage="No se encontraron tratamientos con esos filtros"
        renderExpandedRow={(m) => expandedRow === m.id ? <ExpandedMetodo metodo={m} navigate={navigate} cuitToId={cuitToId} /> : null}
      />

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={metodosFiltrados.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Expanded row detail (static catalog)
// ---------------------------------------------------------------------------

const ExpandedMetodo: React.FC<{
  metodo: MetodoTratamiento;
  navigate: ReturnType<typeof useNavigate>;
  cuitToId: Record<string, string>;
}> = ({ metodo, navigate, cuitToId }) => {
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  const prefix = isMobile ? '/mobile' : '';
  const operadoresEnriched = metodo.operadores.map(o => ({
    ...o,
    enriched: getOperadorEnriched(o.cuit),
  }));

  return (
    <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-100">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
            Corrientes Autorizadas ({metodo.corrientesY.length})
          </p>
          <div className="space-y-1">
            {metodo.corrientesY.map(y => (
              <div key={y} className="flex items-start gap-2">
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-neutral-200 text-neutral-800 shrink-0">
                  {y}
                </span>
                <span className="text-xs text-neutral-600">{CORRIENTES_Y[y] || '-'}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
            Operadores Habilitados ({operadoresEnriched.length})
          </p>
          <div className="space-y-1.5">
            {operadoresEnriched.map(o => {
              const dbId = cuitToId[o.cuit];
              const href = dbId
                ? `${prefix}/admin/actores/operadores/${dbId}`
                : `${prefix}/admin/actores/operadores?q=${encodeURIComponent(o.cuit)}`;
              return (
              <div
                key={o.cuit}
                className="flex items-center gap-2 p-2 rounded-lg bg-white hover:bg-primary-50 transition-colors cursor-pointer group"
                onClick={() => navigate(href)}
              >
                <FlaskConical size={14} className="text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-neutral-900 group-hover:text-primary-600 truncate block">
                    {o.enriched?.empresa || o.cuit}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">{o.cuit} {o.enriched?.certificado ? `· ${o.enriched.certificado}` : ''}</span>
                </div>
                <Badge variant="outline" color={o.tipo === 'FIJO' ? 'info' : o.tipo === 'AMBOS' ? 'primary' : 'warning'} className="text-[10px] shrink-0">
                  {o.tipo}
                </Badge>
                <ExternalLink size={10} className="text-neutral-300 group-hover:text-primary-400 shrink-0" />
              </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 p-3 bg-white rounded-lg border border-neutral-100">
        <p className="text-xs font-semibold text-neutral-500 mb-1">Descripción</p>
        <p className="text-sm text-neutral-700">{metodo.descripcion}</p>
      </div>
    </div>
  );
};

export default AdminTratamientosPage;

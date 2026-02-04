/**
 * SITREP v6 - Admin Residuos Page
 * ================================
 * Catálogo de residuos y tipos
 */

import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  Plus,
  Search,
  AlertTriangle,
  Leaf,
  Trash2,
  Beaker,
  FileText,
  MoreVertical,
  Filter,
  Download,
  Edit,
  Tag,
  BarChart3,
  Info,
  Loader2
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Table, Pagination } from '../../components/ui/Table';
import { SearchInput } from '../../components/ui/SearchInput';
import { Modal } from '../../components/ui/Modal';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { useTiposResiduo } from '../../hooks/useCatalogos';
import { toast } from '../../components/ui/Toast';

interface ResiduoDisplay {
  id: string;
  codigo: string;
  descripcion: string;
  categoria: string;
  tipo: string;
  peligrosidad: string;
  activo: boolean;
}

interface CategoriaDisplay {
  id: number;
  nombre: string;
  color: string;
  residuos: number;
}

export const AdminResiduosPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('catalogo');
  const [selectedResiduo, setSelectedResiduo] = useState<ResiduoDisplay | null>(null);
  const [tipoFilter, setTipoFilter] = useState<string | null>(null);
  const [categoriaFilter, setCategoriaFilter] = useState<string | null>(null);

  const { data: tiposResiduoRaw, isLoading, isError, error } = useTiposResiduo();

  const tiposResiduo = tiposResiduoRaw || [];

  // Map API data to display format
  const residuosData: ResiduoDisplay[] = useMemo(() =>
    tiposResiduo.map(r => ({
      id: r.id,
      codigo: r.codigo,
      descripcion: r.descripcion || r.nombre,
      categoria: r.categoria || 'Sin categoría',
      tipo: r.peligrosidad === 'alta' || r.peligrosidad === 'media' ? 'Peligroso' : 'No Peligroso',
      peligrosidad: r.peligrosidad || 'ninguna',
      activo: r.activo,
    })),
    [tiposResiduo]
  );

  // Build categories from real data
  const categoriasData: CategoriaDisplay[] = useMemo(() => {
    const catMap = new Map<string, number>();
    residuosData.forEach(r => {
      catMap.set(r.categoria, (catMap.get(r.categoria) || 0) + 1);
    });
    return Array.from(catMap.entries()).map(([nombre, count], idx) => {
      const isPeligroso = residuosData.some(r => r.categoria === nombre && (r.peligrosidad === 'alta'));
      const isMedio = residuosData.some(r => r.categoria === nombre && (r.peligrosidad === 'media'));
      return {
        id: idx + 1,
        nombre,
        color: isPeligroso ? 'error' : isMedio ? 'warning' : 'success',
        residuos: count,
      };
    });
  }, [residuosData]);

  // Computed stats
  const statsPeligrosos = residuosData.filter(r => r.tipo === 'Peligroso').length;
  const statsNoPeligrosos = residuosData.filter(r => r.tipo === 'No Peligroso').length;
  const statsCategorias = categoriasData.length;
  const statsTotal = residuosData.length;

  const filteredData = residuosData.filter(r => {
    if (tipoFilter && r.tipo !== tipoFilter) return false;
    if (categoriaFilter && r.categoria !== categoriaFilter) return false;
    return (
      r.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.descripcion.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.categoria.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Pagination
  const itemsPerPage = 10;
  const totalFilteredPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const columns = [
    {
      key: 'residuo',
      width: '25%',
      header: 'Residuo',
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
          <div>
            <p className="font-medium text-neutral-900">{row.codigo}</p>
            <p className="text-xs text-neutral-500 line-clamp-1 max-w-[200px]">{row.descripcion}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'categoria',
      width: '15%',
      hiddenBelow: 'md' as const,
      header: 'Categoría',
      render: (row: ResiduoDisplay) => (
        <Badge variant="soft" color="neutral">{row.categoria}</Badge>
      ),
    },
    {
      key: 'tipo',
      width: '15%',
      header: 'Tipo',
      render: (row: ResiduoDisplay) => (
        <Badge variant={row.tipo === 'Peligroso' ? 'solid' : 'soft'} color={row.tipo === 'Peligroso' ? 'error' : 'success'}>
          {row.tipo}
        </Badge>
      ),
    },
    {
      key: 'peligrosidad',
      width: '15%',
      header: 'Peligrosidad',
      render: (row: ResiduoDisplay) => {
        const colors: Record<string, string> = {
          alta: 'error',
          media: 'warning',
          baja: 'info',
          ninguna: 'success',
        };
        return (
          <Badge variant="outline" color={colors[row.peligrosidad] as any}>
            {row.peligrosidad.charAt(0).toUpperCase() + row.peligrosidad.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: 'estado',
      width: '12%',
      header: 'Estado',
      render: (row: ResiduoDisplay) => (
        <Badge variant="soft" color={row.activo ? 'success' : 'neutral'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      width: '18%',
      header: '',
      align: 'right' as const,
      render: (row: ResiduoDisplay) => (
        <div className="flex items-center justify-end gap-1">
          <button
            className="p-1.5 text-neutral-400 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors"
            onClick={() => { toast.info('Editar residuo', 'La edición de tipos de residuo estará disponible próximamente'); }}
          >
            <Edit size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
            onClick={() => { if (window.confirm('¿Eliminar tipo de residuo ' + row.codigo + '?')) { toast.info('Eliminar residuo', 'La eliminación de tipos de residuo estará disponible próximamente'); } }}
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
          <h2 className="text-2xl font-bold text-neutral-900">Catálogo de Residuos</h2>
          <p className="text-neutral-600 mt-1">
            Gestión de tipos y categorías de residuos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={18} />} disabled title="Próximamente">
            Exportar Catálogo
          </Button>
          <Button leftIcon={<Plus size={18} />} onClick={() => setIsModalOpen(true)}>
            Nuevo Tipo
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${tipoFilter === 'Peligroso' ? 'ring-2 ring-error-500 shadow-md' : ''}`}
          onClick={() => { setTipoFilter(f => f === 'Peligroso' ? null : 'Peligroso'); setCategoriaFilter(null); setCurrentPage(1); }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-error-100 rounded-lg">
                <AlertTriangle size={20} className="text-error-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{statsPeligrosos}</p>
                <p className="text-sm text-neutral-600">Tipos Peligrosos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${tipoFilter === 'No Peligroso' ? 'ring-2 ring-success-500 shadow-md' : ''}`}
          onClick={() => { setTipoFilter(f => f === 'No Peligroso' ? null : 'No Peligroso'); setCategoriaFilter(null); setCurrentPage(1); }}
        >
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
              <div className="p-2 bg-primary-100 rounded-lg">
                <Tag size={20} className="text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{statsCategorias}</p>
                <p className="text-sm text-neutral-600">Categorías</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${!tipoFilter && !categoriaFilter ? '' : 'opacity-75'}`}
          onClick={() => { setTipoFilter(null); setCategoriaFilter(null); setCurrentPage(1); }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-100 rounded-lg">
                <BarChart3 size={20} className="text-info-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{statsTotal}</p>
                <p className="text-sm text-neutral-600">Total Tipos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categorías Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-primary-500" />
          <span className="ml-2 text-neutral-600">Cargando categorías...</span>
        </div>
      ) : categoriasData.length > 0 ? (
        <div className={`grid grid-cols-1 md:grid-cols-${Math.min(categoriasData.length, 5)} gap-4`}>
          {categoriasData.map(cat => (
            <Card
              key={cat.id}
              className={`cursor-pointer hover:shadow-md transition-all ${categoriaFilter === cat.nombre ? 'ring-2 ring-primary-500 shadow-md' : ''}`}
              onClick={() => { setCategoriaFilter(f => f === cat.nombre ? null : cat.nombre); setTipoFilter(null); setCurrentPage(1); }}
            >
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                  cat.color === 'error' ? 'bg-error-100' :
                  cat.color === 'warning' ? 'bg-warning-100' :
                  'bg-success-100'
                }`}>
                  <FlaskConical size={20} className={
                    cat.color === 'error' ? 'text-error-600' :
                    cat.color === 'warning' ? 'text-warning-600' :
                    'text-success-600'
                  } />
                </div>
                <h4 className="font-semibold text-neutral-900">{cat.nombre}</h4>
                <p className="text-sm text-neutral-500">{cat.residuos} tipos</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Tabs */}
      <Tabs activeTab={activeTab} onChange={setActiveTab}>
        <TabList>
          <Tab id="catalogo">Catálogo Completo</Tab>
          <Tab id="categorias">Categorías</Tab>
          <Tab id="tratamientos">Tratamientos</Tab>
        </TabList>

        <TabPanel id="catalogo">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Buscar por código, descripción o categoría..."
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm"
                    value={categoriaFilter || ''}
                    onChange={(e) => { setCategoriaFilter(e.target.value || null); setTipoFilter(null); setCurrentPage(1); }}
                  >
                    <option value="">Todas las categorías</option>
                    {categoriasData.map(cat => (
                      <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                    ))}
                  </select>
                  <Button variant="outline" leftIcon={<Filter size={18} />} disabled title="Próximamente">
                    Filtros
                  </Button>
                </div>
              </div>
              {(tipoFilter || categoriaFilter) && (
                <div className="flex items-center gap-2 mb-4 p-2 bg-primary-50 rounded-lg">
                  <span className="text-sm text-primary-700">Filtro activo:</span>
                  {tipoFilter && (
                    <Badge variant="solid" color="primary">
                      {tipoFilter}
                      <button className="ml-1.5" onClick={() => { setTipoFilter(null); setCurrentPage(1); }}>&times;</button>
                    </Badge>
                  )}
                  {categoriaFilter && (
                    <Badge variant="solid" color="primary">
                      {categoriaFilter}
                      <button className="ml-1.5" onClick={() => { setCategoriaFilter(null); setCurrentPage(1); }}>&times;</button>
                    </Badge>
                  )}
                  <button
                    className="ml-auto text-sm text-primary-600 hover:text-primary-800 font-medium"
                    onClick={() => { setTipoFilter(null); setCategoriaFilter(null); setCurrentPage(1); }}
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
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
                    selectable
                    selectedKeys={selectedRows}
                    onSelectionChange={setSelectedRows}
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
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel id="categorias">
          <Card>
            <CardHeader title="Gestión de Categorías" />
            <CardContent>
              <div className="space-y-4 animate-fade-in">
                {categoriasData.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        cat.color === 'error' ? 'bg-error-100' :
                        cat.color === 'warning' ? 'bg-warning-100' :
                        'bg-success-100'
                      }`}>
                        <FlaskConical size={24} className={
                          cat.color === 'error' ? 'text-error-600' :
                          cat.color === 'warning' ? 'text-warning-600' :
                          'text-success-600'
                        } />
                      </div>
                      <div>
                        <h4 className="font-semibold text-neutral-900">{cat.nombre}</h4>
                        <p className="text-sm text-neutral-500">{cat.residuos} tipos de residuos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" disabled title="Próximamente">Editar</Button>
                      <Button variant="outline" size="sm" disabled title="Próximamente">Ver residuos</Button>
                    </div>
                  </div>
                ))}
                {categoriasData.length === 0 && !isLoading && (
                  <p className="text-center text-neutral-400 py-8">No hay categorías disponibles</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel id="tratamientos">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['Incineración', 'Esterilización', 'Reciclaje', 'Tratamiento Especial', 'Disposición Final'].map((trat, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Info size={20} className="text-primary-600" />
                    </div>
                    <h4 className="font-semibold text-neutral-900">{trat}</h4>
                  </div>
                  <p className="text-sm text-neutral-600 mb-3">
                    Método de tratamiento para residuos según su clasificación.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabPanel>
      </Tabs>

      {/* Modal Nuevo Tipo */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nuevo Tipo de Residuo"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => { toast.info('Nuevo tipo', 'La creación de tipos de residuo estará disponible próximamente'); setIsModalOpen(false); }}>Guardar Tipo</Button>
          </div>
        }
      >
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Código CER *</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200" placeholder="180103" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Categoría *</label>
              <select className="w-full px-4 h-10 rounded-xl border border-neutral-200">
                {categoriasData.map(cat => (
                  <option key={cat.id}>{cat.nombre}</option>
                ))}
                <option>Otra</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Descripción *</label>
            <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200" placeholder="Descripción del residuo" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo *</label>
              <select className="w-full px-4 h-10 rounded-xl border border-neutral-200">
                <option>Peligroso</option>
                <option>No Peligroso</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Nivel de Peligrosidad *</label>
              <select className="w-full px-4 h-10 rounded-xl border border-neutral-200">
                <option>Alta</option>
                <option>Media</option>
                <option>Baja</option>
                <option>Ninguna</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Tratamiento *</label>
              <select className="w-full px-4 h-10 rounded-xl border border-neutral-200">
                <option>Incineración</option>
                <option>Esterilización</option>
                <option>Reciclaje</option>
                <option>Tratamiento Especial</option>
                <option>Disposición Final</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Unidad de Medida *</label>
              <select className="w-full px-4 h-10 rounded-xl border border-neutral-200">
                <option>kg</option>
                <option>ton</option>
                <option>litros</option>
                <option>unidades</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminResiduosPage;

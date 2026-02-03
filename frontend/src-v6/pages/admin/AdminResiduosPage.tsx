/**
 * SITREP v6 - Admin Residuos Page
 * ================================
 * Catálogo de residuos y tipos
 */

import React, { useState } from 'react';
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
  Info
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Table, Pagination } from '../../components/ui/Table';
import { SearchInput } from '../../components/ui/SearchInput';
import { Modal } from '../../components/ui/Modal';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';

// Mock data
const residuosData = [
  { id: 'RES-001', codigo: '180103', descripcion: 'Residuos de procedencia hospitalaria', categoria: 'Anatomopatológico', tipo: 'Peligroso', tratamiento: 'Incineración', peligrosidad: 'alta', unidad: 'kg', activo: true, volumenAnual: 45000 },
  { id: 'RES-002', codigo: '180106', descripcion: 'Objetos punzantes o cortantes', categoria: 'Cortopunzante', tipo: 'Peligroso', tratamiento: 'Incineración', peligrosidad: 'alta', unidad: 'kg', activo: true, volumenAnual: 12500 },
  { id: 'RES-003', codigo: '180108', descripcion: 'Residuos biológicos', categoria: 'Biológico', tipo: 'Peligroso', tratamiento: 'Esterilización', peligrosidad: 'media', unidad: 'kg', activo: true, volumenAnual: 32000 },
  { id: 'RES-004', codigo: '180202', descripcion: 'Residuos de animales infectados', categoria: 'Biológico', tipo: 'Peligroso', tratamiento: 'Incineración', peligrosidad: 'alta', unidad: 'kg', activo: true, volumenAnual: 8900 },
  { id: 'RES-005', codigo: '200101', descripcion: 'Papel y cartón', categoria: 'Reciclable', tipo: 'No Peligroso', tratamiento: 'Reciclaje', peligrosidad: 'ninguna', unidad: 'kg', activo: true, volumenAnual: 56000 },
  { id: 'RES-006', codigo: '200139', descripcion: 'Plásticos', categoria: 'Reciclable', tipo: 'No Peligroso', tratamiento: 'Reciclaje', peligrosidad: 'ninguna', unidad: 'kg', activo: true, volumenAnual: 34000 },
  { id: 'RES-007', codigo: '200111', descripcion: 'Envases de productos químicos', categoria: 'Químico', tipo: 'Peligroso', tratamiento: 'Tratamiento especial', peligrosidad: 'media', unidad: 'kg', activo: false, volumenAnual: 0 },
];

const categoriasData = [
  { id: 1, nombre: 'Anatomopatológico', color: 'error', residuos: 3, volumen: 58000 },
  { id: 2, nombre: 'Cortopunzante', color: 'error', residuos: 1, volumen: 12500 },
  { id: 3, nombre: 'Biológico', color: 'warning', residuos: 2, volumen: 40900 },
  { id: 4, nombre: 'Reciclable', color: 'success', residuos: 2, volumen: 90000 },
  { id: 5, nombre: 'Químico', color: 'warning', residuos: 1, volumen: 5600 },
];

export const AdminResiduosPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('catalogo');

  const filteredData = residuosData.filter(r => 
    r.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.descripcion.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.categoria.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: 'residuo',
      header: 'Residuo',
      render: (row: typeof residuosData[0]) => (
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
      header: 'Categoría',
      render: (row: typeof residuosData[0]) => (
        <Badge variant="soft" color="neutral">{row.categoria}</Badge>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (row: typeof residuosData[0]) => (
        <Badge variant={row.tipo === 'Peligroso' ? 'solid' : 'soft'} color={row.tipo === 'Peligroso' ? 'error' : 'success'}>
          {row.tipo}
        </Badge>
      ),
    },
    {
      key: 'peligrosidad',
      header: 'Peligrosidad',
      render: (row: typeof residuosData[0]) => {
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
      key: 'tratamiento',
      header: 'Tratamiento',
      render: (row: typeof residuosData[0]) => (
        <span className="text-sm text-neutral-600">{row.tratamiento}</span>
      ),
    },
    {
      key: 'volumen',
      header: 'Volumen Anual',
      align: 'right' as const,
      render: (row: typeof residuosData[0]) => (
        <span className="text-sm font-medium text-neutral-900">
          {row.volumenAnual.toLocaleString()} {row.unidad}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (row: typeof residuosData[0]) => (
        <Badge variant="soft" color={row.activo ? 'success' : 'neutral'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: '',
      align: 'right' as const,
      render: () => (
        <div className="flex items-center justify-end gap-1">
          <button className="p-1.5 text-neutral-400 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors">
            <Edit size={16} />
          </button>
          <button className="p-1.5 text-neutral-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors">
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
          <Button variant="outline" leftIcon={<Download size={18} />}>
            Exportar Catálogo
          </Button>
          <Button leftIcon={<Plus size={18} />} onClick={() => setIsModalOpen(true)}>
            Nuevo Tipo
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-error-100 rounded-lg">
                <AlertTriangle size={20} className="text-error-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">4</p>
                <p className="text-sm text-neutral-600">Tipos Peligrosos</p>
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
                <p className="text-2xl font-bold text-neutral-900">3</p>
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
                <p className="text-2xl font-bold text-neutral-900">5</p>
                <p className="text-sm text-neutral-600">Categorías</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-100 rounded-lg">
                <BarChart3 size={20} className="text-info-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">187tn</p>
                <p className="text-sm text-neutral-600">Volumen Anual</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categorías Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {categoriasData.map(cat => (
          <Card key={cat.id} className="cursor-pointer hover:shadow-md transition-shadow">
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
              <p className="text-xs text-neutral-400 mt-1">{cat.volumen.toLocaleString()} kg/año</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
                  <select className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm">
                    <option>Todas las categorías</option>
                    <option>Anatomopatológico</option>
                    <option>Cortopunzante</option>
                    <option>Biológico</option>
                    <option>Reciclable</option>
                  </select>
                  <Button variant="outline" leftIcon={<Filter size={18} />}>
                    Filtros
                  </Button>
                </div>
              </div>
              <Table
                data={filteredData}
                columns={columns}
                keyExtractor={(row) => row.id}
                selectable
                selectedKeys={selectedRows}
                onSelectionChange={setSelectedRows}
              />
              <Pagination
                currentPage={currentPage}
                totalPages={4}
                totalItems={28}
                itemsPerPage={10}
                onPageChange={setCurrentPage}
              />
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
                        <p className="text-sm text-neutral-500">{cat.residuos} tipos de residuos • {cat.volumen.toLocaleString()} kg/año</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">Editar</Button>
                      <Button variant="outline" size="sm">Ver residuos</Button>
                    </div>
                  </div>
                ))}
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
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Operadores habilitados:</span>
                    <Badge variant="soft" color="primary">{3 + i}</Badge>
                  </div>
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
            <Button>Guardar Tipo</Button>
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
                <option>Anatomopatológico</option>
                <option>Cortopunzante</option>
                <option>Biológico</option>
                <option>Reciclable</option>
                <option>Químico</option>
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

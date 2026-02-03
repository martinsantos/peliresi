/**
 * SITREP v6 - Admin Establecimientos Page
 * ========================================
 * Gestión de establecimientos/generadores
 */

import React, { useState } from 'react';
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
  Eye
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Table, Pagination } from '../../components/ui/Table';
import { SearchInput } from '../../components/ui/SearchInput';
import { Modal } from '../../components/ui/Modal';

// Mock data
const establecimientosData = [
  { id: 'EST-001', nombre: 'Hospital Central', tipo: 'Hospital', cuit: '30-12345678-9', direccion: 'Av. Central 1234, Ciudad', contacto: 'Dr. García', telefono: '261-4123456', email: 'gestion@hospitalcentral.gob.ar', estado: 'activo', manifiestosMes: 45, residuosMes: 1200 },
  { id: 'EST-002', nombre: 'Clínica del Sol', tipo: 'Clínica Privada', cuit: '30-87654321-0', direccion: 'Calle Sol 567, Ciudad', contacto: 'Dra. Martínez', telefono: '261-4234567', email: 'admin@clinicadelsol.com', estado: 'activo', manifiestosMes: 32, residuosMes: 890 },
  { id: 'EST-003', nombre: 'Laboratorio BioTest', tipo: 'Laboratorio', cuit: '30-11223344-5', direccion: 'Av. Industria 890, Godoy Cruz', contacto: 'Lic. Rodríguez', telefono: '261-4345678', email: 'operaciones@biotest.com.ar', estado: 'activo', manifiestosMes: 28, residuosMes: 450 },
  { id: 'EST-004', nombre: 'Centro Médico Norte', tipo: 'Centro Médico', cuit: '30-55667788-9', direccion: 'Av. Norte 2345, Las Heras', contacto: 'Dr. López', telefono: '261-4456789', email: 'info@centromedicomza.com', estado: 'pendiente', manifiestosMes: 0, residuosMes: 0 },
  { id: 'EST-005', nombre: 'Hospital Pediátrico', tipo: 'Hospital', cuit: '30-99887766-2', direccion: 'Calle Niños 456, Ciudad', contacto: 'Dra. Fernández', telefono: '261-4567890', email: 'direccion@hospitalpediatrico.gob.ar', estado: 'activo', manifiestosMes: 38, residuosMes: 980 },
  { id: 'EST-006', nombre: 'Clínica Mendoza', tipo: 'Clínica Privada', cuit: '30-33445566-7', direccion: 'San Martín 789, Ciudad', contacto: 'Dr. Silva', telefono: '261-4678901', email: 'contacto@clinicamendoza.com', estado: 'inactivo', manifiestosMes: 0, residuosMes: 0 },
];

const tipoEstablecimiento = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinica', label: 'Clínica Privada' },
  { value: 'laboratorio', label: 'Laboratorio' },
  { value: 'centro_medico', label: 'Centro Médico' },
  { value: 'farmacia', label: 'Farmacia' },
  { value: 'otro', label: 'Otro' },
];

export const AdminEstablecimientosPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  const filteredData = establecimientosData.filter(est => {
    const matchesSearch = est.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         est.cuit.includes(searchQuery) ||
                         est.direccion.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEstado = filtroEstado === 'todos' || est.estado === filtroEstado;
    return matchesSearch && matchesEstado;
  });

  const columns = [
    {
      key: 'nombre',
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
      header: 'CUIT',
      render: (row: typeof establecimientosData[0]) => (
        <span className="font-mono text-sm text-neutral-600">{row.cuit}</span>
      ),
    },
    {
      key: 'contacto',
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
      header: 'Ubicación',
      render: (row: typeof establecimientosData[0]) => (
        <div className="flex items-center gap-1 text-sm text-neutral-600">
          <MapPin size={14} />
          <span className="truncate max-w-[150px]">{row.direccion}</span>
        </div>
      ),
    },
    {
      key: 'actividad',
      header: 'Actividad (Mes)',
      align: 'center' as const,
      render: (row: typeof establecimientosData[0]) => (
        <div className="text-center">
          <p className="font-medium text-neutral-900">{row.manifiestosMes}</p>
          <p className="text-xs text-neutral-500">{row.residuosMes} kg</p>
        </div>
      ),
    },
    {
      key: 'estado',
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
      header: '',
      align: 'right' as const,
      render: () => (
        <div className="flex items-center justify-end gap-1">
          <button className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
            <Eye size={16} />
          </button>
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
          <h2 className="text-2xl font-bold text-neutral-900">Establecimientos</h2>
          <p className="text-neutral-600 mt-1">
            Gestión de establecimientos generadores de residuos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={18} />}>
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
                <p className="text-2xl font-bold text-neutral-900">247</p>
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
                <p className="text-2xl font-bold text-neutral-900">198</p>
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
                <p className="text-2xl font-bold text-neutral-900">23</p>
                <p className="text-sm text-neutral-600">Pendientes</p>
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
                <p className="text-2xl font-bold text-neutral-900">12</p>
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
              <Button variant="outline" leftIcon={<Filter size={18} />}>
                Más filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
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
          totalPages={12}
          totalItems={247}
          itemsPerPage={20}
          onPageChange={setCurrentPage}
        />
      </Card>

      {/* Modal Nuevo Establecimiento */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nuevo Establecimiento"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button>Crear Establecimiento</Button>
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
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Tipo *
              </label>
              <select className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none">
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
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Razón Social
              </label>
              <input
                type="text"
                className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none"
                placeholder="Razón social legal"
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
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none"
                placeholder="contacto@ejemplo.com"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminEstablecimientosPage;

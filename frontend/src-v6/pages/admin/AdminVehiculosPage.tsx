/**
 * SITREP v6 - Admin Vehículos Page
 * =================================
 * Gestión de vehículos de transporte
 */

import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  MapPin,
  Calendar,
  Wrench,
  FileText,
  MoreVertical,
  Filter,
  Download,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Table, Pagination } from '../../components/ui/Table';
import { SearchInput } from '../../components/ui/SearchInput';
import { Modal } from '../../components/ui/Modal';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';

// Mock data
const vehiculosData = [
  { id: 'VH-001', patente: 'ABC123', tipo: 'Camión', marca: 'Mercedes-Benz', modelo: 'Actros 2545', ano: 2022, transportista: 'Transporte Rápido SRL', capacidad: '15.000 kg', estado: 'disponible', ultimaRevision: '15/01/2025', vencimientoVTV: '20/06/2025', kmRecorridos: 45230 },
  { id: 'VH-002', patente: 'DEF456', tipo: 'Camión', marca: 'Volvo', modelo: 'FH 460', ano: 2021, transportista: 'EcoTransporte SA', capacidad: '18.000 kg', estado: 'en_viaje', ultimaRevision: '10/01/2025', vencimientoVTV: '15/08/2025', kmRecorridos: 67340 },
  { id: 'VH-003', patente: 'GHI789', tipo: 'Furgón', marca: 'Iveco', modelo: 'Daily 70C18', ano: 2023, transportista: 'Transporte Rápido SRL', capacidad: '4.000 kg', estado: 'disponible', ultimaRevision: '05/01/2025', vencimientoVTV: '12/04/2025', kmRecorridos: 23100 },
  { id: 'VH-004', patente: 'JKL012', tipo: 'Camión', marca: 'Scania', modelo: 'R 450', ano: 2020, transportista: 'Logística Sur', capacidad: '20.000 kg', estado: 'mantenimiento', ultimaRevision: '28/12/2024', vencimientoVTV: '30/03/2025', kmRecorridos: 89200 },
  { id: 'VH-005', patente: 'MNO345', tipo: 'Furgón', marca: 'Mercedes-Benz', modelo: 'Sprinter 516', ano: 2023, transportista: 'EcoTransporte SA', capacidad: '3.500 kg', estado: 'disponible', ultimaRevision: '20/01/2025', vencimientoVTV: '18/09/2025', kmRecorridos: 18900 },
  { id: 'VH-006', patente: 'PQR678', tipo: 'Camión', marca: 'Volvo', modelo: 'FM 410', ano: 2021, transportista: 'Transporte Rápido SRL', capacidad: '16.000 kg', estado: 'inactivo', ultimaRevision: '01/12/2024', vencimientoVTV: 'VENCIDO', kmRecorridos: 54300 },
];

const mantenimientosData = [
  { id: 1, vehiculo: 'ABC123', tipo: 'Service Preventivo', fecha: '15/01/2025', km: 45000, costo: 125000, taller: 'Taller Mecánico Centro', proximo: '45.000 km / 15/04/2025' },
  { id: 2, vehiculo: 'DEF456', tipo: 'Cambio de Neumáticos', fecha: '10/01/2025', km: 67000, costo: 380000, taller: 'Neumáticos Express', proximo: '90.000 km' },
  { id: 3, vehiculo: 'GHI789', tipo: 'Service Completo', fecha: '05/01/2025', km: 23000, costo: 85000, taller: 'Taller Mecánico Centro', proximo: '30.000 km / 05/04/2025' },
];

export const AdminVehiculosPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('vehiculos');

  const filteredData = vehiculosData.filter(v => 
    v.patente.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.transportista.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.marca.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: 'vehiculo',
      header: 'Vehículo',
      render: (row: typeof vehiculosData[0]) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <Truck size={20} className="text-primary-600" />
          </div>
          <div>
            <p className="font-medium text-neutral-900">{row.patente}</p>
            <p className="text-xs text-neutral-500">{row.tipo}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'detalles',
      header: 'Detalles',
      render: (row: typeof vehiculosData[0]) => (
        <div className="text-sm">
          <p className="text-neutral-900">{row.marca} {row.modelo}</p>
          <p className="text-neutral-500">Año {row.ano} • {row.capacidad}</p>
        </div>
      ),
    },
    {
      key: 'transportista',
      header: 'Transportista',
      render: (row: typeof vehiculosData[0]) => (
        <span className="text-sm text-neutral-700">{row.transportista}</span>
      ),
    },
    {
      key: 'km',
      header: 'Kilometraje',
      align: 'center' as const,
      render: (row: typeof vehiculosData[0]) => (
        <span className="text-sm font-medium text-neutral-900">
          {row.kmRecorridos.toLocaleString()} km
        </span>
      ),
    },
    {
      key: 'vtv',
      header: 'VTV',
      render: (row: typeof vehiculosData[0]) => {
        const isVencido = row.vencimientoVTV === 'VENCIDO';
        return (
          <div className="flex items-center gap-1">
            {isVencido ? (
              <>
                <AlertTriangle size={14} className="text-error-500" />
                <Badge variant="soft" color="error">Vencido</Badge>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} className="text-success-500" />
                <span className="text-sm text-neutral-600">{row.vencimientoVTV}</span>
              </>
            )}
          </div>
        );
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (row: typeof vehiculosData[0]) => {
        const estadoConfig: Record<string, { label: string; color: string }> = {
          disponible: { label: 'Disponible', color: 'success' },
          en_viaje: { label: 'En Viaje', color: 'info' },
          mantenimiento: { label: 'Mantenimiento', color: 'warning' },
          inactivo: { label: 'Inactivo', color: 'neutral' },
        };
        const config = estadoConfig[row.estado];
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

  const mantenimientoColumns = [
    {
      key: 'vehiculo',
      header: 'Vehículo',
      render: (row: typeof mantenimientosData[0]) => (
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-neutral-400" />
          <span className="font-medium text-neutral-900">{row.vehiculo}</span>
        </div>
      ),
    },
    { key: 'tipo', header: 'Tipo de Servicio' },
    { key: 'fecha', header: 'Fecha' },
    { key: 'km', header: 'Km', align: 'center' as const },
    {
      key: 'costo',
      header: 'Costo',
      render: (row: typeof mantenimientosData[0]) => (
        <span className="font-medium text-neutral-900">${row.costo.toLocaleString()}</span>
      ),
    },
    { key: 'taller', header: 'Taller' },
    {
      key: 'proximo',
      header: 'Próximo Service',
      render: (row: typeof mantenimientosData[0]) => (
        <span className="text-sm text-neutral-600">{row.proximo}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Vehículos</h2>
          <p className="text-neutral-600 mt-1">
            Gestión de flota de transporte
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={18} />}>
            Exportar
          </Button>
          <Button leftIcon={<Plus size={18} />} onClick={() => setIsModalOpen(true)}>
            Nuevo Vehículo
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Truck size={20} className="text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">56</p>
                <p className="text-sm text-neutral-600">Total Vehículos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-100 rounded-lg">
                <CheckCircle2 size={20} className="text-success-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">42</p>
                <p className="text-sm text-neutral-600">Disponibles</p>
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
                <p className="text-2xl font-bold text-neutral-900">8</p>
                <p className="text-sm text-neutral-600">En Viaje</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning-100 rounded-lg">
                <Wrench size={20} className="text-warning-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">4</p>
                <p className="text-sm text-neutral-600">Mantenimiento</p>
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
                <p className="text-2xl font-bold text-neutral-900">2</p>
                <p className="text-sm text-neutral-600">VTV Vencida</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs activeTab={activeTab} onChange={setActiveTab}>
        <TabList>
          <Tab id="vehiculos">Vehículos</Tab>
          <Tab id="mantenimiento">Mantenimiento</Tab>
          <Tab id="documentacion">Documentación</Tab>
        </TabList>

        <TabPanel id="vehiculos">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Buscar por patente, transportista o marca..."
                  />
                </div>
                <Button variant="outline" leftIcon={<Filter size={18} />}>
                  Filtros
                </Button>
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
                totalPages={6}
                totalItems={56}
                itemsPerPage={10}
                onPageChange={setCurrentPage}
              />
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel id="mantenimiento">
          <Card>
            <CardHeader 
              title="Historial de Mantenimiento"
              action={<Button variant="outline" size="sm">+ Nuevo Service</Button>}
            />
            <CardContent className="p-0">
              <Table
                data={mantenimientosData}
                columns={mantenimientoColumns}
                keyExtractor={(row) => row.id.toString()}
              />
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel id="documentacion">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="VTV - Vencimientos Próximos" />
              <CardContent>
                <div className="space-y-3 animate-fade-in">
                  {vehiculosData.filter(v => v.vencimientoVTV !== 'VENCIDO').slice(0, 3).map(v => (
                    <div key={v.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Truck size={18} className="text-neutral-400" />
                        <div>
                          <p className="font-medium text-neutral-900">{v.patente}</p>
                          <p className="text-xs text-neutral-500">{v.transportista}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{v.vencimientoVTV}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Seguros - Vencimientos" />
              <CardContent>
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-neutral-400" />
                      <div>
                        <p className="font-medium text-neutral-900">ABC123</p>
                        <p className="text-xs text-neutral-500">Transporte Rápido SRL</p>
                      </div>
                    </div>
                    <Badge variant="soft" color="warning">15/03/2025</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-neutral-400" />
                      <div>
                        <p className="font-medium text-neutral-900">DEF456</p>
                        <p className="text-xs text-neutral-500">EcoTransporte SA</p>
                      </div>
                    </div>
                    <Badge variant="soft" color="success">20/08/2025</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>
      </Tabs>

      {/* Modal Nuevo Vehículo */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nuevo Vehículo"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button>Registrar Vehículo</Button>
          </div>
        }
      >
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Patente *</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200" placeholder="ABC123" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo *</label>
              <select className="w-full px-4 h-10 rounded-xl border border-neutral-200">
                <option>Camión</option>
                <option>Furgón</option>
                <option>Camioneta</option>
                <option>Semi-remolque</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Marca *</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200" placeholder="Mercedes-Benz" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Modelo *</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200" placeholder="Actros 2545" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Año *</label>
              <input type="number" className="w-full px-4 h-10 rounded-xl border border-neutral-200" placeholder="2023" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Capacidad *</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200" placeholder="15.000 kg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Transportista *</label>
            <select className="w-full px-4 h-10 rounded-xl border border-neutral-200">
              <option>Transporte Rápido SRL</option>
              <option>EcoTransporte SA</option>
              <option>Logística Sur</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminVehiculosPage;

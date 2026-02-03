/**
 * SITREP v6 - Admin Vehículos Page
 * =================================
 * Gestión de vehículos de transporte
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Table, Pagination } from '../../components/ui/Table';
import { SearchInput } from '../../components/ui/SearchInput';
import { Modal } from '../../components/ui/Modal';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { useTransportistas } from '../../hooks/useActores';
import { toast } from '../../components/ui/Toast';

interface VehiculoDisplay {
  id: string;
  transportistaId: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  capacidad: string;
  transportista: string;
  habilitacion: string;
  estado: string;
  vencimiento: string;
  activo: boolean;
}

export const AdminVehiculosPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('vehiculos');

  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  const { data: transportistasData, isLoading, isError, error } = useTransportistas({ limit: 100 });

  const transportistas = Array.isArray(transportistasData?.items) ? transportistasData.items : [];

  // Flatten all vehicles from all transportistas
  const allVehicles: VehiculoDisplay[] = useMemo(() =>
    transportistas.flatMap(t =>
      (Array.isArray(t.vehiculos) ? t.vehiculos : []).map(v => ({
        id: v.id,
        transportistaId: t.id,
        patente: v.patente,
        marca: v.marca,
        modelo: v.modelo,
        anio: v.anio,
        capacidad: typeof v.capacidad === 'number' ? `${v.capacidad.toLocaleString()} kg` : '',
        transportista: t.razonSocial,
        habilitacion: v.numeroHabilitacion || '',
        estado: v.activo ? 'disponible' : 'inactivo',
        vencimiento: v.vencimiento || '',
        activo: v.activo,
      }))
    ),
    [transportistas]
  );

  // Computed stats
  const statsTotal = allVehicles.length;
  const statsDisponibles = allVehicles.filter(v => v.activo).length;
  const statsInactivos = allVehicles.filter(v => !v.activo).length;
  const statsVencidos = allVehicles.filter(v => {
    if (!v.vencimiento) return false;
    try {
      return new Date(v.vencimiento) < new Date();
    } catch {
      return false;
    }
  }).length;

  const filteredData = allVehicles.filter(v =>
    String(v.patente || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(v.transportista || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(v.marca || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination for display
  const itemsPerPage = 10;
  const totalFilteredPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const columns = [
    {
      key: 'vehiculo',
      width: '22%',
      header: 'Vehículo',
      render: (row: VehiculoDisplay) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <Truck size={20} className="text-primary-600" />
          </div>
          <div>
            <p className="font-medium text-neutral-900">{row.patente}</p>
            <p className="text-xs text-neutral-500">{row.habilitacion || 'Sin habilitación'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'detalles',
      width: '20%',
      hiddenBelow: 'md' as const,
      header: 'Detalles',
      render: (row: VehiculoDisplay) => (
        <div className="text-sm">
          <p className="text-neutral-900">{row.marca} {row.modelo}</p>
          <p className="text-neutral-500">Año {row.anio} {row.capacidad ? `• ${row.capacidad}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'transportista',
      width: '20%',
      hiddenBelow: 'md' as const,
      header: 'Transportista',
      render: (row: VehiculoDisplay) => (
        <span className="text-sm text-neutral-700">{row.transportista}</span>
      ),
    },
    {
      key: 'vtv',
      width: '15%',
      header: 'Vencimiento',
      render: (row: VehiculoDisplay) => {
        if (!row.vencimiento) {
          return <span className="text-sm text-neutral-400">Sin datos</span>;
        }
        const isVencido = (() => {
          try { return new Date(row.vencimiento) < new Date(); } catch { return false; }
        })();
        const formatted = (() => {
          try {
            return new Date(row.vencimiento).toLocaleDateString('es-AR');
          } catch {
            return row.vencimiento;
          }
        })();
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
                <span className="text-sm text-neutral-600">{formatted}</span>
              </>
            )}
          </div>
        );
      },
    },
    {
      key: 'estado',
      width: '12%',
      header: 'Estado',
      render: (row: VehiculoDisplay) => {
        const estadoConfig: Record<string, { label: string; color: string }> = {
          disponible: { label: 'Disponible', color: 'success' },
          en_viaje: { label: 'En Viaje', color: 'info' },
          mantenimiento: { label: 'Mantenimiento', color: 'warning' },
          inactivo: { label: 'Inactivo', color: 'neutral' },
        };
        const config = estadoConfig[row.estado] || estadoConfig.inactivo;
        return <Badge variant="soft" color={config.color as any}>{config.label}</Badge>;
      },
    },
    {
      key: 'acciones',
      width: '11%',
      header: '',
      align: 'right' as const,
      render: (row: VehiculoDisplay) => (
        <div className="flex items-center justify-end gap-1">
          <button
            className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            onClick={() => navigate(isMobile ? '/mobile/actores/transportistas/' + row.transportistaId : '/actores/transportistas/' + row.transportistaId)}
            title="Ver transportista"
          >
            <Eye size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors"
            onClick={() => navigate(isMobile ? '/mobile/actores/transportistas/' + row.transportistaId : '/actores/transportistas/' + row.transportistaId)}
            title="Editar vehículo"
          >
            <Edit size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
            onClick={() => {
              if (window.confirm('La gestión de vehículos se realiza desde la ficha del transportista. ¿Desea ir a la ficha del transportista?')) {
                navigate(isMobile ? '/mobile/actores/transportistas/' + row.transportistaId : '/actores/transportistas/' + row.transportistaId);
              }
            }}
            title="Eliminar vehículo"
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Truck size={20} className="text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{statsTotal}</p>
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
                <p className="text-2xl font-bold text-neutral-900">{statsDisponibles}</p>
                <p className="text-sm text-neutral-600">Disponibles</p>
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
                <p className="text-2xl font-bold text-neutral-900">{statsInactivos}</p>
                <p className="text-sm text-neutral-600">Inactivos</p>
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
                <p className="text-2xl font-bold text-neutral-900">{statsVencidos}</p>
                <p className="text-sm text-neutral-600">Hab. Vencida</p>
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
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={32} className="animate-spin text-primary-500" />
                  <span className="ml-3 text-neutral-600">Cargando vehículos...</span>
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

        <TabPanel id="mantenimiento">
          <Card>
            <CardHeader
              title="Historial de Mantenimiento"
              action={<Button variant="outline" size="sm">+ Nuevo Service</Button>}
            />
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
                <Wrench size={40} className="mb-3" />
                <p className="text-neutral-600 font-medium">Sin registros de mantenimiento</p>
                <p className="text-sm text-neutral-400 mt-1">Los registros de mantenimiento aparecerán aquí</p>
              </div>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel id="documentacion">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Habilitaciones - Vencimientos Próximos" />
              <CardContent>
                <div className="space-y-3 animate-fade-in">
                  {allVehicles
                    .filter(v => {
                      if (!v.vencimiento) return false;
                      try {
                        const venc = new Date(v.vencimiento);
                        return venc >= new Date();
                      } catch { return false; }
                    })
                    .sort((a, b) => {
                      try {
                        return new Date(a.vencimiento).getTime() - new Date(b.vencimiento).getTime();
                      } catch {
                        return 0;
                      }
                    })
                    .slice(0, 5)
                    .map(v => (
                      <div key={v.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Truck size={18} className="text-neutral-400" />
                          <div>
                            <p className="font-medium text-neutral-900">{v.patente}</p>
                            <p className="text-xs text-neutral-500">{v.transportista}</p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {(() => {
                            try { return new Date(v.vencimiento).toLocaleDateString('es-AR'); } catch { return v.vencimiento; }
                          })()}
                        </Badge>
                      </div>
                    ))}
                  {allVehicles.filter(v => {
                    if (!v.vencimiento) return false;
                    try { return new Date(v.vencimiento) >= new Date(); } catch { return false; }
                  }).length === 0 && (
                    <p className="text-sm text-neutral-400 text-center py-4">Sin vencimientos próximos</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Habilitaciones Vencidas" />
              <CardContent>
                <div className="space-y-3 animate-fade-in">
                  {allVehicles
                    .filter(v => {
                      if (!v.vencimiento) return false;
                      try { return new Date(v.vencimiento) < new Date(); } catch { return false; }
                    })
                    .slice(0, 5)
                    .map(v => (
                      <div key={v.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText size={18} className="text-neutral-400" />
                          <div>
                            <p className="font-medium text-neutral-900">{v.patente}</p>
                            <p className="text-xs text-neutral-500">{v.transportista}</p>
                          </div>
                        </div>
                        <Badge variant="soft" color="error">
                          {(() => {
                            try { return new Date(v.vencimiento).toLocaleDateString('es-AR'); } catch { return v.vencimiento; }
                          })()}
                        </Badge>
                      </div>
                    ))}
                  {allVehicles.filter(v => {
                    if (!v.vencimiento) return false;
                    try { return new Date(v.vencimiento) < new Date(); } catch { return false; }
                  }).length === 0 && (
                    <p className="text-sm text-neutral-400 text-center py-4">Sin habilitaciones vencidas</p>
                  )}
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
            <Button onClick={() => { toast.info('Los vehículos se gestionan desde la ficha del transportista'); setIsModalOpen(false); }}>Registrar Vehículo</Button>
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
              {transportistas.map(t => (
                <option key={t.id} value={t.id}>{t.razonSocial}</option>
              ))}
              {transportistas.length === 0 && <option>Cargando transportistas...</option>}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminVehiculosPage;

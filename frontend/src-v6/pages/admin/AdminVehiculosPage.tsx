/**
 * SITREP v6 - Admin Vehículos Page
 * =================================
 * Gestión de vehículos de transporte
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Truck,
  Wrench,
  FileText,
  Download,
  Eye,
  Edit,
  Trash2,
  User,
  AlertTriangle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Table, Pagination } from '../../components/ui/Table';
import { SearchInput } from '../../components/ui/SearchInput';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { useTransportistas, useUpdateVehiculo, useDeleteVehiculo, useUpdateChofer, useDeleteChofer } from '../../hooks/useActores';
import { toast } from '../../components/ui/Toast';
import { downloadCsv } from '../../utils/exportCsv';

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

interface ChoferDisplay {
  id: string;
  transportistaId: string;
  nombre: string;
  apellido: string;
  dni: string;
  licencia: string;
  telefono: string;
  transportista: string;
  vencimiento: string;
  activo: boolean;
}

export const AdminVehiculosPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('vehiculos');

  // Vehiculo edit/delete state
  const [editingVehiculo, setEditingVehiculo] = useState<VehiculoDisplay | null>(null);
  const [deletingVehiculo, setDeletingVehiculo] = useState<{ id: string; transportistaId: string; patente: string } | null>(null);
  const [vehiculoForm, setVehiculoForm] = useState({ patente: '', marca: '', modelo: '', anio: '', capacidad: '', activo: true });

  // Chofer edit/delete state
  const [editingChofer, setEditingChofer] = useState<ChoferDisplay | null>(null);
  const [deletingChofer, setDeletingChofer] = useState<{ id: string; transportistaId: string; nombre: string } | null>(null);
  const [choferForm, setChoferForm] = useState({ nombre: '', apellido: '', dni: '', licencia: '', telefono: '', activo: true });

  // Choferes pagination
  const [choferPage, setChoferPage] = useState(1);
  const [choferSearch, setChoferSearch] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  const { data: transportistasData, isLoading, isError, error } = useTransportistas({ limit: 100, search: searchQuery || undefined });

  const transportistas = Array.isArray(transportistasData?.items) ? transportistasData.items : [];

  // Mutations
  const updateVehiculoMut = useUpdateVehiculo();
  const deleteVehiculoMut = useDeleteVehiculo();
  const updateChoferMut = useUpdateChofer();
  const deleteChoferMut = useDeleteChofer();

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

  // Flatten all choferes from all transportistas
  const allChoferes: ChoferDisplay[] = useMemo(() =>
    transportistas.flatMap(t =>
      (Array.isArray(t.choferes) ? t.choferes : []).map(c => ({
        id: c.id,
        transportistaId: t.id,
        nombre: c.nombre,
        apellido: c.apellido,
        dni: c.dni,
        licencia: c.licencia,
        telefono: c.telefono || '',
        transportista: t.razonSocial,
        vencimiento: c.vencimiento || '',
        activo: c.activo,
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

  // Pagination for vehicles
  const itemsPerPage = 10;
  const totalFilteredPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Filtered & paginated choferes
  const filteredChoferes = allChoferes.filter(c =>
    String(c.nombre || '').toLowerCase().includes(choferSearch.toLowerCase()) ||
    String(c.apellido || '').toLowerCase().includes(choferSearch.toLowerCase()) ||
    String(c.dni || '').toLowerCase().includes(choferSearch.toLowerCase()) ||
    String(c.transportista || '').toLowerCase().includes(choferSearch.toLowerCase()) ||
    String(c.licencia || '').toLowerCase().includes(choferSearch.toLowerCase())
  );
  const totalChoferPages = Math.max(1, Math.ceil(filteredChoferes.length / itemsPerPage));
  const paginatedChoferes = filteredChoferes.slice((choferPage - 1) * itemsPerPage, choferPage * itemsPerPage);

  // Handlers
  const handleEditVehiculo = async () => {
    if (!editingVehiculo) return;
    try {
      await updateVehiculoMut.mutateAsync({
        transportistaId: editingVehiculo.transportistaId,
        vehiculoId: editingVehiculo.id,
        data: {
          patente: vehiculoForm.patente,
          marca: vehiculoForm.marca,
          modelo: vehiculoForm.modelo,
          anio: Number(vehiculoForm.anio),
          capacidad: Number(vehiculoForm.capacidad),
          activo: vehiculoForm.activo,
        },
      });
      toast.success('Actualizado', 'Vehículo actualizado exitosamente');
      setEditingVehiculo(null);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo actualizar el vehículo');
    }
  };

  const handleDeleteVehiculo = async () => {
    if (!deletingVehiculo) return;
    try {
      await deleteVehiculoMut.mutateAsync({
        transportistaId: deletingVehiculo.transportistaId,
        vehiculoId: deletingVehiculo.id,
      });
      toast.success('Eliminado', 'Vehículo eliminado exitosamente');
      setDeletingVehiculo(null);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo eliminar el vehículo');
    }
  };

  const handleEditChofer = async () => {
    if (!editingChofer) return;
    try {
      await updateChoferMut.mutateAsync({
        transportistaId: editingChofer.transportistaId,
        choferId: editingChofer.id,
        data: {
          nombre: choferForm.nombre,
          apellido: choferForm.apellido,
          dni: choferForm.dni,
          licencia: choferForm.licencia,
          telefono: choferForm.telefono,
          activo: choferForm.activo,
        },
      });
      toast.success('Actualizado', 'Chofer actualizado exitosamente');
      setEditingChofer(null);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo actualizar el chofer');
    }
  };

  const handleDeleteChofer = async () => {
    if (!deletingChofer) return;
    try {
      await deleteChoferMut.mutateAsync({
        transportistaId: deletingChofer.transportistaId,
        choferId: deletingChofer.id,
      });
      toast.success('Eliminado', 'Chofer eliminado exitosamente');
      setDeletingChofer(null);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo eliminar el chofer');
    }
  };

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
            onClick={(e) => { e.stopPropagation(); navigate(isMobile ? '/mobile/admin/actores/transportistas/' + row.transportistaId : '/admin/actores/transportistas/' + row.transportistaId); }}
            title="Ver transportista"
          >
            <Eye size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setEditingVehiculo(row);
              setVehiculoForm({
                patente: row.patente,
                marca: row.marca,
                modelo: row.modelo,
                anio: String(row.anio || ''),
                capacidad: row.capacidad.replace(/[^\d]/g, ''),
                activo: row.activo,
              });
            }}
            title="Editar"
          >
            <Edit size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); setDeletingVehiculo({ id: row.id, transportistaId: row.transportistaId, patente: row.patente }); }}
            title="Eliminar"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  const choferColumns = [
    {
      key: 'chofer',
      width: '22%',
      header: 'Chofer',
      render: (row: ChoferDisplay) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-info-100 rounded-lg flex items-center justify-center">
            <User size={20} className="text-info-600" />
          </div>
          <div>
            <p className="font-medium text-neutral-900">{row.nombre} {row.apellido}</p>
            <p className="text-xs text-neutral-500">DNI {row.dni}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'licencia',
      width: '15%',
      hiddenBelow: 'md' as const,
      header: 'Licencia',
      render: (row: ChoferDisplay) => (
        <span className="text-sm text-neutral-700">{row.licencia || 'Sin licencia'}</span>
      ),
    },
    {
      key: 'transportista',
      width: '20%',
      hiddenBelow: 'md' as const,
      header: 'Transportista',
      render: (row: ChoferDisplay) => (
        <span className="text-sm text-neutral-700">{row.transportista}</span>
      ),
    },
    {
      key: 'vencimiento',
      width: '15%',
      header: 'Vencimiento',
      render: (row: ChoferDisplay) => {
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
      render: (row: ChoferDisplay) => (
        <Badge variant="soft" color={row.activo ? 'success' : 'neutral'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      width: '11%',
      header: '',
      align: 'right' as const,
      render: (row: ChoferDisplay) => (
        <div className="flex items-center justify-end gap-1">
          <button
            className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(isMobile ? '/mobile/admin/actores/transportistas/' + row.transportistaId : '/admin/actores/transportistas/' + row.transportistaId); }}
            title="Ver transportista"
          >
            <Eye size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setEditingChofer(row);
              setChoferForm({
                nombre: row.nombre,
                apellido: row.apellido,
                dni: row.dni,
                licencia: row.licencia,
                telefono: row.telefono,
                activo: row.activo,
              });
            }}
            title="Editar"
          >
            <Edit size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); setDeletingChofer({ id: row.id, transportistaId: row.transportistaId, nombre: `${row.nombre} ${row.apellido}` }); }}
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
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Vehículos</h2>
          <p className="text-neutral-600 mt-1">
            Gestión de flota de transporte
          </p>
        </div>
        <Button variant="outline" leftIcon={<Download size={18} />} onClick={() => downloadCsv(allVehicles.map(v => ({ Patente: v.patente, Marca: v.marca, Modelo: v.modelo, Año: v.anio, Capacidad: v.capacidad, Transportista: v.transportista, Habilitación: v.habilitacion, Estado: v.estado })), 'vehiculos')}>
          Exportar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <Tab id="choferes">Choferes</Tab>
          <Tab id="documentacion">Documentación</Tab>
        </TabList>

        <TabPanel id="vehiculos">
          <Card>
            <CardContent className="p-4">
              <div className="mb-4">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Buscar por patente, transportista o marca..."
                />
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
                    onRowClick={(row) => navigate(isMobile ? `/mobile/admin/actores/transportistas/${row.transportistaId}` : `/admin/actores/transportistas/${row.transportistaId}`)}
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
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel id="choferes">
          <Card>
            <CardContent className="p-4">
              <div className="mb-4">
                <SearchInput
                  value={choferSearch}
                  onChange={(v) => { setChoferSearch(v); setChoferPage(1); }}
                  placeholder="Buscar por nombre, DNI, licencia o transportista..."
                />
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={32} className="animate-spin text-primary-500" />
                  <span className="ml-3 text-neutral-600">Cargando choferes...</span>
                </div>
              ) : isError ? (
                <div className="flex items-center justify-center py-16 text-error-600">
                  <span>Error al cargar datos: {(error as Error)?.message || 'Error desconocido'}</span>
                </div>
              ) : (
                <>
                  <Table
                    data={paginatedChoferes}
                    columns={choferColumns}
                    keyExtractor={(row) => row.id}
                    onRowClick={(row) => navigate(isMobile ? `/mobile/admin/actores/transportistas/${row.transportistaId}` : `/admin/actores/transportistas/${row.transportistaId}`)}
                    stickyHeader
                  />
                  <Pagination
                    currentPage={choferPage}
                    totalPages={totalChoferPages}
                    totalItems={filteredChoferes.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setChoferPage}
                  />
                </>
              )}
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

      {/* Edit Vehicle Modal */}
      <Modal
        isOpen={!!editingVehiculo}
        onClose={() => setEditingVehiculo(null)}
        title="Editar Vehículo"
        size="base"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingVehiculo(null)}>Cancelar</Button>
            <Button onClick={handleEditVehiculo} disabled={updateVehiculoMut.isPending}>
              {updateVehiculoMut.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Patente" value={vehiculoForm.patente} onChange={(e) => setVehiculoForm(f => ({ ...f, patente: e.target.value }))} />
            <Input label="Marca" value={vehiculoForm.marca} onChange={(e) => setVehiculoForm(f => ({ ...f, marca: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Modelo" value={vehiculoForm.modelo} onChange={(e) => setVehiculoForm(f => ({ ...f, modelo: e.target.value }))} />
            <Input label="Año" type="number" value={vehiculoForm.anio} onChange={(e) => setVehiculoForm(f => ({ ...f, anio: e.target.value }))} />
          </div>
          <Input label="Capacidad (kg)" type="number" value={vehiculoForm.capacidad} onChange={(e) => setVehiculoForm(f => ({ ...f, capacidad: e.target.value }))} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={vehiculoForm.activo} onChange={(e) => setVehiculoForm(f => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 rounded border-neutral-300 text-primary-500" />
            <span className="text-sm text-neutral-700">Activo</span>
          </label>
        </div>
      </Modal>

      {/* Delete Vehicle Confirm */}
      <ConfirmModal
        isOpen={!!deletingVehiculo}
        onClose={() => setDeletingVehiculo(null)}
        onConfirm={handleDeleteVehiculo}
        title="Eliminar Vehículo"
        description={`¿Está seguro que desea eliminar el vehículo "${deletingVehiculo?.patente}"?`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteVehiculoMut.isPending}
      />

      {/* Edit Chofer Modal */}
      <Modal
        isOpen={!!editingChofer}
        onClose={() => setEditingChofer(null)}
        title="Editar Chofer"
        size="base"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingChofer(null)}>Cancelar</Button>
            <Button onClick={handleEditChofer} disabled={updateChoferMut.isPending}>
              {updateChoferMut.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre" value={choferForm.nombre} onChange={(e) => setChoferForm(f => ({ ...f, nombre: e.target.value }))} />
            <Input label="Apellido" value={choferForm.apellido} onChange={(e) => setChoferForm(f => ({ ...f, apellido: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="DNI" value={choferForm.dni} onChange={(e) => setChoferForm(f => ({ ...f, dni: e.target.value }))} />
            <Input label="Licencia" value={choferForm.licencia} onChange={(e) => setChoferForm(f => ({ ...f, licencia: e.target.value }))} />
          </div>
          <Input label="Teléfono" value={choferForm.telefono} onChange={(e) => setChoferForm(f => ({ ...f, telefono: e.target.value }))} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={choferForm.activo} onChange={(e) => setChoferForm(f => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 rounded border-neutral-300 text-primary-500" />
            <span className="text-sm text-neutral-700">Activo</span>
          </label>
        </div>
      </Modal>

      {/* Delete Chofer Confirm */}
      <ConfirmModal
        isOpen={!!deletingChofer}
        onClose={() => setDeletingChofer(null)}
        onConfirm={handleDeleteChofer}
        title="Eliminar Chofer"
        description={`¿Está seguro que desea eliminar al chofer "${deletingChofer?.nombre}"?`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteChoferMut.isPending}
      />

    </div>
  );
};

export default AdminVehiculosPage;

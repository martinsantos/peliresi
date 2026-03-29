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
  FileDown,
  Eye,
  Edit,
  Trash2,
  User,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Printer,
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
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../components/ui/Toast';
import { downloadCsv } from '../../utils/exportCsv';
import { exportReportePDF } from '../../utils/exportPdf';

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
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [choferSortConfig, setChoferSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Vehiculo edit/delete state
  const [editingVehiculo, setEditingVehiculo] = useState<VehiculoDisplay | null>(null);
  const [deletingVehiculo, setDeletingVehiculo] = useState<{ id: string; transportistaId: string; patente: string } | null>(null);
  const [vehiculoForm, setVehiculoForm] = useState({ patente: '', marca: '', modelo: '', anio: '', capacidad: '', numeroHabilitacion: '', vencimiento: '', activo: true });

  // Chofer edit/delete state
  const [editingChofer, setEditingChofer] = useState<ChoferDisplay | null>(null);
  const [deletingChofer, setDeletingChofer] = useState<{ id: string; transportistaId: string; nombre: string } | null>(null);
  const [choferForm, setChoferForm] = useState({ nombre: '', apellido: '', dni: '', licencia: '', vencimiento: '', telefono: '', activo: true });

  // Choferes pagination
  const [choferPage, setChoferPage] = useState(1);
  const [choferSearch, setChoferSearch] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isTransportista } = useAuth();

  const { data: transportistasData, isLoading, isError, error } = useTransportistas({ limit: 100, search: searchQuery || undefined });

  const allTransportistas = Array.isArray(transportistasData?.items) ? transportistasData.items : [];
  // TRANSPORTISTA role: only show their own company's vehicles/choferes
  const transportistas = isTransportista && currentUser?.actorId
    ? allTransportistas.filter((t: any) => t.id === currentUser.actorId)
    : allTransportistas;

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

  const filteredData = useMemo(() => {
    let result = allVehicles.filter(v =>
      String(v.patente || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(v.transportista || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(v.marca || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        switch (sortConfig.key) {
          case 'vehiculo': return dir * a.patente.localeCompare(b.patente, 'es');
          case 'transportista': return dir * a.transportista.localeCompare(b.transportista, 'es');
          case 'estado': return dir * (Number(b.activo) - Number(a.activo));
          case 'vtv': {
            const aTime = a.vencimiento ? new Date(a.vencimiento).getTime() : 0;
            const bTime = b.vencimiento ? new Date(b.vencimiento).getTime() : 0;
            return dir * (aTime - bTime);
          }
          default: return 0;
        }
      });
    }
    return result;
  }, [allVehicles, searchQuery, sortConfig]);

  // Pagination for vehicles
  const itemsPerPage = 10;
  const totalFilteredPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Filtered & paginated choferes
  const filteredChoferes = useMemo(() => {
    let result = allChoferes.filter(c =>
      String(c.nombre || '').toLowerCase().includes(choferSearch.toLowerCase()) ||
      String(c.apellido || '').toLowerCase().includes(choferSearch.toLowerCase()) ||
      String(c.dni || '').toLowerCase().includes(choferSearch.toLowerCase()) ||
      String(c.transportista || '').toLowerCase().includes(choferSearch.toLowerCase()) ||
      String(c.licencia || '').toLowerCase().includes(choferSearch.toLowerCase())
    );
    if (choferSortConfig) {
      result = [...result].sort((a, b) => {
        const dir = choferSortConfig.direction === 'asc' ? 1 : -1;
        switch (choferSortConfig.key) {
          case 'chofer': return dir * `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, 'es');
          case 'transportista': return dir * a.transportista.localeCompare(b.transportista, 'es');
          case 'estado': return dir * (Number(b.activo) - Number(a.activo));
          default: return 0;
        }
      });
    }
    return result;
  }, [allChoferes, choferSearch, choferSortConfig]);
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
          numeroHabilitacion: vehiculoForm.numeroHabilitacion || undefined,
          vencimiento: vehiculoForm.vencimiento || undefined,
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
          vencimiento: choferForm.vencimiento || undefined,
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
      sortable: true,
      render: (row: VehiculoDisplay) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <Truck size={20} className="text-primary-600" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-neutral-900 truncate" title={row.patente}>{row.patente}</p>
            <p className="text-xs text-neutral-500 truncate" title={row.habilitacion || 'Sin habilitación'}>{row.habilitacion || 'Sin habilitación'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'detalles',
      width: '20%',
      hiddenBelow: 'lg' as const,
      header: 'Detalles',
      render: (row: VehiculoDisplay) => (
        <div className="text-sm min-w-0">
          <p className="text-neutral-900 truncate" title={`${row.marca} ${row.modelo}`}>{row.marca} {row.modelo}</p>
          <p className="text-neutral-500 truncate" title={`Año ${row.anio} ${row.capacidad ? `• ${row.capacidad}` : ''}`}>Año {row.anio} {row.capacidad ? `• ${row.capacidad}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'transportista',
      width: '20%',
      sortable: true,
      hiddenBelow: 'lg' as const,
      header: 'Transportista',
      render: (row: VehiculoDisplay) => (
        <span className="text-sm text-neutral-700 truncate block">{row.transportista}</span>
      ),
    },
    {
      key: 'vtv',
      width: '15%',
      sortable: true,
      hiddenBelow: 'xl' as const,
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
      sortable: true,
      header: 'Estado',
      render: (row: VehiculoDisplay) => {
        const estadoConfig: Record<string, { label: string; color: string }> = {
          disponible: { label: 'Disponible', color: 'success' },
          en_viaje: { label: 'En Viaje', color: 'info' },
          mantenimiento: { label: 'Mantenimiento', color: 'warning' },
          inactivo: { label: 'Inactivo', color: 'neutral' },
        };
        const config = estadoConfig[row.estado] || estadoConfig.inactivo;
        return <Badge variant="soft" color={config.color}>{config.label}</Badge>;
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
            onClick={(e) => { e.stopPropagation(); navigate('/admin/actores/transportistas/' + row.transportistaId); }}
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
                numeroHabilitacion: row.habilitacion || '',
                vencimiento: row.vencimiento ? new Date(row.vencimiento).toISOString().split('T')[0] : '',
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
      sortable: true,
      header: 'Chofer',
      render: (row: ChoferDisplay) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-info-100 rounded-lg flex items-center justify-center">
            <User size={20} className="text-info-600" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-neutral-900 truncate">{row.nombre} {row.apellido}</p>
            <p className="text-xs text-neutral-500 truncate">DNI {row.dni}</p>
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
      width: '25%',
      sortable: true,
      hiddenBelow: 'md' as const,
      header: 'Transportista',
      render: (row: ChoferDisplay) => (
        <span className="text-sm text-neutral-700 truncate block">{row.transportista}</span>
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
      sortable: true,
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
            onClick={(e) => { e.stopPropagation(); navigate('/admin/actores/transportistas/' + row.transportistaId); }}
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
                vencimiento: row.vencimiento ? new Date(row.vencimiento).toISOString().split('T')[0] : '',
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

  const handleExportPdf = () => {
    exportReportePDF({
      titulo: 'Flota de Vehículos',
      subtitulo: 'Gestión de vehículos de transporte de residuos peligrosos',
      periodo: `Total: ${statsTotal} vehículos`,
      kpis: [
        { label: 'Total Vehículos', value: statsTotal },
        { label: 'Disponibles', value: statsDisponibles },
        { label: 'Inactivos', value: statsInactivos },
        { label: 'Vencidos', value: statsVencidos },
      ],
      tabla: {
        headers: ['Patente', 'Marca', 'Modelo', 'Año', 'Capacidad', 'Transportista', 'Habilitación', 'Estado'],
        rows: filteredData.map(v => [
          v.patente,
          v.marca,
          v.modelo,
          v.anio,
          v.capacidad,
          v.transportista,
          v.habilitacion,
          v.activo ? 'Disponible' : 'Inactivo',
        ]),
      },
    });
  };

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
          <button onClick={() => window.print()} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors" title="Imprimir"><Printer size={14} />Imprimir</button>
          <Button variant="outline" leftIcon={<Download size={18} />} onClick={() => downloadCsv(allVehicles.map(v => ({ Patente: v.patente, Marca: v.marca, Modelo: v.modelo, Año: v.anio, Capacidad: v.capacidad, Transportista: v.transportista, Habilitación: v.habilitacion, Estado: v.estado })), 'vehiculos', { titulo: 'Flota de Vehiculos', periodo: 'Todos los periodos', total: allVehicles.length })} className="hidden sm:inline-flex">
            CSV
          </Button>
          <button onClick={handleExportPdf} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-error-700 bg-error-50 hover:bg-error-100 rounded-lg border border-error-200 transition-colors" title="Exportar PDF"><FileDown size={14} />PDF</button>
        </div>
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
          {/* Mobile Search */}
          <div className="md:hidden mb-3">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar por patente, transportista o marca..."
            />
          </div>

          {/* Mobile Card View */}
          {!isLoading && !isError && paginatedData.length > 0 && (
            <div className="md:hidden space-y-2">
              {paginatedData.map((v) => {
                const estadoConfig: Record<string, { label: string; color: string }> = {
                  disponible: { label: 'Disponible', color: 'success' },
                  en_viaje: { label: 'En Viaje', color: 'info' },
                  mantenimiento: { label: 'Mantenimiento', color: 'warning' },
                  inactivo: { label: 'Inactivo', color: 'neutral' },
                };
                const config = estadoConfig[v.estado] || estadoConfig.inactivo;
                return (
                  <Card
                    key={v.id}
                    className="active:scale-[0.98] transition-transform cursor-pointer"
                    onClick={() => navigate(`/admin/actores/transportistas/${v.transportistaId}`)}
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center shrink-0">
                            <Truck size={16} className="text-primary-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-neutral-900">{v.patente}</p>
                            <p className="text-xs text-neutral-500 truncate">{v.marca} {v.modelo}</p>
                          </div>
                        </div>
                        <Badge variant="soft" color={config.color}>{config.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2 pl-10">
                        <span className="text-xs text-neutral-500 truncate">{v.transportista}</span>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            className="p-1.5 text-neutral-400 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors"
                            onClick={() => {
                              setEditingVehiculo(v);
                              setVehiculoForm({
                                patente: v.patente,
                                marca: v.marca,
                                modelo: v.modelo,
                                anio: String(v.anio || ''),
                                capacidad: v.capacidad.replace(/[^\d]/g, ''),
                                numeroHabilitacion: v.habilitacion || '',
                                vencimiento: v.vencimiento ? new Date(v.vencimiento).toISOString().split('T')[0] : '',
                                activo: v.activo,
                              });
                            }}
                            title="Editar"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="p-1.5 text-neutral-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
                            onClick={() => setDeletingVehiculo({ id: v.id, transportistaId: v.transportistaId, patente: v.patente })}
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
              <Pagination
                currentPage={currentPage}
                totalPages={totalFilteredPages}
                totalItems={filteredData.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}

          {/* Desktop Table */}
          <Card className="hidden md:block">
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
                    sortable={true}
                    onSort={(key, dir) => setSortConfig({ key, direction: dir })}
                    onRowClick={(row) => navigate(`/admin/actores/transportistas/${row.transportistaId}`)}
                    stickyHeader
                    fixedLayout
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
          {/* Mobile Search */}
          <div className="md:hidden mb-3">
            <SearchInput
              value={choferSearch}
              onChange={(v) => { setChoferSearch(v); setChoferPage(1); }}
              placeholder="Buscar por nombre, DNI, licencia o transportista..."
            />
          </div>

          {/* Mobile Card View */}
          {!isLoading && !isError && paginatedChoferes.length > 0 && (
            <div className="md:hidden space-y-2">
              {paginatedChoferes.map((c) => (
                <Card
                  key={c.id}
                  className="active:scale-[0.98] transition-transform cursor-pointer"
                  onClick={() => navigate(`/admin/actores/transportistas/${c.transportistaId}`)}
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 bg-info-50 rounded-lg flex items-center justify-center shrink-0">
                          <User size={16} className="text-info-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-neutral-900 truncate">{c.nombre} {c.apellido}</p>
                          <p className="text-xs text-neutral-500">DNI {c.dni}</p>
                        </div>
                      </div>
                      <Badge variant="soft" color={c.activo ? 'success' : 'neutral'}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2 pl-10">
                      <span className="text-xs text-neutral-500 truncate">{c.transportista}</span>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          className="p-1.5 text-neutral-400 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors"
                          onClick={() => {
                            setEditingChofer(c);
                            setChoferForm({
                              nombre: c.nombre,
                              apellido: c.apellido,
                              dni: c.dni,
                              licencia: c.licencia,
                              vencimiento: c.vencimiento ? new Date(c.vencimiento).toISOString().split('T')[0] : '',
                              telefono: c.telefono,
                              activo: c.activo,
                            });
                          }}
                          title="Editar"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="p-1.5 text-neutral-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
                          onClick={() => setDeletingChofer({ id: c.id, transportistaId: c.transportistaId, nombre: `${c.nombre} ${c.apellido}` })}
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              <Pagination
                currentPage={choferPage}
                totalPages={totalChoferPages}
                totalItems={filteredChoferes.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setChoferPage}
              />
            </div>
          )}

          {/* Desktop Table */}
          <Card className="hidden md:block">
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
                    sortable={true}
                    onSort={(key, dir) => setChoferSortConfig({ key, direction: dir })}
                    onRowClick={(row) => navigate(`/admin/actores/transportistas/${row.transportistaId}`)}
                    stickyHeader
                    fixedLayout
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
          <div className="grid grid-cols-2 gap-4">
            <Input label="N° Habilitación" value={vehiculoForm.numeroHabilitacion} onChange={(e) => setVehiculoForm(f => ({ ...f, numeroHabilitacion: e.target.value }))} />
            <Input label="Vencimiento Habilitación" type="date" value={vehiculoForm.vencimiento} onChange={(e) => setVehiculoForm(f => ({ ...f, vencimiento: e.target.value }))} />
          </div>
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
          <div className="grid grid-cols-2 gap-4">
            <Input label="Teléfono" value={choferForm.telefono} onChange={(e) => setChoferForm(f => ({ ...f, telefono: e.target.value }))} />
            <Input label="Venc. Licencia" type="date" value={choferForm.vencimiento} onChange={(e) => setChoferForm(f => ({ ...f, vencimiento: e.target.value }))} />
          </div>
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

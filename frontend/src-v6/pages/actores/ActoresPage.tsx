/**
 * SITREP v6 - Gestion de Actores Page
 * ===================================
 * Vista unificada de generadores, transportistas y operadores
 * Con filtros sticky, tabs, Table component y pagination
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import {
  Users,
  Factory,
  Truck,
  FlaskConical,
  Search,
  Plus,
  Edit,
  Eye,
  FileText,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  ChevronRight,
  Trash2,
  ArrowLeft,
  Download,
  List,
  Grid3X3,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Table, Pagination } from '../../components/ui/Table';
import { Tabs, TabList, Tab } from '../../components/ui/Tabs';
import { downloadCsv } from '../../utils/exportCsv';
import {
  useGeneradores,
  useTransportistas,
  useOperadores,
  useCreateGenerador,
  useCreateTransportista,
  useCreateOperador,
  useDeleteGenerador,
  useDeleteTransportista,
  useDeleteOperador,
} from '../../hooks/useActores';

const tipoConfig = {
  generador: { label: 'Generador', icon: Factory, color: 'purple' },
  transportista: { label: 'Transportista', icon: Truck, color: 'orange' },
  operador: { label: 'Operador', icon: FlaskConical, color: 'blue' },
};

const INITIAL_FORM = {
  tipo: 'generador' as 'generador' | 'transportista' | 'operador',
  razonSocial: '',
  cuit: '',
  domicilio: '',
  telefono: '',
  email: '',
  password: '',
  nombre: '',
  numeroInscripcion: '',
  categoria: '',
  numeroHabilitacion: '',
};

export const ActoresPage: React.FC = () => {
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  const [activeTab, setActiveTab] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [vistaMode, setVistaMode] = useState<'grid' | 'list'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [actorSeleccionado, setActorSeleccionado] = useState<any>(null);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [actorEliminar, setActorEliminar] = useState<{ id: string; tipo: string; razonSocial: string } | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const itemsPerPage = 10;

  // API hooks
  const { data: generadoresData, isLoading: loadingGen } = useGeneradores({ search: busqueda || undefined });
  const { data: transportistasData, isLoading: loadingTrans } = useTransportistas({ search: busqueda || undefined });
  const { data: operadoresData, isLoading: loadingOp } = useOperadores({ search: busqueda || undefined });

  const createGenerador = useCreateGenerador();
  const createTransportista = useCreateTransportista();
  const createOperador = useCreateOperador();
  const deleteGenerador = useDeleteGenerador();
  const deleteTransportista = useDeleteTransportista();
  const deleteOperador = useDeleteOperador();

  const isLoading = loadingGen || loadingTrans || loadingOp;

  // Build unified list from API data
  const actoresData = useMemo(() => {
    const list: any[] = [];
    if (generadoresData?.items && Array.isArray(generadoresData.items)) {
      generadoresData.items.forEach((g: any) => list.push({ ...g, tipo: 'generador' }));
    }
    if (transportistasData?.items && Array.isArray(transportistasData.items)) {
      transportistasData.items.forEach((t: any) => list.push({ ...t, tipo: 'transportista' }));
    }
    if (operadoresData?.items && Array.isArray(operadoresData.items)) {
      operadoresData.items.forEach((o: any) => list.push({ ...o, tipo: 'operador' }));
    }
    return list;
  }, [generadoresData, transportistasData, operadoresData]);

  const generadoresCount = generadoresData?.total ?? actoresData.filter(a => a.tipo === 'generador').length;
  const transportistasCount = transportistasData?.total ?? actoresData.filter(a => a.tipo === 'transportista').length;
  const operadoresCount = operadoresData?.total ?? actoresData.filter(a => a.tipo === 'operador').length;
  const totalCount = generadoresCount + transportistasCount + operadoresCount;

  const tabCounts = {
    todos: totalCount,
    generador: generadoresCount,
    transportista: transportistasCount,
    operador: operadoresCount,
  };

  // Filter by tab + estado
  const actoresFiltrados = useMemo(() => {
    let filtered = actoresData;

    if (activeTab !== 'todos') {
      filtered = filtered.filter(a => a.tipo === activeTab);
    }

    if (filtroEstado !== 'todos') {
      filtered = filtered.filter(a => {
        const isActivo = a.activo !== false && a.estado !== 'inactivo';
        return filtroEstado === 'activo' ? isActivo : !isActivo;
      });
    }

    return filtered;
  }, [actoresData, activeTab, filtroEstado]);

  // Pagination
  const totalPages = Math.ceil(actoresFiltrados.length / itemsPerPage);
  const actoresPaginados = actoresFiltrados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const verDetalle = (actor: any) => {
    setActorSeleccionado(actor);
    setModalDetalle(true);
  };

  const handleCrear = async () => {
    try {
      const base = {
        email: form.email,
        password: form.password || 'TempPass123!',
        nombre: form.nombre || form.razonSocial,
        razonSocial: form.razonSocial,
        cuit: form.cuit,
        domicilio: form.domicilio,
        telefono: form.telefono,
      };

      if (form.tipo === 'generador') {
        await createGenerador.mutateAsync({ ...base, numeroInscripcion: form.numeroInscripcion, categoria: form.categoria });
      } else if (form.tipo === 'transportista') {
        await createTransportista.mutateAsync({ ...base, numeroHabilitacion: form.numeroHabilitacion });
      } else {
        await createOperador.mutateAsync({ ...base, numeroHabilitacion: form.numeroHabilitacion, categoria: form.categoria });
      }
      setModalCrear(false);
      setForm(INITIAL_FORM);
    } catch {
      // Error handled by React Query
    }
  };

  const handleEliminar = async () => {
    if (!actorEliminar) return;
    try {
      if (actorEliminar.tipo === 'generador') await deleteGenerador.mutateAsync(actorEliminar.id);
      else if (actorEliminar.tipo === 'transportista') await deleteTransportista.mutateAsync(actorEliminar.id);
      else await deleteOperador.mutateAsync(actorEliminar.id);
      setModalEliminar(false);
      setActorEliminar(null);
    } catch {
      // Error handled by React Query
    }
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Table columns
  const columns = [
    {
      key: 'actor',
      width: '28%',
      header: 'Actor',
      render: (row: any) => {
        const config = tipoConfig[row.tipo as keyof typeof tipoConfig] || tipoConfig['generador'];
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${config.color}-100`}>
              <Icon size={18} className={`text-${config.color}-600`} />
            </div>
            <div>
              <p className="font-semibold text-neutral-900">{row.razonSocial}</p>
              <p className="text-sm text-neutral-500 font-mono">{row.cuit}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'tipo',
      width: '12%',
      header: 'Tipo',
      render: (row: any) => {
        const config = tipoConfig[row.tipo as keyof typeof tipoConfig];
        return <Badge variant="soft" color={config?.color as any}>{config?.label}</Badge>;
      },
    },
    {
      key: 'contacto',
      width: '22%',
      hiddenBelow: 'md' as const,
      header: 'Contacto',
      render: (row: any) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-sm text-neutral-600">
            <Mail size={14} />
            <span className="truncate max-w-[150px]">{row.email}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-neutral-600">
            <Phone size={14} />
            <span>{row.telefono}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'estado',
      width: '10%',
      header: 'Estado',
      render: (row: any) => {
        const isActivo = row.activo !== false && row.estado !== 'inactivo';
        return (
          <Badge variant="soft" color={isActivo ? 'success' : 'neutral'}>
            {isActivo ? 'Activo' : 'Inactivo'}
          </Badge>
        );
      },
    },
    {
      key: 'acciones',
      width: '15%',
      header: '',
      align: 'right' as const,
      render: (row: any) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" className="p-2" onClick={(e: any) => { e.stopPropagation(); verDetalle(row); }}>
            <Eye size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="p-2" onClick={(e: any) => { e.stopPropagation(); }}>
            <Edit size={16} />
          </Button>
          <Button
            variant="ghost" size="sm" className="p-2 text-error-500 hover:text-error-600"
            onClick={(e: any) => {
              e.stopPropagation();
              setActorEliminar({ id: row.id, tipo: row.tipo, razonSocial: row.razonSocial });
              setModalEliminar(true);
            }}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Filter bar */}
      <div className="pt-2 pb-2">
        <div className="p-3 bg-white rounded-2xl border border-neutral-100 shadow-sm">
          <Tabs activeTab={activeTab} onChange={(t) => { setActiveTab(t); setCurrentPage(1); }}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
              <TabList>
                <Tab id="todos">
                  Todos
                  <Badge variant="soft" color="neutral" className="ml-2">{tabCounts.todos}</Badge>
                </Tab>
                <Tab id="generador">
                  Generadores
                  <Badge variant="soft" color="purple" className="ml-2">{tabCounts.generador}</Badge>
                </Tab>
                <Tab id="transportista">
                  Transportistas
                  <Badge variant="soft" color="warning" className="ml-2">{tabCounts.transportista}</Badge>
                </Tab>
                <Tab id="operador">
                  Operadores
                  <Badge variant="soft" color="success" className="ml-2">{tabCounts.operador}</Badge>
                </Tab>
              </TabList>

              {/* Toggle Vista */}
              <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-lg">
                <button
                  onClick={() => setVistaMode('list')}
                  className={`p-2 rounded-md transition-colors ${vistaMode === 'list' ? 'bg-white shadow-sm text-primary-600' : 'text-neutral-500'}`}
                >
                  <List size={18} />
                </button>
                <button
                  onClick={() => setVistaMode('grid')}
                  className={`p-2 rounded-md transition-colors ${vistaMode === 'grid' ? 'bg-white shadow-sm text-primary-600' : 'text-neutral-500'}`}
                >
                  <Grid3X3 size={18} />
                </button>
              </div>
            </div>
          </Tabs>

          {/* Search + Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Buscar por razon social o CUIT..."
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setCurrentPage(1); }}
                leftIcon={<Search size={18} />}
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filtroEstado}
                onChange={(e) => { setFiltroEstado(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable page content */}
      <div className="space-y-6 pt-4 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-neutral-600" />
              </button>
            )}
            <div>
              <h2 className="text-2xl font-bold text-neutral-900">Gestion de Actores</h2>
              <p className="text-neutral-600 mt-1">
                {isLoading ? (
                  <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando actores...</span>
                ) : (
                  <>{totalCount} actores registrados</>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              leftIcon={<Download size={18} />}
              onClick={() => downloadCsv(actoresData.map(a => ({
                'Razon Social': a.razonSocial,
                CUIT: a.cuit,
                Tipo: tipoConfig[a.tipo as keyof typeof tipoConfig]?.label || a.tipo,
                Email: a.email,
                Telefono: a.telefono,
                Domicilio: a.domicilio,
                Estado: (a.activo !== false && a.estado !== 'inactivo') ? 'Activo' : 'Inactivo',
              })), 'actores')}
            >
              Exportar
            </Button>
            <Button leftIcon={<Plus size={18} />} onClick={() => setModalCrear(true)}>
              Nuevo Actor
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card
            className="bg-purple-50 border-purple-200 hover:shadow-md hover:border-purple-300 transition-all cursor-pointer group"
            onClick={() => navigate(mp('/admin/actores/generadores'))}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg group-hover:scale-110 transition-transform">
                <Factory size={20} className="text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-purple-700">Generadores</p>
                <p className="text-2xl font-bold text-purple-900">{generadoresCount}</p>
              </div>
              <ChevronRight size={16} className="text-purple-400" />
            </CardContent>
          </Card>
          <Card
            className="bg-orange-50 border-orange-200 hover:shadow-md hover:border-orange-300 transition-all cursor-pointer group"
            onClick={() => navigate(mp('/admin/actores/transportistas'))}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg group-hover:scale-110 transition-transform">
                <Truck size={20} className="text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-orange-700">Transportistas</p>
                <p className="text-2xl font-bold text-orange-900">{transportistasCount}</p>
              </div>
              <ChevronRight size={16} className="text-orange-400" />
            </CardContent>
          </Card>
          <Card
            className="bg-blue-50 border-blue-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
            onClick={() => navigate(mp('/admin/actores/operadores'))}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg group-hover:scale-110 transition-transform">
                <FlaskConical size={20} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-blue-700">Operadores</p>
                <p className="text-2xl font-bold text-blue-900">{operadoresCount}</p>
              </div>
              <ChevronRight size={16} className="text-blue-400" />
            </CardContent>
          </Card>
          <Card className="bg-neutral-50 border-neutral-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-neutral-100 rounded-lg">
                <Users size={20} className="text-neutral-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-700">Total</p>
                <p className="text-2xl font-bold text-neutral-900">{totalCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table or Grid */}
        {isLoading ? (
          <Card className="py-12">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
              <p className="text-neutral-500">Cargando actores...</p>
            </div>
          </Card>
        ) : vistaMode === 'list' ? (
          <>
            <Table
              data={actoresPaginados}
              columns={columns}
              keyExtractor={(row) => `${row.tipo}-${row.id}`}
              selectable
              selectedKeys={selectedRows}
              onSelectionChange={setSelectedRows}
              onRowClick={verDetalle}
              stickyHeader
              emptyMessage="No se encontraron actores"
            />
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={actoresFiltrados.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {actoresPaginados.map((actor) => {
              const config = tipoConfig[actor.tipo as keyof typeof tipoConfig] || tipoConfig['generador'];
              const Icon = config.icon;
              const isActivo = actor.activo !== false && actor.estado !== 'inactivo';
              return (
                <Card key={`${actor.tipo}-${actor.id}`} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => verDetalle(actor)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-${config.color}-100`}>
                          <Icon size={24} className={`text-${config.color}-600`} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-neutral-900">{actor.razonSocial}</h4>
                          <p className="text-sm text-neutral-500 font-mono">{actor.cuit}</p>
                        </div>
                      </div>
                      <Badge variant="soft" color={isActivo ? 'success' : 'neutral'}>
                        {isActivo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                    <div className="space-y-2 mb-4">
                      <Badge variant="soft" color={config.color as any}>
                        {config.label}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-neutral-600">
                        <Mail size={14} />
                        <span className="truncate">{actor.email}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-neutral-600">
                        <Phone size={14} />
                        <span>{actor.telefono}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1 pt-3 border-t border-neutral-100">
                      <Button variant="ghost" size="sm" className="p-2" onClick={(e: any) => { e.stopPropagation(); verDetalle(actor); }}>
                        <Eye size={16} />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="p-2 text-error-500"
                        onClick={(e: any) => {
                          e.stopPropagation();
                          setActorEliminar({ id: actor.id, tipo: actor.tipo, razonSocial: actor.razonSocial });
                          setModalEliminar(true);
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {actoresFiltrados.length === 0 && (
              <div className="col-span-full py-12 text-center">
                <Users className="mx-auto text-neutral-300 mb-3" size={40} />
                <p className="text-neutral-500">No se encontraron actores</p>
              </div>
            )}
          </div>
        )}
        {vistaMode === 'grid' && totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={actoresFiltrados.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Modal de detalle */}
      <Modal
        isOpen={modalDetalle}
        onClose={() => setModalDetalle(false)}
        title="Detalle del Actor"
        size="lg"
      >
        {actorSeleccionado && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-start gap-4">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center bg-${tipoConfig[actorSeleccionado.tipo as keyof typeof tipoConfig].color}-100`}>
                {(() => {
                  const Icon = tipoConfig[actorSeleccionado.tipo as keyof typeof tipoConfig].icon;
                  return <Icon size={32} className={`text-${tipoConfig[actorSeleccionado.tipo as keyof typeof tipoConfig].color}-600`} />;
                })()}
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">{actorSeleccionado.razonSocial}</h3>
                <p className="text-neutral-500 font-mono">{actorSeleccionado.cuit}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="soft" color={actorSeleccionado.activo !== false ? 'success' : 'neutral'}>
                    {actorSeleccionado.activo !== false ? <CheckCircle size={12} className="mr-1" /> : <XCircle size={12} className="mr-1" />}
                    {actorSeleccionado.activo !== false ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <Badge variant="soft" color={tipoConfig[actorSeleccionado.tipo as keyof typeof tipoConfig].color as any}>
                    {tipoConfig[actorSeleccionado.tipo as keyof typeof tipoConfig].label}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-50 rounded-xl">
                <div className="flex items-center gap-2 text-neutral-600 mb-1">
                  <FileText size={16} />
                  <span className="text-sm font-medium">Domicilio</span>
                </div>
                <p className="text-neutral-900">{actorSeleccionado.domicilio}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-xl">
                <div className="flex items-center gap-2 text-neutral-600 mb-1">
                  <Phone size={16} />
                  <span className="text-sm font-medium">Telefono</span>
                </div>
                <p className="text-neutral-900">{actorSeleccionado.telefono}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-xl">
                <div className="flex items-center gap-2 text-neutral-600 mb-1">
                  <Mail size={16} />
                  <span className="text-sm font-medium">Email</span>
                </div>
                <p className="text-neutral-900">{actorSeleccionado.email}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal crear actor */}
      <Modal
        isOpen={modalCrear}
        onClose={() => { setModalCrear(false); setForm(INITIAL_FORM); }}
        title="Nuevo Actor"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalCrear(false); setForm(INITIAL_FORM); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleCrear}
              disabled={createGenerador.isPending || createTransportista.isPending || createOperador.isPending}
            >
              {(createGenerador.isPending || createTransportista.isPending || createOperador.isPending) ? 'Guardando...' : 'Crear Actor'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo de Actor</label>
            <select
              value={form.tipo}
              onChange={(e) => updateField('tipo', e.target.value)}
              className="w-full px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="generador">Generador</option>
              <option value="transportista">Transportista</option>
              <option value="operador">Operador</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Razon Social" value={form.razonSocial} onChange={(e) => updateField('razonSocial', e.target.value)} placeholder="Empresa S.A." />
            <Input label="CUIT" value={form.cuit} onChange={(e) => updateField('cuit', e.target.value)} placeholder="30-12345678-9" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="contacto@empresa.com" />
            <Input label="Telefono" value={form.telefono} onChange={(e) => updateField('telefono', e.target.value)} placeholder="+54 261 ..." />
          </div>
          <Input label="Domicilio" value={form.domicilio} onChange={(e) => updateField('domicilio', e.target.value)} placeholder="Av. San Martin 1234, Mendoza" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre Responsable" value={form.nombre} onChange={(e) => updateField('nombre', e.target.value)} placeholder="Juan Perez" />
            <Input label="Password inicial" type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Min. 8 caracteres" />
          </div>
          {form.tipo === 'generador' && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="N. Inscripcion" value={form.numeroInscripcion} onChange={(e) => updateField('numeroInscripcion', e.target.value)} placeholder="DGFA-2024-XXXX" />
              <Input label="Categoria" value={form.categoria} onChange={(e) => updateField('categoria', e.target.value)} placeholder="Grandes Generadores" />
            </div>
          )}
          {form.tipo === 'transportista' && (
            <Input label="N. Habilitacion" value={form.numeroHabilitacion} onChange={(e) => updateField('numeroHabilitacion', e.target.value)} placeholder="HAB-TR-2024-XXXX" />
          )}
          {form.tipo === 'operador' && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="N. Habilitacion" value={form.numeroHabilitacion} onChange={(e) => updateField('numeroHabilitacion', e.target.value)} placeholder="HAB-OP-2024-XXXX" />
              <Input label="Categoria" value={form.categoria} onChange={(e) => updateField('categoria', e.target.value)} placeholder="Incineracion" />
            </div>
          )}
        </div>
      </Modal>

      {/* Modal confirmar eliminar */}
      <ConfirmModal
        isOpen={modalEliminar}
        onClose={() => { setModalEliminar(false); setActorEliminar(null); }}
        onConfirm={handleEliminar}
        title="Eliminar Actor"
        description={`Esta seguro que desea eliminar a "${actorEliminar?.razonSocial}"? Esta accion no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteGenerador.isPending || deleteTransportista.isPending || deleteOperador.isPending}
      />
    </>
  );
};

export default ActoresPage;

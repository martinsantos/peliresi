/**
 * SITREP v6 - Gestion de Actores Page
 * ===================================
 * Vista unificada de generadores, transportistas y operadores
 * Con filtros sticky, tabs, Table component y pagination
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { useActorListNavigation } from '../../hooks/useActorListNavigation';
import { useAuth } from '../../contexts/AuthContext';
import { canReadActorDetail, type ActorReadType } from '../../utils/actorReadAccess';
import type { ActorDirectoryFilters, ActorDirectoryType } from '../../services/actores.service';
import {
  Users,
  Factory,
  Truck,
  FlaskConical,
  Search,
  ExternalLink,
  Eye,
  FileText,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  ChevronRight,
  Trash2,
  Download,
  FileDown,
  List,
  Grid3X3,
  Loader2,
  Printer,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { RecordListToolbar } from '../../components/crud/RecordListToolbar';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Table, Pagination } from '../../components/ui/Table';
import { Tabs, TabList, Tab } from '../../components/ui/Tabs';
import { Select } from '../../components/ui/Select';
import { downloadCsv } from '../../utils/exportCsv';
import { exportReportePDF } from '../../utils/exportPdf';
import { toast } from '../../components/ui/Toast';
import {
  useActorDirectory,
  useDeleteGenerador,
  useDeleteTransportista,
  useDeleteOperador,
} from '../../hooks/useActores';

const tipoConfig = {
  generador: { label: 'Generador', icon: Factory, color: 'purple' },
  transportista: { label: 'Transportista', icon: Truck, color: 'orange' },
  operador: { label: 'Operador', icon: FlaskConical, color: 'blue' },
};

export const ActoresPage: React.FC = () => {
  const list = useActorListNavigation();
  const mp = useMobilePrefix();
  const { currentUser, isRestricted } = useAuth();
  // Mirror the existing API's category mutation roles; inspection is consultation.
  const canManageActor = (tipo: string) => Boolean(!isRestricted && currentUser
    && (currentUser.rol === 'ADMIN' || currentUser.rol === `ADMIN_${tipo.toUpperCase()}`));
  const allowedActorTypes = (Object.keys(tipoConfig) as Array<keyof typeof tipoConfig>).filter(canManageActor);
  const canOpenFicha = (actor: any) => canReadActorDetail(currentUser, actor.tipo.toUpperCase() as ActorReadType, actor.id);
  const openFicha = (actor: any) => {
    if (!canOpenFicha(actor)) return;
    const category = actor.tipo === 'generador' ? 'generadores' : actor.tipo === 'transportista' ? 'transportistas' : 'operadores';
    list.open(mp(`/admin/actores/${category}/${encodeURIComponent(actor.id)}`));
  };
  const tabParam = list.text('tipo', 'todos');
  const activeTab: ActorDirectoryFilters['tipo'] = ['todos','generador','transportista','operador'].includes(tabParam) ? tabParam as ActorDirectoryFilters['tipo'] : 'todos';
  const estadoParam = list.text('estado', 'todos');
  const filtroEstado: ActorDirectoryFilters['estado'] = ['todos','activo','inactivo'].includes(estadoParam) ? estadoParam as ActorDirectoryFilters['estado'] : 'todos';
  const sortParam = list.text('sortBy', 'actor');
  const sortBy: ActorDirectoryFilters['sortBy'] = ['actor','tipo','estado'].includes(sortParam) ? sortParam as ActorDirectoryFilters['sortBy'] : 'actor';
  const sortOrder: 'asc' | 'desc' = list.text('sortOrder', 'asc') === 'desc' ? 'desc' : 'asc';
  const busqueda = list.text('q');
  const vistaMode = list.text('vista') === 'grid' ? 'grid' : 'list';
  const currentPage = Math.min(list.number('page', 1), 1_000_000);
  const setActiveTab = (value: string) => list.set('tipo', value === 'todos' ? undefined : value);
  const setBusqueda = (value: string) => list.set('q', value);
  const setFiltroEstado = (value: string) => list.set('estado', value === 'todos' ? undefined : value);
  const setVistaMode = (value: 'grid' | 'list') => list.set('vista', value === 'list' ? undefined : value);
  const setCurrentPage = (value: number) => list.set('page', value === 1 ? undefined : value);
  const [actorSeleccionado, setActorSeleccionado] = useState<any>(null);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [actorEliminar, setActorEliminar] = useState<{ id: string; tipo: string; razonSocial: string } | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const deleteInFlight = useRef(false);
  const [creationType, setCreationType] = useState<ActorDirectoryType>('generador');

  const itemsPerPage = 20;

  const directory = useActorDirectory({ search: busqueda.trim() || undefined, tipo: activeTab, estado: filtroEstado,
    sortBy, sortOrder, page: currentPage, limit: itemsPerPage });
  const deleteGenerador = useDeleteGenerador();
  const deleteTransportista = useDeleteTransportista();
  const deleteOperador = useDeleteOperador();
  const { data, isError } = directory;
  const isLoading = directory.isLoading || directory.isFetching;
  useEffect(() => {
    if (data && data.pagination.page !== currentPage) setCurrentPage(data.pagination.page);
  }, [data?.pagination.page, currentPage]);
  const actoresPaginados = data?.items || [];
  const generadoresCount = data?.counts.generador ?? 0;
  const transportistasCount = data?.counts.transportista ?? 0;
  const operadoresCount = data?.counts.operador ?? 0;
  const totalCount = generadoresCount + transportistasCount + operadoresCount;
  const serverTotal = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.pages ?? 0;
  const displayCount = (count: number) => data && !isError && !isLoading ? count : '—';

  const tabCounts = {
    todos: displayCount(totalCount),
    generador: displayCount(generadoresCount),
    transportista: displayCount(transportistasCount),
    operador: displayCount(operadoresCount),
  };
  const selectedDirectory = activeTab === 'generador' ? { label:'Generadores', path:'/admin/actores/generadores' }
    : activeTab === 'transportista' ? { label:'Transportistas', path:'/admin/actores/transportistas' }
    : activeTab === 'operador' ? { label:'Operadores', path:'/admin/actores/operadores' } : null;

  const verDetalle = (actor: any) => {
    setActorSeleccionado(actor);
    setModalDetalle(true);
  };

  const handleCrear = () => {
    if (!canManageActor(creationType)) return;
    const category = creationType === 'generador' ? 'generadores' : creationType === 'transportista' ? 'transportistas' : 'operadores';
    setModalCrear(false);
    list.open(mp(`/admin/actores/${category}/nuevo`));
  };

  const handleEliminar = async () => {
    if (!actorEliminar || !canManageActor(actorEliminar.tipo) || deleteInFlight.current) return;
    deleteInFlight.current = true;
    setDeleteError('');
    try {
      if (actorEliminar.tipo === 'generador') await deleteGenerador.mutateAsync(actorEliminar.id);
      else if (actorEliminar.tipo === 'transportista') await deleteTransportista.mutateAsync(actorEliminar.id);
      else await deleteOperador.mutateAsync(actorEliminar.id);
      setModalEliminar(false);
      setActorEliminar(null);
      void directory.refetch();
    } catch (error: any) {
      setDeleteError(error?.response?.data?.message || 'No se pudo eliminar. Revisá la conexión y volvé a intentar.');
    } finally { deleteInFlight.current = false; }
  };

  const exportFilters = [busqueda.trim() ? `Búsqueda: ${busqueda.trim()}` : '', activeTab !== 'todos' ? `Tipo: ${activeTab}` : '', filtroEstado !== 'todos' ? `Estado: ${filtroEstado}` : ''].filter(Boolean).join(', ') || 'Sin filtros';
  const handleExportCsv = () => {
    if (!data || isError || !actoresPaginados.length) return;
    try {
      downloadCsv(actoresPaginados.map(a => ({
        'Razon Social': a.razonSocial, CUIT: a.cuit, Tipo: tipoConfig[a.tipo]?.label || a.tipo,
        Email: a.email, Telefono: a.telefono, Domicilio: a.domicilio, Estado: a.activo ? 'Activo' : 'Inactivo',
      })), 'actores-pagina', { titulo: 'Actores · página actual', periodo: `Página ${data.pagination.page} de ${Math.max(1, totalPages)}`, filtros: exportFilters, total: actoresPaginados.length });
    } catch {
      toast.error('Exportar', 'No se pudo generar el CSV de esta página.');
    }
  };
  const handleExportPdf = async () => {
    if (!data || isError || !actoresPaginados.length) return;
    try { await exportReportePDF({
      titulo: 'Gestión de Actores',
      subtitulo: `Resultados de la página actual · ${exportFilters}`,
      periodo: `Página ${data.pagination.page} de ${Math.max(1, totalPages)} · ${serverTotal} resultados`,
      kpis: [
        { label: 'Total Actores', value: totalCount },
        { label: 'Generadores', value: generadoresCount },
        { label: 'Transportistas', value: transportistasCount },
        { label: 'Operadores', value: operadoresCount },
      ],
      tabla: {
        headers: ['Razón Social', 'CUIT', 'Tipo', 'Email', 'Teléfono', 'Estado'],
        rows: actoresPaginados.map(a => [
          a.razonSocial || '',
          a.cuit || '',
          tipoConfig[a.tipo as keyof typeof tipoConfig]?.label || a.tipo,
          a.email || '',
          a.telefono || '',
          a.activo ? 'Activo' : 'Inactivo',
        ]),
      },
    }); } catch {
      toast.error('Exportar', 'No se pudo generar el PDF de esta página.');
    }
  };

  // Table columns
  const columns = [
    {
      key: 'actor',
      // Keep identity flexible so selection cannot absorb unused percentages.
      header: 'Actor',
      sortable: true,
      render: (row: any) => {
        const config = tipoConfig[row.tipo as keyof typeof tipoConfig] || tipoConfig['generador'];
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${config.color}-100`}>
              <Icon size={18} className={`text-${config.color}-600`} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-neutral-900 truncate">{row.razonSocial}</p>
              <p className="text-sm text-neutral-500 font-mono truncate">{row.cuit}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'tipo',
      width: '12%',
      header: 'Tipo',
      sortable: true,
      render: (row: any) => {
        const config = tipoConfig[row.tipo as keyof typeof tipoConfig];
        return <Badge variant="soft" color={config?.color}>{config?.label}</Badge>;
      },
    },
    {
      key: 'contacto',
      width: '22%',
      hiddenBelow: 'lg' as const,
      header: 'Contacto',
      render: (row: any) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-sm text-neutral-600">
            <Mail size={14} />
            <span className="truncate min-w-0 flex-1">{row.email}</span>
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
      sortable: true,
      render: (row: any) => {
        const isActivo = row.activo;
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
          <Button variant="ghost" size="sm" className="p-2" aria-label={`Vista rápida de ${row.razonSocial}`} onClick={(e: any) => { e.stopPropagation(); verDetalle(row); }}>
            <Eye size={16} />
          </Button>
          {canOpenFicha(row) && <Button variant="ghost" size="sm" className="p-2" aria-label={`Abrir ficha de ${row.razonSocial}`} onClick={(e: any) => {
            e.stopPropagation();
            openFicha(row);
          }}>
            <ExternalLink size={16} />
          </Button>}
          {canManageActor(row.tipo) && <Button
            variant="ghost" size="sm" className="p-2 text-error-500 hover:text-error-600"
            aria-label={`Eliminar ${row.razonSocial}`}
            onClick={(e: any) => {
              e.stopPropagation();
              setDeleteError('');
              setActorEliminar({ id: row.id, tipo: row.tipo, razonSocial: row.razonSocial });
              setModalEliminar(true);
            }}
          >
            <Trash2 size={16} />
          </Button>}
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Los filtros se desplazan con el contenido y no tapan las filas en móvil. */}
      <div className="bg-[#FAFAF8] -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-2">
        <div className="p-3 bg-white rounded-2xl border border-neutral-100 shadow-sm">
          <Tabs activeTab={activeTab} onChange={(t) => { setActiveTab(t); setCurrentPage(1); }}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
              <TabList>
                <Tab id="todos">
                  Todos{' '}
                  <Badge variant="soft" color="neutral" className="ml-2">{tabCounts.todos}</Badge>
                </Tab>
                <Tab id="generador">
                  Generadores{' '}
                  <Badge variant="soft" color="purple" className="ml-2">{tabCounts.generador}</Badge>
                </Tab>
                <Tab id="transportista">
                  Transportistas{' '}
                  <Badge variant="soft" color="warning" className="ml-2">{tabCounts.transportista}</Badge>
                </Tab>
                <Tab id="operador">
                  Operadores{' '}
                  <Badge variant="soft" color="success" className="ml-2">{tabCounts.operador}</Badge>
                </Tab>
              </TabList>

              {/* Toggle Vista */}
              <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-lg">
                <button
                  type="button"
                  aria-label="Vista de lista"
                  aria-pressed={vistaMode === 'list'}
                  onClick={() => setVistaMode('list')}
                  className={`min-h-11 min-w-11 p-2 rounded-md transition-colors ${vistaMode === 'list' ? 'bg-white shadow-sm text-primary-600' : 'text-neutral-500'}`}
                >
                  <List size={18} />
                </button>
                <button
                  type="button"
                  aria-label="Vista de tarjetas"
                  aria-pressed={vistaMode === 'grid'}
                  onClick={() => setVistaMode('grid')}
                  className={`min-h-11 min-w-11 p-2 rounded-md transition-colors ${vistaMode === 'grid' ? 'bg-white shadow-sm text-primary-600' : 'text-neutral-500'}`}
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
                label="Buscar actores"
                placeholder="Buscar por razon social o CUIT..."
                maxLength={160}
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setCurrentPage(1); }}
                leftIcon={<Search size={18} />}
              />
            </div>
            <div className="w-full md:w-56">
              <Select
                label="Estado"
                value={filtroEstado}
                onChange={(val) => { setFiltroEstado(val); setCurrentPage(1); }}
                options={[
                  { value: 'todos', label: 'Todos los estados' },
                  { value: 'activo', label: 'Activos' },
                  { value: 'inactivo', label: 'Inactivos' },
                ]}
                size="base"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable page content */}
      <div className="space-y-6 pt-4 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-neutral-600" role="status">
                {isLoading ? (
                  <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando actores...</span>
                ) : isError || !data ? (
                  <>No se pudo consultar el padrón.</>
                ) : (
                  <>{serverTotal} {serverTotal === 1 ? 'resultado' : 'resultados'}{activeTab !== 'todos' || busqueda.trim() || filtroEstado !== 'todos' ? ' con los filtros actuales' : ' en el padrón'}</>
                )}
              </p>
              {selectedDirectory && canManageActor(activeTab) && <Link to={mp(selectedDirectory.path)} className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary-800 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
                Abrir padrón de {selectedDirectory.label}<ChevronRight size={16} aria-hidden="true" />
              </Link>}
            </div>
          </div>
          <RecordListToolbar title="Actores" newLabel="Nuevo Actor" onNew={allowedActorTypes.length ? () => {
            setCreationType(allowedActorTypes[0]); setModalCrear(true);
          } : undefined} exports={[
            { label: 'CSV de esta página', icon: <Download size={16} />, onClick: handleExportCsv, disabled: isLoading || isError || !actoresPaginados.length },
            { label: 'PDF de esta página', icon: <FileDown size={16} />, onClick: handleExportPdf, disabled: isLoading || isError || !actoresPaginados.length },
            { label: 'Imprimir esta página', icon: <Printer size={16} />, onClick: () => window.print(), disabled: isLoading || isError || !actoresPaginados.length },
          ]} />
        </div>

        {/* Table or Grid */}
        {isLoading ? (
          <Card className="py-12">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
              <p className="text-neutral-500">Cargando actores...</p>
            </div>
          </Card>
        ) : isError ? (
          <Card className="p-4"><div role="alert" className="space-y-3"><p>No pudimos consultar el padrón. Revisá la conexión y volvé a intentar.</p><Button variant="outline" onClick={() => void directory.refetch()}>Reintentar consulta</Button></div></Card>
        ) : vistaMode === 'list' ? (
          <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-2">
              {actoresPaginados.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="mx-auto text-neutral-300 mb-3" size={40} />
                  <p className="text-neutral-500">No se encontraron actores</p>
                </div>
              ) : actoresPaginados.map((actor) => {
                const config = tipoConfig[actor.tipo as keyof typeof tipoConfig] || tipoConfig['generador'];
                const Icon = config.icon;
                const isActivo = actor.activo;
                return (
                  <Card
                    key={`m-${actor.tipo}-${actor.id}`}
                    padding="none"
                  >
                    <button
                      type="button"
                      aria-label={`Vista rápida de ${actor.razonSocial}`}
                      className="w-full rounded-[12px] p-3 text-left transition-colors hover:bg-primary-50 active:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
                      onClick={() => verDetalle(actor)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-${config.color}-100`}>
                          <Icon size={18} className={`text-${config.color}-600`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="whitespace-normal break-words font-semibold text-neutral-900">{actor.razonSocial}</p>
                          <p className="text-xs text-neutral-500 font-mono">{actor.cuit}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge variant="soft" color={config.color} className="text-xs">{config.label}</Badge>
                            <Badge variant="soft" color={isActivo ? 'success' : 'neutral'} className="text-xs">
                              {isActivo ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-neutral-300 shrink-0 mt-2" />
                      </div>
                    </button>
                  </Card>
                );
              })}
            </div>
            {/* Desktop table view */}
            <div className="hidden md:block">
              <Table
                data={actoresPaginados}
                columns={columns}
                keyExtractor={(row) => `${row.tipo}-${row.id}`}
                sortable={true}
                sort={{ key: sortBy, direction: sortOrder }}
                onSort={(key, dir) => { list.set('sortBy', key === 'actor' ? undefined : key); list.set('sortOrder', dir === 'asc' ? undefined : dir); setCurrentPage(1); }}
                onRowClick={verDetalle}
                stickyHeader
                emptyMessage="No se encontraron actores"
              />
            </div>
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={serverTotal}
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
              const isActivo = actor.activo;
              return (
                <Card key={`${actor.tipo}-${actor.id}`} className="transition-shadow">
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
                      <Badge variant="soft" color={config.color}>
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
                      <Button variant="ghost" size="sm" className="p-2" aria-label={`Vista rápida de ${actor.razonSocial}`} onClick={(e: any) => { e.stopPropagation(); verDetalle(actor); }}>
                        <Eye size={16} />
                      </Button>
                      {canOpenFicha(actor) && <Button variant="ghost" size="sm" className="p-2" aria-label={`Abrir ficha de ${actor.razonSocial}`} onClick={(e: any) => { e.stopPropagation(); openFicha(actor); }}>
                        <ExternalLink size={16} />
                      </Button>}
                      {canManageActor(actor.tipo) && <Button
                        variant="ghost" size="sm" className="p-2 text-error-500"
                        aria-label={`Eliminar ${actor.razonSocial}`}
                        onClick={(e: any) => {
                          e.stopPropagation();
                          setDeleteError('');
                          setActorEliminar({ id: actor.id, tipo: actor.tipo, razonSocial: actor.razonSocial });
                          setModalEliminar(true);
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {actoresPaginados.length === 0 && (
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
            totalItems={serverTotal}
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
                  <Badge variant="soft" color={tipoConfig[actorSeleccionado.tipo as keyof typeof tipoConfig].color}>
                    {tipoConfig[actorSeleccionado.tipo as keyof typeof tipoConfig].label}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
            <div className="flex justify-end pt-2 border-t border-neutral-100">
              {canOpenFicha(actorSeleccionado) && <Button
                leftIcon={<Eye size={16} />}
                onClick={() => {
                  setModalDetalle(false);
                  openFicha(actorSeleccionado);
                }}
              >
                Ver detalle completo
              </Button>}
            </div>
          </div>
        )}
      </Modal>

      {/* El alta usa el formulario completo de cada actividad. */}
      <Modal
        isOpen={modalCrear && allowedActorTypes.length > 0}
        onClose={() => setModalCrear(false)}
        title="Nuevo Actor"
        size="lg"
        footer={<>
          <Button variant="outline" onClick={() => setModalCrear(false)}>Cancelar</Button>
          <Button onClick={handleCrear} disabled={!canManageActor(creationType)}>Continuar al formulario</Button>
        </>}
      >
        <div className="space-y-4">
          <p>Elegí la actividad para completar su formulario de alta.</p>
          <Select
            label="Tipo de Actor"
            value={creationType}
            onChange={(value) => { if (canManageActor(value)) setCreationType(value as ActorDirectoryType); }}
            options={[
              { value: 'generador', label: 'Generador' },
              { value: 'transportista', label: 'Transportista' },
              { value: 'operador', label: 'Operador' },
            ].filter(option => canManageActor(option.value))}
          />
        </div>
      </Modal>

      {/* Modal confirmar eliminar */}
      <ConfirmModal
        isOpen={Boolean(modalEliminar && actorEliminar && canManageActor(actorEliminar.tipo))}
        onClose={() => { setModalEliminar(false); setActorEliminar(null); setDeleteError(''); }}
        onConfirm={handleEliminar}
        title="Eliminar Actor"
        description={`Esta seguro que desea eliminar a "${actorEliminar?.razonSocial}"? Esta accion no se puede deshacer.`}
        error={deleteError}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteGenerador.isPending || deleteTransportista.isPending || deleteOperador.isPending}
      />
    </>
  );
};

export default ActoresPage;

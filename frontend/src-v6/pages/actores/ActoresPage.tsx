/**
 * SITREP v6 - Gestion de Actores Page
 * ===================================
 * Administracion de generadores, transportistas y operadores
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import {
  Users,
  Factory,
  Truck,
  Building2,
  Search,
  Plus,
  Filter,
  Edit,
  Eye,
  FileText,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  ChevronRight,
  Trash2,
  ArrowLeft
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
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
  operador: { label: 'Operador', icon: Building2, color: 'green' },
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
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [actorSeleccionado, setActorSeleccionado] = useState<any>(null);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [actorEliminar, setActorEliminar] = useState<{ id: string; tipo: string; razonSocial: string } | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

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
  const actoresFromApi: any[] = [];
  if (generadoresData?.items && Array.isArray(generadoresData.items)) {
    generadoresData.items.forEach((g: any) => actoresFromApi.push({ ...g, tipo: 'generador' }));
  }
  if (transportistasData?.items && Array.isArray(transportistasData.items)) {
    transportistasData.items.forEach((t: any) => actoresFromApi.push({ ...t, tipo: 'transportista' }));
  }
  if (operadoresData?.items && Array.isArray(operadoresData.items)) {
    operadoresData.items.forEach((o: any) => actoresFromApi.push({ ...o, tipo: 'operador' }));
  }

  const actoresData = actoresFromApi;

  const generadoresCount = generadoresData?.total ?? actoresData.filter(a => a.tipo === 'generador').length;
  const transportistasCount = transportistasData?.total ?? actoresData.filter(a => a.tipo === 'transportista').length;
  const operadoresCount = operadoresData?.total ?? actoresData.filter(a => a.tipo === 'operador').length;
  const totalCount = generadoresCount + transportistasCount + operadoresCount;

  // Server handles search; client filters by tipo
  const actoresFiltrados = actoresData.filter(actor => {
    const matchTipo = filtroTipo === 'todos' || actor.tipo === filtroTipo;
    return matchTipo;
  });

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

  return (
    <div className="space-y-6 animate-fade-in">
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
              Administra generadores, transportistas y operadores
            </p>
          </div>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => setModalCrear(true)}>
          Nuevo Actor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className="bg-purple-50 border-purple-200 hover:shadow-md hover:border-purple-300 transition-all cursor-pointer group"
          onClick={() => navigate(mp('/admin/generadores'))}
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
          onClick={() => navigate(mp('/actores/transportistas'))}
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
          className="bg-green-50 border-green-200 hover:shadow-md hover:border-green-300 transition-all cursor-pointer group"
          onClick={() => navigate(mp('/actores/operadores'))}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg group-hover:scale-110 transition-transform">
              <Building2 size={20} className="text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-green-700">Operadores</p>
              <p className="text-2xl font-bold text-green-900">{operadoresCount}</p>
            </div>
            <ChevronRight size={16} className="text-green-400" />
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

      {/* Filtros */}
      <Card padding="base">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por razon social o CUIT..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              leftIcon={<Search size={18} />}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="todos">Todos los tipos</option>
              <option value="generador">Generadores</option>
              <option value="transportista">Transportistas</option>
              <option value="operador">Operadores</option>
            </select>
            <Button variant="outline" leftIcon={<Filter size={18} />}>
              Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <Card className="py-12">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
            <p className="text-neutral-500">Cargando actores...</p>
          </div>
        </Card>
      )}

      {/* Tabla de actores */}
      {!isLoading && (
        <Card padding="none">
          <table className="w-full table-fixed">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '30%' }}>Actor</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '15%' }}>Tipo</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '25%' }}>Contacto</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '12%' }}>Estado</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-neutral-600 uppercase" style={{ width: '18%' }}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {actoresFiltrados.map((actor) => {
                  const config = tipoConfig[actor.tipo as keyof typeof tipoConfig] || tipoConfig['generador'];
                  const Icon = config.icon;
                  const isActivo = actor.activo !== false && actor.estado !== 'inactivo';
                  return (
                    <tr
                      key={`${actor.tipo}-${actor.id}`}
                      className="hover:bg-neutral-50 transition-colors cursor-pointer group"
                      onClick={() => verDetalle(actor)}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${config.color}-100 group-hover:scale-110 transition-transform`}>
                            <Icon size={18} className={`text-${config.color}-600`} />
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">{actor.razonSocial}</p>
                            <p className="text-sm text-neutral-500 font-mono">{actor.cuit}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="soft" color={config.color as any}>
                          {config.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <div className="space-y-1 animate-fade-in">
                          <div className="flex items-center gap-1 text-sm text-neutral-600">
                            <Mail size={14} />
                            <span className="truncate max-w-[150px]">{actor.email}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-neutral-600">
                            <Phone size={14} />
                            <span>{actor.telefono}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant="soft"
                          color={isActivo ? 'success' : 'neutral'}
                        >
                          {isActivo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-2"
                            onClick={(e) => { e.stopPropagation(); verDetalle(actor); }}
                          >
                            <Eye size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" className="p-2" onClick={(e) => { e.stopPropagation(); }}>
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-2 text-error-500 hover:text-error-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActorEliminar({ id: actor.id, tipo: actor.tipo, razonSocial: actor.razonSocial });
                              setModalEliminar(true);
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          {actoresFiltrados.length === 0 && !isLoading && (
            <div className="py-12 text-center">
              <Users className="mx-auto text-neutral-300 mb-3" size={40} />
              <p className="text-neutral-500">No se encontraron actores</p>
            </div>
          )}
        </Card>
      )}

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
    </div>
  );
};

export default ActoresPage;

/**
 * SITREP v6 - Usuarios Admin Page
 * ================================
 * Gestión de usuarios: confirmaciones y datos provistos por la API.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  UserPlus,
  Search,
  MoreHorizontal,
  Trash2,
  CheckCircle,
  XCircle,
  Shield,
  Factory,
  Truck,
  FlaskConical,
  Building2,
  Grid3X3,
  List,
  User,
  Eye,
  MapPin,
  UserCheck,
  UserX,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { Table, Pagination } from '../../components/ui/Table';
import { Select } from '../../components/ui/Select';
import { useUsuarios, useCreateUsuario, useDeleteUsuario, useUpdateUsuario, useToggleUsuarioActivo } from '../../hooks/useUsuarios';
import { downloadCsv } from '../../utils/exportCsv';
import { exportReportePDF } from '../../utils/exportPdf';
import { useAuth } from '../../contexts/AuthContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import api from '../../services/api';
import type { Rol } from '../../types/models';
import { useDebounce } from '../../hooks/useDebounce';
import { getApiErrorMessage } from '../../utils/api-error';


type UsuarioLocal = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  rol: string;
  sector: string;
  estado: string;
  ultimoAcceso: string;
  fechaRegistro: string;
  avatar: string;
  ubicacion: string;
  manifiestos: number | null;
  esInspector: boolean;
};

// ========================================
// CONFIGURACION DE ROLES
// ========================================
const rolConfig = {
  ADMIN:               { label: 'Super Administrador',    icon: Shield,       color: 'primary', bgColor: 'bg-primary-100',  textColor: 'text-primary-700',  borderColor: 'border-primary-200' },
  ADMIN_GENERADOR:     { label: 'Admin de Generadores',   icon: Factory,      color: 'purple',  bgColor: 'bg-purple-100',   textColor: 'text-purple-700',   borderColor: 'border-purple-200' },
  ADMIN_TRANSPORTISTA: { label: 'Admin de Transporte',    icon: Truck,        color: 'orange',  bgColor: 'bg-orange-100',   textColor: 'text-orange-700',   borderColor: 'border-orange-200' },
  ADMIN_OPERADOR:      { label: 'Admin de Operadores',    icon: FlaskConical, color: 'blue',    bgColor: 'bg-blue-100',     textColor: 'text-blue-700',     borderColor: 'border-blue-200' },
  GENERADOR:           { label: 'Generador',              icon: Factory,      color: 'emerald', bgColor: 'bg-emerald-100',  textColor: 'text-emerald-700',  borderColor: 'border-emerald-200' },
  TRANSPORTISTA:       { label: 'Transportista',          icon: Truck,        color: 'amber',   bgColor: 'bg-amber-100',    textColor: 'text-amber-700',    borderColor: 'border-amber-200' },
  OPERADOR:            { label: 'Operador',               icon: FlaskConical, color: 'sky',     bgColor: 'bg-sky-100',      textColor: 'text-sky-700',      borderColor: 'border-sky-200' },
};

/** Convert API Usuario to the local shape used in the UI */
function apiUserToLocal(u: any): UsuarioLocal {
  const initials = u.nombre && typeof u.nombre === 'string'
    ? u.nombre.split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase()
    : String(u.email || '').slice(0, 2).toUpperCase();

  const timeSince = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} dia${days > 1 ? 's' : ''}`;
  };

  return {
    id: u.id,
    nombre: [u.nombre, u.apellido].filter(Boolean).join(' '),
    email: u.email,
    telefono: u.telefono || '',
    rol: u.rol,
    sector: u.empresa || u.generador?.razonSocial || u.transportista?.razonSocial || u.operador?.razonSocial || '',
    estado: u.activo ? 'activo' : (u.emailVerified ? 'pendiente' : 'inactivo'),
    ultimoAcceso: u.lastLoginAt ? timeSince(u.lastLoginAt) : 'No informado',
    fechaRegistro: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '',
    avatar: initials,
    ubicacion: '',
    manifiestos: typeof u.manifiestosCount === 'number' ? u.manifiestosCount : null,
    esInspector: !!u.esInspector,
  };
}

// ========================================
// COMPONENTE PRINCIPAL
// ========================================
const USR_COL_MAP: Record<string, string> = { usuario: 'nombre', rol: 'rol', estado: 'activo', ultimoAcceso: 'createdAt' };

const UsuariosPage: React.FC = () => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [vistaMode, setVistaMode] = useState<'grid' | 'list'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { isAdmin, currentUser } = useAuth();
  const { impersonateUser } = useImpersonation();

  // Real API data
  const search = useDebounce(busqueda.trim(), 300);
  const itemsPerPage = 10;
  const { data: apiData, isLoading: apiLoading, isError: apiError, refetch } = useUsuarios({
    page: currentPage, limit: itemsPerPage, sortBy, sortOrder, search: search || undefined,
    rol: filtroRol !== 'todos' && filtroRol !== 'ADMIN_GRUPO' ? filtroRol as Rol : undefined,
    roles: filtroRol === 'ADMIN_GRUPO' ? ['ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'] : undefined,
    activo: filtroEstado === 'todos' ? undefined : filtroEstado === 'activo',
    emailVerified: filtroEstado === 'pendiente' ? true : filtroEstado === 'inactivo' ? false : undefined,
  });
  const createMutation = useCreateUsuario();
  const deleteMutation = useDeleteUsuario();
  const updateMutation = useUpdateUsuario();
  const toggleActivoMutation = useToggleUsuarioActivo();

  // Use only API data
  const usuarios: UsuarioLocal[] = useMemo(() => {
    if (apiData?.items && Array.isArray(apiData.items) && apiData.items.length > 0) {
      return apiData.items.map(apiUserToLocal);
    }
    return [];
  }, [apiData]);

  // Modal states
  const [modalCrear, setModalCrear] = useState(false);
  const [modalVer, setModalVer] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioLocal | null>(null);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [modalPromover, setModalPromover] = useState(false);
  const [promoverPassword, setPromoverPassword] = useState('');
  const [promoverLoading, setPromoverLoading] = useState(false);
  const [promoverTargetRol, setPromoverTargetRol] = useState('');

  // Form state for new user
  const [formNombre, setFormNombre] = useState('');
  const [formApellido, setFormApellido] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formRol, setFormRol] = useState('');
  const [formSector, setFormSector] = useState('');
  const [formPassword, setFormPassword] = useState('');

  // Form state for edit user
  const [editEmail, setEditEmail] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editEmpresa, setEditEmpresa] = useState('');
  const [editEsInspector, setEditEsInspector] = useState(false);

  const totalPages = apiData?.totalPages ?? 0;
  const totalItems = apiData?.total ?? 0;
  const usuariosPaginados = usuarios;
  useEffect(() => {
    if (apiData && currentPage > Math.max(1, apiData.totalPages)) setCurrentPage(Math.max(1, apiData.totalPages));
  }, [apiData, currentPage]);

  const cambiarEstado = (id: string, _nuevoEstado: string, onConfirmed?: () => void) => {
    if (toggleActivoMutation.isPending) return;
    toggleActivoMutation.mutate(id, {
      onSuccess: updated => {
        toast.success('Estado actualizado', `El usuario ahora está ${updated.activo ? 'activo' : 'inactivo'}.`);
        onConfirmed?.();
      },
      onError: error => {
        toast.error('No se pudo cambiar el estado', getApiErrorMessage(error, 'El cambio no fue confirmado. Revisá la conexión y volvé a intentar.'));
      },
    });
  };

  const eliminarUsuario = () => {
    if (usuarioSeleccionado && !deleteMutation.isPending) {
      deleteMutation.mutate(usuarioSeleccionado.id, {
        onSuccess: () => {
          setModalEliminar(false);
          toast.success('Usuario eliminado', 'El usuario fue eliminado correctamente');
        },
        onError: error => {
          toast.error('No se pudo eliminar el usuario', getApiErrorMessage(error, 'El servidor no confirmó la eliminación. Podés volver a intentar.'));
        },
      });
    }
  };

  const crearUsuario = () => {
    if (createMutation.isPending) return;
    if (!formEmail || !formNombre || !formRol) {
      toast.error('Error', 'Completa los campos obligatorios: nombre, email y rol');
      return;
    }
    if (!formPassword || formPassword.length < 8) {
      toast.error('Revisá la contraseña', 'Debe tener al menos 8 caracteres.');
      return;
    }
    createMutation.mutate(
      {
        email: formEmail,
        password: formPassword,
        nombre: formNombre,
        apellido: formApellido,
        rol: formRol as Rol,
        empresa: formSector,
        telefono: formTelefono,
      },
      {
        onSuccess: () => {
          setModalCrear(false);
          resetForm();
          toast.success('Usuario creado', 'El servidor confirmó el alta.');
        },
        onError: error => {
          toast.error('No se pudo crear el usuario', getApiErrorMessage(error, 'Conservamos los datos del formulario para que puedas volver a intentar.'));
        },
      }
    );
  };

  const resetForm = () => {
    setFormNombre('');
    setFormApellido('');
    setFormEmail('');
    setFormTelefono('');
    setFormRol('');
    setFormSector('');
    setFormPassword('');
  };

  const verUsuario = (usuario: UsuarioLocal) => {
    setUsuarioSeleccionado(usuario);
    setModalVer(true);
  };

  const abrirEditar = (usuario: UsuarioLocal) => {
    setUsuarioSeleccionado(usuario);
    setEditEmail(usuario.email);
    setEditNombre(usuario.nombre);
    setEditTelefono(usuario.telefono);
    setEditEmpresa(usuario.sector);
    setEditEsInspector(usuario.esInspector);
    setModalVer(false);
    setModalEditar(true);
  };

  const guardarEdicion = () => {
    if (updateMutation.isPending) return;
    if (!usuarioSeleccionado || !editEmail) {
      toast.error('Error', 'El email es obligatorio');
      return;
    }
    const [nombre, ...apellidoParts] = editNombre.split(' ');
    updateMutation.mutate(
      { id: usuarioSeleccionado.id, data: { email: editEmail, nombre: nombre || editNombre, apellido: apellidoParts.join(' ') || undefined, telefono: editTelefono || undefined, empresa: editEmpresa || undefined, esInspector: editEsInspector } },
      {
        onSuccess: () => {
          setModalEditar(false);
          toast.success('Usuario actualizado', 'Los datos se guardaron correctamente');
        },
        onError: (err: any) => {
          toast.error('Error', err?.response?.data?.message || 'No se pudo actualizar el usuario');
        },
      }
    );
  };

  const handleExportPdf = () => {
    exportReportePDF({
      titulo: 'Gestión de Usuarios',
      subtitulo: 'Usuarios de la página actual',
      periodo: `Página ${currentPage} · ${usuarios.length} de ${totalItems} resultados`,
      kpis: [{ label: 'En esta página', value: usuarios.length }],
      tabla: {
        headers: ['Nombre', 'Email', 'Rol', 'Sector', 'Estado', 'Último Acceso'],
        rows: usuarios.map(u => [
          u.nombre,
          u.email,
          rolConfig[u.rol as keyof typeof rolConfig]?.label || u.rol,
          u.sector,
          u.estado === 'activo' ? 'Activo' : u.estado === 'pendiente' ? 'Pendiente' : 'Inactivo',
          u.ultimoAcceso,
        ]),
      },
    });
  };

  // Columnas para la tabla
  const columns = [
    {
      key: 'usuario',
      width: '34%',
      header: 'Usuario',
      sortable: true,
      render: (row: UsuarioLocal) => {
        const config = rolConfig[row.rol as keyof typeof rolConfig];
        return (
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${config?.bgColor || 'bg-neutral-100'} ${config?.textColor || 'text-neutral-700'}`}>
              {row.avatar}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-neutral-900 truncate flex items-center gap-1.5">
                {row.nombre}
                {row.esInspector && (
                  <span title="Inspector — puede ver reportes completos de todo el sistema" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700">
                    <Eye size={10} />
                    Inspector
                  </span>
                )}
              </p>
              <p className="text-sm text-neutral-500 truncate">{row.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'rol',
      width: '18%',
      header: 'Rol',
      sortable: true,
      hiddenBelow: 'sm' as const,
      render: (row: UsuarioLocal) => {
        const config = rolConfig[row.rol as keyof typeof rolConfig];
        if (!config) return <Badge variant="soft" color="neutral">{row.rol}</Badge>;
        const Icon = config.icon;
        return (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
            <Icon size={12} />
            {config.label}
          </div>
        );
      },
    },
    {
      key: 'sector',
      width: '18%',
      hiddenBelow: 'lg' as const,
      header: 'Sector/Empresa',
      render: (row: UsuarioLocal) => (
        <div className="min-w-0">
          <p className="text-sm text-neutral-900 truncate">{row.sector || '—'}</p>
          {row.ubicacion && (
            <p className="text-xs text-neutral-500 flex items-center gap-1">
              <MapPin size={10} />
              {row.ubicacion}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'estado',
      width: '12%',
      header: 'Estado',
      sortable: true,
      render: (row: UsuarioLocal) => (
        <Badge
          variant="soft"
          color={row.estado === 'activo' ? 'success' : row.estado === 'pendiente' ? 'warning' : 'neutral'}
        >
          {row.estado === 'activo' && <CheckCircle size={12} className="mr-1" />}
          {row.estado === 'inactivo' && <XCircle size={12} className="mr-1" />}
          {row.estado === 'pendiente' && <span title="Email verificado — pendiente de aprobación del administrador" className="mr-1">⏳</span>}
          {row.estado.charAt(0).toUpperCase() + row.estado.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      width: '18%',
      header: '',
      align: 'right' as const,
      render: (row: UsuarioLocal) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {isAdmin && row.id !== currentUser?.id && row.estado === 'activo' && (
            <Button
              variant="ghost"
              size="sm"
              className="p-2 text-amber-600 hover:bg-amber-50"
              onClick={async (e: any) => {
                e.stopPropagation();
                try {
                  await impersonateUser(row.id);
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || 'No se pudo acceder como este usuario');
                }
              }}
              title="Acceso Comodín — ver como este usuario"
            >
              <Eye size={16} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={`p-2 ${row.estado === 'activo' ? 'text-amber-500' : 'text-emerald-600'}`}
            onClick={(e: any) => {
              e.stopPropagation();
              cambiarEstado(row.id, row.estado === 'activo' ? 'inactivo' : 'activo');
            }}
            title={row.estado === 'activo' ? 'Desactivar usuario' : 'Activar usuario'}
            disabled={toggleActivoMutation.isPending}
          >
            {row.estado === 'activo' ? <UserX size={16} /> : <UserCheck size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="p-2"
            onClick={(e: any) => { e.stopPropagation(); verUsuario(row); }}
            title="Ver detalle"
          >
            <MoreHorizontal size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="p-2 text-error-500"
            aria-label={`Eliminar a ${row.nombre}`}
            onClick={(e: any) => { e.stopPropagation(); setUsuarioSeleccionado(row); setModalEliminar(true); }}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-5 pt-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Usuarios</h2>
            <p className="mt-1 text-sm text-neutral-600" aria-live="polite">
              {apiLoading ? 'Cargando usuarios…' : apiError ? 'No se pudo actualizar el listado.' : `${totalItems} ${totalItems === 1 ? 'perfil encontrado' : 'perfiles encontrados'}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={apiLoading || apiError || !usuarios.length} onClick={() => downloadCsv(usuarios.map(u => ({ Nombre: u.nombre, Email: u.email, Teléfono: u.telefono, Rol: u.rol, Sector: u.sector, Estado: u.estado })), 'usuarios-pagina', { titulo: 'Usuarios · página actual', periodo: `Página ${currentPage}`, total: usuarios.length })} className="hidden sm:inline-flex">CSV · página</Button>
            <Button variant="outline" disabled={apiLoading || apiError || !usuarios.length} onClick={handleExportPdf} className="hidden sm:inline-flex">PDF · página</Button>
            <Button leftIcon={<UserPlus size={18} />} onClick={() => setModalCrear(true)}>Nuevo Usuario</Button>
          </div>
        </header>

        <div className="grid min-w-0 grid-cols-2 gap-3 rounded-xl border border-neutral-200 bg-white p-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_minmax(150px,190px)_auto] lg:items-end">
          <Input containerClassName="col-span-2 lg:col-span-1" label="Buscar usuarios" placeholder="Nombre, email o empresa" value={busqueda} onChange={event => { setBusqueda(event.target.value); setCurrentPage(1); }} leftIcon={<Search size={18} />} />
          <Select label="Rol" value={filtroRol} onChange={value => { setFiltroRol(value); setCurrentPage(1); }} options={[
            { value: 'todos', label: 'Todos los roles' },
            { value: 'ADMIN_GRUPO', label: 'Administradores de grupo' },
            ...Object.entries(rolConfig).map(([value, config]) => ({ value, label: config.label })),
          ]} />
          <Select label="Estado" value={filtroEstado} onChange={value => { setFiltroEstado(value); setCurrentPage(1); }} options={[
            { value: 'todos', label: 'Todos los estados' },
            { value: 'activo', label: 'Activos' },
            { value: 'pendiente', label: 'Pendientes de aprobación' },
            { value: 'inactivo', label: 'Inactivos' },
          ]} />
          <div className="col-span-2 flex gap-1 lg:col-span-1" aria-label="Presentación del listado">
            <Button variant={vistaMode === 'list' ? 'primary' : 'outline'} aria-label="Ver como lista" aria-pressed={vistaMode === 'list'} onClick={() => setVistaMode('list')}><List size={18} /></Button>
            <Button variant={vistaMode === 'grid' ? 'primary' : 'outline'} aria-label="Ver como tarjetas" aria-pressed={vistaMode === 'grid'} onClick={() => setVistaMode('grid')}><Grid3X3 size={18} /></Button>
          </div>
        </div>

        {apiError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error-200 bg-error-50 p-4">
            <p className="text-error-800">No pudimos cargar los usuarios. Los filtros se conservan.</p>
            <Button variant="outline" onClick={() => void refetch()}>Reintentar</Button>
          </div>
        ) : apiLoading ? (
          <p role="status" className="py-6 text-neutral-600">Cargando usuarios…</p>
        ) : !usuarios.length ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <p className="font-medium text-neutral-900">No hay usuarios con estos filtros.</p>
            <Button variant="ghost" className="mt-2" onClick={() => { setBusqueda(''); setFiltroRol('todos'); setFiltroEstado('todos'); setCurrentPage(1); }}>Limpiar filtros</Button>
          </div>
        ) : null}

        {/* Both presentations use the same server-filtered page. */}
        {!apiError && !apiLoading && usuarios.length > 0 && (vistaMode === 'list' ? (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {usuariosPaginados.map((u) => (
                <button type="button" key={u.id} className="w-full bg-white rounded-xl border border-neutral-300 p-3 text-left hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700" onClick={() => verUsuario(u)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-primary-700">
                        {(u.nombre || u.email || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-neutral-900 truncate">{u.nombre || u.email}</p>
                        <p className="text-xs text-neutral-500 truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="max-w-28 text-xs text-neutral-700">{rolConfig[u.rol as keyof typeof rolConfig]?.label || u.rol}</span>
                      <span className="sr-only">{u.estado}</span>
                      <span aria-hidden="true" className={`w-2 h-2 rounded-full ${u.estado === 'activo' ? 'bg-green-500' : 'bg-neutral-400'}`} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block">
            <Table
              data={usuariosPaginados}
              columns={columns}
              keyExtractor={(row) => row.id.toString()}
              sortable={true}
              onSort={(key, dir) => {
                setSortBy(USR_COL_MAP[key] ?? key);
                setSortOrder(dir);
                setCurrentPage(1);
              }}
              onRowClick={verUsuario}
              stickyHeader
            />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {usuariosPaginados.map((usuario) => {
              const config = rolConfig[usuario.rol as keyof typeof rolConfig];
              const Icon = config?.icon || User;
              return (
                <Card key={usuario.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold ${config?.bgColor || 'bg-neutral-100'} ${config?.textColor || 'text-neutral-700'}`}>
                          {usuario.avatar}
                        </div>
                        <div>
                          <h4 className="font-semibold text-neutral-900 flex items-center gap-1.5 flex-wrap">
                            {usuario.nombre}
                            {usuario.esInspector && (
                              <span title="Inspector — puede ver reportes completos de todo el sistema" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700">
                                <Eye size={10} />
                                Inspector
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-neutral-500">{usuario.email}</p>
                        </div>
                      </div>
                      <Badge
                        variant="soft"
                        color={usuario.estado === 'activo' ? 'success' : usuario.estado === 'pendiente' ? 'warning' : 'neutral'}
                      >
                        {usuario.estado}
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${config?.bgColor || 'bg-neutral-100'} ${config?.textColor || 'text-neutral-700'}`}>
                        <Icon size={12} />
                        {config?.label || usuario.rol}
                      </div>
                      <p className="text-sm text-neutral-600">
                        <Building2 size={12} className="inline mr-1" />
                        {usuario.sector}
                      </p>
                      {usuario.ubicacion && (
                        <p className="text-sm text-neutral-500">
                          <MapPin size={12} className="inline mr-1" />
                          {usuario.ubicacion}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end pt-4 border-t border-neutral-100">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost" size="sm"
                          className={`p-2 ${usuario.estado === 'activo' ? 'text-amber-500' : 'text-emerald-600'}`}
                          onClick={() => cambiarEstado(usuario.id, usuario.estado === 'activo' ? 'inactivo' : 'activo')}
                          title={usuario.estado === 'activo' ? 'Desactivar' : 'Activar'}
                          disabled={toggleActivoMutation.isPending}
                        >
                          {usuario.estado === 'activo' ? <UserX size={16} /> : <UserCheck size={16} />}
                        </Button>
                        <Button variant="ghost" size="sm" className="p-2" aria-label={`Ver detalle de ${usuario.nombre}`} onClick={() => verUsuario(usuario)}>
                          <Eye size={16} />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="p-2 text-error-500"
                          aria-label={`Eliminar a ${usuario.nombre}`}
                          onClick={() => { setUsuarioSeleccionado(usuario); setModalEliminar(true); }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}
        {!apiError && !apiLoading && totalItems > 0 && <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />}
      </div>

      {/* Modal Ver Usuario */}
      <Modal
        isOpen={modalVer}
        onClose={() => setModalVer(false)}
        title="Detalle de Usuario"
        isBusy={toggleActivoMutation.isPending}
        size="lg"
        footer={
          <>
            <Button variant="outline" disabled={toggleActivoMutation.isPending} onClick={() => setModalVer(false)}>Cerrar</Button>
            {usuarioSeleccionado && (
              <Button
                variant={usuarioSeleccionado.estado === 'activo' ? 'outline' : 'primary'}
                isLoading={toggleActivoMutation.isPending}
                leftIcon={usuarioSeleccionado.estado === 'activo' ? <UserX size={16} /> : <UserCheck size={16} />}
                onClick={() => {
                  cambiarEstado(usuarioSeleccionado.id, usuarioSeleccionado.estado === 'activo' ? 'inactivo' : 'activo', () => setModalVer(false));
                }}
              >
                {usuarioSeleccionado.estado === 'activo' ? 'Desactivar' : 'Activar'}
              </Button>
            )}
            {usuarioSeleccionado && ['ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR', 'ADMIN'].includes(usuarioSeleccionado.rol) && usuarioSeleccionado.id !== currentUser?.id && (
              <Button
                variant="outline"
                leftIcon={<ShieldCheck size={16} />}
                disabled={toggleActivoMutation.isPending}
                className={usuarioSeleccionado.rol === 'ADMIN' ? 'text-red-700 border-red-300 hover:bg-red-50' : 'text-amber-700 border-amber-300 hover:bg-amber-50'}
                onClick={() => { setModalVer(false); setModalPromover(true); setPromoverPassword(''); setPromoverTargetRol(usuarioSeleccionado.rol === 'ADMIN' ? '' : ''); }}
              >
                {usuarioSeleccionado.rol === 'ADMIN' ? 'Degradar rol' : 'Promover a Super Admin'}
              </Button>
            )}
            {usuarioSeleccionado && <Button disabled={toggleActivoMutation.isPending} onClick={() => abrirEditar(usuarioSeleccionado)}>Editar</Button>}
          </>
        }
      >
        {usuarioSeleccionado && (
          <div className="space-y-5">
            {/* Header del usuario */}
            <div className="flex items-center gap-4">
              {(() => {
                const config = rolConfig[usuarioSeleccionado.rol as keyof typeof rolConfig];
                return (
                  <div aria-hidden="true" className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-lg font-bold ${config?.bgColor || 'bg-neutral-100'} ${config?.textColor || 'text-neutral-700'}`}>
                    {usuarioSeleccionado.avatar}
                  </div>
                );
              })()}
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-neutral-900">{usuarioSeleccionado.nombre}</h3>
                <p className="break-words text-sm text-neutral-600">{usuarioSeleccionado.email}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {(() => {
                    const config = rolConfig[usuarioSeleccionado.rol as keyof typeof rolConfig];
                    const Icon = config?.icon || User;
                    return (
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config?.bgColor || 'bg-neutral-100'} ${config?.textColor || 'text-neutral-700'}`}>
                        <Icon size={12} />
                        {config?.label || usuarioSeleccionado.rol}
                      </div>
                    );
                  })()}
                  <Badge
                    variant="soft"
                    color={usuarioSeleccionado.estado === 'activo' ? 'success' : usuarioSeleccionado.estado === 'pendiente' ? 'warning' : 'neutral'}
                  >
                    {usuarioSeleccionado.estado.charAt(0).toUpperCase() + usuarioSeleccionado.estado.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>

            <dl className="divide-y divide-neutral-200 border-y border-neutral-200 text-sm">
              {[
                ['Sector/Empresa', usuarioSeleccionado.sector],
                ['Ubicación', usuarioSeleccionado.ubicacion],
                ['Teléfono', usuarioSeleccionado.telefono],
                ['Fecha de registro', usuarioSeleccionado.fechaRegistro],
              ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
                <div key={label} className="grid grid-cols-[minmax(100px,1fr)_2fr] gap-3 py-3">
                  <dt className="text-neutral-600">{label}</dt>
                  <dd className="min-w-0 break-words font-medium text-neutral-900">{value}</dd>
                </div>
              ))}
            </dl>

          </div>
        )}
      </Modal>

      {/* Modal Editar Usuario */}
      <Modal
        isOpen={modalEditar}
        onClose={() => setModalEditar(false)}
        title="Editar Usuario"
        isBusy={updateMutation.isPending}
        size="lg"
        footer={
          <>
            <Button variant="outline" disabled={updateMutation.isPending} onClick={() => setModalEditar(false)}>Cancelar</Button>
            <Button onClick={guardarEdicion} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 animate-fade-in">
          <Input label="Email" type="email" placeholder="usuario@empresa.com" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
          <Input label="Nombre completo" placeholder="Juan Perez" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
          <Input label="Telefono" placeholder="+54 261 123-4567" value={editTelefono} onChange={(e) => setEditTelefono(e.target.value)} />
          <Input label="Empresa / Sector" placeholder="Razon social" value={editEmpresa} onChange={(e) => setEditEmpresa(e.target.value)} />
          <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div>
              <p className="text-sm font-medium text-indigo-900">Inspector</p>
              <p className="text-xs text-indigo-600 mt-0.5">Puede ver reportes completos de todo el sistema</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={editEsInspector}
              aria-label="Inspector"
              onClick={() => setEditEsInspector(!editEsInspector)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${editEsInspector ? 'bg-indigo-600' : 'bg-neutral-300'}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${editEsInspector ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Crear Usuario */}
      <Modal
        isOpen={modalCrear}
        onClose={() => { setModalCrear(false); resetForm(); }}
        title="Nuevo Usuario"
        isBusy={createMutation.isPending}
        size="lg"
        footer={
          <>
            <Button variant="outline" disabled={createMutation.isPending} onClick={() => { setModalCrear(false); resetForm(); }}>Cancelar</Button>
            <Button
              onClick={crearUsuario}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creando...' : 'Crear Usuario'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Input label="Nombre" placeholder="Juan" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} />
            <Input label="Apellido" placeholder="Perez" value={formApellido} onChange={(e) => setFormApellido(e.target.value)} />
          </div>
          <Input label="Email" type="email" placeholder="usuario@empresa.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
          <Input label="Contraseña" type="password" autoComplete="new-password" helperText="Mínimo 8 caracteres." value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
          <Input label="Telefono" placeholder="+54 261 123-4567" value={formTelefono} onChange={(e) => setFormTelefono(e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Select
              label="Rol"
              value={formRol}
              onChange={(val) => setFormRol(val)}
              placeholder="Seleccionar rol"
              options={[
                { value: '', label: 'Seleccionar rol' },
                { value: 'ADMIN', label: 'Super Administrador' },
                { value: 'ADMIN_GENERADOR', label: 'Admin de Generadores' },
                { value: 'ADMIN_TRANSPORTISTA', label: 'Admin de Transporte' },
                { value: 'ADMIN_OPERADOR', label: 'Admin de Operadores' },
                { value: 'GENERADOR', label: 'Generador' },
                { value: 'TRANSPORTISTA', label: 'Transportista' },
                { value: 'OPERADOR', label: 'Operador' },
              ]}
            />
            <Input label="Sector/Empresa" value={formSector} onChange={event => setFormSector(event.target.value)} placeholder="Nombre de la organización" />
          </div>
        </div>
      </Modal>

      {/* Modal Confirmar Eliminacion */}
      <ConfirmModal
        isOpen={modalEliminar}
        onClose={() => setModalEliminar(false)}
        onConfirm={eliminarUsuario}
        title="Eliminar Usuario"
        description={`Estas seguro de eliminar a ${usuarioSeleccionado?.nombre}? Esta accion no se puede deshacer.`}
        confirmText="Si, eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Modal Cambiar Jerarquia (Promover / Degradar) */}
      <Modal
        isOpen={modalPromover}
        onClose={() => { setModalPromover(false); setPromoverPassword(''); setPromoverTargetRol(''); }}
        title={usuarioSeleccionado?.rol === 'ADMIN' ? 'Degradar Super Administrador' : 'Promover a Super Administrador'}
        isBusy={promoverLoading}
        size="sm"
        footer={
          <>
            <Button variant="outline" disabled={promoverLoading} onClick={() => { setModalPromover(false); setPromoverPassword(''); setPromoverTargetRol(''); }}>Cancelar</Button>
            <Button
              variant={usuarioSeleccionado?.rol === 'ADMIN' ? 'outline' : 'primary'}
              className={usuarioSeleccionado?.rol === 'ADMIN' ? 'text-red-700 border-red-300 hover:bg-red-50' : ''}
              leftIcon={<ShieldCheck size={16} />}
              isLoading={promoverLoading}
              disabled={!promoverPassword || (usuarioSeleccionado?.rol === 'ADMIN' && !promoverTargetRol)}
              onClick={async () => {
                if (!usuarioSeleccionado || !promoverPassword) return;
                const nuevoRol = usuarioSeleccionado.rol === 'ADMIN' ? promoverTargetRol : 'ADMIN';
                if (!nuevoRol) return;
                setPromoverLoading(true);
                try {
                  await api.post('/auth/login', { email: currentUser?.email, password: promoverPassword });
                  await api.put(`/admin/usuarios/${usuarioSeleccionado.id}`, { rol: nuevoRol });
                  const label = nuevoRol === 'ADMIN' ? 'Super Administrador' : nuevoRol.replace(/_/g, ' ');
                  toast.success('Rol actualizado', `${usuarioSeleccionado.nombre} ahora es ${label}`);
                  setModalPromover(false); setPromoverPassword(''); setPromoverTargetRol('');
                  window.location.reload();
                } catch (err: any) {
                  toast.error('Error', err?.response?.data?.message || 'Clave incorrecta o error de red');
                } finally { setPromoverLoading(false); }
              }}
            >
              {usuarioSeleccionado?.rol === 'ADMIN' ? 'Confirmar Degradacion' : 'Confirmar Promocion'}
            </Button>
          </>
        }
      >
        {usuarioSeleccionado && (
          <div className="space-y-4">
            {usuarioSeleccionado.rol === 'ADMIN' ? (
              <>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <UserX size={32} className="text-red-500 mx-auto mb-2" />
                  <p className="font-semibold text-red-900">{usuarioSeleccionado.nombre}</p>
                  <p className="text-sm text-red-700 mt-1">Super Administrador &rarr; rol inferior</p>
                </div>
                <Select
                  label="Nuevo rol"
                  value={promoverTargetRol}
                  onChange={(val) => setPromoverTargetRol(val)}
                  placeholder="Seleccionar rol destino..."
                  options={[
                    { value: '', label: 'Seleccionar rol destino...' },
                    { value: 'ADMIN_GENERADOR', label: 'Admin de Generadores' },
                    { value: 'ADMIN_TRANSPORTISTA', label: 'Admin de Transporte' },
                    { value: 'ADMIN_OPERADOR', label: 'Admin de Operadores' },
                    { value: 'GENERADOR', label: 'Generador' },
                    { value: 'TRANSPORTISTA', label: 'Transportista' },
                    { value: 'OPERADOR', label: 'Operador' },
                  ]}
                />
                <p className="text-sm text-neutral-600">
                  Esto removera el acceso de Super Admin. Ingresa tu clave para confirmar.
                </p>
              </>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <ShieldCheck size={32} className="text-amber-600 mx-auto mb-2" />
                  <p className="font-semibold text-amber-900">{usuarioSeleccionado.nombre}</p>
                  <p className="text-sm text-amber-700 mt-1">{usuarioSeleccionado.rol.replace(/_/g, ' ')} &rarr; <strong>Super Administrador</strong></p>
                </div>
                <p className="text-sm text-neutral-600">
                  Esto otorgara acceso completo al sistema. Ingresa tu clave para confirmar.
                </p>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Tu clave de Super Admin</label>
              <input
                type="password"
                value={promoverPassword}
                onChange={(e) => setPromoverPassword(e.target.value)}
                placeholder="Ingresa tu clave actual"
                className="w-full px-4 py-2.5 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-amber-500 focus:outline-none"
                autoFocus
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default UsuariosPage;

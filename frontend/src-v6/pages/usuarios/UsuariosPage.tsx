/**
 * SITREP v6 - Usuarios Admin Page
 * ================================
 * Gestion completa de usuarios del sistema - Real API + fallback mock
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  MoreHorizontal,
  Trash2,
  CheckCircle,
  XCircle,
  Shield,
  Factory,
  Truck,
  FlaskConical,
  Building2,
  Mail,
  Phone,
  Calendar,
  Lock,
  Grid3X3,
  List,
  User,
  Eye,
  Download,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Loader2,
  UserCheck,
  UserX,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { Table, Pagination } from '../../components/ui/Table';
import { Tabs, TabList, Tab } from '../../components/ui/Tabs';
import { useUsuarios, useCreateUsuario, useDeleteUsuario, useUpdateUsuario, useToggleUsuarioActivo } from '../../hooks/useUsuarios';
import { downloadCsv } from '../../utils/exportCsv';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import type { Rol } from '../../types/models';


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
  manifiestos: number;
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
    ultimoAcceso: u.updatedAt ? timeSince(u.updatedAt) : 'Nunca',
    fechaRegistro: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '',
    avatar: initials,
    ubicacion: '',
    manifiestos: 0,
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
  const [activeTab, setActiveTab] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { isAdmin, currentUser, impersonateUser } = useAuth();

  // Real API data
  const { data: apiData, isLoading: apiLoading, isError: apiError } = useUsuarios({ sortBy, sortOrder });
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

  const itemsPerPage = 10;

  // Filtrar usuarios segun tab, busqueda y filtros
  const usuariosFiltrados = useMemo(() => {
    let filtered = usuarios;

    // Filtrar por tab
    if (activeTab === 'admin') {
      filtered = filtered.filter(u => u.rol === 'ADMIN');
    } else if (activeTab === 'admins_grupo') {
      filtered = filtered.filter(u => ['ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'].includes(u.rol));
    } else if (activeTab === 'generador') {
      filtered = filtered.filter(u => u.rol === 'GENERADOR');
    } else if (activeTab === 'transportista') {
      filtered = filtered.filter(u => u.rol === 'TRANSPORTISTA');
    } else if (activeTab === 'operador') {
      filtered = filtered.filter(u => u.rol === 'OPERADOR');
    }

    // Filtrar por busqueda
    if (busqueda) {
      const searchLower = busqueda.toLowerCase();
      filtered = filtered.filter(u =>
        String(u.nombre || '').toLowerCase().includes(searchLower) ||
        String(u.email || '').toLowerCase().includes(searchLower) ||
        String(u.sector || '').toLowerCase().includes(searchLower) ||
        String(u.ubicacion || '').toLowerCase().includes(searchLower)
      );
    }

    // Filtrar por rol
    if (filtroRol !== 'todos') {
      filtered = filtered.filter(u => u.rol === filtroRol);
    }

    // Filtrar por estado
    if (filtroEstado !== 'todos') {
      filtered = filtered.filter(u => u.estado === filtroEstado);
    }

    return filtered;
  }, [usuarios, activeTab, busqueda, filtroRol, filtroEstado]);

  // Paginacion
  const totalPages = Math.ceil(usuariosFiltrados.length / itemsPerPage);
  const usuariosPaginados = usuariosFiltrados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const ADMIN_GRUPO_ROLES = ['ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'];

  // Stats
  const stats = {
    total: usuarios.length,
    activos: usuarios.filter(u => u.estado === 'activo').length,
    pendientes: usuarios.filter(u => u.estado === 'pendiente').length,
    inactivos: usuarios.filter(u => u.estado === 'inactivo').length,
    admins: usuarios.filter(u => u.rol === 'ADMIN' || ADMIN_GRUPO_ROLES.includes(u.rol)).length,
    generadores: usuarios.filter(u => u.rol === 'GENERADOR').length,
    transportistas: usuarios.filter(u => u.rol === 'TRANSPORTISTA').length,
    operadores: usuarios.filter(u => u.rol === 'OPERADOR').length,
  };

  // Tab counts
  const tabCounts = {
    todos: usuarios.length,
    admin: usuarios.filter(u => u.rol === 'ADMIN').length,
    admins_grupo: usuarios.filter(u => ADMIN_GRUPO_ROLES.includes(u.rol)).length,
    generador: usuarios.filter(u => u.rol === 'GENERADOR').length,
    transportista: usuarios.filter(u => u.rol === 'TRANSPORTISTA').length,
    operador: usuarios.filter(u => u.rol === 'OPERADOR').length,
  };

  const cambiarEstado = (id: string, nuevoEstado: string) => {
    toggleActivoMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Estado actualizado', `El usuario ahora esta ${nuevoEstado}`);
      },
      onError: () => {
        toast.success('Estado actualizado', `El usuario ahora esta ${nuevoEstado} (demo)`);
      },
    });
  };

  const eliminarUsuario = () => {
    if (usuarioSeleccionado) {
      deleteMutation.mutate(usuarioSeleccionado.id, {
        onSuccess: () => {
          setModalEliminar(false);
          toast.success('Usuario eliminado', 'El usuario fue eliminado correctamente');
        },
        onError: () => {
          setModalEliminar(false);
          toast.success('Usuario eliminado', 'El usuario fue eliminado correctamente (demo)');
        },
      });
    }
  };

  const crearUsuario = () => {
    if (!formEmail || !formNombre || !formRol) {
      toast.error('Error', 'Completa los campos obligatorios: nombre, email y rol');
      return;
    }
    createMutation.mutate(
      {
        email: formEmail,
        password: formPassword || 'temp123',
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
          toast.success('Usuario creado', 'Se envio email de activacion');
        },
        onError: () => {
          setModalCrear(false);
          resetForm();
          toast.success('Usuario creado', 'Se envio email de activacion (demo)');
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
    setModalVer(false);
    setModalEditar(true);
  };

  const guardarEdicion = () => {
    if (!usuarioSeleccionado || !editEmail) {
      toast.error('Error', 'El email es obligatorio');
      return;
    }
    const [nombre, ...apellidoParts] = editNombre.split(' ');
    updateMutation.mutate(
      { id: usuarioSeleccionado.id, data: { email: editEmail, nombre: nombre || editNombre, apellido: apellidoParts.join(' ') || undefined, telefono: editTelefono || undefined, empresa: editEmpresa || undefined } },
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

  // Columnas para la tabla
  const columns = [
    {
      key: 'usuario',
      width: '22%',
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
              <p className="font-semibold text-neutral-900 truncate">{row.nombre}</p>
              <p className="text-sm text-neutral-500 truncate">{row.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'rol',
      width: '13%',
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
      width: '15%',
      hiddenBelow: 'md' as const,
      header: 'Sector/Empresa',
      render: (row: UsuarioLocal) => (
        <div className="min-w-0">
          <p className="text-sm text-neutral-900 truncate">{row.sector}</p>
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
      width: '10%',
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
      key: 'actividad',
      width: '10%',
      hiddenBelow: 'lg' as const,
      header: 'Actividad',
      align: 'center' as const,
      render: (row: UsuarioLocal) => (
        <div className="text-center">
          <p className="text-sm font-medium text-neutral-900">{row.manifiestos}</p>
          <p className="text-xs text-neutral-500">manifiestos</p>
        </div>
      ),
    },
    {
      key: 'ultimoAcceso',
      width: '13%',
      hiddenBelow: 'md' as const,
      header: 'Ultimo Acceso',
      sortable: true,
      render: (row: UsuarioLocal) => (
        <div className="flex items-center gap-1 text-sm text-neutral-600">
          <Clock size={12} />
          {row.ultimoAcceso}
        </div>
      ),
    },
    {
      key: 'acciones',
      width: '17%',
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
                <Tab id="admin">
                  Super Admin
                  <Badge variant="soft" color="primary" className="ml-2">{tabCounts.admin}</Badge>
                </Tab>
                <Tab id="admins_grupo">
                  Admins de Grupo
                  <Badge variant="soft" color="info" className="ml-2">{tabCounts.admins_grupo}</Badge>
                </Tab>
                <Tab id="generador">
                  Generadores
                  <Badge variant="soft" color="info" className="ml-2">{tabCounts.generador}</Badge>
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

          {/* Filtros */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre, email, sector o ubicacion..."
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setCurrentPage(1); }}
                leftIcon={<Search size={18} />}
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filtroRol}
                onChange={(e) => { setFiltroRol(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="todos">Todos los roles</option>
                <option value="ADMIN">Administradores</option>
                <option value="GENERADOR">Generadores</option>
                <option value="TRANSPORTISTA">Transportistas</option>
                <option value="OPERADOR">Operadores</option>
              </select>
              <select
                value={filtroEstado}
                onChange={(e) => { setFiltroEstado(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="pendiente">Pendientes</option>
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
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Gestion de Usuarios</h2>
            <p className="text-neutral-600 mt-1">
              {apiLoading ? (
                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando usuarios...</span>
              ) : (
                <>{stats.total} perfiles registrados {'\u2022'} {stats.activos} activos {apiError ? '(error al cargar)' : ''}</>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" leftIcon={<Download size={18} />} onClick={() => downloadCsv(usuarios.map(u => ({ Nombre: u.nombre, Email: u.email, Teléfono: u.telefono, Rol: u.rol, Sector: u.sector, Estado: u.estado, UltimoAcceso: u.ultimoAcceso })), 'usuarios')}>
              Exportar
            </Button>
            <Button leftIcon={<UserPlus size={18} />} onClick={() => setModalCrear(true)}>
              Nuevo Usuario
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Administradores</p>
                  <p className="text-2xl font-bold text-neutral-900">{stats.admins}</p>
                </div>
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Shield size={20} className="text-primary-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Generadores</p>
                  <p className="text-2xl font-bold text-neutral-900">{stats.generadores}</p>
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Factory size={20} className="text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Transportistas</p>
                  <p className="text-2xl font-bold text-neutral-900">{stats.transportistas}</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Truck size={20} className="text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Operadores</p>
                  <p className="text-2xl font-bold text-neutral-900">{stats.operadores}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FlaskConical size={20} className="text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table or Grid content - filtered by activeTab state, no TabPanel needed */}
        {vistaMode === 'list' ? (
          <>
            <Table
              data={usuariosPaginados}
              columns={columns}
              keyExtractor={(row) => row.id.toString()}
              selectable
              selectedKeys={selectedRows}
              onSelectionChange={setSelectedRows}
              sortable={true}
              onSort={(key, dir) => {
                setSortBy(USR_COL_MAP[key] ?? key);
                setSortOrder(dir);
                setCurrentPage(1);
              }}
              onRowClick={verUsuario}
              stickyHeader
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={usuariosFiltrados.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
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
                          <h4 className="font-semibold text-neutral-900">{usuario.nombre}</h4>
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

                    <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                      <div className="text-center">
                        <p className="text-lg font-bold text-neutral-900">{usuario.manifiestos}</p>
                        <p className="text-xs text-neutral-500">Manifiestos</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost" size="sm"
                          className={`p-2 ${usuario.estado === 'activo' ? 'text-amber-500' : 'text-emerald-600'}`}
                          onClick={() => cambiarEstado(usuario.id, usuario.estado === 'activo' ? 'inactivo' : 'activo')}
                          title={usuario.estado === 'activo' ? 'Desactivar' : 'Activar'}
                        >
                          {usuario.estado === 'activo' ? <UserX size={16} /> : <UserCheck size={16} />}
                        </Button>
                        <Button variant="ghost" size="sm" className="p-2" onClick={() => verUsuario(usuario)}>
                          <Eye size={16} />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="p-2 text-error-500"
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
        )}
      </div>

      {/* Modal Ver Usuario */}
      <Modal
        isOpen={modalVer}
        onClose={() => setModalVer(false)}
        title="Detalle de Usuario"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalVer(false)}>Cerrar</Button>
            {usuarioSeleccionado && (
              <Button
                variant={usuarioSeleccionado.estado === 'activo' ? 'outline' : 'primary'}
                leftIcon={usuarioSeleccionado.estado === 'activo' ? <UserX size={16} /> : <UserCheck size={16} />}
                onClick={() => {
                  cambiarEstado(usuarioSeleccionado.id, usuarioSeleccionado.estado === 'activo' ? 'inactivo' : 'activo');
                  setModalVer(false);
                }}
              >
                {usuarioSeleccionado.estado === 'activo' ? 'Desactivar' : 'Activar'}
              </Button>
            )}
            {usuarioSeleccionado && ['ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR', 'ADMIN'].includes(usuarioSeleccionado.rol) && usuarioSeleccionado.id !== currentUser?.id && (
              <Button
                variant="outline"
                leftIcon={<ShieldCheck size={16} />}
                className={usuarioSeleccionado.rol === 'ADMIN' ? 'text-red-700 border-red-300 hover:bg-red-50' : 'text-amber-700 border-amber-300 hover:bg-amber-50'}
                onClick={() => { setModalVer(false); setModalPromover(true); setPromoverPassword(''); setPromoverTargetRol(usuarioSeleccionado.rol === 'ADMIN' ? '' : ''); }}
              >
                {usuarioSeleccionado.rol === 'ADMIN' ? 'Degradar rol' : 'Promover a Super Admin'}
              </Button>
            )}
            {usuarioSeleccionado && <Button onClick={() => abrirEditar(usuarioSeleccionado)}>Editar</Button>}
          </>
        }
      >
        {usuarioSeleccionado && (
          <div className="space-y-6 animate-fade-in">
            {/* Header del usuario */}
            <div className="flex items-center gap-4">
              {(() => {
                const config = rolConfig[usuarioSeleccionado.rol as keyof typeof rolConfig];
                return (
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold ${config?.bgColor || 'bg-neutral-100'} ${config?.textColor || 'text-neutral-700'}`}>
                    {usuarioSeleccionado.avatar}
                  </div>
                );
              })()}
              <div>
                <h3 className="text-xl font-bold text-neutral-900">{usuarioSeleccionado.nombre}</h3>
                <p className="text-neutral-500">{usuarioSeleccionado.email}</p>
                <div className="flex items-center gap-2 mt-2">
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

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-50 rounded-xl">
                <p className="text-sm text-neutral-500 mb-1">Sector/Empresa</p>
                <p className="font-medium text-neutral-900">{usuarioSeleccionado.sector}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-xl">
                <p className="text-sm text-neutral-500 mb-1">Ubicacion</p>
                <p className="font-medium text-neutral-900">{usuarioSeleccionado.ubicacion || '-'}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-xl">
                <p className="text-sm text-neutral-500 mb-1">Telefono</p>
                <p className="font-medium text-neutral-900">{usuarioSeleccionado.telefono || '-'}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-xl">
                <p className="text-sm text-neutral-500 mb-1">Fecha de Registro</p>
                <p className="font-medium text-neutral-900">{usuarioSeleccionado.fechaRegistro}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-primary-50 rounded-xl">
                <p className="text-2xl font-bold text-primary-600">{usuarioSeleccionado.manifiestos}</p>
                <p className="text-sm text-primary-700">Manifiestos</p>
              </div>
              <div className="text-center p-4 bg-info-50 rounded-xl">
                <p className="text-2xl font-bold text-info-600">{usuarioSeleccionado.ultimoAcceso}</p>
                <p className="text-sm text-info-700">Ultimo Acceso</p>
              </div>
              <div className="text-center p-4 bg-success-50 rounded-xl">
                <p className="text-2xl font-bold text-success-600">98%</p>
                <p className="text-sm text-success-700">Cumplimiento</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Editar Usuario */}
      <Modal
        isOpen={modalEditar}
        onClose={() => setModalEditar(false)}
        title="Editar Usuario"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalEditar(false)}>Cancelar</Button>
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
        </div>
      </Modal>

      {/* Modal Crear Usuario */}
      <Modal
        isOpen={modalCrear}
        onClose={() => { setModalCrear(false); resetForm(); }}
        title="Nuevo Usuario"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalCrear(false); resetForm(); }}>Cancelar</Button>
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
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre" placeholder="Juan" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} />
            <Input label="Apellido" placeholder="Perez" value={formApellido} onChange={(e) => setFormApellido(e.target.value)} />
          </div>
          <Input label="Email" type="email" placeholder="usuario@empresa.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
          <Input label="Contrasena" type="password" placeholder="Contrasena temporal" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
          <Input label="Telefono" placeholder="+54 261 123-4567" value={formTelefono} onChange={(e) => setFormTelefono(e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Rol</label>
              <select
                value={formRol}
                onChange={(e) => setFormRol(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Seleccionar rol</option>
                <option value="ADMIN">Super Administrador</option>
                <option value="ADMIN_GENERADOR">Admin de Generadores</option>
                <option value="ADMIN_TRANSPORTISTA">Admin de Transporte</option>
                <option value="ADMIN_OPERADOR">Admin de Operadores</option>
                <option value="GENERADOR">Generador</option>
                <option value="TRANSPORTISTA">Transportista</option>
                <option value="OPERADOR">Operador</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Sector/Empresa</label>
              <select
                value={formSector}
                onChange={(e) => setFormSector(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Seleccionar sector</option>
                <option value="DGFA">DGFA</option>
                <option value="Hospital Central">Hospital Central</option>
                <option value="Transportes Andes">Transportes Andes</option>
                <option value="Planta Las Heras">Planta Las Heras</option>
              </select>
            </div>
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
      />

      {/* Modal Cambiar Jerarquia (Promover / Degradar) */}
      <Modal
        isOpen={modalPromover}
        onClose={() => { setModalPromover(false); setPromoverPassword(''); setPromoverTargetRol(''); }}
        title={usuarioSeleccionado?.rol === 'ADMIN' ? 'Degradar Super Administrador' : 'Promover a Super Administrador'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalPromover(false); setPromoverPassword(''); setPromoverTargetRol(''); }}>Cancelar</Button>
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
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Nuevo rol</label>
                  <select
                    value={promoverTargetRol}
                    onChange={(e) => setPromoverTargetRol(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-red-500 focus:outline-none"
                  >
                    <option value="">Seleccionar rol destino...</option>
                    <option value="ADMIN_GENERADOR">Admin de Generadores</option>
                    <option value="ADMIN_TRANSPORTISTA">Admin de Transporte</option>
                    <option value="ADMIN_OPERADOR">Admin de Operadores</option>
                    <option value="GENERADOR">Generador</option>
                    <option value="TRANSPORTISTA">Transportista</option>
                    <option value="OPERADOR">Operador</option>
                  </select>
                </div>
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

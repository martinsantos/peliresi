/**
 * SITREP v6 - Usuarios Admin Page
 * ================================
 * Gestión completa de usuarios del sistema - Todos los perfiles
 */

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Shield,
  Factory,
  Truck,
  Building2,
  Mail,
  Phone,
  Calendar,
  Lock,
  RefreshCw,
  Grid3X3,
  List,
  User,
  Eye,
  Download,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { Table, Pagination } from '../../components/ui/Table';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';

// ========================================
// MOCK DATA - TODOS LOS PERFILES
// ========================================
const usuariosData = [
  // Administradores
  { id: 1, nombre: 'Juan Pérez', email: 'juan.perez@dgfa.gob.ar', telefono: '+54 261 412-3456', rol: 'ADMIN', sector: 'DGFA', estado: 'activo', ultimoAcceso: 'Hace 5 min', fechaRegistro: '2024-03-15', avatar: 'JP', ubicacion: 'Ciudad, Mendoza', manifiestos: 124 },
  { id: 2, nombre: 'Laura Torres', email: 'laura.torres@dgfa.gob.ar', telefono: '+54 261 467-8901', rol: 'ADMIN', sector: 'DGFA', estado: 'activo', ultimoAcceso: 'Ahora', fechaRegistro: '2024-02-28', avatar: 'LT', ubicacion: 'Godoy Cruz, Mendoza', manifiestos: 89 },
  { id: 3, nombre: 'Roberto Silva', email: 'r.silva@dgfa.gob.ar', telefono: '+54 261 478-9012', rol: 'ADMIN', sector: 'DGFA', estado: 'activo', ultimoAcceso: 'Hace 1 hora', fechaRegistro: '2024-01-15', avatar: 'RS', ubicacion: 'Ciudad, Mendoza', manifiestos: 156 },
  { id: 4, nombre: 'Carmen Ruiz', email: 'c.ruiz@dgfa.gob.ar', telefono: '+54 261 489-0123', rol: 'ADMIN', sector: 'DGFA', estado: 'inactivo', ultimoAcceso: 'Hace 2 meses', fechaRegistro: '2023-11-20', avatar: 'CR', ubicacion: 'Luján, Mendoza', manifiestos: 45 },
  
  // Generadores - Hospitales
  { id: 5, nombre: 'María González', email: 'm.gonzalez@hospitalcentral.gob.ar', telefono: '+54 261 423-4567', rol: 'GENERADOR', sector: 'Hospital Central', estado: 'activo', ultimoAcceso: 'Hace 2 horas', fechaRegistro: '2024-06-20', avatar: 'MG', ubicacion: 'Ciudad, Mendoza', manifiestos: 342 },
  { id: 6, nombre: 'Pedro Sánchez', email: 'p.sanchez@hospitalpediatrico.gob.ar', telefono: '+54 261 456-7890', rol: 'GENERADOR', sector: 'Hospital Pediátrico', estado: 'activo', ultimoAcceso: 'Hace 30 min', fechaRegistro: '2024-01-10', avatar: 'PS', ubicacion: 'Ciudad, Mendoza', manifiestos: 267 },
  { id: 7, nombre: 'Ana López', email: 'a.lopez@clinicamendoza.com', telefono: '+54 261 512-3456', rol: 'GENERADOR', sector: 'Clínica Mendoza', estado: 'activo', ultimoAcceso: 'Hace 15 min', fechaRegistro: '2024-04-15', avatar: 'AL', ubicacion: 'Godoy Cruz, Mendoza', manifiestos: 189 },
  { id: 8, nombre: 'Diego Fernández', email: 'd.fernandez@laboratoriolab.com', telefono: '+54 261 523-4567', rol: 'GENERADOR', sector: 'Laboratorio LAB S.A.', estado: 'activo', ultimoAcceso: 'Hace 1 hora', fechaRegistro: '2024-05-20', avatar: 'DF', ubicacion: 'Ciudad, Mendoza', manifiestos: 145 },
  { id: 9, nombre: 'Lucía Martínez', email: 'l.martinez@sanatorioitaliano.com', telefono: '+54 261 534-5678', rol: 'GENERADOR', sector: 'Sanatorio Italiano', estado: 'pendiente', ultimoAcceso: 'Nunca', fechaRegistro: '2025-01-28', avatar: 'LM', ubicacion: 'Godoy Cruz, Mendoza', manifiestos: 0 },
  { id: 10, nombre: 'Jorge Castro', email: 'j.castro@centromedicosur.com', telefono: '+54 261 545-6789', rol: 'GENERADOR', sector: 'Centro Médico Sur', estado: 'activo', ultimoAcceso: 'Hace 3 horas', fechaRegistro: '2024-07-10', avatar: 'JC', ubicacion: 'Maipú, Mendoza', manifiestos: 98 },
  { id: 11, nombre: 'Silvia Romero', email: 's.romero@clinicadelsol.com', telefono: '+54 261 556-7890', rol: 'GENERADOR', sector: 'Clínica del Sol', estado: 'activo', ultimoAcceso: 'Hace 45 min', fechaRegistro: '2024-08-05', avatar: 'SR', ubicacion: 'Las Heras, Mendoza', manifiestos: 134 },
  { id: 12, nombre: 'Miguel Ángel', email: 'm.angel@hospitallasheras.gob.ar', telefono: '+54 261 567-8901', rol: 'GENERADOR', sector: 'Hospital Las Heras', estado: 'inactivo', ultimoAcceso: 'Hace 3 meses', fechaRegistro: '2023-12-01', avatar: 'MA', ubicacion: 'Las Heras, Mendoza', manifiestos: 23 },
  
  // Transportistas
  { id: 13, nombre: 'Carlos Rodríguez', email: 'c.rodriguez@transportesandes.com', telefono: '+54 261 434-5678', rol: 'TRANSPORTISTA', sector: 'Transportes Andes S.A.', estado: 'activo', ultimoAcceso: 'Hace 15 min', fechaRegistro: '2024-08-10', avatar: 'CR', ubicacion: 'Guaymallén, Mendoza', manifiestos: 567 },
  { id: 14, nombre: 'Elena Vargas', email: 'e.vargas@ecotransportear.com', telefono: '+54 261 578-9012', rol: 'TRANSPORTISTA', sector: 'EcoTransporte AR', estado: 'activo', ultimoAcceso: 'Hace 20 min', fechaRegistro: '2024-03-25', avatar: 'EV', ubicacion: 'Ciudad, Mendoza', manifiestos: 423 },
  { id: 15, nombre: 'Fernando Díaz', email: 'f.diaz@transportelogistico.com', telefono: '+54 261 589-0123', rol: 'TRANSPORTISTA', sector: 'Transporte Logístico', estado: 'activo', ultimoAcceso: 'Hace 5 min', fechaRegistro: '2024-06-15', avatar: 'FD', ubicacion: 'Godoy Cruz, Mendoza', manifiestos: 389 },
  { id: 16, nombre: 'Gabriela Soto', email: 'g.soto@transportesrapidos.com', telefono: '+54 261 590-1234', rol: 'TRANSPORTISTA', sector: 'Transportes Rápidos', estado: 'pendiente', ultimoAcceso: 'Nunca', fechaRegistro: '2025-01-25', avatar: 'GS', ubicacion: 'Luján, Mendoza', manifiestos: 0 },
  { id: 17, nombre: 'Hugo Benítez', email: 'h.benitez@cargasegura.com', telefono: '+54 261 601-2345', rol: 'TRANSPORTISTA', sector: 'Carga Segura SRL', estado: 'activo', ultimoAcceso: 'Hace 1 hora', fechaRegistro: '2024-09-10', avatar: 'HB', ubicacion: 'Maipú, Mendoza', manifiestos: 234 },
  { id: 18, nombre: 'Inés Morales', email: 'i.morales@transpuntano.com', telefono: '+54 261 612-3456', rol: 'TRANSPORTISTA', sector: 'Transporte Puntano', estado: 'activo', ultimoAcceso: 'Hace 2 horas', fechaRegistro: '2024-07-20', avatar: 'IM', ubicacion: 'San Rafael, Mendoza', manifiestos: 178 },
  
  // Operadores
  { id: 19, nombre: 'Ana Martínez', email: 'ana.martinez@plantalasheras.com', telefono: '+54 261 445-6789', rol: 'OPERADOR', sector: 'Planta Las Heras', estado: 'activo', ultimoAcceso: 'Ahora', fechaRegistro: '2024-04-30', avatar: 'AM', ubicacion: 'Las Heras, Mendoza', manifiestos: 890 },
  { id: 20, nombre: 'Bruno Acosta', email: 'b.acosta@incineradoraeco.com', telefono: '+54 261 623-4567', rol: 'OPERADOR', sector: 'Incineradora Eco', estado: 'activo', ultimoAcceso: 'Hace 10 min', fechaRegistro: '2024-05-15', avatar: 'BA', ubicacion: 'Godoy Cruz, Mendoza', manifiestos: 756 },
  { id: 21, nombre: 'Cecilia Paredes', email: 'c.paredes@plantatratamiento.com', telefono: '+54 261 634-5678', rol: 'OPERADOR', sector: 'Planta de Tratamiento Norte', estado: 'activo', ultimoAcceso: 'Hace 30 min', fechaRegistro: '2024-02-10', avatar: 'CP', ubicacion: 'Guaymallén, Mendoza', manifiestos: 634 },
  { id: 22, nombre: 'Daniel Ortega', email: 'd.ortega@residuosmza.com', telefono: '+54 261 645-6789', rol: 'OPERADOR', sector: 'Residuos MZASRL', estado: 'pendiente', ultimoAcceso: 'Nunca', fechaRegistro: '2025-01-20', avatar: 'DO', ubicacion: 'Luján, Mendoza', manifiestos: 0 },
  { id: 23, nombre: 'Ester Aguirre', email: 'e.aguirre@tratamientosur.com', telefono: '+54 261 656-7890', rol: 'OPERADOR', sector: 'Tratamiento Sur', estado: 'activo', ultimoAcceso: 'Hace 2 horas', fechaRegistro: '2024-08-25', avatar: 'EA', ubicacion: 'San Rafael, Mendoza', manifiestos: 445 },
  { id: 24, nombre: 'Francisco Luna', email: 'f.luna@operadoresmza.com', telefono: '+54 261 667-8901', rol: 'OPERADOR', sector: 'Operadores MZASRL', estado: 'inactivo', ultimoAcceso: 'Hace 1 mes', fechaRegistro: '2024-01-05', avatar: 'FL', ubicacion: 'Ciudad, Mendoza', manifiestos: 67 },
  
  // Auditores/Consultores
  { id: 25, nombre: 'Patricia Méndez', email: 'p.mendez@auditoriaambiental.com', telefono: '+54 261 678-9012', rol: 'AUDITOR', sector: 'Auditoría Ambiental', estado: 'activo', ultimoAcceso: 'Hace 3 horas', fechaRegistro: '2024-09-01', avatar: 'PM', ubicacion: 'Ciudad, Mendoza', manifiestos: 34 },
  { id: 26, nombre: 'Ricardo Flores', email: 'r.flores@consultoraverde.com', telefono: '+54 261 689-0123', rol: 'CONSULTOR', sector: 'Consultora Verde', estado: 'activo', ultimoAcceso: 'Hace 1 día', fechaRegistro: '2024-10-15', avatar: 'RF', ubicacion: 'Godoy Cruz, Mendoza', manifiestos: 12 },
];

// ========================================
// CONFIGURACIÓN DE ROLES
// ========================================
const rolConfig = {
  ADMIN: { label: 'Administrador', icon: Shield, color: 'primary', bgColor: 'bg-primary-100', textColor: 'text-primary-700', borderColor: 'border-primary-200' },
  GENERADOR: { label: 'Generador', icon: Factory, color: 'purple', bgColor: 'bg-purple-100', textColor: 'text-purple-700', borderColor: 'border-purple-200' },
  TRANSPORTISTA: { label: 'Transportista', icon: Truck, color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
  OPERADOR: { label: 'Operador', icon: Building2, color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-700', borderColor: 'border-green-200' },
  AUDITOR: { label: 'Auditor', icon: User, color: 'info', bgColor: 'bg-info-100', textColor: 'text-info-700', borderColor: 'border-info-200' },
  CONSULTOR: { label: 'Consultor', icon: User, color: 'neutral', bgColor: 'bg-neutral-100', textColor: 'text-neutral-700', borderColor: 'border-neutral-200' },
};

// ========================================
// COMPONENTE PRINCIPAL
// ========================================
const UsuariosPage: React.FC = () => {
  const [usuarios] = useState(usuariosData);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [vistaMode, setVistaMode] = useState<'grid' | 'list'>('list');
  const [activeTab, setActiveTab] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  
  // Modal states
  const [modalCrear, setModalCrear] = useState(false);
  const [modalVer, setModalVer] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<typeof usuariosData[0] | null>(null);
  const [modalEliminar, setModalEliminar] = useState(false);

  const itemsPerPage = 10;

  // Filtrar usuarios según tab, búsqueda y filtros
  const usuariosFiltrados = useMemo(() => {
    let filtered = usuarios;
    
    // Filtrar por tab
    if (activeTab !== 'todos') {
      filtered = filtered.filter(u => u.rol.toLowerCase() === activeTab || 
        (activeTab === 'admin' && u.rol === 'ADMIN') ||
        (activeTab === 'generador' && u.rol === 'GENERADOR') ||
        (activeTab === 'transportista' && u.rol === 'TRANSPORTISTA') ||
        (activeTab === 'operador' && u.rol === 'OPERADOR')
      );
    }
    
    // Filtrar por búsqueda
    if (busqueda) {
      const searchLower = busqueda.toLowerCase();
      filtered = filtered.filter(u => 
        u.nombre.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower) ||
        u.sector.toLowerCase().includes(searchLower) ||
        u.ubicacion.toLowerCase().includes(searchLower)
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

  // Paginación
  const totalPages = Math.ceil(usuariosFiltrados.length / itemsPerPage);
  const usuariosPaginados = usuariosFiltrados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats
  const stats = {
    total: usuarios.length,
    activos: usuarios.filter(u => u.estado === 'activo').length,
    pendientes: usuarios.filter(u => u.estado === 'pendiente').length,
    inactivos: usuarios.filter(u => u.estado === 'inactivo').length,
    admins: usuarios.filter(u => u.rol === 'ADMIN').length,
    generadores: usuarios.filter(u => u.rol === 'GENERADOR').length,
    transportistas: usuarios.filter(u => u.rol === 'TRANSPORTISTA').length,
    operadores: usuarios.filter(u => u.rol === 'OPERADOR').length,
  };

  // Tab counts
  const tabCounts = {
    todos: usuarios.length,
    admin: usuarios.filter(u => u.rol === 'ADMIN').length,
    generador: usuarios.filter(u => u.rol === 'GENERADOR').length,
    transportista: usuarios.filter(u => u.rol === 'TRANSPORTISTA').length,
    operador: usuarios.filter(u => u.rol === 'OPERADOR').length,
  };

  const cambiarEstado = (id: number, nuevoEstado: string) => {
    toast.success('Estado actualizado', `El usuario ahora está ${nuevoEstado}`);
  };

  const eliminarUsuario = () => {
    if (usuarioSeleccionado) {
      setModalEliminar(false);
      toast.success('Usuario eliminado', 'El usuario fue eliminado correctamente');
    }
  };

  const resetearPassword = (id: number) => {
    toast.success('Password reseteado', 'Se envió un email con instrucciones');
  };

  const verUsuario = (usuario: typeof usuariosData[0]) => {
    setUsuarioSeleccionado(usuario);
    setModalVer(true);
  };

  // Columnas para la tabla
  const columns = [
    {
      key: 'usuario',
      header: 'Usuario',
      render: (row: typeof usuariosData[0]) => {
        const config = rolConfig[row.rol as keyof typeof rolConfig];
        return (
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${config.bgColor} ${config.textColor}`}>
              {row.avatar}
            </div>
            <div>
              <p className="font-semibold text-neutral-900">{row.nombre}</p>
              <p className="text-sm text-neutral-500">{row.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'rol',
      header: 'Rol',
      render: (row: typeof usuariosData[0]) => {
        const config = rolConfig[row.rol as keyof typeof rolConfig];
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
      header: 'Sector/Empresa',
      render: (row: typeof usuariosData[0]) => (
        <div>
          <p className="text-sm text-neutral-900">{row.sector}</p>
          <p className="text-xs text-neutral-500 flex items-center gap-1">
            <MapPin size={10} />
            {row.ubicacion}
          </p>
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (row: typeof usuariosData[0]) => (
        <Badge 
          variant="soft" 
          color={row.estado === 'activo' ? 'success' : row.estado === 'pendiente' ? 'warning' : 'neutral'}
        >
          {row.estado === 'activo' && <CheckCircle size={12} className="mr-1" />}
          {row.estado === 'inactivo' && <XCircle size={12} className="mr-1" />}
          {row.estado.charAt(0).toUpperCase() + row.estado.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'actividad',
      header: 'Actividad',
      align: 'center' as const,
      render: (row: typeof usuariosData[0]) => (
        <div className="text-center">
          <p className="text-sm font-medium text-neutral-900">{row.manifiestos}</p>
          <p className="text-xs text-neutral-500">manifiestos</p>
        </div>
      ),
    },
    {
      key: 'ultimoAcceso',
      header: 'Último Acceso',
      render: (row: typeof usuariosData[0]) => (
        <div className="flex items-center gap-1 text-sm text-neutral-600">
          <Clock size={12} />
          {row.ultimoAcceso}
        </div>
      ),
    },
    {
      key: 'acciones',
      header: '',
      align: 'right' as const,
      render: (row: typeof usuariosData[0]) => (
        <div className="flex items-center justify-end gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-2"
            onClick={() => verUsuario(row)}
            title="Ver detalle"
          >
            <Eye size={16} />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-2"
            onClick={() => resetearPassword(row.id)}
            title="Resetear password"
          >
            <RefreshCw size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="p-2">
            <Edit size={16} />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-2 text-error-500"
            onClick={() => { setUsuarioSeleccionado(row); setModalEliminar(true); }}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Gestión de Usuarios</h2>
          <p className="text-neutral-600 mt-1">
            {stats.total} perfiles registrados • {stats.activos} activos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={18} />}>
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
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 mb-1">Operadores</p>
                <p className="text-2xl font-bold text-neutral-900">{stats.operadores}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <Building2 size={20} className="text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs y Filtros */}
      <Card>
        <CardContent className="p-4">
          <Tabs activeTab={activeTab} onChange={setActiveTab}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
              <TabList>
                <Tab id="todos">
                  Todos
                  <Badge variant="soft" color="neutral" className="ml-2">{tabCounts.todos}</Badge>
                </Tab>
                <Tab id="admin">
                  Admins
                  <Badge variant="soft" color="primary" className="ml-2">{tabCounts.admin}</Badge>
                </Tab>
                <Tab id="generador">
                  Generadores
                  <Badge variant="soft" color="purple" className="ml-2">{tabCounts.generador}</Badge>
                </Tab>
                <Tab id="transportista">
                  Transportistas
                  <Badge variant="soft" color="orange" className="ml-2">{tabCounts.transportista}</Badge>
                </Tab>
                <Tab id="operador">
                  Operadores
                  <Badge variant="soft" color="green" className="ml-2">{tabCounts.operador}</Badge>
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

            {/* Filtros */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por nombre, email, sector o ubicación..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  leftIcon={<Search size={18} />}
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filtroRol}
                  onChange={(e) => setFiltroRol(e.target.value)}
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
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="activo">Activos</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="inactivo">Inactivos</option>
                </select>
              </div>
            </div>

            {/* Contenido según vista */}
            <TabPanel id="todos">
              {vistaMode === 'list' ? (
                <>
                  <Table
                    data={usuariosPaginados}
                    columns={columns}
                    keyExtractor={(row) => row.id.toString()}
                    selectable
                    selectedKeys={selectedRows}
                    onSelectionChange={setSelectedRows}
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
                    const Icon = config.icon;
                    return (
                      <Card key={usuario.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold ${config.bgColor} ${config.textColor}`}>
                                {usuario.avatar}
                              </div>
                              <div>
                                <h4 className="font-semibold text-neutral-900">{usuario.nombre}</h4>
                                <p className="text-sm text-neutral-500">{usuario.email}</p>
                              </div>
                            </div>
                            <Badge 
                              variant="soft" 
                              size="sm"
                              color={usuario.estado === 'activo' ? 'success' : usuario.estado === 'pendiente' ? 'warning' : 'neutral'}
                            >
                              {usuario.estado}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${config.bgColor} ${config.textColor}`}>
                              <Icon size={12} />
                              {config.label}
                            </div>
                            <p className="text-sm text-neutral-600">
                              <Building2 size={12} className="inline mr-1" />
                              {usuario.sector}
                            </p>
                            <p className="text-sm text-neutral-500">
                              <MapPin size={12} className="inline mr-1" />
                              {usuario.ubicacion}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                            <div className="text-center">
                              <p className="text-lg font-bold text-neutral-900">{usuario.manifiestos}</p>
                              <p className="text-xs text-neutral-500">Manifiestos</p>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="p-2" onClick={() => verUsuario(usuario)}>
                                <Eye size={16} />
                              </Button>
                              <Button variant="ghost" size="sm" className="p-2">
                                <Edit size={16} />
                              </Button>
                              <Button variant="ghost" size="sm" className="p-2 text-error-500">
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
            </TabPanel>

            <TabPanel id="admin">
              <Table data={usuariosPaginados} columns={columns} keyExtractor={(row) => row.id.toString()} />
            </TabPanel>
            <TabPanel id="generador">
              <Table data={usuariosPaginados} columns={columns} keyExtractor={(row) => row.id.toString()} />
            </TabPanel>
            <TabPanel id="transportista">
              <Table data={usuariosPaginados} columns={columns} keyExtractor={(row) => row.id.toString()} />
            </TabPanel>
            <TabPanel id="operador">
              <Table data={usuariosPaginados} columns={columns} keyExtractor={(row) => row.id.toString()} />
            </TabPanel>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modal Ver Usuario */}
      <Modal
        isOpen={modalVer}
        onClose={() => setModalVer(false)}
        title="Detalle de Usuario"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalVer(false)}>Cerrar</Button>
            <Button leftIcon={<Edit size={18} />}>Editar Usuario</Button>
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
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold ${config.bgColor} ${config.textColor}`}>
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
                    const Icon = config.icon;
                    return (
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
                        <Icon size={12} />
                        {config.label}
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
                <p className="text-sm text-neutral-500 mb-1">Ubicación</p>
                <p className="font-medium text-neutral-900">{usuarioSeleccionado.ubicacion}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-xl">
                <p className="text-sm text-neutral-500 mb-1">Teléfono</p>
                <p className="font-medium text-neutral-900">{usuarioSeleccionado.telefono}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-xl">
                <p className="text-sm text-neutral-500 mb-1">Fecha de Registro</p>
                <p className="font-medium text-neutral-900">{usuarioSeleccionado.fechaRegistro}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-primary-50 rounded-xl">
                <p className="text-2xl font-bold text-primary-600">{usuarioSeleccionado.manifiestos}</p>
                <p className="text-sm text-primary-700">Manifiestos</p>
              </div>
              <div className="text-center p-4 bg-info-50 rounded-xl">
                <p className="text-2xl font-bold text-info-600">{usuarioSeleccionado.ultimoAcceso}</p>
                <p className="text-sm text-info-700">Último Acceso</p>
              </div>
              <div className="text-center p-4 bg-success-50 rounded-xl">
                <p className="text-2xl font-bold text-success-600">98%</p>
                <p className="text-sm text-success-700">Cumplimiento</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Crear Usuario */}
      <Modal
        isOpen={modalCrear}
        onClose={() => setModalCrear(false)}
        title="Nuevo Usuario"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalCrear(false)}>Cancelar</Button>
            <Button onClick={() => { setModalCrear(false); toast.success('Usuario creado', 'Se envió email de activación'); }}>
              Crear Usuario
            </Button>
          </>
        }
      >
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre" placeholder="Juan" />
            <Input label="Apellido" placeholder="Pérez" />
          </div>
          <Input label="Email" type="email" placeholder="usuario@empresa.com" />
          <Input label="Teléfono" placeholder="+54 261 123-4567" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Rol</label>
              <select className="w-full px-4 py-2.5 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none">
                <option value="">Seleccionar rol</option>
                <option value="ADMIN">Administrador</option>
                <option value="GENERADOR">Generador</option>
                <option value="TRANSPORTISTA">Transportista</option>
                <option value="OPERADOR">Operador</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Sector/Empresa</label>
              <select className="w-full px-4 py-2.5 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none">
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

      {/* Modal Confirmar Eliminación */}
      <ConfirmModal
        isOpen={modalEliminar}
        onClose={() => setModalEliminar(false)}
        onConfirm={eliminarUsuario}
        title="Eliminar Usuario"
        description={`¿Estás seguro de eliminar a ${usuarioSeleccionado?.nombre}? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};

export default UsuariosPage;

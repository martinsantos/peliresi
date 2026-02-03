/**
 * SITREP v6 - Gestión de Actores Page
 * ===================================
 * Administración de generadores, transportistas y operadores
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Factory, 
  Truck, 
  Building2, 
  Search, 
  Plus, 
  Filter,
  MoreHorizontal,
  Edit,
  Eye,
  FileText,
  MapPin,
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
import { Modal } from '../../components/ui/Modal';

// Mock data de actores
const actoresData = [
  { 
    id: 1, 
    tipo: 'generador', 
    razonSocial: 'Química Mendoza S.A.', 
    cuit: '30-12345678-9',
    domicilio: 'Av. San Martín 1234, Mendoza',
    telefono: '+54 261 412-3456',
    email: 'contacto@quimicamendoza.com',
    estado: 'activo',
    manifiestos: 45,
    ultimaActividad: 'Hace 2 horas'
  },
  { 
    id: 2, 
    tipo: 'transportista', 
    razonSocial: 'Transportes Andes S.A.', 
    cuit: '30-98765432-1',
    domicilio: 'Ruta 40 Km 8, Godoy Cruz',
    telefono: '+54 261 456-7890',
    email: 'logistica@transportesandes.com',
    estado: 'activo',
    manifiestos: 128,
    ultimaActividad: 'Hace 15 min'
  },
  { 
    id: 3, 
    tipo: 'operador', 
    razonSocial: 'Planta de Tratamiento Las Heras', 
    cuit: '30-56789123-4',
    domicilio: 'Av. Acceso Este 2345, Las Heras',
    telefono: '+54 261 789-0123',
    email: 'admin@plantalasheras.com',
    estado: 'activo',
    manifiestos: 89,
    ultimaActividad: 'Hace 1 hora'
  },
  { 
    id: 4, 
    tipo: 'generador', 
    razonSocial: 'Industrias del Sur', 
    cuit: '30-11111111-1',
    domicilio: 'Parque Industrial, Luján',
    telefono: '+54 261 234-5678',
    email: 'info@industriasdelsur.com',
    estado: 'inactivo',
    manifiestos: 12,
    ultimaActividad: 'Hace 3 meses'
  },
  { 
    id: 5, 
    tipo: 'transportista', 
    razonSocial: 'Logística Sur', 
    cuit: '30-22222222-2',
    domicilio: 'Calle Mitre 567, Mendoza',
    telefono: '+54 261 345-6789',
    email: 'operaciones@logisticasur.com',
    estado: 'activo',
    manifiestos: 67,
    ultimaActividad: 'Hace 45 min'
  },
];

const tipoConfig = {
  generador: { label: 'Generador', icon: Factory, color: 'purple' },
  transportista: { label: 'Transportista', icon: Truck, color: 'orange' },
  operador: { label: 'Operador', icon: Building2, color: 'green' },
};

export const ActoresPage: React.FC = () => {
  const navigate = useNavigate();
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [actorSeleccionado, setActorSeleccionado] = useState<typeof actoresData[0] | null>(null);
  const [modalDetalle, setModalDetalle] = useState(false);

  const actoresFiltrados = actoresData.filter(actor => {
    const matchTipo = filtroTipo === 'todos' || actor.tipo === filtroTipo;
    const matchBusqueda = 
      actor.razonSocial.toLowerCase().includes(busqueda.toLowerCase()) ||
      actor.cuit.includes(busqueda);
    return matchTipo && matchBusqueda;
  });

  const verDetalle = (actor: typeof actoresData[0]) => {
    setActorSeleccionado(actor);
    setModalDetalle(true);
  };

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
            <h2 className="text-2xl font-bold text-neutral-900">Gestión de Actores</h2>
            <p className="text-neutral-600 mt-1">
              Administra generadores, transportistas y operadores
            </p>
          </div>
        </div>
        <Button leftIcon={<Plus size={18} />}>
          Nuevo Actor
        </Button>
      </div>

      {/* Stats - Ahora clickeables */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className="bg-purple-50 border-purple-200 hover:shadow-md hover:border-purple-300 transition-all cursor-pointer group"
          onClick={() => navigate('/mobile/admin/generadores')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg group-hover:scale-110 transition-transform">
              <Factory size={20} className="text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-purple-700">Generadores</p>
              <p className="text-2xl font-bold text-purple-900">24</p>
            </div>
            <ChevronRight size={16} className="text-purple-400" />
          </CardContent>
        </Card>
        <Card 
          className="bg-orange-50 border-orange-200 hover:shadow-md hover:border-orange-300 transition-all cursor-pointer group"
          onClick={() => navigate('/mobile/actores/transportistas')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg group-hover:scale-110 transition-transform">
              <Truck size={20} className="text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-orange-700">Transportistas</p>
              <p className="text-2xl font-bold text-orange-900">12</p>
            </div>
            <ChevronRight size={16} className="text-orange-400" />
          </CardContent>
        </Card>
        <Card 
          className="bg-green-50 border-green-200 hover:shadow-md hover:border-green-300 transition-all cursor-pointer group"
          onClick={() => navigate('/mobile/actores/operadores')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg group-hover:scale-110 transition-transform">
              <Building2 size={20} className="text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-green-700">Operadores</p>
              <p className="text-2xl font-bold text-green-900">8</p>
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
              <p className="text-2xl font-bold text-neutral-900">44</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card padding="base">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por razón social o CUIT..."
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

      {/* Tabla de actores */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase">Actor</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase">Tipo</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase">Contacto</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase">Estado</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase">Manifiestos</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {actoresFiltrados.map((actor) => {
                const config = tipoConfig[actor.tipo as keyof typeof tipoConfig];
                const Icon = config.icon;
                return (
                  <tr 
                    key={actor.id} 
                    className="hover:bg-neutral-50 transition-colors cursor-pointer group"
                    onClick={() => verDetalle(actor)}
                  >
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4">
                      <Badge variant="soft" color={config.color as any}>
                        {config.label}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4">
                      <Badge 
                        variant="soft" 
                        color={actor.estado === 'activo' ? 'success' : 'neutral'}
                      >
                        {actor.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-neutral-400" />
                        <span className="font-medium">{actor.manifiestos}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-2"
                          onClick={(e) => { e.stopPropagation(); verDetalle(actor); }}
                        >
                          <Eye size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" className="p-2" onClick={(e) => e.stopPropagation()}>
                          <Edit size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" className="p-2 text-error-500 hover:text-error-600" onClick={(e) => e.stopPropagation()}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

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
                  <Badge variant="soft" color={actorSeleccionado.estado === 'activo' ? 'success' : 'neutral'}>
                    {actorSeleccionado.estado === 'activo' ? <CheckCircle size={12} className="mr-1" /> : <XCircle size={12} className="mr-1" />}
                    {actorSeleccionado.estado === 'activo' ? 'Activo' : 'Inactivo'}
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
                  <MapPin size={16} />
                  <span className="text-sm font-medium">Domicilio</span>
                </div>
                <p className="text-neutral-900">{actorSeleccionado.domicilio}</p>
              </div>
              <div className="p-4 bg-neutral-50 rounded-xl">
                <div className="flex items-center gap-2 text-neutral-600 mb-1">
                  <Phone size={16} />
                  <span className="text-sm font-medium">Teléfono</span>
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
              <div className="p-4 bg-neutral-50 rounded-xl">
                <div className="flex items-center gap-2 text-neutral-600 mb-1">
                  <FileText size={16} />
                  <span className="text-sm font-medium">Manifiestos</span>
                </div>
                <p className="text-neutral-900">{actorSeleccionado.manifiestos} registrados</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ActoresPage;

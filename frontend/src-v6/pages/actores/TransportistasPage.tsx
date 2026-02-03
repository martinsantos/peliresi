/**
 * SITREP v6 - Transportistas Page
 * ================================
 * Gestión de transportistas y flotas
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Search,
  Plus,
  Filter,
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  Package,
  Star,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Edit,
  Trash2,
  Eye,
  Users,
  TrendingUp
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';

// Mock data
const transportistasMock = [
  {
    id: 1,
    nombre: 'Transportes Rápidos S.A.',
    cuit: '30-12345678-9',
    direccion: 'Av. Libertador 1234, Mendoza',
    telefono: '+54 261 456-7890',
    email: 'contacto@transportesrapidos.com',
    estado: 'ACTIVO',
    flotaTotal: 12,
    flotaActiva: 8,
    conductores: 15,
    manifiestosMes: 145,
    rating: 4.8,
    incidencias: 2,
    ultimoViaje: '2025-01-31 08:30',
    certificaciones: ['SENASA', 'CNRT'],
    areasCobertura: ['Mendoza Capital', 'Godoy Cruz', 'Maipú'],
  },
  {
    id: 2,
    nombre: 'Logística EcoTrans',
    cuit: '30-87654321-0',
    direccion: 'Ruta 40 Km 500, Luján de Cuyo',
    telefono: '+54 261 234-5678',
    email: 'info@ecotrans.com',
    estado: 'ACTIVO',
    flotaTotal: 8,
    flotaActiva: 6,
    conductores: 10,
    manifiestosMes: 98,
    rating: 4.5,
    incidencias: 5,
    ultimoViaje: '2025-01-31 10:15',
    certificaciones: ['SENASA'],
    areasCobertura: ['Luján de Cuyo', 'Chacras de Coria'],
  },
  {
    id: 3,
    nombre: 'Transporte del Sur',
    cuit: '30-11111111-1',
    direccion: 'Calle San Martín 456, San Rafael',
    telefono: '+54 260 456-7890',
    email: 'admin@transportedelsur.com',
    estado: 'SUSPENDIDO',
    flotaTotal: 5,
    flotaActiva: 0,
    conductores: 5,
    manifiestosMes: 0,
    rating: 3.2,
    incidencias: 12,
    ultimoViaje: '2025-01-15 14:20',
    certificaciones: [],
    areasCobertura: ['San Rafael', 'General Alvear'],
  },
  {
    id: 4,
    nombre: 'Mendoza Cargo Express',
    cuit: '30-22222222-2',
    direccion: 'Av. Acceso Este 789, Guaymallén',
    telefono: '+54 261 876-5432',
    email: 'operaciones@mendozacargo.com',
    estado: 'ACTIVO',
    flotaTotal: 20,
    flotaActiva: 18,
    conductores: 22,
    manifiestosMes: 234,
    rating: 4.9,
    incidencias: 1,
    ultimoViaje: '2025-01-31 11:45',
    certificaciones: ['SENASA', 'CNRT', 'ISO 9001'],
    areasCobertura: ['Toda la provincia'],
  },
];

const estadoConfig: Record<string, { label: string; color: Badge['color']; icon: React.ReactNode }> = {
  ACTIVO: { label: 'Activo', color: 'success', icon: <CheckCircle2 size={14} /> },
  SUSPENDIDO: { label: 'Suspendido', color: 'error', icon: <AlertCircle size={14} /> },
  INACTIVO: { label: 'Inactivo', color: 'neutral', icon: <AlertCircle size={14} /> },
};

const TransportistasPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [vista, setVista] = useState<'grid' | 'lista'>('lista');

  const transportistasFiltrados = transportistasMock.filter(t => {
    const matchesSearch = t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.cuit.includes(searchTerm);
    const matchesEstado = filtroEstado === '' || t.estado === filtroEstado;
    return matchesSearch && matchesEstado;
  });

  const isMobile = typeof window !== 'undefined' && window.location.pathname.includes('/mobile');

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-success-600';
    if (rating >= 3.5) return 'text-warning-600';
    return 'text-error-600';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-neutral-900">Transportistas</h2>
              <Badge variant="soft" color="secondary">{transportistasFiltrados.length}</Badge>
            </div>
            <p className="text-neutral-600 mt-1">
              Gestión de empresas de transporte
            </p>
          </div>
        </div>
        <Button leftIcon={<Plus size={18} />}>
          Nuevo Transportista
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success-50 rounded-lg flex items-center justify-center">
              <Truck className="text-success-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">3</p>
              <p className="text-xs text-neutral-500">Transportistas activos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              <Package className="text-primary-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">40</p>
              <p className="text-xs text-neutral-500">Vehículos activos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-secondary-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">477</p>
              <p className="text-xs text-neutral-500">Manifiestos este mes</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning-50 rounded-lg flex items-center justify-center">
              <Users className="text-warning-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">52</p>
              <p className="text-xs text-neutral-500">Conductores</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="base">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nombre o CUIT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={18} />}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="">Todos los estados</option>
              <option value="ACTIVO">Activo</option>
              <option value="SUSPENDIDO">Suspendido</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
            <div className="flex bg-neutral-100 rounded-lg p-1">
              <button
                onClick={() => setVista('lista')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  vista === 'lista' ? 'bg-white text-primary-600 shadow-sm' : 'text-neutral-600'
                }`}
              >
                Lista
              </button>
              <button
                onClick={() => setVista('grid')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  vista === 'grid' ? 'bg-white text-primary-600 shadow-sm' : 'text-neutral-600'
                }`}
              >
                Grid
              </button>
            </div>
            <Button variant="outline" leftIcon={<Filter size={18} />}>
              Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Lista */}
      {vista === 'lista' ? (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Transportista
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Flota
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Manifiestos
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {transportistasFiltrados.map((t) => {
                  const estado = estadoConfig[t.estado];
                  const flotaDisponible = t.flotaTotal - t.flotaActiva;
                  
                  return (
                    <tr 
                      key={t.id} 
                      className="hover:bg-neutral-50 transition-colors cursor-pointer group"
                      onClick={() => navigate(isMobile ? `/mobile/actores/transportistas/${t.id}` : `/actores/transportistas/${t.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-secondary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Truck className="text-secondary-600" size={18} />
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                              {t.nombre}
                            </p>
                            <p className="text-xs text-neutral-500">{t.cuit}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="soft" color={estado.color}>
                          <span className="flex items-center gap-1">
                            {estado.icon}
                            {estado.label}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <span className="font-medium text-neutral-900">{t.flotaActiva}/{t.flotaTotal}</span>
                          <span className="text-neutral-500"> vehículos</span>
                          {flotaDisponible > 0 && (
                            <span className="ml-2 text-xs text-success-600">
                              ({flotaDisponible} libres)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {t.conductores} conductores
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Star className={`fill-current ${getRatingColor(t.rating)}`} size={16} />
                          <span className={`font-medium ${getRatingColor(t.rating)}`}>
                            {t.rating.toFixed(1)}
                          </span>
                        </div>
                        {t.incidencias > 0 && (
                          <p className="text-xs text-error-500 mt-1">
                            {t.incidencias} incidencias
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-neutral-900">
                          {t.manifiestosMes}
                        </span>
                        <span className="text-xs text-neutral-500 ml-1">este mes</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="p-2" onClick={(e) => { e.stopPropagation(); }}>
                            <Eye size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" className="p-2" onClick={(e) => { e.stopPropagation(); }}>
                            <Edit size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" className="p-2 text-error-500 hover:text-error-600" onClick={(e) => { e.stopPropagation(); }}>
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
      ) : (
        /* Vista Grid */
        <div className="grid md:grid-cols-2 gap-4">
          {transportistasFiltrados.map((t) => {
            const estado = estadoConfig[t.estado];
            
            return (
              <Card 
                key={t.id}
                className="p-5 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => navigate(isMobile ? `/mobile/actores/transportistas/${t.id}` : `/actores/transportistas/${t.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-secondary-50 rounded-xl flex items-center justify-center">
                      <Truck className="text-secondary-600" size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                        {t.nombre}
                      </h3>
                      <p className="text-xs text-neutral-500">{t.cuit}</p>
                    </div>
                  </div>
                  <Badge variant="soft" color={estado.color}>
                    {estado.label}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-neutral-50 rounded-lg">
                    <p className="text-lg font-bold text-neutral-900">{t.flotaActiva}/{t.flotaTotal}</p>
                    <p className="text-xs text-neutral-500">Vehículos</p>
                  </div>
                  <div className="text-center p-3 bg-neutral-50 rounded-lg">
                    <p className="text-lg font-bold text-neutral-900">{t.conductores}</p>
                    <p className="text-xs text-neutral-500">Conductores</p>
                  </div>
                  <div className="text-center p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center justify-center gap-1">
                      <Star className={`fill-current ${getRatingColor(t.rating)}`} size={14} />
                      <p className={`text-lg font-bold ${getRatingColor(t.rating)}`}>{t.rating}</p>
                    </div>
                    <p className="text-xs text-neutral-500">Rating</p>
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <Package size={14} />
                    <span>{t.manifiestosMes} manifiestos este mes</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <MapPin size={14} />
                    <span className="truncate">{t.areasCobertura.join(', ')}</span>
                  </div>
                </div>

                {/* Certificaciones */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {t.certificaciones.map(cert => (
                    <span key={cert} className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">
                      {cert}
                    </span>
                  ))}
                  {t.certificaciones.length === 0 && (
                    <span className="text-xs text-neutral-400">Sin certificaciones</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-neutral-100">
                  <button 
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-50 text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors"
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    <Phone size={14} />
                    Contactar
                  </button>
                  <button 
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-neutral-50 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-100 transition-colors"
                    onClick={(e) => { e.stopPropagation(); navigate(isMobile ? `/mobile/actores/transportistas/${t.id}` : `/actores/transportistas/${t.id}`); }}
                  >
                    <Truck size={14} />
                    Ver Flota
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {transportistasFiltrados.length === 0 && (
        <Card className="py-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="text-neutral-400" size={24} />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-1">
              No se encontraron transportistas
            </h3>
            <p className="text-neutral-500">
              Intenta con otros términos de búsqueda
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default TransportistasPage;

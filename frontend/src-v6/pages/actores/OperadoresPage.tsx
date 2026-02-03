/**
 * SITREP v6 - Operadores Page
 * ============================
 * Gestión de operadores de tratamiento
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  Filter,
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Edit,
  Trash2,
  Eye,
  Factory
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';

// Mock data
const operadoresMock = [
  {
    id: 1,
    nombre: 'Planta Norte',
    razonSocial: 'Tratamiento de Residuos Norte S.A.',
    cuit: '30-12345678-9',
    direccion: 'Ruta 40 Km 1234, Guaymallén',
    telefono: '+54 261 456-7890',
    email: 'contacto@plantanorte.com',
    estado: 'ACTIVO',
    capacidadTotal: 5000,
    capacidadUsada: 4250,
    procesadoMes: 1240,
    residuosAceptados: ['Líquidos', 'Sólidos', 'Pastosos'],
    certificaciones: ['ISO 14001', 'ISO 9001'],
    ultimaAuditoria: '2025-01-15',
    proximaAuditoria: '2025-07-15',
  },
  {
    id: 2,
    nombre: 'EcoResiduos Sur',
    razonSocial: 'EcoResiduos Mendoza S.A.',
    cuit: '30-87654321-0',
    direccion: 'Ruta 7 Km 985, San Rafael',
    telefono: '+54 260 456-7890',
    email: 'info@ecoresiduos.com',
    estado: 'ACTIVO',
    capacidadTotal: 3500,
    capacidadUsada: 2100,
    procesadoMes: 890,
    residuosAceptados: ['Sólidos', 'Líquidos'],
    certificaciones: ['ISO 14001'],
    ultimaAuditoria: '2024-12-20',
    proximaAuditoria: '2025-06-20',
  },
  {
    id: 3,
    nombre: 'Planta Este',
    razonSocial: 'Operador Este S.R.L.',
    cuit: '30-11111111-1',
    direccion: 'Av. Acceso Este 2345, Maipú',
    telefono: '+54 261 234-5678',
    email: 'admin@plantaeste.com',
    estado: 'MANTENIMIENTO',
    capacidadTotal: 2800,
    capacidadUsada: 0,
    procesadoMes: 0,
    residuosAceptados: ['Sólidos'],
    certificaciones: [],
    ultimaAuditoria: '2024-11-10',
    proximaAuditoria: '2025-05-10',
  },
  {
    id: 4,
    nombre: 'Operador Sur',
    razonSocial: 'Residuos del Sur S.A.',
    cuit: '30-22222222-2',
    direccion: 'Calle Principal 456, Las Heras',
    telefono: '+54 261 876-5432',
    email: 'contacto@operadorsur.com',
    estado: 'ACTIVO',
    capacidadTotal: 4200,
    capacidadUsada: 3780,
    procesadoMes: 1050,
    residuosAceptados: ['Líquidos', 'Sólidos', 'Gases'],
    certificaciones: ['ISO 14001', 'ISO 9001', 'OHSAS 18001'],
    ultimaAuditoria: '2025-01-05',
    proximaAuditoria: '2025-07-05',
  },
];

const estadoConfig: Record<string, { label: string; color: Badge['color']; icon: React.ReactNode }> = {
  ACTIVO: { label: 'En línea', color: 'success', icon: <CheckCircle2 size={14} /> },
  MANTENIMIENTO: { label: 'Mantenimiento', color: 'warning', icon: <AlertCircle size={14} /> },
  INACTIVO: { label: 'Fuera de servicio', color: 'error', icon: <AlertCircle size={14} /> },
};

const OperadoresPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [vista, setVista] = useState<'grid' | 'lista'>('lista');

  const operadoresFiltrados = operadoresMock.filter(op => {
    const matchesSearch = op.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         op.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         op.cuit.includes(searchTerm);
    const matchesEstado = filtroEstado === '' || op.estado === filtroEstado;
    return matchesSearch && matchesEstado;
  });

  const isMobile = typeof window !== 'undefined' && window.location.pathname.includes('/mobile');

  const getCapacidadColor = (usada: number, total: number) => {
    const porcentaje = (usada / total) * 100;
    if (porcentaje > 90) return 'text-error-600';
    if (porcentaje > 70) return 'text-warning-600';
    return 'text-success-600';
  };

  const getCapacidadBg = (usada: number, total: number) => {
    const porcentaje = (usada / total) * 100;
    if (porcentaje > 90) return 'bg-error-500';
    if (porcentaje > 70) return 'bg-warning-500';
    return 'bg-success-500';
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
              <h2 className="text-2xl font-bold text-neutral-900">Operadores</h2>
              <Badge variant="soft" color="primary">{operadoresFiltrados.length}</Badge>
            </div>
            <p className="text-neutral-600 mt-1">
              Gestión de plantas de tratamiento
            </p>
          </div>
        </div>
        <Button leftIcon={<Plus size={18} />}>
          Nuevo Operador
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success-50 rounded-lg flex items-center justify-center">
              <Building2 className="text-success-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">3</p>
              <p className="text-xs text-neutral-500">Activos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning-50 rounded-lg flex items-center justify-center">
              <AlertCircle className="text-warning-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">1</p>
              <p className="text-xs text-neutral-500">Mantenimiento</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-primary-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">3,180</p>
              <p className="text-xs text-neutral-500">Tn este mes</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-info-50 rounded-lg flex items-center justify-center">
              <Factory className="text-info-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">13,500</p>
              <p className="text-xs text-neutral-500">Tn capacidad total</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="base">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nombre, razón social o CUIT..."
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
              <option value="ACTIVO">En línea</option>
              <option value="MANTENIMIENTO">Mantenimiento</option>
              <option value="INACTIVO">Fuera de servicio</option>
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
                    Operador
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Capacidad
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Procesado (mes)
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {operadoresFiltrados.map((op) => {
                  const estado = estadoConfig[op.estado];
                  const capacidadPorcentaje = (op.capacidadUsada / op.capacidadTotal) * 100;
                  
                  return (
                    <tr 
                      key={op.id} 
                      className="hover:bg-neutral-50 transition-colors cursor-pointer group"
                      onClick={() => navigate(isMobile ? `/mobile/actores/operadores/${op.id}` : `/actores/operadores/${op.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Building2 className="text-primary-600" size={18} />
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                              {op.nombre}
                            </p>
                            <p className="text-xs text-neutral-500">{op.cuit}</p>
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
                        <div className="w-32">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className={getCapacidadColor(op.capacidadUsada, op.capacidadTotal)}>
                              {capacidadPorcentaje.toFixed(0)}%
                            </span>
                            <span className="text-neutral-500">
                              {op.capacidadUsada.toLocaleString()}/{op.capacidadTotal.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${getCapacidadBg(op.capacidadUsada, op.capacidadTotal)}`}
                              style={{ width: `${capacidadPorcentaje}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-neutral-900">
                          {op.procesadoMes.toLocaleString()} Tn
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-neutral-600">
                          <p className="flex items-center gap-1">
                            <Phone size={12} />
                            {op.telefono}
                          </p>
                        </div>
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
          {operadoresFiltrados.map((op) => {
            const estado = estadoConfig[op.estado];
            const capacidadPorcentaje = (op.capacidadUsada / op.capacidadTotal) * 100;
            
            return (
              <Card 
                key={op.id}
                className="p-5 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => navigate(isMobile ? `/mobile/actores/operadores/${op.id}` : `/actores/operadores/${op.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                      <Building2 className="text-primary-600" size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                        {op.nombre}
                      </h3>
                      <p className="text-xs text-neutral-500">{op.razonSocial}</p>
                    </div>
                  </div>
                  <Badge variant="soft" color={estado.color}>
                    {estado.label}
                  </Badge>
                </div>

                {/* Capacidad */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-neutral-600">Capacidad utilizada</span>
                    <span className={getCapacidadColor(op.capacidadUsada, op.capacidadTotal)}>
                      {capacidadPorcentaje.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${getCapacidadBg(op.capacidadUsada, op.capacidadTotal)}`}
                      style={{ width: `${capacidadPorcentaje}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    {op.capacidadUsada.toLocaleString()} / {op.capacidadTotal.toLocaleString()} Tn
                  </p>
                </div>

                {/* Info adicional */}
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Procesado (mes)</p>
                    <p className="font-medium text-neutral-900">{op.procesadoMes.toLocaleString()} Tn</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Residuos</p>
                    <p className="font-medium text-neutral-900">{op.residuosAceptados.length} tipos</p>
                  </div>
                </div>

                {/* Certificaciones */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {op.certificaciones.map(cert => (
                    <span key={cert} className="px-2 py-0.5 bg-success-50 text-success-700 text-xs rounded-full">
                      {cert}
                    </span>
                  ))}
                  {op.certificaciones.length === 0 && (
                    <span className="text-xs text-neutral-400">Sin certificaciones</span>
                  )}
                </div>

                {/* Contacto */}
                <div className="flex items-center gap-3 pt-4 border-t border-neutral-100">
                  <button 
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-50 text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors"
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    <Phone size={14} />
                    Llamar
                  </button>
                  <button 
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-neutral-50 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-100 transition-colors"
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    <Mail size={14} />
                    Email
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {operadoresFiltrados.length === 0 && (
        <Card className="py-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="text-neutral-400" size={24} />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-1">
              No se encontraron operadores
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

export default OperadoresPage;

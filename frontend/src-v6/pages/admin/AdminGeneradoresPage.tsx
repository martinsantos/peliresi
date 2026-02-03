/**
 * SITREP v6 - Admin Generadores Page
 * ==================================
 * Panel administrativo específico para generadores
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Factory, 
  Plus, 
  Search, 
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Phone,
  Mail,
  Edit,
  Eye
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';

// Mock data
const generadoresData = [
  { 
    id: 1, 
    razonSocial: 'Química Mendoza S.A.', 
    cuit: '30-12345678-9',
    domicilio: 'Av. San Martín 1234, Mendoza',
    telefono: '+54 261 412-3456',
    email: 'contacto@quimicamendoza.com',
    estado: 'activo',
    manifiestos: 145,
    residuos: 420,
    ultimoManifiesto: '2025-01-31',
    categoria: 'Grandes Generadores'
  },
  { 
    id: 2, 
    razonSocial: 'Industrias del Sur', 
    cuit: '30-11111111-1',
    domicilio: 'Parque Industrial, Luján',
    telefono: '+54 261 234-5678',
    email: 'info@industriasdelsur.com',
    estado: 'activo',
    manifiestos: 89,
    residuos: 280,
    ultimoManifiesto: '2025-01-30',
    categoria: 'Medianos Generadores'
  },
  { 
    id: 3, 
    razonSocial: 'Metalúrgica Argentina', 
    cuit: '30-22222222-2',
    domicilio: 'Ruta 40 Km 15, Guaymallén',
    telefono: '+54 261 345-6789',
    email: 'admin@metalargentina.com',
    estado: 'alerta',
    manifiestos: 34,
    residuos: 120,
    ultimoManifiesto: '2025-01-15',
    categoria: 'Medianos Generadores'
  },
  { 
    id: 4, 
    razonSocial: 'Textil Cuyo', 
    cuit: '30-33333333-3',
    domicilio: 'Av. España 567, Godoy Cruz',
    telefono: '+54 261 456-7890',
    email: 'info@textilcuyo.com',
    estado: 'activo',
    manifiestos: 67,
    residuos: 195,
    ultimoManifiesto: '2025-01-29',
    categoria: 'Pequeños Generadores'
  },
];

const AdminGeneradoresPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  const [busqueda, setBusqueda] = useState('');

  const generadoresFiltrados = generadoresData.filter(g => 
    g.razonSocial.toLowerCase().includes(busqueda.toLowerCase()) ||
    g.cuit.includes(busqueda)
  );

  const stats = {
    total: generadoresData.length,
    activos: generadoresData.filter(g => g.estado === 'activo').length,
    alertas: generadoresData.filter(g => g.estado === 'alerta').length,
    totalResiduos: generadoresData.reduce((acc, g) => acc + g.residuos, 0),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Factory size={24} className="text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Admin Generadores</h2>
            <p className="text-neutral-600">Panel de gestión de generadores de residuos</p>
          </div>
        </div>
        <Button leftIcon={<Plus size={18} />}>
          Nuevo Generador
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <p className="text-sm text-purple-700 mb-1">Total Generadores</p>
            <p className="text-3xl font-bold text-purple-900">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-success-50 border-success-200">
          <CardContent className="p-4">
            <p className="text-sm text-success-700 mb-1">Activos</p>
            <p className="text-3xl font-bold text-success-900">{stats.activos}</p>
          </CardContent>
        </Card>
        <Card className="bg-warning-50 border-warning-200">
          <CardContent className="p-4">
            <p className="text-sm text-warning-700 mb-1">Con Alertas</p>
            <p className="text-3xl font-bold text-warning-900">{stats.alertas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-neutral-600 mb-1">Total Residuos (tn)</p>
            <p className="text-3xl font-bold text-neutral-900">{stats.totalResiduos}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de tendencia */}
      <Card>
        <CardHeader title="Generación de Residuos por Mes" icon={<TrendingUp size={20} />} />
        <CardContent>
          <div className="h-48 flex items-end gap-4">
            {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'].map((mes, i) => (
              <div key={mes} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-purple-200 rounded-t-md relative group" style={{ height: `${40 + i * 15}px` }}>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {80 + i * 30}tn
                  </div>
                </div>
                <span className="text-xs text-neutral-500">{mes}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card padding="base">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por razón social o CUIT..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              leftIcon={<Search size={18} />}
            />
          </div>
          <select className="px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none">
            <option value="">Todas las categorías</option>
            <option value="grandes">Grandes Generadores</option>
            <option value="medianos">Medianos Generadores</option>
            <option value="pequenos">Pequeños Generadores</option>
          </select>
        </div>
      </Card>

      {/* Lista de generadores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {generadoresFiltrados.map((generador) => (
          <Card key={generador.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Factory size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-neutral-900">{generador.razonSocial}</h4>
                    <p className="text-sm text-neutral-500 font-mono">{generador.cuit}</p>
                  </div>
                </div>
                <Badge 
                  variant="soft" 
                  color={generador.estado === 'activo' ? 'success' : 'warning'}
                >
                  {generador.estado === 'activo' ? <CheckCircle size={12} className="mr-1" /> : <AlertTriangle size={12} className="mr-1" />}
                  {generador.estado === 'activo' ? 'Activo' : 'Alerta'}
                </Badge>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <MapPin size={14} />
                  <span>{generador.domicilio}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <Mail size={14} />
                  <span>{generador.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <Phone size={14} />
                  <span>{generador.telefono}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-neutral-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-neutral-900">{generador.manifiestos}</p>
                  <p className="text-xs text-neutral-500">Manifiestos</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-neutral-900">{generador.residuos}</p>
                  <p className="text-xs text-neutral-500">Tn Residuos</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-2 text-center">
                  <p className="text-xs font-medium text-neutral-900">{generador.ultimoManifiesto}</p>
                  <p className="text-xs text-neutral-500">Último</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" leftIcon={<Eye size={14} />} onClick={() => navigate(isMobile ? `/mobile/admin/generadores/${generador.id}` : `/admin/generadores/${generador.id}`)}>
                  Ver
                </Button>
                <Button variant="outline" size="sm" className="flex-1" leftIcon={<Edit size={14} />}>
                  Editar
                </Button>
                <Button variant="outline" size="sm" className="flex-1" leftIcon={<FileText size={14} />} onClick={() => navigate(isMobile ? `/mobile/admin/generadores/${generador.id}` : `/admin/generadores/${generador.id}`)}>
                  Manifiestos
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminGeneradoresPage;

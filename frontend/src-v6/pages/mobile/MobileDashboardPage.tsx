/**
 * SITREP v6 - Mobile Dashboard Page
 * ==================================
 * Dashboard optimizado para dispositivos móviles
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  MapPin,
  Users,
  TrendingUp,
  AlertCircle,
  Clock,
  ChevronRight,
  Package,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Badge } from '../../components/ui/BadgeV2';
import { useAuth } from '../../contexts/AuthContext';

const roleLabelMap: Record<string, string> = {
  ADMIN: 'Admin',
  GENERADOR: 'Generador',
  TRANSPORTISTA: 'Transportista',
  OPERADOR: 'Operador',
  AUDITOR: 'Auditor',
};

const roleBadgeColor: Record<string, 'primary' | 'purple' | 'orange' | 'green' | 'info'> = {
  ADMIN: 'primary',
  GENERADOR: 'purple',
  TRANSPORTISTA: 'orange',
  OPERADOR: 'green',
  AUDITOR: 'info',
};

// Mock data
const stats = [
  { id: 1, label: 'Manifiestos Hoy', value: '12', change: '+3', icon: FileText, color: 'primary' },
  { id: 2, label: 'En Tránsito', value: '8', change: '+2', icon: MapPin, color: 'info' },
  { id: 3, label: 'Pendientes', value: '5', icon: Clock, color: 'warning' },
  { id: 4, label: 'Completados', value: '45', change: '+12', icon: CheckCircle2, color: 'success' },
];

const actividadReciente = [
  { id: 1, tipo: 'manifiesto', titulo: 'Manifiesto #2025-00184', estado: 'en_transito', tiempo: 'Hace 10 min', icon: FileText },
  { id: 2, tipo: 'alerta', titulo: 'Retraso en entrega', estado: 'warning', tiempo: 'Hace 25 min', icon: AlertCircle },
  { id: 3, tipo: 'manifiesto', titulo: 'Manifiesto #2025-00183', estado: 'completado', tiempo: 'Hace 1 hora', icon: CheckCircle2 },
  { id: 4, tipo: 'manifiesto', titulo: 'Manifiesto #2025-00182', estado: 'completado', tiempo: 'Hace 2 horas', icon: CheckCircle2 },
];

const accesosRapidos = [
  { id: 1, label: 'Nuevo Manifiesto', icon: FileText, path: '/mobile/manifiestos/nuevo', color: 'primary' },
  { id: 2, label: 'Escanear QR', icon: MapPin, path: '/mobile/scan', color: 'success' },
  { id: 3, label: 'Ver Tracking', icon: Package, path: '/mobile/tracking', color: 'info' },
  { id: 4, label: 'Reportes', icon: TrendingUp, path: '/mobile/reportes', color: 'purple' },
];

export const MobileDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{greeting()},</p>
          <h2 className="text-xl font-bold text-neutral-900">{currentUser.nombre}</h2>
        </div>
        <Badge variant="soft" color={roleBadgeColor[currentUser.rol] || 'primary'}>
          {roleLabelMap[currentUser.rol] || currentUser.rol}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/mobile/manifiestos')}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className={`p-2 rounded-lg ${
                    stat.color === 'primary' ? 'bg-primary-100' :
                    stat.color === 'info' ? 'bg-info-100' :
                    stat.color === 'warning' ? 'bg-warning-100' :
                    'bg-success-100'
                  }`}>
                    <Icon size={18} className={
                      stat.color === 'primary' ? 'text-primary-600' :
                      stat.color === 'info' ? 'text-info-600' :
                      stat.color === 'warning' ? 'text-warning-600' :
                      'text-success-600'
                    } />
                  </div>
                  {stat.change && (
                    <span className="text-xs font-medium text-success-600">{stat.change}</span>
                  )}
                </div>
                <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                <p className="text-xs text-neutral-500">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Access */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Accesos Rápidos</h3>
        <div className="grid grid-cols-4 gap-2">
          {accesosRapidos.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl border border-neutral-100 active:scale-95 transition-transform"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  item.color === 'primary' ? 'bg-primary-100' :
                  item.color === 'success' ? 'bg-success-100' :
                  item.color === 'info' ? 'bg-info-100' :
                  'bg-purple-100'
                }`}>
                  <Icon size={22} className={
                    item.color === 'primary' ? 'text-primary-600' :
                    item.color === 'success' ? 'text-success-600' :
                    item.color === 'info' ? 'text-info-600' :
                    'text-purple-600'
                  } />
                </div>
                <span className="text-[10px] font-medium text-neutral-700 text-center leading-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-900">Actividad Reciente</h3>
          <button 
            onClick={() => navigate('/mobile/manifiestos')}
            className="text-xs text-primary-600 font-medium flex items-center gap-0.5"
          >
            Ver todo
            <ChevronRight size={14} />
          </button>
        </div>
        
        <div className="space-y-2 animate-fade-in">
          {actividadReciente.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.id} className="active:bg-neutral-50 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      item.estado === 'en_transito' ? 'bg-info-100' :
                      item.estado === 'warning' ? 'bg-warning-100' :
                      'bg-success-100'
                    }`}>
                      <Icon size={18} className={
                        item.estado === 'en_transito' ? 'text-info-600' :
                        item.estado === 'warning' ? 'text-warning-600' :
                        'text-success-600'
                      } />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 text-sm truncate">{item.titulo}</p>
                      <p className="text-xs text-neutral-500">{item.tiempo}</p>
                    </div>
                    <Badge 
                      variant="soft" 
                      size="sm"
                      color={
                        item.estado === 'en_transito' ? 'info' :
                        item.estado === 'warning' ? 'warning' :
                        'success'
                      }
                    >
                      {item.estado === 'en_transito' ? 'En tránsito' :
                       item.estado === 'warning' ? 'Alerta' :
                       'Completado'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Resumen del día */}
      <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-primary-100 text-sm">Resumen del día</p>
              <h3 className="text-xl font-bold mt-1">8 manifiestos activos</h3>
              <p className="text-primary-100 text-sm mt-1">2 pendientes de recepción</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp size={24} className="text-white" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button 
              onClick={() => navigate('/mobile/manifiestos')}
              className="flex-1 py-2 bg-white text-primary-600 font-medium rounded-lg text-sm"
            >
              Ver manifiestos
            </button>
            <button 
              onClick={() => navigate('/mobile/tracking')}
              className="flex-1 py-2 bg-primary-400/50 text-white font-medium rounded-lg text-sm"
            >
              Ver tracking
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileDashboardPage;

/**
 * SITREP v6 - Estadísticas Page
 * ==============================
 * Dashboard de estadísticas y KPIs
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  Users,
  Leaf,
  ArrowLeft,
  Download,
  Calendar
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';

// Mock stats data
const statsCards = [
  {
    title: 'Total Manifiestos',
    value: '1,247',
    change: '+12.5%',
    trend: 'up',
    icon: Package,
    color: 'primary',
  },
  {
    title: 'En Tránsito',
    value: '48',
    change: '+5.2%',
    trend: 'up',
    icon: Truck,
    color: 'info',
  },
  {
    title: 'Generadores Activos',
    value: '156',
    change: '+3.1%',
    trend: 'up',
    icon: Users,
    color: 'secondary',
  },
  {
    title: 'Residuos Tratados',
    value: '45.2 Tn',
    change: '-2.4%',
    trend: 'down',
    icon: Leaf,
    color: 'success',
  },
];

const EstadisticasPage: React.FC = () => {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'año'>('mes');

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      primary: { bg: 'bg-primary-50', text: 'text-primary-600' },
      info: { bg: 'bg-info-50', text: 'text-info-600' },
      success: { bg: 'bg-success-50', text: 'text-success-600' },
      secondary: { bg: 'bg-secondary-50', text: 'text-secondary-600' },
    };
    return colors[color] || colors.primary;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-neutral-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Estadísticas</h2>
            <p className="text-neutral-600 mt-1">
              Métricas y análisis del sistema
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={18} />}>
            Exportar
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <Calendar size={18} className="text-neutral-500" />
        <div className="flex bg-neutral-100 rounded-lg p-1">
          {(['semana', 'mes', 'año'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                periodo === p
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => {
          const colors = getColorClasses(stat.color);
          const Icon = stat.icon;
          
          return (
            <Card key={stat.title} className="p-4">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={colors.text} size={20} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${
                  stat.trend === 'up' ? 'text-success-600' : 'text-error-600'
                }`}>
                  {stat.trend === 'up' ? (
                    <TrendingUp size={14} />
                  ) : (
                    <TrendingDown size={14} />
                  )}
                  {stat.change}
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                <p className="text-sm text-neutral-600">{stat.title}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts placeholder */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Manifiestos por Estado
          </h3>
          <div className="h-64 flex items-center justify-center bg-neutral-50 rounded-xl">
            <div className="text-center">
              <div className="w-32 h-32 rounded-full border-8 border-neutral-200 border-t-primary-500 border-r-success-500 border-b-warning-500 border-l-info-500 animate-spin" style={{ animationDuration: '3s' }} />
              <p className="text-neutral-500 mt-4 text-sm">Gráfico circular</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Tendencia Mensual
          </h3>
          <div className="h-64 flex items-end justify-center gap-2 bg-neutral-50 rounded-xl p-4">
            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 85].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-primary-500 rounded-t-sm hover:bg-primary-600 transition-colors"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-neutral-500">
            <span>Ene</span>
            <span>Jun</span>
            <span>Dic</span>
          </div>
        </Card>
      </div>

      {/* Top Generators */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">
          Top Generadores
        </h3>
        <div className="space-y-4 animate-fade-in">
          {[
            { name: 'Química Mendoza S.A.', manifiestos: 145, toneladas: '12.5 Tn' },
            { name: 'Industrias del Sur', manifiestos: 98, toneladas: '8.3 Tn' },
            { name: 'Metalúrgica Argentina', manifiestos: 87, toneladas: '24.1 Tn' },
            { name: 'Plásticos Argentinos', manifiestos: 76, toneladas: '6.8 Tn' },
            { name: 'Textil Cuyo', manifiestos: 54, toneladas: '4.2 Tn' },
          ].map((gen, i) => (
            <div key={gen.name} className="flex items-center gap-4">
              <span className="w-6 text-center text-sm font-medium text-neutral-500">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-neutral-900">{gen.name}</p>
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary-500 rounded-full"
                      style={{ width: `${(gen.manifiestos / 145) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-neutral-900">{gen.manifiestos}</p>
                <p className="text-xs text-neutral-500">{gen.toneladas}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default EstadisticasPage;

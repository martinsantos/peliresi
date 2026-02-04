/**
 * SITREP v6 - Estadísticas Page
 * ==============================
 * Dashboard de estadísticas y KPIs - Connected to real API data
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
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { useDashboardStats } from '../../hooks/useDashboard';
import { useGeneradores } from '../../hooks/useActores';

const EstadisticasPage: React.FC = () => {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'año'>('mes');

  const { data: dashboardData, isLoading, isError } = useDashboardStats();
  const { data: generadoresData } = useGeneradores();

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const stats = dashboardData?.estadisticas;
  const generadoresList = Array.isArray(generadoresData?.items) ? generadoresData.items : [];

  const statsCards = [
    {
      title: 'Total Manifiestos',
      value: stats?.total ?? '-',
      icon: Package,
      color: 'primary',
    },
    {
      title: 'En Tránsito',
      value: stats?.enTransito ?? '-',
      icon: Truck,
      color: 'info',
    },
    {
      title: 'Generadores Activos',
      value: generadoresList.filter((g: any) => g.activo !== false).length || '-',
      icon: Users,
      color: 'secondary',
    },
    {
      title: 'Residuos Tratados',
      value: stats?.tratados ?? '-',
      icon: Leaf,
      color: 'success',
    },
  ];

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
              {isLoading ? (
                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando métricas...</span>
              ) : isError ? (
                <span className="flex items-center gap-2 text-error-600"><AlertCircle size={14} /> Error al cargar datos</span>
              ) : (
                'Métricas y análisis del sistema'
              )}
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
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <div className="h-8 w-16 bg-neutral-200 rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                )}
                <p className="text-sm text-neutral-600">{stat.title}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts - Manifiestos por Estado */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Manifiestos por Estado
          </h3>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-neutral-400" />
            </div>
          ) : stats ? (
            <div className="space-y-3">
              {[
                { label: 'Borradores', count: stats.borradores, color: 'bg-neutral-400' },
                { label: 'Aprobados', count: stats.aprobados, color: 'bg-primary-500' },
                { label: 'En Tránsito', count: stats.enTransito, color: 'bg-info-500' },
                { label: 'Entregados', count: stats.entregados, color: 'bg-warning-500' },
                { label: 'Recibidos', count: stats.recibidos, color: 'bg-orange-500' },
                { label: 'Tratados', count: stats.tratados, color: 'bg-success-500' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-sm text-neutral-600 w-24">{item.label}</span>
                  <div className="flex-1 h-6 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all`}
                      style={{ width: `${stats.total > 0 ? (item.count / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-neutral-900 w-8 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-neutral-500">
              Sin datos disponibles
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Resumen General
          </h3>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-neutral-400" />
            </div>
          ) : stats ? (
            <div className="space-y-4">
              <div className="p-4 bg-primary-50 rounded-xl">
                <p className="text-sm text-primary-700">Total Manifiestos</p>
                <p className="text-3xl font-bold text-primary-900">{stats.total}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-info-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-info-900">{stats.enTransito}</p>
                  <p className="text-xs text-info-700">En tránsito</p>
                </div>
                <div className="p-3 bg-success-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-success-900">{stats.tratados}</p>
                  <p className="text-xs text-success-700">Completados</p>
                </div>
                <div className="p-3 bg-warning-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-warning-900">{stats.borradores + stats.aprobados}</p>
                  <p className="text-xs text-warning-700">Pendientes</p>
                </div>
                <div className="p-3 bg-neutral-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-neutral-900">{stats.total > 0 ? ((stats.tratados / stats.total) * 100).toFixed(0) : 0}%</p>
                  <p className="text-xs text-neutral-600">Tasa completitud</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-neutral-500">
              Sin datos disponibles
            </div>
          )}
        </Card>
      </div>

      {/* Top Generators - from real data */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">
          Top Generadores
        </h3>
        {generadoresList.length === 0 ? (
          <div className="py-8 text-center text-neutral-500">
            {isLoading ? (
              <Loader2 size={24} className="animate-spin mx-auto" />
            ) : (
              'No hay datos de generadores disponibles'
            )}
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {generadoresList.slice(0, 5).map((gen: any, i: number) => (
              <div key={gen.id || gen.razonSocial} className="flex items-center gap-4">
                <span className="w-6 text-center text-sm font-medium text-neutral-500">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-neutral-900">{gen.razonSocial}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${100 - i * 15}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-500">{gen.categoria || '-'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default EstadisticasPage;

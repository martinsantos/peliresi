/**
 * SITREP v6 - Reportes Page (Conectada a API)
 * ============================================
 * Centro de reportes con diseño mejorado
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Truck,
  BarChart3,
  TrendingUp,
  Building2,
  Calendar,
  Download,
  ChevronRight,
  Filter,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { useExportarReporte } from '../../hooks/useReportes';

// Reportes disponibles
const reportes = [
  {
    id: 'manifiestos-periodo',
    titulo: 'Manifiestos por Período',
    descripcion: 'Resumen de manifiestos generados en un rango de fechas',
    icono: FileText,
    color: 'primary',
    frecuencia: 'Diario',
    frecuenciaColor: 'neutral' as const,
    tipo: 'manifiestos',
  },
  {
    id: 'transporte-stats',
    titulo: 'Estadísticas de Transporte',
    descripcion: 'Análisis de rutas, tiempos y eficiencia',
    icono: Truck,
    color: 'secondary',
    frecuencia: 'Semanal',
    frecuenciaColor: 'neutral' as const,
    tipo: 'transporte',
  },
  {
    id: 'residuos-generacion',
    titulo: 'Generación de Residuos',
    descripcion: 'Volumen y tipos de residuos por generador',
    icono: BarChart3,
    color: 'accent',
    frecuencia: 'Mensual',
    frecuenciaColor: 'neutral' as const,
    tipo: 'tratados',
  },
  {
    id: 'operadores-capacidad',
    titulo: 'Capacidad de Operadores',
    descripcion: 'Utilización de plantas de tratamiento',
    icono: Building2,
    color: 'success',
    frecuencia: 'Mensual',
    frecuenciaColor: 'neutral' as const,
    tipo: 'tratados',
  },
  {
    id: 'tendencias',
    titulo: 'Tendencias Anuales',
    descripcion: 'Comparativa interanual de gestión',
    icono: TrendingUp,
    color: 'info',
    frecuencia: 'Anual',
    frecuenciaColor: 'neutral' as const,
    tipo: 'manifiestos',
  },
];

const getColorClasses = (color: string) => {
  const colors: Record<string, { bg: string; icon: string; border: string }> = {
    primary: { bg: 'bg-primary-50', icon: 'text-primary-600', border: 'border-primary-100' },
    secondary: { bg: 'bg-secondary-50', icon: 'text-secondary-600', border: 'border-secondary-100' },
    accent: { bg: 'bg-accent-50', icon: 'text-accent-600', border: 'border-accent-100' },
    success: { bg: 'bg-success-50', icon: 'text-success-600', border: 'border-success-100' },
    info: { bg: 'bg-info-50', icon: 'text-info-600', border: 'border-info-100' },
  };
  return colors[color] || colors.primary;
};

const ReportesPage: React.FC = () => {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState('');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const exportarReporte = useExportarReporte();

  const reportesFiltrados = reportes.filter(r =>
    r.titulo.toLowerCase().includes(filtro.toLowerCase()) ||
    r.descripcion.toLowerCase().includes(filtro.toLowerCase())
  );

  const handleGenerar = (reporte: typeof reportes[0]) => {
    setGeneratingId(reporte.id);
    exportarReporte.mutate(
      { tipo: reporte.tipo, formato: 'pdf' },
      {
        onSettled: () => setGeneratingId(null),
      }
    );
  };

  const handleExportarTodo = () => {
    exportarReporte.mutate({ tipo: 'manifiestos', formato: 'excel' });
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
              <h2 className="text-2xl font-bold text-neutral-900">Reportes</h2>
              <Badge variant="soft" color="primary">ADMIN</Badge>
            </div>
            <p className="text-neutral-600 mt-1">
              Genera y descarga reportes del sistema
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Filter size={18} />}>
            Filtros
          </Button>
          <Button
            leftIcon={exportarReporte.isPending ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            onClick={handleExportarTodo}
            disabled={exportarReporte.isPending}
          >
            Exportar Todo
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <input
          type="text"
          placeholder="Buscar reportes..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-neutral-200 focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/10 focus:outline-none transition-all"
        />
        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
      </div>

      {/* Grid de Reportes */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 stagger-children">
        {reportesFiltrados.map((reporte) => {
          const colors = getColorClasses(reporte.color);
          const Icon = reporte.icono;
          const isGenerating = generatingId === reporte.id;

          return (
            <Card
              key={reporte.id}
              className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-[rgba(27,94,60,0.15)] hover-lift"
            >
              <div className="p-5">
                {/* Header de tarjeta */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                    <Icon className={colors.icon} size={24} />
                  </div>
                  <Badge variant="soft" color={reporte.frecuenciaColor}>
                    {reporte.frecuencia}
                  </Badge>
                </div>

                {/* Contenido */}
                <h3 className="text-lg font-semibold text-neutral-900 mb-2 group-hover:text-primary-600 transition-colors">
                  {reporte.titulo}
                </h3>
                <p className="text-sm text-neutral-600 mb-5 line-clamp-2">
                  {reporte.descripcion}
                </p>

                {/* Footer con botón */}
                <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Calendar size={14} />
                    <span>Último: Hoy</span>
                  </div>
                  <button
                    onClick={() => handleGenerar(reporte)}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors group/btn disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        Generar
                        <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Efecto hover decoration */}
              <div className={`absolute top-0 right-0 w-32 h-32 ${colors.bg} rounded-full -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:scale-150 transition-transform duration-500 pointer-events-none`} />
            </Card>
          );
        })}
      </div>

      {/* Empty state */}
      {reportesFiltrados.length === 0 && (
        <Card className="py-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="text-neutral-400" size={24} />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-1">
              No se encontraron reportes
            </h3>
            <p className="text-neutral-500">
              Intenta con otros términos de búsqueda
            </p>
          </div>
        </Card>
      )}

      {/* Reportes Recientes */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">
          Reportes Generados Recientemente
        </h3>
        <Card>
          <div className="divide-y divide-neutral-100">
            {[
              { nombre: 'Manifiestos_Enero_2025.pdf', fecha: 'Hoy, 10:30', tamaño: '2.4 MB' },
              { nombre: 'Transporte_Semana_4.pdf', fecha: 'Ayer, 16:45', tamaño: '1.8 MB' },
              { nombre: 'Residuos_Diciembre_2024.pdf', fecha: '28 Ene, 09:15', tamaño: '3.2 MB' },
            ].map((reporte, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                    <FileText className="text-red-500" size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors">
                      {reporte.nombre}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {reporte.fecha} • {reporte.tamaño}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Download size={18} />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReportesPage;

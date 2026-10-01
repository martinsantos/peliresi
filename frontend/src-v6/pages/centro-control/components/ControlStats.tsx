/**
 * CentroControl — KPI Cards + Pipeline + Charts + Quick Actions
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  FileText,
  Truck,
  TrendingUp,
  Factory,
  FlaskConical,
  ChevronRight,
  BarChart3,
  Bell,
  Shield,
  Settings,
  Radio,
} from 'lucide-react';
import {
  ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../../../components/ui/CardV2';
import { Badge } from '../../../components/ui/BadgeV2';
import { ESTADO_CHART_COLORS } from '../../../utils/chart-colors';
import { ChartTooltip } from '../../../components/charts/ChartTooltip';
import { CategoryBarChart } from '../../../components/charts/CategoryBarChart';
import type { CentroControlData } from '../../../hooks/useCentroControl';

const ESTADO_PIPELINE = ['BORRADOR', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'] as const;

interface AlertItem {
  id: string;
  tipo: 'critical' | 'warning' | 'info';
  mensaje: string;
  tiempo: string;
}

interface ControlStatsProps {
  cc: CentroControlData | null;
  alertas: AlertItem[];
  datePreset: number;
  inspectionCount?: number | null;
  children?: React.ReactNode;
}

export const ControlStats: React.FC<ControlStatsProps> = ({
  cc,
  alertas,
  datePreset,
  inspectionCount,
  children,
}) => {
  const navigate = useNavigate();
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const pendingScroll = useRef<{ container: HTMLElement; top: number } | null>(null);
  useLayoutEffect(() => {
    const saved = pendingScroll.current;
    pendingScroll.current = null;
    if (statisticsOpen && saved?.container.isConnected) saved.container.scrollTop = saved.top;
  }, [statisticsOpen]);

  // ── KPIs ──
  type KpiItem = { label: string; value: number | null; icon: React.ElementType; gradient: string; href: string; suffix?: string };
  const kpis: KpiItem[] = [
    {
      label: 'Total Manifiestos',
      value: cc?.estadisticas?.totalManifiestos || 0,
      icon: FileText,
      gradient: 'from-emerald-600 to-emerald-700',
      href: '/manifiestos',
    },
    {
      label: 'En Tránsito',
      value: cc?.estadisticas?.enTransitoActivos || 0,
      icon: Truck,
      gradient: 'from-amber-700 to-amber-800',
      href: '/manifiestos?estado=EN_TRANSITO',
    },
    {
      label: 'Generadores Activos',
      value: cc?.estadisticas?.generadoresActivos || 0,
      icon: Factory,
      gradient: 'from-purple-700 to-purple-800',
      href: '/admin/actores/generadores',
    },
    {
      label: 'Operadores Activos',
      value: cc?.estadisticas?.operadoresActivos || 0,
      icon: FlaskConical,
      gradient: 'from-blue-600 to-blue-700',
      href: '/admin/actores/operadores',
    },
    {
      label: 'Toneladas Período',
      value: cc?.estadisticas?.toneladasPeriodo || 0,
      icon: TrendingUp,
      gradient: 'from-teal-600 to-teal-700',
      href: '/reportes',
      suffix: 't',
    },
  ];

  if (inspectionCount !== undefined) kpis.splice(4, 0, { label: 'Inspecciones activas', value: inspectionCount, icon: ClipboardCheck, gradient: 'from-teal-600 to-teal-700', href: '/inspecciones' });

  // ── Pipeline data ──
  const pipelineData = (() => {
    const porEstado = cc?.estadisticas?.porEstado || {};
    return ESTADO_PIPELINE.map(estado => ({
      name: estado.replace(/_/g, ' '),
      key: estado,
      count: porEstado[estado] || 0,
      color: ESTADO_CHART_COLORS[estado],
    }));
  })();

  const pipelineTotal = pipelineData.reduce((s, d) => s + d.count, 0) || 1;

  // ── Donut data ──
  // Distribution is not the workflow: include terminal and legacy states too.
  const donutData = Object.entries(cc?.estadisticas?.distribucionPorEstado ?? cc?.estadisticas?.porEstado ?? {})
    .filter(([, count]) => count > 0)
    .map(([estado, count]) => ({ name: estado.replace(/_/g, ' '), value: count, fill: ESTADO_CHART_COLORS[estado] || '#6B7280' }));
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  // ── Sparkline data ──
  const sparklineData = (cc?.estadisticas?.manifiestosPorDia || []).map(d => ({
    fecha: new Date(d.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    cantidad: d.cantidad,
  }));

  // ── Quick Actions ──
  const quickActions = [
    { icon: FileText, label: 'Nuevo Manifiesto', path: '/manifiestos/nuevo', color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
    { icon: Truck, label: 'Ver Flota', path: '/manifiestos?estado=EN_TRANSITO', color: 'text-orange-700 bg-orange-50 hover:bg-orange-100' },
    { icon: BarChart3, label: 'Reportes', path: '/reportes', color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
    { icon: Bell, label: 'Alertas', path: '/alertas', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
    { icon: Shield, label: 'Auditoría', path: '/auditoria', color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' },
    { icon: Settings, label: 'Configuración', path: '/configuracion', color: 'text-neutral-600 bg-neutral-50 hover:bg-neutral-100' },
  ];

  return (
    <>
      {/* ══════ 5 KPI Cards ══════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 stagger-children">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <button type="button" key={i} aria-label={kpi.label} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${kpi.gradient} p-4 text-left group hover:shadow-lg transition-shadow duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 active:brightness-90 cursor-pointer`} onClick={() => navigate(kpi.href)}>
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -translate-y-1/3 translate-x-1/3 group-hover:scale-125 transition-transform duration-500" />
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center mb-2">
                  <Icon size={18} className="text-white" />
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {kpi.value ?? '—'}{kpi.suffix || ''}
                </p>
                <p className="text-xs text-white font-medium mt-0.5">{kpi.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {children}
      <details open={statisticsOpen} className="rounded-xl border border-neutral-200 bg-white" style={{ overflowAnchor: 'none' }} onToggle={event => setStatisticsOpen(event.currentTarget.open)}>
        <summary onClick={event => {
          event.preventDefault();
          const container = event.currentTarget.closest('main');
          pendingScroll.current = container ? { container, top: container.scrollTop } : null;
          setStatisticsOpen(open => !open);
        }} className="min-h-14 cursor-pointer px-5 py-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">Actividad y estadísticas del período</summary>
        {statisticsOpen ? <div className="space-y-6 border-t border-neutral-200 p-4">
      {/* ══════ Pipeline ══════ */}
      <Card className="border-0 shadow-sm">
        <CardHeader title="Pipeline de Manifiestos" subtitle="Flujo de trabajo: BORRADOR → TRATADO" />
        <CardContent>
          <div className="flex items-stretch gap-1 h-16 sm:h-20 w-full overflow-hidden">
            {pipelineData.map((stage, i) => {
              const widthPercent = Math.max(8, (stage.count / pipelineTotal) * 100);
              return (
                <button
                  type="button"
                  key={stage.key}
                  aria-label={`${stage.name}: ${stage.count}`}
                  className="relative flex flex-col items-center justify-center rounded-xl transition-colors duration-150 hover:brightness-95 active:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 focus-visible:-outline-offset-2 group cursor-pointer min-w-0 overflow-hidden"
                  onClick={() => navigate(`/manifiestos?estado=${stage.key}`)}
                  style={{
                    flex: `${widthPercent} 1 0%`,
                    backgroundColor: stage.color + '18',
                    borderBottom: `4px solid ${stage.color}`,
                  }}
                  title={`${stage.name}: ${stage.count}`}
                >
                  <span className="text-base sm:text-2xl font-extrabold truncate w-full text-center" style={{ color: stage.color }}>{stage.count}</span>
                  <span className="text-[9px] sm:text-xs font-medium text-neutral-500 leading-tight text-center px-0.5 truncate w-full">{stage.name}</span>
                  {i < pipelineData.length - 1 && (
                    <ChevronRight size={16} className="absolute -right-2.5 text-neutral-300 z-10 hidden sm:block" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex h-2 mt-3 rounded-full overflow-hidden bg-neutral-100">
            {pipelineData.map(stage => (
              <div
                key={stage.key}
                className="transition-all duration-700"
                style={{ flex: `${Math.max(1, stage.count)} 1 0%`, backgroundColor: stage.color }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ══════ Actividad del Período + Alertas (below map — rendered here for layout) ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estadísticas del período */}
        <Card padding="none">
          <div className="flex items-center gap-2 p-4 border-b border-neutral-100">
            <TrendingUp size={18} className="text-primary-600" />
            <h3 className="font-semibold text-neutral-900">Actividad del Período</h3>
          </div>
          <div className="p-4">
            {/* Sparkline */}
            {sparklineData.length > 0 ? (
              <div className="h-32 mb-3">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={80} initialDimension={{ width: 100, height: 80 }}>
                  <AreaChart data={sparklineData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                    <defs>
                      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0D8A4F" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0D8A4F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="fecha" tick={{ fontSize: 9 }} stroke="#94a3b8" interval="preserveStartEnd" />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="cantidad" name="manifiestos" stroke="#0D8A4F" fill="url(#sparkGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-xs text-neutral-400 mb-3">Sin datos de actividad diaria</div>
            )}
            {/* Mini stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-neutral-50 rounded-lg">
                <span className="text-neutral-500">Total</span>
                <p className="font-bold text-neutral-900">{cc?.estadisticas?.totalManifiestos || 0}</p>
              </div>
              <div className="p-2 bg-neutral-50 rounded-lg">
                <span className="text-neutral-500">En tránsito</span>
                <p className="font-bold text-amber-600">{cc?.estadisticas?.enTransitoActivos || 0}</p>
              </div>
              <div className="p-2 bg-neutral-50 rounded-lg">
                <span className="text-neutral-500">Generadores</span>
                <p className="font-bold text-green-600">{cc?.estadisticas?.generadoresActivos || 0}</p>
              </div>
              <div className="p-2 bg-neutral-50 rounded-lg">
                <span className="text-neutral-500">Toneladas</span>
                <p className="font-bold text-teal-600">{cc?.estadisticas?.toneladasPeriodo || 0}t</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Alertas */}
        <Card padding="none">
          <div className="flex items-center justify-between p-4 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <Radio size={18} className="text-error-500 animate-pulse-soft" />
              <h3 className="font-semibold text-neutral-900">Alertas en Vivo</h3>
            </div>
            <Badge variant="solid" color="error">{alertas.length}</Badge>
          </div>
          <div className="divide-y divide-neutral-100 max-h-56 overflow-y-auto">
            {alertas.map((alerta) => (
              <div
                key={alerta.id}
                className={`p-3 border-l-4 ${
                  alerta.tipo === 'critical' ? 'border-error-500 bg-error-50/50' :
                  alerta.tipo === 'warning' ? 'border-warning-500 bg-warning-50/50' :
                  'border-info-500 bg-info-50/50'
                }`}
              >
                <p className={`text-sm font-medium ${
                  alerta.tipo === 'critical' ? 'text-error-700' :
                  alerta.tipo === 'warning' ? 'text-warning-700' : 'text-info-700'
                }`}>
                  {alerta.mensaje}
                </p>
                <p className="text-xs text-neutral-400 mt-1">{alerta.tiempo}</p>
              </div>
            ))}
            {alertas.length === 0 && (
              <div className="p-6 text-center text-sm text-neutral-400">Sin alertas activas</div>
            )}
          </div>
        </Card>
      </div>

      {/* ══════ Charts Row ══════ */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Donut */}
        <Card className="border-0 shadow-sm">
          <CardHeader title="Distribución por Estado" subtitle="Manifiestos creados en el período seleccionado" />
          <CardContent>
            <div className="mb-3 text-center">
              <p className="text-3xl font-extrabold text-neutral-900">{donutTotal}</p>
              <p className="text-xs text-neutral-500">Total manifiestos</p>
            </div>
            <div className="max-h-[250px] sm:max-h-[300px] overflow-y-auto pr-2">
              <CategoryBarChart data={donutData} maxItems={10} emptyMessage="Sin datos" />
            </div>
          </CardContent>
        </Card>

        {/* Manifiestos por día bar chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader title="Manifiestos por Día" subtitle={`Últimos ${datePreset || 'N'} días`} />
          <CardContent>
            {sparklineData.length > 0 ? (
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={80} initialDimension={{ width: 100, height: 80 }}>
                  <BarChart data={sparklineData} margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} stroke="#94a3b8" interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="cantidad" name="manifiestos" fill="#0D8A4F" radius={[4, 4, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] sm:h-[300px] flex items-center justify-center text-neutral-400">Sin datos del período</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ══════ Quick Actions ══════ */}
      <Card className="border-0 shadow-sm">
        <CardHeader title="Acciones Rápidas" subtitle="Navegación directa a funciones clave" />
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <button
                  key={i}
                  onClick={() => navigate(action.path)}
                  className={`flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-xl text-sm font-medium border border-transparent hover:border-neutral-200 active:scale-[0.97] transition-all ${action.color}`}
                >
                  <Icon size={22} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
        </div> : null}
      </details>
    </>
  );
};

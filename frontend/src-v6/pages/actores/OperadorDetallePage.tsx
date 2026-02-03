/**
 * SITREP v6 - Operador Detail Page
 * =================================
 * Vista detalle de un operador/planta de tratamiento con tabs
 */

import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  FileText,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Edit,
  CheckCircle2,
  AlertCircle,
  Shield,
  Beaker,
  TrendingUp,
  BarChart3,
  Award,
  Gauge,
  Leaf,
  ClipboardCheck,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { useOperador } from '../../hooks/useActores';

const EMPTY_DEFAULTS = {
  metodosAutorizados: [] as string[],
  residuosAceptados: [] as string[],
  certificaciones: [] as string[],
  capacidadPorTipo: [] as any[],
  manifiestos: { recibidos: 0, enTratamiento: 0, cerrados: 0, rechazados: 0 },
  ultimosManifiestos: [] as any[],
  tratamientos: [] as any[],
  metodosMasUsados: [] as any[],
};

const estadoConfig: Record<string, { label: string; color: string }> = {
  ACTIVO: { label: 'En línea', color: 'success' },
  MANTENIMIENTO: { label: 'Mantenimiento', color: 'warning' },
  INACTIVO: { label: 'Fuera de servicio', color: 'error' },
};

const estadoManifiestoColor: Record<string, string> = {
  EN_TRATAMIENTO: 'warning',
  TRATADO: 'primary',
  RECHAZADO: 'error',
  RECIBIDO: 'info',
};

const getCapacidadColor = (usada: number, total: number) => {
  const pct = total > 0 ? (usada / total) * 100 : 0;
  if (pct > 90) return 'text-error-600';
  if (pct > 70) return 'text-warning-600';
  return 'text-success-600';
};

const getCapacidadBg = (usada: number, total: number) => {
  const pct = total > 0 ? (usada / total) * 100 : 0;
  if (pct > 90) return 'bg-error-500';
  if (pct > 70) return 'bg-warning-500';
  return 'bg-success-500';
};

const OperadorDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  const { data: apiOperador, isLoading, isError } = useOperador(id || '');

  // Build operador from API data with safe defaults
  const operador = apiOperador ? {
    ...apiOperador,
    nombre: (apiOperador as any).razonSocial || '-',
    direccion: (apiOperador as any).domicilio || '-',
    estado: (apiOperador as any).activo !== false ? 'ACTIVO' : 'INACTIVO',
    habilitacion: (apiOperador as any).numeroHabilitacion || '-',
    vencimientoHab: (apiOperador as any).vencimientoHab || '-',
    metodosAutorizados: (apiOperador as any).metodosAutorizados || EMPTY_DEFAULTS.metodosAutorizados,
    residuosAceptados: (apiOperador as any).residuosAceptados || EMPTY_DEFAULTS.residuosAceptados,
    certificaciones: (apiOperador as any).certificaciones || EMPTY_DEFAULTS.certificaciones,
    capacidadPorTipo: (apiOperador as any).capacidadPorTipo || EMPTY_DEFAULTS.capacidadPorTipo,
    manifiestos: (apiOperador as any).manifiestos || EMPTY_DEFAULTS.manifiestos,
    ultimosManifiestos: (apiOperador as any).ultimosManifiestos || EMPTY_DEFAULTS.ultimosManifiestos,
    tratamientos: (apiOperador as any).tratamientos || EMPTY_DEFAULTS.tratamientos,
    metodosMasUsados: (apiOperador as any).metodosMasUsados || EMPTY_DEFAULTS.metodosMasUsados,
    capacidadTotal: (apiOperador as any).capacidadTotal || 1,
    capacidadUsada: (apiOperador as any).capacidadUsada || 0,
    procesadoMes: (apiOperador as any).procesadoMes || 0,
    ultimaAuditoria: (apiOperador as any).ultimaAuditoria || '-',
    proximaAuditoria: (apiOperador as any).proximaAuditoria || '-',
  } : null;

  const backPath = isMobile ? '/mobile/actores/operadores' : '/actores/operadores';

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>Volver</Button>
        </div>
        <Card className="py-12">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
            <p className="text-neutral-500">Cargando operador...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!operador) return null;

  const capacidadPct = (operador.capacidadUsada / operador.capacidadTotal) * 100;
  const est = estadoConfig[operador.estado] || estadoConfig.ACTIVO;

  return (
    <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>
            Volver
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center">
              <Building2 size={28} className="text-primary-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-neutral-900">{operador.nombre}</h2>
                <Badge variant="soft" color={est.color as any}>
                  {operador.estado === 'ACTIVO' ? <CheckCircle2 size={12} className="mr-1" /> : <AlertCircle size={12} className="mr-1" />}
                  {est.label}
                </Badge>
              </div>
              <p className="text-neutral-600 mt-1 text-sm">{operador.razonSocial}</p>
              <p className="text-neutral-500 font-mono text-sm">CUIT: {operador.cuit}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Cambiar Estado</Button>
          <Button leftIcon={<Edit size={16} />}>Editar</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Recibidos</p>
          <p className="text-3xl font-bold text-neutral-900">{operador.manifiestos.recibidos}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-warning-600">En tratamiento</p>
          <p className="text-3xl font-bold text-warning-700">{operador.manifiestos.enTratamiento}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-primary-600">Cerrados</p>
          <p className="text-3xl font-bold text-primary-700">{operador.manifiestos.cerrados}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Procesado (mes)</p>
          <p className="text-3xl font-bold text-neutral-900">{operador.procesadoMes.toLocaleString()} Tn</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultTab="info" variant="default">
        <TabList>
          <Tab id="info" icon={<Building2 size={16} />}>Información General</Tab>
          <Tab id="capacidad" icon={<Gauge size={16} />}>Capacidad</Tab>
          <Tab id="manifiestos" icon={<FileText size={16} />}>Manifiestos</Tab>
          <Tab id="tratamientos" icon={<Beaker size={16} />}>Tratamientos</Tab>
        </TabList>

        {/* Tab: Info General */}
        <TabPanel id="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Datos de la Planta" icon={<Building2 size={20} />} />
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Dirección</p>
                      <p className="font-medium text-neutral-900">{operador.direccion}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Teléfono</p>
                      <p className="font-medium text-neutral-900">{operador.telefono}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Email</p>
                      <p className="font-medium text-neutral-900">{operador.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Shield size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">N° Habilitación</p>
                      <p className="font-medium text-neutral-900">{operador.habilitacion}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Vencimiento habilitación</p>
                      <p className="font-medium text-neutral-900">{operador.vencimientoHab}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Métodos y Residuos" icon={<Beaker size={20} />} />
              <CardContent>
                <div className="mb-6">
                  <p className="text-sm font-medium text-neutral-700 mb-3">Métodos de tratamiento autorizados</p>
                  <div className="space-y-2">
                    {operador.metodosAutorizados.map((m: string) => (
                      <div key={m} className="flex items-center gap-2 text-sm">
                        <Leaf size={14} className="text-success-500" />
                        <span className="text-neutral-700">{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mb-6">
                  <p className="text-sm font-medium text-neutral-700 mb-3">Tipos de residuos aceptados</p>
                  <div className="flex flex-wrap gap-2">
                    {operador.residuosAceptados.map((r: string) => (
                      <Badge key={r} variant="outline" color="neutral">{r}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-700 mb-3">Certificaciones</p>
                  <div className="flex flex-wrap gap-2">
                    {operador.certificaciones.map((cert: string) => (
                      <Badge key={cert} variant="soft" color="success">
                        <CheckCircle2 size={12} className="mr-1" />
                        {cert}
                      </Badge>
                    ))}
                    {operador.certificaciones.length === 0 && (
                      <span className="text-sm text-neutral-400">Sin certificaciones</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* Tab: Capacidad */}
        <TabPanel id="capacidad">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Capacidad General" icon={<Gauge size={20} />} />
              <CardContent>
                <div className="text-center mb-6">
                  <p className={`text-5xl font-bold ${getCapacidadColor(operador.capacidadUsada, operador.capacidadTotal)}`}>
                    {capacidadPct.toFixed(0)}%
                  </p>
                  <p className="text-neutral-500 mt-1">
                    {operador.capacidadUsada.toLocaleString()} / {operador.capacidadTotal.toLocaleString()} Tn
                  </p>
                </div>
                <div className="h-4 bg-neutral-100 rounded-full overflow-hidden mb-6">
                  <div
                    className={`h-full rounded-full transition-all ${getCapacidadBg(operador.capacidadUsada, operador.capacidadTotal)}`}
                    style={{ width: `${capacidadPct}%` }}
                  />
                </div>

                <div className="space-y-4">
                  {operador.capacidadPorTipo.map((ct: any) => {
                    const pct = ct.capacidad > 0 ? (ct.usado / ct.capacidad) * 100 : 0;
                    return (
                      <div key={ct.tipo}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-neutral-700">{ct.tipo}</span>
                          <span className={`font-medium ${getCapacidadColor(ct.usado, ct.capacidad)}`}>
                            {pct.toFixed(0)}% — {ct.usado.toLocaleString()}/{ct.capacidad.toLocaleString()} Tn
                          </span>
                        </div>
                        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getCapacidadBg(ct.usado, ct.capacidad)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Auditorías y Compliance" icon={<ClipboardCheck size={20} />} />
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-neutral-50 rounded-xl">
                    <p className="text-sm text-neutral-500">Última auditoría</p>
                    <p className="text-lg font-semibold text-neutral-900">{operador.ultimaAuditoria}</p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-xl">
                    <p className="text-sm text-neutral-500">Próxima auditoría programada</p>
                    <p className="text-lg font-semibold text-neutral-900">{operador.proximaAuditoria}</p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-xl">
                    <p className="text-sm text-neutral-500">Procesado este mes</p>
                    <p className="text-lg font-semibold text-neutral-900">{operador.procesadoMes.toLocaleString()} Tn</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* Tab: Manifiestos */}
        <TabPanel id="manifiestos">
          <Card padding="none">
              <table className="w-full table-fixed">
                <thead className="bg-[#F5F5F3] border-b border-neutral-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider" style={{ width: '20%' }}>Manifiesto</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider" style={{ width: '18%' }}>Fecha</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider" style={{ width: '20%' }}>Estado</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden md:table-cell" style={{ width: '18%' }}>Peso</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider truncate hidden md:table-cell" style={{ width: '24%' }}>Generador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {(operador.ultimosManifiestos || []).map((m: any) => (
                    <tr
                      key={m.id}
                      className="hover:bg-neutral-50 transition-colors cursor-pointer group"
                      onClick={() => navigate(isMobile ? `/mobile/manifiestos/${m.id}` : `/manifiestos/${m.id}`)}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600">
                            <FileText size={16} />
                          </div>
                          <span className="font-mono font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                            {m.id}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-neutral-600">{m.fecha || '-'}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="soft" color={estadoManifiestoColor[m.estado] || 'neutral'}>
                          {String(m.estado || '').replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-neutral-700 hidden md:table-cell">{(m.peso ?? 0).toLocaleString('es-AR')} kg</td>
                      <td className="px-3 py-2.5 text-neutral-600 truncate hidden md:table-cell">{m.generador || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </Card>
        </TabPanel>

        {/* Tab: Tratamientos */}
        <TabPanel id="tratamientos">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Métodos más Usados" icon={<BarChart3 size={20} />} />
              <CardContent>
                <div className="space-y-4">
                  {operador.metodosMasUsados.map((m: any) => (
                    <div key={m.metodo}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-neutral-700">{m.metodo}</span>
                        <span className="font-medium text-neutral-900">{m.porcentaje}%</span>
                      </div>
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-400 rounded-full"
                          style={{ width: `${m.porcentaje}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Historial de Tratamientos" icon={<Beaker size={20} />} />
              <CardContent>
                  <table className="w-full table-fixed">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '10%' }}>ID</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '15%' }}>Fecha</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '18%' }}>Manifiesto</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '22%' }}>Método</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '15%' }}>Peso</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '20%' }}>Certificado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {(operador.tratamientos || []).map((t: any) => (
                        <tr key={t.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-3 py-2.5 font-mono text-sm text-neutral-900 hidden md:table-cell">{t.id}</td>
                          <td className="px-3 py-2.5 text-neutral-600">{t.fecha || '-'}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className="font-mono text-primary-600 cursor-pointer hover:underline"
                              onClick={() => navigate(isMobile ? `/mobile/manifiestos/${t.manifiesto}` : `/manifiestos/${t.manifiesto}`)}
                            >
                              {t.manifiesto}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-neutral-700 truncate">{t.metodo}</td>
                          <td className="px-3 py-2.5 font-medium text-neutral-700">{(t.peso ?? 0).toLocaleString('es-AR')} kg</td>
                          <td className="px-3 py-2.5 hidden md:table-cell">
                            <Badge variant="soft" color="success">{t.certificado || '-'}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </CardContent>
            </Card>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default OperadorDetallePage;

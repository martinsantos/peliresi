/**
 * SITREP v6 - Generador Detail Page
 * ==================================
 * Vista detalle de un generador con tabs
 */

import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Factory,
  FileText,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Download,
  CheckCircle,
  AlertTriangle,
  Biohazard,
  TrendingUp,
  BarChart3,
  Truck,
  FlaskConical,
  User,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { useGenerador } from '../../hooks/useActores';
import { downloadCsv } from '../../utils/exportCsv';
import { GENERADORES_DATA } from '../../data/generadores-enrichment';
import { CORRIENTES_Y } from '../../data/corrientes-y';

const EMPTY_DEFAULTS = {
  responsableAmbiental: { nombre: '-', matricula: '-', telefono: '-' },
  manifiestos: { total: 0, activos: 0, completados: 0, rechazados: 0 },
  residuosMensuales: [] as any[],
  tiposResiduos: [] as any[],
  transportistas: [] as string[],
  operadores: [] as string[],
  ultimosManifiestos: [] as any[],
};

const estadoManifiestoColor: Record<string, string> = {
  EN_TRANSITO: 'info',
  APROBADO: 'success',
  TRATADO: 'primary',
  RECHAZADO: 'error',
  BORRADOR: 'neutral',
};

const GeneradorDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  const { data: apiGenerador, isLoading, isError } = useGenerador(id || '');

  // Build generador from API data with safe defaults
  const generador = apiGenerador ? {
    ...apiGenerador,
    estado: (apiGenerador as any).activo !== false ? 'activo' : 'inactivo',
    inscripcionDGFA: (apiGenerador as any).numeroInscripcion || '-',
    fechaAlta: (apiGenerador as any).createdAt ? new Date((apiGenerador as any).createdAt).toISOString().split('T')[0] : '-',
    responsableAmbiental: (apiGenerador as any).responsableAmbiental || EMPTY_DEFAULTS.responsableAmbiental,
    manifiestos: (apiGenerador as any).manifiestos || EMPTY_DEFAULTS.manifiestos,
    residuosMensuales: (apiGenerador as any).residuosMensuales || EMPTY_DEFAULTS.residuosMensuales,
    tiposResiduos: (apiGenerador as any).tiposResiduos || EMPTY_DEFAULTS.tiposResiduos,
    transportistas: (apiGenerador as any).transportistas || EMPTY_DEFAULTS.transportistas,
    operadores: (apiGenerador as any).operadores || EMPTY_DEFAULTS.operadores,
    ultimosManifiestos: (apiGenerador as any).ultimosManifiestos || EMPTY_DEFAULTS.ultimosManifiestos,
  } : null;

  const backPath = isMobile ? '/mobile/admin/actores/generadores' : '/admin/actores/generadores';

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>Volver</Button>
        </div>
        <Card className="py-12">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
            <p className="text-neutral-500">Cargando generador...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!generador) return null;

  return (
    <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>
            Volver
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
              <Factory size={28} className="text-purple-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-neutral-900">{generador.razonSocial}</h2>
                <Badge variant="soft" color={generador.estado === 'activo' ? 'success' : 'warning'}>
                  {generador.estado === 'activo' ? <CheckCircle size={12} className="mr-1" /> : <AlertTriangle size={12} className="mr-1" />}
                  {generador.estado === 'activo' ? 'Activo' : 'Alerta'}
                </Badge>
                <Badge variant="outline" color="neutral">{generador.categoria}</Badge>
              </div>
              <p className="text-neutral-600 mt-1 font-mono text-sm">CUIT: {generador.cuit}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={16} />} onClick={() => { if (generador) downloadCsv([{ RazónSocial: generador.razonSocial, CUIT: generador.cuit, Domicilio: generador.domicilio, Teléfono: generador.telefono, Email: generador.email, Inscripción: generador.inscripcionDGFA, Estado: generador.estado }], 'generador-' + (generador.cuit || id)); }}>Exportar</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Manifiestos totales</p>
          <p className="text-3xl font-bold text-neutral-900">{generador.manifiestos.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-success-600">Activos</p>
          <p className="text-3xl font-bold text-success-700">{generador.manifiestos.activos}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-primary-600">Completados</p>
          <p className="text-3xl font-bold text-primary-700">{generador.manifiestos.completados}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-error-600">Rechazados</p>
          <p className="text-3xl font-bold text-error-700">{generador.manifiestos.rechazados}</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultTab="info" variant="default">
        <TabList>
          <Tab id="info" icon={<Factory size={16} />}>Información General</Tab>
          <Tab id="manifiestos" icon={<FileText size={16} />}>Manifiestos</Tab>
          <Tab id="estadisticas" icon={<BarChart3 size={16} />}>Estadísticas</Tab>
          <Tab id="residuos" icon={<Biohazard size={16} />}>Residuos Inscriptos</Tab>
        </TabList>

        {/* Tab: Info General */}
        <TabPanel id="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Datos de la Empresa" icon={<Factory size={20} />} />
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Domicilio</p>
                      <p className="font-medium text-neutral-900">{generador.domicilio}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Teléfono</p>
                      <p className="font-medium text-neutral-900">{generador.telefono}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Email</p>
                      <p className="font-medium text-neutral-900">{generador.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Shield size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Inscripción DGFA</p>
                      <p className="font-medium text-neutral-900">{generador.inscripcionDGFA}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Fecha de alta</p>
                      <p className="font-medium text-neutral-900">{generador.fechaAlta}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Responsable Ambiental" icon={<User size={20} />} />
              <CardContent>
                <div className="p-4 bg-neutral-50 rounded-xl space-y-3">
                  <div>
                    <p className="text-sm text-neutral-500">Nombre</p>
                    <p className="font-semibold text-neutral-900">{generador.responsableAmbiental.nombre}</p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Matrícula</p>
                    <p className="font-medium text-neutral-900">{generador.responsableAmbiental.matricula}</p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Teléfono</p>
                    <p className="font-medium text-neutral-900">{generador.responsableAmbiental.telefono}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-medium text-neutral-700 mb-3">Transportistas habituales</p>
                  <div className="space-y-2">
                    {generador.transportistas.map((t: string) => (
                      <div
                        key={t}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary-600 group"
                        onClick={() => navigate(`${isMobile ? '/mobile' : ''}/admin/actores/transportistas?q=${encodeURIComponent(t)}`)}
                      >
                        <Truck size={14} className="text-neutral-400 group-hover:text-primary-500" />
                        <span className="text-neutral-700 group-hover:text-primary-600">{t}</span>
                        <ExternalLink size={10} className="text-neutral-300 group-hover:text-primary-400" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-medium text-neutral-700 mb-3">Operadores destino</p>
                  <div className="space-y-2">
                    {generador.operadores.map((o: string) => (
                      <div
                        key={o}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary-600 group"
                        onClick={() => navigate(`${isMobile ? '/mobile' : ''}/admin/actores/operadores?q=${encodeURIComponent(o)}`)}
                      >
                        <FlaskConical size={14} className="text-neutral-400 group-hover:text-primary-500" />
                        <span className="text-neutral-700 group-hover:text-primary-600">{o}</span>
                        <ExternalLink size={10} className="text-neutral-300 group-hover:text-primary-400" />
                      </div>
                    ))}
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
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider truncate hidden md:table-cell" style={{ width: '24%' }}>Transportista</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {(generador.ultimosManifiestos || []).map((m: any) => (
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
                      <td className="px-3 py-2.5 text-neutral-600 truncate hidden md:table-cell">{m.transportista || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </Card>
        </TabPanel>

        {/* Tab: Estadísticas */}
        <TabPanel id="estadisticas">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Volumen Generado por Mes (Tn)" icon={<TrendingUp size={20} />} />
              <CardContent>
                <div className="h-48 flex items-end gap-3">
                  {(generador.residuosMensuales || []).map((item: any) => {
                    const vals = (generador.residuosMensuales || []).map((r: any) => r.valor || 0);
                    const maxVal = vals.length > 0 ? Math.max(...vals) : 1;
                    const heightPct = maxVal > 0 ? (item.valor / maxVal) * 100 : 0;
                    return (
                      <div key={item.mes} className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-xs font-medium text-neutral-700">{item.valor}</span>
                        <div
                          className="w-full bg-purple-300 rounded-t-md hover:bg-purple-400 transition-colors"
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-xs text-neutral-500">{item.mes}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Tipos de Residuos" icon={<BarChart3 size={20} />} />
              <CardContent>
                <div className="space-y-4">
                  {generador.tiposResiduos.map((r: any) => (
                    <div key={r.tipo}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-neutral-700">{r.tipo}</span>
                        <span className="font-medium text-neutral-900">{r.porcentaje}%</span>
                      </div>
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-400 rounded-full"
                          style={{ width: `${r.porcentaje}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* Tab: Residuos Inscriptos */}
        <TabPanel id="residuos">
          {(() => {
            const enriched = generador.cuit ? GENERADORES_DATA[generador.cuit] : null;
            const categorias = enriched?.categoriasControl || [];
            return categorias.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-500">
                    {categorias.length} corriente{categorias.length !== 1 ? 's' : ''} de residuos peligrosos inscripta{categorias.length !== 1 ? 's' : ''} (Convenio de Basilea)
                  </p>
                  <Badge variant="soft" color="warning">{categorias.length} categorías</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {categorias.map((code: string) => (
                    <div key={code} className="flex items-start gap-3 p-4 bg-white border border-neutral-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-colors">
                      <div className="shrink-0 w-14 h-8 bg-amber-100 border border-amber-300 rounded-md flex items-center justify-center">
                        <span className="text-xs font-bold text-amber-800">{code}</span>
                      </div>
                      <p className="text-sm text-neutral-700 leading-relaxed">
                        {CORRIENTES_Y[code] || 'Descripción no disponible'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Card className="py-12">
                <div className="text-center">
                  <Biohazard size={32} className="text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-500">No se encontraron categorías de residuos inscriptas para este generador</p>
                  <p className="text-xs text-neutral-400 mt-1">CUIT: {generador.cuit}</p>
                </div>
              </Card>
            );
          })()}
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default GeneradorDetallePage;

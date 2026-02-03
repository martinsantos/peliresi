/**
 * SITREP v6 - Transportista Detail Page
 * ======================================
 * Vista detalle de un transportista con tabs
 */

import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  FileText,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Edit,
  Star,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Users,
  Shield,
  Clock,
  TrendingUp,
  BarChart3,
  Award,
  Ban,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { useTransportista } from '../../hooks/useActores';

const EMPTY_DEFAULTS = {
  areasCobertura: [] as string[],
  certificaciones: [] as string[],
  flota: [] as any[],
  conductores: [] as any[],
  manifiestos: { completados: 0, enTransito: 0, incidencias: 0 },
  ultimosManifiestos: [] as any[],
  rendimiento: {
    viajesMes: 0, viajesTotal: 0, incidenciasMes: 0, incidenciasTotal: 0,
    tiempoPromedioEntrega: '-', satisfaccion: 0,
  },
};

const estadoManifiestoColor: Record<string, string> = {
  EN_TRANSITO: 'info',
  ENTREGADO: 'success',
  TRATADO: 'primary',
  RECHAZADO: 'error',
};

const getRatingColor = (rating: number) => {
  if (rating >= 4.5) return 'text-success-600';
  if (rating >= 3.5) return 'text-warning-600';
  return 'text-error-600';
};

const TransportistaDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  const { data: apiTransportista, isLoading, isError } = useTransportista(id || '');

  // Build transportista from API data with safe defaults
  const transportista = apiTransportista ? {
    ...apiTransportista,
    nombre: (apiTransportista as any).razonSocial || '-',
    direccion: (apiTransportista as any).domicilio || '-',
    estado: (apiTransportista as any).activo !== false ? 'ACTIVO' : 'SUSPENDIDO',
    habilitacion: (apiTransportista as any).numeroHabilitacion || '-',
    vencimientoHab: (apiTransportista as any).vencimientoHab || '2099-12-31',
    areasCobertura: (apiTransportista as any).areasCobertura || EMPTY_DEFAULTS.areasCobertura,
    certificaciones: (apiTransportista as any).certificaciones || EMPTY_DEFAULTS.certificaciones,
    rating: (apiTransportista as any).rating || 0,
    flota: (apiTransportista as any).vehiculos || (apiTransportista as any).flota || EMPTY_DEFAULTS.flota,
    conductores: (apiTransportista as any).choferes || (apiTransportista as any).conductores || EMPTY_DEFAULTS.conductores,
    manifiestos: (apiTransportista as any).manifiestos || EMPTY_DEFAULTS.manifiestos,
    ultimosManifiestos: (apiTransportista as any).ultimosManifiestos || EMPTY_DEFAULTS.ultimosManifiestos,
    rendimiento: (apiTransportista as any).rendimiento || EMPTY_DEFAULTS.rendimiento,
  } : null;

  const backPath = isMobile ? '/mobile/actores/transportistas' : '/actores/transportistas';

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>Volver</Button>
        </div>
        <Card className="py-12">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
            <p className="text-neutral-500">Cargando transportista...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!transportista) return null;

  const habVencimiento = new Date(transportista.vencimientoHab);
  const ahora = new Date();
  const diasHastaVencimiento = Math.ceil((habVencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
  const habProximaVencer = diasHastaVencimiento <= 90 && diasHastaVencimiento > 0;

  return (
    <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>
            Volver
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-secondary-100 rounded-xl flex items-center justify-center">
              <Truck size={28} className="text-secondary-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-neutral-900">{transportista.nombre}</h2>
                <Badge variant="soft" color={transportista.estado === 'ACTIVO' ? 'success' : 'error'}>
                  {transportista.estado === 'ACTIVO' ? <CheckCircle2 size={12} className="mr-1" /> : <AlertCircle size={12} className="mr-1" />}
                  {transportista.estado === 'ACTIVO' ? 'Activo' : 'Suspendido'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-neutral-600 font-mono text-sm">CUIT: {transportista.cuit}</span>
                <div className="flex items-center gap-1">
                  <Star className={`fill-current ${getRatingColor(transportista.rating)}`} size={16} />
                  <span className={`font-semibold ${getRatingColor(transportista.rating)}`}>{transportista.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" color="error" leftIcon={<Ban size={16} />}>Suspender</Button>
          <Button leftIcon={<Edit size={16} />}>Editar</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Viajes completados</p>
          <p className="text-3xl font-bold text-neutral-900">{transportista.manifiestos.completados}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-info-600">En tránsito</p>
          <p className="text-3xl font-bold text-info-700">{transportista.manifiestos.enTransito}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Vehículos</p>
          <p className="text-3xl font-bold text-neutral-900">{transportista.flota.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Conductores</p>
          <p className="text-3xl font-bold text-neutral-900">{transportista.conductores.length}</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultTab="info" variant="default">
        <TabList>
          <Tab id="info" icon={<Truck size={16} />}>Información General</Tab>
          <Tab id="flota" icon={<Users size={16} />}>Flota y Conductores</Tab>
          <Tab id="manifiestos" icon={<FileText size={16} />}>Manifiestos</Tab>
          <Tab id="rendimiento" icon={<TrendingUp size={16} />}>Rendimiento</Tab>
        </TabList>

        {/* Tab: Info General */}
        <TabPanel id="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Datos de la Empresa" icon={<Truck size={20} />} />
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Dirección</p>
                      <p className="font-medium text-neutral-900">{transportista.direccion}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Teléfono</p>
                      <p className="font-medium text-neutral-900">{transportista.telefono}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Email</p>
                      <p className="font-medium text-neutral-900">{transportista.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Shield size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">N° Habilitación</p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-neutral-900">{transportista.habilitacion}</p>
                        {habProximaVencer && (
                          <Badge variant="soft" color="warning">
                            <AlertTriangle size={12} className="mr-1" />
                            Vence en {diasHastaVencimiento} días
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Vencimiento habilitación</p>
                      <p className="font-medium text-neutral-900">{transportista.vencimientoHab}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Cobertura y Certificaciones" icon={<Award size={20} />} />
              <CardContent>
                <div className="mb-6">
                  <p className="text-sm font-medium text-neutral-700 mb-3">Áreas de cobertura</p>
                  <div className="flex flex-wrap gap-2">
                    {transportista.areasCobertura.map((area: string) => (
                      <Badge key={area} variant="outline" color="neutral">{area}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-700 mb-3">Certificaciones</p>
                  <div className="flex flex-wrap gap-2">
                    {transportista.certificaciones.map((cert: string) => (
                      <Badge key={cert} variant="soft" color="success">
                        <CheckCircle2 size={12} className="mr-1" />
                        {cert}
                      </Badge>
                    ))}
                    {transportista.certificaciones.length === 0 && (
                      <span className="text-sm text-neutral-400">Sin certificaciones registradas</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* Tab: Flota y Conductores */}
        <TabPanel id="flota">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Vehículos" icon={<Truck size={20} />} />
              <CardContent>
                  <table className="w-full table-fixed">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Patente</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Tipo</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Capacidad</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Estado</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '20%' }}>Vto. VTV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {(transportista.flota || []).map((v: any) => (
                        <tr key={v.patente} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-3 py-2.5 font-mono font-semibold text-neutral-900">{v.patente}</td>
                          <td className="px-3 py-2.5 text-neutral-700">{v.tipo}</td>
                          <td className="px-3 py-2.5 text-neutral-700">{v.capacidad}</td>
                          <td className="px-3 py-2.5">
                            <Badge variant="soft" color={v.estado === 'Activo' ? 'success' : 'warning'}>
                              {v.estado}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-neutral-600 hidden md:table-cell">{v.vencimientoVTV}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Conductores" icon={<Users size={20} />} />
              <CardContent>
                  <table className="w-full table-fixed">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '25%' }}>Nombre</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '18%' }}>DNI</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '18%' }}>Licencia</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '17%' }}>Categoría</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '22%' }}>Vto. Licencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {(transportista.conductores || []).map((c: any) => (
                        <tr key={c.dni} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-neutral-900">{c.nombre}</td>
                          <td className="px-3 py-2.5 font-mono text-neutral-700">{c.dni}</td>
                          <td className="px-3 py-2.5 text-neutral-700">{c.licencia}</td>
                          <td className="px-3 py-2.5 text-neutral-700 hidden md:table-cell">{c.categoria}</td>
                          <td className="px-3 py-2.5 text-neutral-600 hidden md:table-cell">{c.vencimiento}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                  {(transportista.ultimosManifiestos || []).map((m: any) => (
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

        {/* Tab: Rendimiento */}
        <TabPanel id="rendimiento">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Métricas de Rendimiento" icon={<TrendingUp size={20} />} />
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-50 rounded-xl text-center">
                    <p className="text-3xl font-bold text-neutral-900">{transportista.rendimiento.viajesMes}</p>
                    <p className="text-sm text-neutral-500">Viajes este mes</p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-xl text-center">
                    <p className="text-3xl font-bold text-neutral-900">{transportista.rendimiento.viajesTotal}</p>
                    <p className="text-sm text-neutral-500">Viajes totales</p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock size={18} className="text-primary-600" />
                      <p className="text-2xl font-bold text-neutral-900">{transportista.rendimiento.tiempoPromedioEntrega}</p>
                    </div>
                    <p className="text-sm text-neutral-500">Tiempo promedio</p>
                  </div>
                  <div className="p-4 bg-neutral-50 rounded-xl text-center">
                    <p className="text-3xl font-bold text-success-600">{transportista.rendimiento.satisfaccion}%</p>
                    <p className="text-sm text-neutral-500">Satisfacción</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Incidencias" icon={<AlertTriangle size={20} />} />
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
                    <div>
                      <p className="font-medium text-neutral-900">Este mes</p>
                      <p className="text-sm text-neutral-500">Incidencias reportadas</p>
                    </div>
                    <Badge variant="soft" color={transportista.rendimiento.incidenciasMes > 3 ? 'error' : 'warning'}>
                      {transportista.rendimiento.incidenciasMes}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
                    <div>
                      <p className="font-medium text-neutral-900">Total histórico</p>
                      <p className="text-sm text-neutral-500">Desde el registro</p>
                    </div>
                    <Badge variant="soft" color="neutral">
                      {transportista.rendimiento.incidenciasTotal}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
                    <div>
                      <p className="font-medium text-neutral-900">Rating global</p>
                      <p className="text-sm text-neutral-500">Promedio ponderado</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className={`fill-current ${getRatingColor(transportista.rating)}`} size={18} />
                      <span className={`text-lg font-bold ${getRatingColor(transportista.rating)}`}>
                        {transportista.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default TransportistaDetallePage;

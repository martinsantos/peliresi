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

// Mock data
const transportistasData: Record<string, any> = {
  '1': {
    id: 1,
    nombre: 'Transportes Rápidos S.A.',
    cuit: '30-12345678-9',
    direccion: 'Av. Libertador 1234, Mendoza',
    telefono: '+54 261 456-7890',
    email: 'contacto@transportesrapidos.com',
    estado: 'ACTIVO',
    habilitacion: 'HAB-TR-2023-0456',
    vencimientoHab: '2025-12-31',
    areasCobertura: ['Mendoza Capital', 'Godoy Cruz', 'Maipú', 'Guaymallén', 'Las Heras'],
    certificaciones: ['SENASA', 'CNRT'],
    rating: 4.8,
    flota: [
      { patente: 'AB 123 CD', tipo: 'Camión cisterna', capacidad: '15,000 lt', estado: 'Activo', vencimientoVTV: '2025-06-15' },
      { patente: 'EF 456 GH', tipo: 'Camión volteo', capacidad: '12 tn', estado: 'Activo', vencimientoVTV: '2025-08-20' },
      { patente: 'IJ 789 KL', tipo: 'Camión cerrado', capacidad: '8 tn', estado: 'En taller', vencimientoVTV: '2025-04-10' },
      { patente: 'MN 012 OP', tipo: 'Camión cisterna', capacidad: '20,000 lt', estado: 'Activo', vencimientoVTV: '2025-11-30' },
    ],
    conductores: [
      { nombre: 'Juan Pérez', dni: '28.456.789', licencia: 'A5', categoria: 'Profesional', vencimiento: '2026-03-15' },
      { nombre: 'Carlos Gómez', dni: '31.234.567', licencia: 'A5', categoria: 'Profesional', vencimiento: '2025-09-20' },
      { nombre: 'Roberto Sánchez', dni: '35.678.901', licencia: 'A4', categoria: 'Profesional', vencimiento: '2025-12-01' },
    ],
    manifiestos: {
      completados: 132,
      enTransito: 8,
      incidencias: 2,
    },
    ultimosManifiestos: [
      { id: 'M-2025-089', fecha: '2025-01-31', estado: 'EN_TRANSITO', peso: 2450, generador: 'Química Mendoza S.A.' },
      { id: 'M-2025-086', fecha: '2025-01-30', estado: 'TRATADO', peso: 950, generador: 'Plásticos Argentinos' },
      { id: 'M-2025-082', fecha: '2025-01-28', estado: 'TRATADO', peso: 3200, generador: 'Metalúrgica Argentina' },
      { id: 'M-2025-075', fecha: '2025-01-24', estado: 'TRATADO', peso: 1800, generador: 'Industrias del Sur' },
    ],
    rendimiento: {
      viajesMes: 45,
      viajesTotal: 520,
      incidenciasMes: 1,
      incidenciasTotal: 12,
      tiempoPromedioEntrega: '4.2 hrs',
      satisfaccion: 96,
    },
  },
  '2': {
    id: 2,
    nombre: 'Logística EcoTrans',
    cuit: '30-87654321-0',
    direccion: 'Ruta 40 Km 500, Luján de Cuyo',
    telefono: '+54 261 234-5678',
    email: 'info@ecotrans.com',
    estado: 'ACTIVO',
    habilitacion: 'HAB-TR-2022-0321',
    vencimientoHab: '2025-06-30',
    areasCobertura: ['Luján de Cuyo', 'Chacras de Coria'],
    certificaciones: ['SENASA'],
    rating: 4.5,
    flota: [
      { patente: 'QR 345 ST', tipo: 'Camión cisterna', capacidad: '10,000 lt', estado: 'Activo', vencimientoVTV: '2025-07-10' },
      { patente: 'UV 678 WX', tipo: 'Camión cerrado', capacidad: '6 tn', estado: 'Activo', vencimientoVTV: '2025-09-05' },
    ],
    conductores: [
      { nombre: 'Luis Martínez', dni: '29.123.456', licencia: 'A5', categoria: 'Profesional', vencimiento: '2026-01-10' },
      { nombre: 'Diego Torres', dni: '33.789.012', licencia: 'A4', categoria: 'Profesional', vencimiento: '2025-07-15' },
    ],
    manifiestos: { completados: 88, enTransito: 5, incidencias: 5 },
    ultimosManifiestos: [
      { id: 'M-2025-085', fecha: '2025-01-29', estado: 'ENTREGADO', peso: 1500, generador: 'Textil Cuyo' },
      { id: 'M-2025-079', fecha: '2025-01-26', estado: 'TRATADO', peso: 2100, generador: 'Industrias del Sur' },
    ],
    rendimiento: {
      viajesMes: 28,
      viajesTotal: 310,
      incidenciasMes: 2,
      incidenciasTotal: 18,
      tiempoPromedioEntrega: '5.1 hrs',
      satisfaccion: 89,
    },
  },
};

const defaultTransportista = transportistasData['1'];

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

  const transportista = transportistasData[id || ''] || defaultTransportista;
  const backPath = isMobile ? '/mobile/actores/transportistas' : '/actores/transportistas';

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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Patente</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Capacidad</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Vto. VTV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {transportista.flota.map((v: any) => (
                        <tr key={v.patente} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 font-mono font-semibold text-neutral-900">{v.patente}</td>
                          <td className="px-4 py-3 text-neutral-700">{v.tipo}</td>
                          <td className="px-4 py-3 text-neutral-700">{v.capacidad}</td>
                          <td className="px-4 py-3">
                            <Badge variant="soft" color={v.estado === 'Activo' ? 'success' : 'warning'}>
                              {v.estado}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-neutral-600">{v.vencimientoVTV}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Conductores" icon={<Users size={20} />} />
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Nombre</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">DNI</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Licencia</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Categoría</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Vto. Licencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {transportista.conductores.map((c: any) => (
                        <tr key={c.dni} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 font-medium text-neutral-900">{c.nombre}</td>
                          <td className="px-4 py-3 font-mono text-neutral-700">{c.dni}</td>
                          <td className="px-4 py-3 text-neutral-700">{c.licencia}</td>
                          <td className="px-4 py-3 text-neutral-700">{c.categoria}</td>
                          <td className="px-4 py-3 text-neutral-600">{c.vencimiento}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* Tab: Manifiestos */}
        <TabPanel id="manifiestos">
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F5F5F3] border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Manifiesto</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Peso</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Generador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {transportista.ultimosManifiestos.map((m: any) => (
                    <tr
                      key={m.id}
                      className="hover:bg-neutral-50 transition-colors cursor-pointer group"
                      onClick={() => navigate(isMobile ? `/mobile/manifiestos/${m.id}` : `/manifiestos/${m.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600">
                            <FileText size={16} />
                          </div>
                          <span className="font-mono font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                            {m.id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-neutral-600">{m.fecha}</td>
                      <td className="px-6 py-4">
                        <Badge variant="soft" color={estadoManifiestoColor[m.estado] || 'neutral'}>
                          {m.estado.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-medium text-neutral-700">{m.peso.toLocaleString('es-AR')} kg</td>
                      <td className="px-6 py-4 text-neutral-600">{m.generador}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

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
  Edit,
  Download,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Truck,
  Building2,
  User,
  Shield,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';

// Mock data — se reemplazará por API real
const generadoresData: Record<string, any> = {
  '1': {
    id: 1,
    razonSocial: 'Química Mendoza S.A.',
    cuit: '30-12345678-9',
    domicilio: 'Av. San Martín 1234, Mendoza',
    telefono: '+54 261 412-3456',
    email: 'contacto@quimicamendoza.com',
    estado: 'activo',
    categoria: 'Grandes Generadores',
    inscripcionDGFA: 'DGFA-2019-00145',
    fechaAlta: '2019-03-15',
    responsableAmbiental: { nombre: 'Ing. Carlos López', matricula: 'MP-4521', telefono: '+54 261 555-1234' },
    manifiestos: { total: 145, activos: 8, completados: 132, rechazados: 5 },
    residuosMensuales: [
      { mes: 'Ago', valor: 180 }, { mes: 'Sep', valor: 210 }, { mes: 'Oct', valor: 195 },
      { mes: 'Nov', valor: 240 }, { mes: 'Dic', valor: 220 }, { mes: 'Ene', valor: 260 },
    ],
    tiposResiduos: [
      { tipo: 'Y02 - Aceites minerales', porcentaje: 35 },
      { tipo: 'Y12 - Solventes orgánicos', porcentaje: 25 },
      { tipo: 'Y45 - Empaques contaminados', porcentaje: 20 },
      { tipo: 'Y18 - Residuos de laboratorio', porcentaje: 20 },
    ],
    transportistas: ['Transportes Rápidos S.A.', 'Logística EcoTrans', 'Mendoza Cargo Express'],
    operadores: ['Planta Norte', 'Operador Sur'],
    ultimosManifiestos: [
      { id: 'M-2025-089', fecha: '2025-01-31', estado: 'EN_TRANSITO', peso: 2450, transportista: 'Transportes Rápidos S.A.' },
      { id: 'M-2025-085', fecha: '2025-01-29', estado: 'TRATADO', peso: 1500, transportista: 'Logística EcoTrans' },
      { id: 'M-2025-078', fecha: '2025-01-25', estado: 'TRATADO', peso: 3200, transportista: 'Mendoza Cargo Express' },
      { id: 'M-2025-071', fecha: '2025-01-22', estado: 'TRATADO', peso: 1800, transportista: 'Transportes Rápidos S.A.' },
      { id: 'M-2025-065', fecha: '2025-01-18', estado: 'RECHAZADO', peso: 950, transportista: 'Logística EcoTrans' },
    ],
  },
  '2': {
    id: 2,
    razonSocial: 'Industrias del Sur',
    cuit: '30-11111111-1',
    domicilio: 'Parque Industrial, Luján',
    telefono: '+54 261 234-5678',
    email: 'info@industriasdelsur.com',
    estado: 'activo',
    categoria: 'Medianos Generadores',
    inscripcionDGFA: 'DGFA-2020-00289',
    fechaAlta: '2020-06-10',
    responsableAmbiental: { nombre: 'Lic. María Fernández', matricula: 'MP-6732', telefono: '+54 261 555-5678' },
    manifiestos: { total: 89, activos: 3, completados: 82, rechazados: 4 },
    residuosMensuales: [
      { mes: 'Ago', valor: 120 }, { mes: 'Sep', valor: 140 }, { mes: 'Oct', valor: 110 },
      { mes: 'Nov', valor: 160 }, { mes: 'Dic', valor: 150 }, { mes: 'Ene', valor: 170 },
    ],
    tiposResiduos: [
      { tipo: 'Y12 - Solventes orgánicos', porcentaje: 40 },
      { tipo: 'Y45 - Empaques contaminados', porcentaje: 35 },
      { tipo: 'Y02 - Aceites minerales', porcentaje: 25 },
    ],
    transportistas: ['Transportes Rápidos S.A.', 'Mendoza Cargo Express'],
    operadores: ['Planta Norte'],
    ultimosManifiestos: [
      { id: 'M-2025-088', fecha: '2025-01-31', estado: 'APROBADO', peso: 1800, transportista: 'Transportes Rápidos S.A.' },
      { id: 'M-2025-080', fecha: '2025-01-27', estado: 'TRATADO', peso: 2100, transportista: 'Mendoza Cargo Express' },
    ],
  },
};

// Fallback for unknown IDs
const defaultGenerador = generadoresData['1'];

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

  const generador = generadoresData[id || ''] || defaultGenerador;

  const backPath = isMobile ? '/mobile/admin/generadores' : '/admin/generadores';

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
          <Button variant="outline" leftIcon={<Download size={16} />}>Exportar</Button>
          <Button leftIcon={<Edit size={16} />}>Editar</Button>
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
                      <div key={t} className="flex items-center gap-2 text-sm">
                        <Truck size={14} className="text-neutral-400" />
                        <span className="text-neutral-700">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-medium text-neutral-700 mb-3">Operadores destino</p>
                  <div className="space-y-2">
                    {generador.operadores.map((o: string) => (
                      <div key={o} className="flex items-center gap-2 text-sm">
                        <Building2 size={14} className="text-neutral-400" />
                        <span className="text-neutral-700">{o}</span>
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F5F5F3] border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Manifiesto</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Peso</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Transportista</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {generador.ultimosManifiestos.map((m: any) => (
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
                      <td className="px-6 py-4 text-neutral-600">{m.transportista}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabPanel>

        {/* Tab: Estadísticas */}
        <TabPanel id="estadisticas">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Volumen Generado por Mes (Tn)" icon={<TrendingUp size={20} />} />
              <CardContent>
                <div className="h-48 flex items-end gap-3">
                  {generador.residuosMensuales.map((item: any) => {
                    const maxVal = Math.max(...generador.residuosMensuales.map((r: any) => r.valor));
                    const heightPct = (item.valor / maxVal) * 100;
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
      </Tabs>
    </div>
  );
};

export default GeneradorDetallePage;

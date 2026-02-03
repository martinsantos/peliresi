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

// Mock data
const operadoresData: Record<string, any> = {
  '1': {
    id: 1,
    nombre: 'Planta Norte',
    razonSocial: 'Tratamiento de Residuos Norte S.A.',
    cuit: '30-12345678-9',
    direccion: 'Ruta 40 Km 1234, Guaymallén',
    telefono: '+54 261 456-7890',
    email: 'contacto@plantanorte.com',
    estado: 'ACTIVO',
    habilitacion: 'HAB-OP-2022-0189',
    vencimientoHab: '2025-12-31',
    metodosAutorizados: ['Incineración controlada', 'Neutralización química', 'Estabilización/solidificación', 'Landfarming'],
    residuosAceptados: ['Líquidos', 'Sólidos', 'Pastosos'],
    capacidadTotal: 5000,
    capacidadUsada: 4250,
    procesadoMes: 1240,
    certificaciones: ['ISO 14001', 'ISO 9001'],
    ultimaAuditoria: '2025-01-15',
    proximaAuditoria: '2025-07-15',
    capacidadPorTipo: [
      { tipo: 'Líquidos', capacidad: 2000, usado: 1800 },
      { tipo: 'Sólidos', capacidad: 2000, usado: 1650 },
      { tipo: 'Pastosos', capacidad: 1000, usado: 800 },
    ],
    manifiestos: { recibidos: 234, enTratamiento: 12, cerrados: 218, rechazados: 4 },
    ultimosManifiestos: [
      { id: 'M-2025-089', fecha: '2025-01-31', estado: 'EN_TRATAMIENTO', peso: 2450, generador: 'Química Mendoza S.A.' },
      { id: 'M-2025-087', fecha: '2025-01-30', estado: 'TRATADO', peso: 3200, generador: 'Metalúrgica Argentina' },
      { id: 'M-2025-084', fecha: '2025-01-29', estado: 'TRATADO', peso: 2100, generador: 'Química Mendoza S.A.' },
      { id: 'M-2025-080', fecha: '2025-01-27', estado: 'TRATADO', peso: 1500, generador: 'Industrias del Sur' },
      { id: 'M-2025-076', fecha: '2025-01-24', estado: 'RECHAZADO', peso: 800, generador: 'Textil Cuyo' },
    ],
    tratamientos: [
      { id: 'TRT-001', fecha: '2025-01-30', manifiesto: 'M-2025-087', metodo: 'Incineración controlada', peso: 3200, certificado: 'CD-2025-0145' },
      { id: 'TRT-002', fecha: '2025-01-29', manifiesto: 'M-2025-084', metodo: 'Neutralización química', peso: 2100, certificado: 'CD-2025-0144' },
      { id: 'TRT-003', fecha: '2025-01-27', manifiesto: 'M-2025-080', metodo: 'Estabilización/solidificación', peso: 1500, certificado: 'CD-2025-0143' },
      { id: 'TRT-004', fecha: '2025-01-24', manifiesto: 'M-2025-073', metodo: 'Incineración controlada', peso: 1800, certificado: 'CD-2025-0142' },
    ],
    metodosMasUsados: [
      { metodo: 'Incineración controlada', porcentaje: 45 },
      { metodo: 'Neutralización química', porcentaje: 30 },
      { metodo: 'Estabilización/solidificación', porcentaje: 15 },
      { metodo: 'Landfarming', porcentaje: 10 },
    ],
  },
  '2': {
    id: 2,
    nombre: 'EcoResiduos Sur',
    razonSocial: 'EcoResiduos Mendoza S.A.',
    cuit: '30-87654321-0',
    direccion: 'Ruta 7 Km 985, San Rafael',
    telefono: '+54 260 456-7890',
    email: 'info@ecoresiduos.com',
    estado: 'ACTIVO',
    habilitacion: 'HAB-OP-2021-0098',
    vencimientoHab: '2025-06-20',
    metodosAutorizados: ['Neutralización química', 'Landfarming'],
    residuosAceptados: ['Sólidos', 'Líquidos'],
    capacidadTotal: 3500,
    capacidadUsada: 2100,
    procesadoMes: 890,
    certificaciones: ['ISO 14001'],
    ultimaAuditoria: '2024-12-20',
    proximaAuditoria: '2025-06-20',
    capacidadPorTipo: [
      { tipo: 'Sólidos', capacidad: 2000, usado: 1400 },
      { tipo: 'Líquidos', capacidad: 1500, usado: 700 },
    ],
    manifiestos: { recibidos: 156, enTratamiento: 5, cerrados: 148, rechazados: 3 },
    ultimosManifiestos: [
      { id: 'M-2025-085', fecha: '2025-01-29', estado: 'TRATADO', peso: 1500, generador: 'Textil Cuyo' },
      { id: 'M-2025-079', fecha: '2025-01-26', estado: 'TRATADO', peso: 2100, generador: 'Industrias del Sur' },
    ],
    tratamientos: [
      { id: 'TRT-010', fecha: '2025-01-29', manifiesto: 'M-2025-085', metodo: 'Landfarming', peso: 1500, certificado: 'CD-2025-0089' },
    ],
    metodosMasUsados: [
      { metodo: 'Neutralización química', porcentaje: 55 },
      { metodo: 'Landfarming', porcentaje: 45 },
    ],
  },
};

const defaultOperador = operadoresData['1'];

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
  const pct = (usada / total) * 100;
  if (pct > 90) return 'text-error-600';
  if (pct > 70) return 'text-warning-600';
  return 'text-success-600';
};

const getCapacidadBg = (usada: number, total: number) => {
  const pct = (usada / total) * 100;
  if (pct > 90) return 'bg-error-500';
  if (pct > 70) return 'bg-warning-500';
  return 'bg-success-500';
};

const OperadorDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  const operador = operadoresData[id || ''] || defaultOperador;
  const backPath = isMobile ? '/mobile/actores/operadores' : '/actores/operadores';

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
                    const pct = (ct.usado / ct.capacidad) * 100;
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
                  {operador.ultimosManifiestos.map((m: any) => (
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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Manifiesto</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Método</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Peso</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Certificado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {operador.tratamientos.map((t: any) => (
                        <tr key={t.id} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 font-mono text-sm text-neutral-900">{t.id}</td>
                          <td className="px-4 py-3 text-neutral-600">{t.fecha}</td>
                          <td className="px-4 py-3">
                            <span
                              className="font-mono text-primary-600 cursor-pointer hover:underline"
                              onClick={() => navigate(isMobile ? `/mobile/manifiestos/${t.manifiesto}` : `/manifiestos/${t.manifiesto}`)}
                            >
                              {t.manifiesto}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-700">{t.metodo}</td>
                          <td className="px-4 py-3 font-medium text-neutral-700">{t.peso.toLocaleString('es-AR')} kg</td>
                          <td className="px-4 py-3">
                            <Badge variant="soft" color="success">{t.certificado}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default OperadorDetallePage;

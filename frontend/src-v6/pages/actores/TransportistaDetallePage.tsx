/**
 * SITREP v6 - Transportista Detail Page
 * ======================================
 * Vista detalle de un transportista con tabs: Info General + Flota y Conductores
 */

import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  MapPin,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Users,
  Shield,
  Award,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { useTransportista } from '../../hooks/useActores';

const TransportistaDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  const { data: apiTransportista, isLoading } = useTransportista(id || '');

  const transportista = apiTransportista ? {
    ...apiTransportista,
    nombre: (apiTransportista as any).razonSocial || '-',
    direccion: (apiTransportista as any).domicilio || '-',
    estado: (apiTransportista as any).activo !== false ? 'ACTIVO' : 'SUSPENDIDO',
    habilitacion: (apiTransportista as any).numeroHabilitacion || '-',
    vencimientoHab: (apiTransportista as any).vencimientoHab || '-',
    flota: (apiTransportista as any).vehiculos || [],
    conductores: (apiTransportista as any).choferes || [],
  } : null;

  const backPath = isMobile
    ? '/mobile/actores/transportistas'
    : '/admin/actores/transportistas';

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

  const habVencimiento = transportista.vencimientoHab !== '-' ? new Date(transportista.vencimientoHab) : null;
  const diasHastaVencimiento = habVencimiento ? Math.ceil((habVencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const habProximaVencer = diasHastaVencimiento !== null && diasHastaVencimiento <= 90 && diasHastaVencimiento > 0;

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
              <span className="text-neutral-600 font-mono text-sm">CUIT: {transportista.cuit}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats — only real data */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Vehículos</p>
          <p className="text-3xl font-bold text-neutral-900">{transportista.flota.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Conductores</p>
          <p className="text-3xl font-bold text-neutral-900">{transportista.conductores.length}</p>
        </Card>
      </div>

      {/* Tabs — only real data */}
      <Tabs defaultTab="info" variant="default">
        <TabList>
          <Tab id="info" icon={<Truck size={16} />}>Información General</Tab>
          <Tab id="flota" icon={<Users size={16} />}>Flota y Conductores</Tab>
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
                  {transportista.vencimientoHab !== '-' && (
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar size={16} className="text-neutral-400 shrink-0" />
                      <div>
                        <p className="text-neutral-500">Vencimiento habilitación</p>
                        <p className="font-medium text-neutral-900">{transportista.vencimientoHab}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Certificaciones" icon={<Award size={20} />} />
              <CardContent>
                <div>
                  <div className="flex flex-wrap gap-2">
                    {((apiTransportista as any)?.certificaciones || []).map((cert: string) => (
                      <Badge key={cert} variant="soft" color="success">
                        <CheckCircle2 size={12} className="mr-1" />
                        {cert}
                      </Badge>
                    ))}
                    {!((apiTransportista as any)?.certificaciones?.length) && (
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
                {transportista.flota.length > 0 ? (
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
                      {transportista.flota.map((v: any) => (
                        <tr key={v.patente || v.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-3 py-2.5 font-mono font-semibold text-neutral-900">{v.patente}</td>
                          <td className="px-3 py-2.5 text-neutral-700">{v.tipo || '-'}</td>
                          <td className="px-3 py-2.5 text-neutral-700">{v.capacidad || '-'}</td>
                          <td className="px-3 py-2.5">
                            <Badge variant="soft" color={v.activo !== false ? 'success' : 'warning'}>
                              {v.activo !== false ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-neutral-600 hidden md:table-cell">{v.vencimientoVTV || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-neutral-400 text-center py-6">Sin vehículos registrados</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Conductores" icon={<Users size={20} />} />
              <CardContent>
                {transportista.conductores.length > 0 ? (
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
                      {transportista.conductores.map((c: any) => (
                        <tr key={c.dni || c.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-neutral-900">{c.nombre}</td>
                          <td className="px-3 py-2.5 font-mono text-neutral-700">{c.dni || '-'}</td>
                          <td className="px-3 py-2.5 text-neutral-700">{c.licencia || '-'}</td>
                          <td className="px-3 py-2.5 text-neutral-700 hidden md:table-cell">{c.categoria || '-'}</td>
                          <td className="px-3 py-2.5 text-neutral-600 hidden md:table-cell">{c.vencimiento || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-neutral-400 text-center py-6">Sin conductores registrados</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default TransportistaDetallePage;

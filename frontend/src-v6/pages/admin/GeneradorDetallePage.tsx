/**
 * SITREP v6 - Generador Detail Page
 * ==================================
 * Vista detalle de un generador con tabs: Info General + Residuos Inscriptos
 */

import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Factory,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Download,
  CheckCircle,
  AlertTriangle,
  Biohazard,
  Shield,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { useGenerador } from '../../hooks/useActores';
import { downloadCsv } from '../../utils/exportCsv';
import { GENERADORES_DATA } from '../../data/generadores-enrichment';
import { CORRIENTES_Y } from '../../data/corrientes-y';

const GeneradorDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  const { data: apiGenerador, isLoading } = useGenerador(id || '');

  const generador = apiGenerador ? {
    ...apiGenerador,
    estado: (apiGenerador as any).activo !== false ? 'activo' : 'inactivo',
    inscripcionDGFA: (apiGenerador as any).numeroInscripcion || '-',
    fechaAlta: (apiGenerador as any).createdAt ? new Date((apiGenerador as any).createdAt).toISOString().split('T')[0] : '-',
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

  // CSV enrichment lookup
  const enriched = generador.cuit ? GENERADORES_DATA[generador.cuit] : null;
  const categorias = enriched?.categoriasControl || [];

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

      {/* Stats — only real data */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Categoría</p>
          <p className="text-xl font-bold text-neutral-900">{generador.categoria || '-'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Corrientes Y inscriptas</p>
          <p className="text-3xl font-bold text-neutral-900">{categorias.length}</p>
        </Card>
      </div>

      {/* Tabs — only real data */}
      <Tabs defaultTab="info" variant="default">
        <TabList>
          <Tab id="info" icon={<Factory size={16} />}>Información General</Tab>
          <Tab id="residuos" icon={<Biohazard size={16} />}>Residuos Inscriptos</Tab>
        </TabList>

        {/* Tab: Info General */}
        <TabPanel id="info">
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
        </TabPanel>

        {/* Tab: Residuos Inscriptos — DATOS REALES DEL CSV */}
        <TabPanel id="residuos">
          {categorias.length > 0 ? (
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
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default GeneradorDetallePage;

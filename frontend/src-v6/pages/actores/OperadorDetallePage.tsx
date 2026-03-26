/**
 * SITREP v6 - Operador Detail Page
 * =================================
 * Vista detalle de un operador/planta de tratamiento con tabs
 * Integra datos de la API + enriquecimiento CSV (certificado, tipo, tecnología, corrientes)
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import type { Operador, Manifiesto } from '../../types/models';
import {
  ArrowLeft,
  FlaskConical,
  MapPin,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Shield,
  Beaker,
  BarChart3,
  Award,
  Leaf,
  Zap,
  FileText,
  User,
  Briefcase,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { useOperador } from '../../hooks/useActores';
import { useManifiestos } from '../../hooks/useManifiestos';
import type { OperadorEnriched } from '../../data/operadores-enrichment';
import { CORRIENTES_Y } from '../../data/corrientes-y';
import { useOperadoresEnrichment } from '../../hooks/useEnrichment';

/** Local view-model that extends Operador with UI-specific derived fields */
interface OperadorViewModel extends Operador {
  nombre: string;
  direccion: string;
  estado: string;
  habilitacion: string;
  vencimientoHab: string;
  residuosAceptados: string[];
  certificaciones: string[];
}

const estadoConfig: Record<string, { label: string; color: string }> = {
  ACTIVO: { label: 'En línea', color: 'success' },
  MANTENIMIENTO: { label: 'Mantenimiento', color: 'warning' },
  INACTIVO: { label: 'Fuera de servicio', color: 'error' },
};

/** Parse tecnologia string into structured entries: { metodo, corrientes[] } */
function parseTecnologias(tecnologia: string): { metodo: string; corrientes: string[] }[] {
  if (!tecnologia) return [];
  // Split on period or comma-before-uppercase (but not Y-codes inside methods)
  const segments = tecnologia
    .split(/\.\s*/)
    .flatMap(s => s.split(/,\s*(?=[A-Z][a-záéíóú])/))
    .map(s => s.trim())
    .filter(s => s.length > 3);

  return segments.map(seg => {
    // Extract Y-codes from the segment
    const yMatches = seg.match(/Y\d+/g) || [];
    // Clean method name: remove Y-codes and colons
    const metodo = seg
      .replace(/:\s*Y\d+[\s,eéy/]*(?:Y\d+[\s,eéy/]*)*/g, '')
      .replace(/Y\d+/g, '')
      .replace(/\s+/g, ' ')
      .replace(/,\s*$/, '')
      .trim();
    return { metodo: metodo || seg, corrientes: [...new Set(yMatches)] };
  });
}

const OperadorDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  const { data: enrichmentData } = useOperadoresEnrichment();
  const OPERADORES_DATA = enrichmentData?.operadores || {};

  const [historialPage, setHistorialPage] = useState(1);
  const { data: apiOperador, isLoading } = useOperador(id || '');
  const { data: manifiestoData } = useManifiestos({ operadorId: id, limit: 20, page: historialPage }, { enabled: !!id });

  const operador: OperadorViewModel | null = apiOperador ? {
    ...apiOperador,
    nombre: apiOperador.razonSocial || '-',
    direccion: apiOperador.domicilio || '-',
    estado: apiOperador.activo !== false ? 'ACTIVO' : 'INACTIVO',
    habilitacion: apiOperador.numeroHabilitacion || '-',
    vencimientoHab: apiOperador.vencimientoHabilitacion || '-',
    residuosAceptados: [],
    certificaciones: [],
  } : null;

  // CSV enrichment lookup by CUIT
  const enriched: OperadorEnriched | null = operador?.cuit ? (OPERADORES_DATA[operador.cuit] || null) : null;

  // Parse tecnologías from CSV into structured list
  const tecnologiasParsed = useMemo(() =>
    enriched ? parseTecnologias(enriched.tecnologia) : [],
    [enriched]
  );

  // Determine back path based on where we came from (admin vs actores)
  const isFromAdmin = location.pathname.includes('/admin/');
  const backPath = isMobile
    ? (isFromAdmin ? '/mobile/admin/actores/operadores' : '/mobile/actores/operadores')
    : (isFromAdmin ? '/admin/actores/operadores' : '/actores/operadores');

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
              <FlaskConical size={28} className="text-primary-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-neutral-900">{operador.nombre}</h2>
                <Badge variant="soft" color={est.color}>
                  {operador.estado === 'ACTIVO' ? <CheckCircle2 size={12} className="mr-1" /> : <AlertCircle size={12} className="mr-1" />}
                  {est.label}
                </Badge>
                {enriched?.tipoOperador && (
                  <Badge variant="outline" color={enriched.tipoOperador.includes('FIJO') ? 'primary' : 'success'}>
                    {enriched.tipoOperador}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-neutral-500 font-mono text-sm">CUIT: {operador.cuit}</span>
                {enriched?.certificado && (
                  <span className="text-xs font-mono text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">{enriched.certificado}</span>
                )}
              </div>
              {enriched?.expediente && (
                <p className="text-xs text-neutral-400 mt-0.5">Exp: {enriched.expediente}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats — only real data */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Corrientes Y</p>
          <p className="text-3xl font-bold text-neutral-900">{enriched?.corrientes.length || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Tecnologías</p>
          <p className="text-3xl font-bold text-neutral-900">{tecnologiasParsed.length}</p>
        </Card>
      </div>

      {/* Tabs — only real data */}
      <Tabs defaultTab="info" variant="default">
        <TabList>
          <Tab id="info" icon={<FlaskConical size={16} />}>Información General</Tab>
          <Tab id="tratamientos" icon={<Beaker size={16} />}>Tratamientos</Tab>
          <Tab id="historial" icon={<FileText size={16} />}>Historial</Tab>
        </TabList>

        {/* Tab: Info General */}
        <TabPanel id="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Datos de la Planta */}
            <Card>
              <CardHeader title="Datos de la Planta" icon={<FlaskConical size={20} />} />
              <CardContent>
                <div className="space-y-4">
                  {/* Direccion Real (CSV - structured) */}
                  {enriched?.domicilioReal ? (
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin size={16} className="text-neutral-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-neutral-500">Direccion Real {apiOperador?.tipoOperador === 'IN_SITU' ? '(sede administrativa)' : '(planta)'}</p>
                        <p className="font-medium text-neutral-900">{enriched.domicilioReal.calle}</p>
                        <p className="text-neutral-600">{enriched.domicilioReal.localidad}, {enriched.domicilioReal.departamento}</p>
                        {apiOperador?.tipoOperador === 'IN_SITU' && (
                          <p className="text-xs text-amber-600 mt-1">Opera en la ubicacion del generador</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin size={16} className="text-neutral-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-neutral-500">Dirección</p>
                        <p className="font-medium text-neutral-900">{operador.direccion}</p>
                      </div>
                    </div>
                  )}
                  {/* Direccion Fiscal (CSV) */}
                  {enriched?.domicilioLegal && (
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin size={16} className="text-neutral-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-neutral-500">Direccion Fiscal</p>
                        <p className="font-medium text-neutral-900">{enriched.domicilioLegal.calle}</p>
                        <p className="text-neutral-600">{enriched.domicilioLegal.localidad}, {enriched.domicilioLegal.departamento}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Teléfono</p>
                      <p className="font-medium text-neutral-900">{enriched?.telefono || operador.telefono || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Email</p>
                      <p className="font-medium text-neutral-900">{enriched?.mail || operador.email || '-'}</p>
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

            {/* Datos Regulatorios y Representantes */}
            <Card>
              <CardHeader title="Datos Regulatorios y Representantes" icon={<Briefcase size={20} />} />
              <CardContent>
                <div className="space-y-4">
                  {/* Categoría y Regulatorio */}
                  {(apiOperador?.categoria || apiOperador?.expedienteInscripcion || apiOperador?.resolucionDPA) && (
                    <div className="space-y-3">
                      {apiOperador?.categoria && (
                        <div className="flex items-center gap-3 text-sm">
                          <Shield size={16} className="text-neutral-400 shrink-0" />
                          <div>
                            <p className="text-neutral-500">Categoría</p>
                            <p className="font-medium text-neutral-900">{apiOperador.categoria}</p>
                          </div>
                        </div>
                      )}
                      {apiOperador?.expedienteInscripcion && (
                        <div className="flex items-center gap-3 text-sm">
                          <FileText size={16} className="text-neutral-400 shrink-0" />
                          <div>
                            <p className="text-neutral-500">Expediente Inscripción</p>
                            <p className="font-medium text-neutral-900">{apiOperador.expedienteInscripcion}</p>
                          </div>
                        </div>
                      )}
                      {apiOperador?.resolucionDPA && (
                        <div className="flex items-center gap-3 text-sm">
                          <FileText size={16} className="text-neutral-400 shrink-0" />
                          <div>
                            <p className="text-neutral-500">Resolución DPA</p>
                            <p className="font-medium text-neutral-900">{apiOperador.resolucionDPA}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Representante Legal */}
                  {(apiOperador?.representanteLegalNombre || apiOperador?.representanteLegalDNI) && (
                    <div className="border-t border-neutral-100 pt-4">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Representante Legal</p>
                      <div className="space-y-2">
                        {apiOperador?.representanteLegalNombre && (
                          <div className="flex items-center gap-3 text-sm">
                            <User size={16} className="text-neutral-400 shrink-0" />
                            <div>
                              <p className="text-neutral-500">Nombre</p>
                              <p className="font-medium text-neutral-900">{apiOperador.representanteLegalNombre}</p>
                            </div>
                          </div>
                        )}
                        {apiOperador?.representanteLegalDNI && (
                          <div className="flex items-center gap-3 text-sm">
                            <FileText size={16} className="text-neutral-400 shrink-0" />
                            <div>
                              <p className="text-neutral-500">DNI</p>
                              <p className="font-medium text-neutral-900">{apiOperador.representanteLegalDNI}</p>
                            </div>
                          </div>
                        )}
                        {apiOperador?.representanteLegalTelefono && (
                          <div className="flex items-center gap-3 text-sm">
                            <Phone size={16} className="text-neutral-400 shrink-0" />
                            <div>
                              <p className="text-neutral-500">Teléfono</p>
                              <p className="font-medium text-neutral-900">{apiOperador.representanteLegalTelefono}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Representante Técnico */}
                  {(apiOperador?.representanteTecnicoNombre || apiOperador?.representanteTecnicoMatricula) && (
                    <div className="border-t border-neutral-100 pt-4">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Representante Técnico</p>
                      <div className="space-y-2">
                        {apiOperador?.representanteTecnicoNombre && (
                          <div className="flex items-center gap-3 text-sm">
                            <User size={16} className="text-neutral-400 shrink-0" />
                            <div>
                              <p className="text-neutral-500">Nombre</p>
                              <p className="font-medium text-neutral-900">{apiOperador.representanteTecnicoNombre}</p>
                            </div>
                          </div>
                        )}
                        {apiOperador?.representanteTecnicoMatricula && (
                          <div className="flex items-center gap-3 text-sm">
                            <FileText size={16} className="text-neutral-400 shrink-0" />
                            <div>
                              <p className="text-neutral-500">Matrícula</p>
                              <p className="font-medium text-neutral-900">{apiOperador.representanteTecnicoMatricula}</p>
                            </div>
                          </div>
                        )}
                        {apiOperador?.representanteTecnicoTelefono && (
                          <div className="flex items-center gap-3 text-sm">
                            <Phone size={16} className="text-neutral-400 shrink-0" />
                            <div>
                              <p className="text-neutral-500">Teléfono</p>
                              <p className="font-medium text-neutral-900">{apiOperador.representanteTecnicoTelefono}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Fallback if no data */}
                  {!apiOperador?.categoria && !apiOperador?.representanteLegalNombre && !apiOperador?.representanteTecnicoNombre && (
                    <p className="text-sm text-neutral-400">Sin datos regulatorios registrados</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Corrientes de Residuos */}
            <Card>
              <CardHeader title="Corrientes de Residuos Autorizadas" icon={<Award size={20} />} />
              <CardContent>
                {enriched && enriched.corrientes.length > 0 ? (
                  <div className="space-y-3">
                    {enriched.corrientes.map((code: string) => (
                      <div key={code} className="flex items-start gap-3 p-3 bg-neutral-50 rounded-xl">
                        <Badge variant="outline" color="warning" className="shrink-0 mt-0.5">{code}</Badge>
                        <p className="text-sm text-neutral-700">{CORRIENTES_Y[code] || 'Sin descripción'}</p>
                      </div>
                    ))}
                  </div>
                ) : operador.residuosAceptados.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {operador.residuosAceptados.map((r: string) => (
                      <Badge key={r} variant="outline" color="neutral">{r}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400">Sin corrientes registradas</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* Tab: Tratamientos — DATOS REALES DEL CSV */}
        <TabPanel id="tratamientos">
          <div className="space-y-6">
            {/* Tecnologías Autorizadas (CSV real) */}
            <Card>
              <CardHeader title="Tecnologías y Tratamientos Autorizados" icon={<Zap size={20} />} />
              <CardContent>
                {tecnologiasParsed.length > 0 ? (
                  <div className="space-y-3">
                    {tecnologiasParsed.map((tec, i) => (
                      <div key={i} className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                        <div className="flex items-start gap-3">
                          <Leaf size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-neutral-800">{tec.metodo}</p>
                            {tec.corrientes.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {tec.corrientes.map(code => (
                                  <Badge key={code} variant="outline" color="warning" className="text-xs" title={CORRIENTES_Y[code] || code}>
                                    {code}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-neutral-500">
                    <Beaker size={32} className="mx-auto mb-2 text-neutral-300" />
                    <p>Sin tecnologías registradas en el CSV oficial</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Texto completo de tecnología (para referencia) */}
            {enriched?.tecnologia && (
              <Card>
                <CardHeader title="Descripción Completa de Tecnología" icon={<BarChart3 size={20} />} />
                <CardContent>
                  <div className="p-4 bg-neutral-50 rounded-xl">
                    <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{enriched.tecnologia}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Link al catálogo de tratamientos */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<BarChart3 size={14} />}
                onClick={() => navigate(`${isMobile ? '/mobile' : ''}/admin/tratamientos`)}
              >
                Ver catálogo completo de tratamientos
              </Button>
            </div>
          </div>
        </TabPanel>

        {/* Tab: Historial de Manifiestos */}
        <TabPanel id="historial">
          <Card>
            <CardHeader title="Historial de Manifiestos" icon={<FileText size={20} />} />
            <CardContent>
              {(manifiestoData?.items?.length ?? 0) > 0 ? (
                <table className="w-full table-fixed">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Número</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Estado</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '22%' }}>Generador</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '18%' }}>Fecha</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {manifiestoData!.items.map((m: Manifiesto) => (
                      <tr key={m.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-sm font-semibold text-neutral-900">{m.numero}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="soft" color={
                            m.estado === 'TRATADO' ? 'success' :
                            m.estado === 'EN_TRANSITO' ? 'warning' :
                            m.estado === 'CANCELADO' || m.estado === 'RECHAZADO' ? 'error' : 'neutral'
                          }>
                            {m.estado}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-neutral-700 hidden md:table-cell">{m.generador?.razonSocial || '-'}</td>
                        <td className="px-3 py-2.5 text-sm text-neutral-600 hidden md:table-cell">{m.createdAt ? new Date(m.createdAt).toLocaleDateString('es-AR') : '-'}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(isMobile ? `/mobile/manifiestos/${m.id}` : `/manifiestos/${m.id}`)}
                          >
                            Ver
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-neutral-400 text-center py-6">Sin manifiestos registrados</p>
              )}
              {(manifiestoData?.totalPages ?? 0) > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-neutral-100 mt-2">
                  <p className="text-sm text-neutral-500">
                    Página {manifiestoData!.page} de {manifiestoData!.totalPages} · {manifiestoData!.total} total
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={historialPage === 1} onClick={() => setHistorialPage(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={historialPage === manifiestoData!.totalPages} onClick={() => setHistorialPage(p => p + 1)}>Siguiente</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default OperadorDetallePage;

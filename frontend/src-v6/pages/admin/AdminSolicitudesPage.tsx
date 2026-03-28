/**
 * SITREP v6 - Admin Solicitudes Page
 * Admin list page for managing inscription solicitudes
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Clock, Eye, Search, Filter, Loader2,
  CheckCircle, AlertTriangle, Send, XCircle,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Badge } from '../../components/ui/BadgeV2';
import { useSolicitudes } from '../../hooks/useSolicitudes';
import type { EstadoSolicitud, SolicitudInscripcion } from '../../types/api';

// ── Status config ──

const ESTADO_CONFIG: Record<EstadoSolicitud, {
  label: string;
  color: 'neutral' | 'info' | 'warning' | 'success' | 'error';
  icon: typeof Clock;
}> = {
  BORRADOR:    { label: 'Borrador',     color: 'neutral',  icon: FileText },
  ENVIADA:     { label: 'Enviada',      color: 'info',     icon: Send },
  EN_REVISION: { label: 'En Revision',  color: 'warning',  icon: Eye },
  OBSERVADA:   { label: 'Observada',    color: 'warning',  icon: AlertTriangle },
  APROBADA:    { label: 'Aprobada',     color: 'success',  icon: CheckCircle },
  RECHAZADA:   { label: 'Rechazada',    color: 'error',    icon: XCircle },
};

const AdminSolicitudesPage: React.FC = () => {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<string>('');
  const [tipoActor, setTipoActor] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useSolicitudes({
    estado: (estado || undefined) as EstadoSolicitud | undefined,
    tipoActor: tipoActor || undefined,
    search: search || undefined,
    page,
    limit: 20,
  });

  const solicitudes = data?.items || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  // KPIs from current page data - for a production app these would come from a dedicated stats endpoint.
  // We compute from all loaded items as a reasonable approximation.
  const kpis = {
    pendientes: solicitudes.filter(s => s.estado === 'ENVIADA').length,
    enRevision: solicitudes.filter(s => s.estado === 'EN_REVISION').length,
    observadas: solicitudes.filter(s => s.estado === 'OBSERVADA').length,
    aprobadas: solicitudes.filter(s => s.estado === 'APROBADA').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary-100 rounded-xl">
          <FileText size={22} className="text-primary-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Solicitudes de Inscripcion</h2>
          <p className="text-sm text-neutral-500">{total} solicitudes en total</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{kpis.pendientes}</p>
          <p className="text-xs text-neutral-500">Pendientes</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{kpis.enRevision}</p>
          <p className="text-xs text-neutral-500">En Revision</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{kpis.observadas}</p>
          <p className="text-xs text-neutral-500">Observadas</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{kpis.aprobadas}</p>
          <p className="text-xs text-neutral-500">Aprobadas</p>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={16} className="text-neutral-400" />
        <select
          value={estado}
          onChange={e => { setEstado(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-lg border border-neutral-200 text-sm bg-white"
        >
          <option value="">Todos los estados</option>
          <option value="ENVIADA">Pendientes</option>
          <option value="EN_REVISION">En Revision</option>
          <option value="OBSERVADA">Observadas</option>
          <option value="APROBADA">Aprobadas</option>
          <option value="RECHAZADA">Rechazadas</option>
        </select>
        <select
          value={tipoActor}
          onChange={e => { setTipoActor(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-lg border border-neutral-200 text-sm bg-white"
        >
          <option value="">Todos los tipos</option>
          <option value="GENERADOR">Generadores</option>
          <option value="OPERADOR">Operadores</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre o email..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-neutral-200 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 size={32} className="animate-spin text-primary-500 mx-auto" />
        </div>
      ) : solicitudes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText size={40} className="text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500">No hay solicitudes para los filtros seleccionados</p>
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Mobile Card View */}
        <div className="md:hidden space-y-2">
          {solicitudes.map((s: SolicitudInscripcion) => {
            const eCfg = ESTADO_CONFIG[s.estado] || ESTADO_CONFIG.ENVIADA;
            return (
              <Card
                key={s.id}
                className="active:scale-[0.98] transition-transform cursor-pointer"
                onClick={() => navigate(`/admin/solicitudes/${s.id}`)}
              >
                <div className="p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText size={16} className="text-primary-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-neutral-900 truncate">{s.usuario?.nombre || '-'}</p>
                        <p className="text-xs text-neutral-400 truncate">{s.usuario?.email}</p>
                      </div>
                    </div>
                    <Badge
                      variant="soft"
                      color={eCfg.color}
                      dot={s.estado === 'OBSERVADA'}
                      pulse={s.estado === 'OBSERVADA'}
                    >
                      {eCfg.label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2 pl-10">
                    <div className="flex items-center gap-2">
                      <Badge variant="soft" color={s.tipoActor === 'GENERADOR' ? 'primary' : 'info'}>
                        {s.tipoActor}
                      </Badge>
                      <span className="text-xs text-neutral-400">
                        {s.fechaEnvio ? new Date(s.fechaEnvio).toLocaleDateString('es-AR') : '-'}
                      </span>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/admin/solicitudes/${s.id}`); }}
                      className="p-1.5 rounded-lg hover:bg-neutral-100"
                      title="Ver detalle"
                    >
                      <Eye size={14} className="text-neutral-500" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Desktop Table */}
        <Card padding="none" className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Candidato</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Estado</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Fecha envio</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Documentos</th>
                  <th className="text-right py-3 px-4 font-medium text-neutral-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((s: SolicitudInscripcion) => {
                  const eCfg = ESTADO_CONFIG[s.estado] || ESTADO_CONFIG.ENVIADA;
                  const docCount = s._count?.documentos ?? s.documentos?.length ?? 0;

                  return (
                    <tr
                      key={s.id}
                      className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                      onClick={() => navigate(`/admin/solicitudes/${s.id}`)}
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium text-neutral-900">{s.usuario?.nombre || '-'}</p>
                        <p className="text-xs text-neutral-400">{s.usuario?.email}</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="soft" color={s.tipoActor === 'GENERADOR' ? 'primary' : 'info'}>
                          {s.tipoActor}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="soft"
                          color={eCfg.color}
                          dot={s.estado === 'OBSERVADA'}
                          pulse={s.estado === 'OBSERVADA'}
                        >
                          {eCfg.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-neutral-600">
                        {s.fechaEnvio
                          ? new Date(s.fechaEnvio).toLocaleDateString('es-AR')
                          : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="soft" color="neutral">{docCount}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/admin/solicitudes/${s.id}`); }}
                          className="p-1.5 rounded-lg hover:bg-neutral-100"
                          title="Ver detalle"
                        >
                          <Eye size={14} className="text-neutral-500" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-neutral-200">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-xs text-neutral-500">Pagina {page} de {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </Card>
        </>
      )}
    </div>
  );
};

export default AdminSolicitudesPage;

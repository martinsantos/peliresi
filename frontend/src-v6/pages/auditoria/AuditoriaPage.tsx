/**
 * SITREP v6 - Auditoria Page
 * ==========================
 * Logs y registro de actividad del sistema - Real API + fallback mock
 */

import React, { useState, useMemo } from 'react';
import {
  Shield,
  Search,
  Filter,
  Calendar,
  User,
  FileText,
  Edit,
  Trash2,
  LogIn,
  LogOut,
  Download,
  Activity,
  Loader2
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { toast } from '../../components/ui/Toast';
import { useQuery } from '@tanstack/react-query';
import { reporteService } from '../../services/reporte.service';
import { downloadCsv } from '../reportes/tabs/shared';

// Log entry type
type LogEntry = {
  id: number;
  fecha: string;
  usuario: string;
  rol: string;
  accion: string;
  modulo: string;
  detalle: string;
  ip: string;
};

const accionConfig: Record<string, { color: string; icon: any }> = {
  LOGIN: { color: 'success', icon: LogIn },
  LOGOUT: { color: 'neutral', icon: LogOut },
  CREATE: { color: 'primary', icon: FileText },
  UPDATE: { color: 'warning', icon: Edit },
  DELETE: { color: 'error', icon: Trash2 },
  EXPORT: { color: 'info', icon: Download },
};

const AuditoriaPage: React.FC = () => {
  // Real API data
  const { data: apiData, isLoading, isError } = useQuery({
    queryKey: ['reportes', 'auditoria'],
    queryFn: () => reporteService.auditoria(),
  });

  // Convert API data to log entries - supports both { datos } and { eventos } response shapes
  const logsData: LogEntry[] = useMemo(() => {
    const raw = apiData?.datos || apiData?.eventos || [];
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map((d: any, i: number) => ({
      id: d.id || i + 1,
      fecha: d.fecha || d.createdAt || '',
      usuario: d.usuario || d.usuarioNombre || '',
      rol: d.rol || 'ADMIN',
      accion: d.accion || d.tipo || 'UPDATE',
      modulo: d.modulo || d.entidad || '',
      detalle: d.detalle || d.descripcion || '',
      ip: d.ip || d.direccionIp || '',
    }));
  }, [apiData]);

  const [busqueda, setBusqueda] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('todas');
  const [diasFiltro, setDiasFiltro] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const logsFiltrados = logsData.filter(log => {
    const matchBusqueda =
      String(log.usuario || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      String(log.detalle || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      String(log.modulo || '').toLowerCase().includes(busqueda.toLowerCase());
    const matchAccion = filtroAccion === 'todas' || log.accion === filtroAccion;
    let matchFecha = true;
    if (diasFiltro) {
      const since = new Date(Date.now() - diasFiltro * 24 * 60 * 60 * 1000);
      const logDate = log.fecha ? new Date(log.fecha) : null;
      matchFecha = logDate ? logDate >= since : true;
    }
    return matchBusqueda && matchAccion && matchFecha;
  });

  const totalPages = Math.ceil(logsFiltrados.length / itemsPerPage);
  const logsPaginados = logsFiltrados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats from real data only
  const stats = useMemo(() => {
    if (apiData?.resumen) {
      const resumen = apiData.resumen as any;
      return {
        total: resumen.total ?? logsFiltrados.length,
        logins: resumen.porTipo?.LOGIN ?? logsData.filter(l => l.accion === 'LOGIN').length,
        creados: resumen.porTipo?.CREATE ?? logsData.filter(l => l.accion === 'CREATE').length,
        actualizados: resumen.porTipo?.UPDATE ?? logsData.filter(l => l.accion === 'UPDATE').length,
        eliminados: resumen.porTipo?.DELETE ?? logsData.filter(l => l.accion === 'DELETE').length,
      };
    }
    return {
      total: logsFiltrados.length,
      logins: logsData.filter(l => l.accion === 'LOGIN').length,
      creados: logsData.filter(l => l.accion === 'CREATE').length,
      actualizados: logsData.filter(l => l.accion === 'UPDATE').length,
      eliminados: logsData.filter(l => l.accion === 'DELETE').length,
    };
  }, [apiData, logsData, logsFiltrados]);

  const handleExportar = () => {
    if (logsFiltrados.length === 0) {
      toast.warning('Sin datos', 'No hay registros para exportar');
      return;
    }
    const headers = ['Fecha', 'Usuario', 'Rol', 'Accion', 'Modulo', 'Detalle', 'IP'];
    const rows = logsFiltrados.map(l => [l.fecha, l.usuario, l.rol, l.accion, l.modulo, l.detalle, l.ip]);
    downloadCsv(`auditoria_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    toast.success('Exportado', 'Los registros de auditoría fueron descargados');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-100 rounded-xl">
            <Shield size={24} className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Auditoria</h2>
            <p className="text-neutral-600">
              {isLoading ? (
                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando registros...</span>
              ) : (
                <>Registro de actividad del sistema {isError ? '(error al cargar)' : ''}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={diasFiltro === 7 ? 'primary' : 'outline'}
            leftIcon={<Calendar size={18} />}
            onClick={() => setDiasFiltro(diasFiltro === 7 ? null : 7)}
          >
            Últimos 7 días
          </Button>
          <Button variant="outline" leftIcon={<Download size={18} />} onClick={handleExportar}>
            Exportar Logs
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-neutral-600 mb-1">Total Logs</p>
            <p className="text-2xl font-bold text-neutral-900">{typeof stats.total === 'number' ? stats.total.toLocaleString() : stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-success-50 border-success-200">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-success-700 mb-1">Logins</p>
            <p className="text-2xl font-bold text-success-900">{stats.logins}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary-50 border-primary-200">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-primary-700 mb-1">Creados</p>
            <p className="text-2xl font-bold text-primary-900">{stats.creados}</p>
          </CardContent>
        </Card>
        <Card className="bg-warning-50 border-warning-200">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-warning-700 mb-1">Actualizados</p>
            <p className="text-2xl font-bold text-warning-900">{stats.actualizados}</p>
          </CardContent>
        </Card>
        <Card className="bg-error-50 border-error-200">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-error-700 mb-1">Eliminados</p>
            <p className="text-2xl font-bold text-error-900">{stats.eliminados}</p>
          </CardContent>
        </Card></div>

      {/* Filtros */}
      <Card padding="base">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por usuario, modulo o accion..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              leftIcon={<Search size={18} />}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filtroAccion}
              onChange={(e) => setFiltroAccion(e.target.value)}
              className="px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="todas">Todas las acciones</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="CREATE">Crear</option>
              <option value="UPDATE">Actualizar</option>
              <option value="DELETE">Eliminar</option>
              <option value="EXPORT">Exportar</option>
            </select>
            <Button variant="outline" leftIcon={<Filter size={18} />}>
              Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabla de logs */}
      <Card padding="none" className="max-h-[70vh] overflow-auto">
        <table className="w-full table-fixed">
            <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: "15%" }}>Fecha</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: "20%" }}>Usuario</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: "12%" }}>Accion</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: "13%" }}>Modulo</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: "25%" }}>Detalle</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: "15%" }}>IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {logsPaginados.map((log) => {
                const config = accionConfig[log.accion] || { color: 'neutral', icon: Activity };
                const Icon = config.icon;
                return (
                  <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-3 py-2.5 text-sm text-neutral-600 font-mono">
                      {log.fecha}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                          <User size={14} className="text-neutral-500" />
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900 text-sm">{log.usuario}</p>
                          <Badge variant="outline" size="sm">{log.rol}</Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-700`}>
                        <Icon size={12} />
                        {log.accion}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-neutral-600 hidden md:table-cell">
                      {log.modulo}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-neutral-900 truncate hidden md:table-cell" title={log.detalle}>
                      {log.detalle}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-neutral-500 font-mono hidden md:table-cell">
                      {log.ip}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-between">
          <p className="text-sm text-neutral-600">
            Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, logsFiltrados.length)}</span> de <span className="font-medium">{logsFiltrados.length.toLocaleString()}</span> registros
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Card>

      {/* Error state */}
      {isError && logsData.length === 0 && (
        <Card padding="base" className="bg-error-50 border-error-200">
          <div className="text-center py-8">
            <Shield size={32} className="text-error-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-error-900 mb-1">No se pudo cargar la auditoria</h3>
            <p className="text-sm text-error-700">Hubo un error al conectar con el servidor. Por favor, intente de nuevo más tarde.</p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AuditoriaPage;

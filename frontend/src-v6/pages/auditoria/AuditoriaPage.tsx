/**
 * SITREP v6 - Auditoria Page
 * ==========================
 * Logs y registro de actividad del sistema — server-side pagination + filters
 */

import React, { useState, useMemo } from 'react';
import {
  Shield, Search, Calendar, User, FileText, Edit, Trash2,
  LogIn, LogOut, Download, Activity, Loader2, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import { useQuery } from '@tanstack/react-query';
import { reporteService } from '../../services/reporte.service';
import { downloadCsv } from '../reportes/tabs/shared';
import { useUsuarios } from '../../hooks/useUsuarios';

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

const accionConfig: Record<string, { color: string; icon: React.FC<{ size?: number }> }> = {
  LOGIN: { color: 'success', icon: LogIn },
  LOGOUT: { color: 'neutral', icon: LogOut },
  CREACION: { color: 'primary', icon: FileText },
  CREATE: { color: 'primary', icon: FileText },
  FIRMA: { color: 'primary', icon: FileText },
  UPDATE: { color: 'warning', icon: Edit },
  DELETE: { color: 'error', icon: Trash2 },
  EXPORT: { color: 'info', icon: Download },
  ENTREGA: { color: 'warning', icon: Activity },
  RECEPCION: { color: 'warning', icon: Activity },
  TRATAMIENTO: { color: 'warning', icon: Activity },
  CIERRE: { color: 'success', icon: Activity },
  INCIDENTE: { color: 'error', icon: Activity },
};

const ITEMS_PER_PAGE_OPTIONS = [
  { value: '25', label: '25 por página' },
  { value: '50', label: '50 por página' },
  { value: '100', label: '100 por página' },
  { value: '200', label: '200 por página' },
];

const ACCION_OPTIONS = [
  { value: '', label: 'Todas las acciones' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'CREACION', label: 'Creación' },
  { value: 'FIRMA', label: 'Firma' },
  { value: 'ENTREGA', label: 'Entrega' },
  { value: 'RECEPCION', label: 'Recepción' },
  { value: 'TRATAMIENTO', label: 'Tratamiento' },
  { value: 'CIERRE', label: 'Cierre' },
  { value: 'INCIDENTE', label: 'Incidente' },
];

const AuditoriaPage: React.FC = () => {
  // Filters state
  const [busqueda, setBusqueda] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch users for user filter dropdown
  const { data: usuariosData } = useUsuarios();
  const usuarioOptions = useMemo(() => {
    const users = (usuariosData as any)?.items || usuariosData || [];
    if (!Array.isArray(users)) return [{ value: '', label: 'Todos los usuarios' }];
    return [
      { value: '', label: 'Todos los usuarios' },
      ...users.map((u: any) => ({ value: u.id?.toString() || '', label: `${u.nombre || u.email} (${u.rol})` })),
    ];
  }, [usuariosData]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  // Server-side paginated query
  const { data: apiData, isLoading, isError } = useQuery({
    queryKey: ['reportes', 'auditoria', currentPage, itemsPerPage, filtroAccion, filtroUsuario, fechaDesde, fechaHasta, sortBy, sortOrder],
    queryFn: () => reporteService.auditoria({
      page: currentPage,
      limit: itemsPerPage,
      accion: filtroAccion || undefined,
      usuarioId: filtroUsuario || undefined,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      sortBy,
      sortOrder,
    } as any),
  });

  // Parse response
  const logsData: LogEntry[] = useMemo(() => {
    const raw = apiData?.datos || apiData?.eventos || [];
    if (!Array.isArray(raw)) return [];
    return raw.map((d: any, i: number) => ({
      id: d.id || i + 1,
      fecha: d.fecha || d.createdAt || '',
      usuario: d.usuario || d.usuarioNombre || '',
      rol: d.rol || 'SISTEMA',
      accion: d.accion || d.tipo || 'UPDATE',
      modulo: d.modulo || d.entidad || d.manifiestoNumero || '',
      detalle: d.detalle || d.descripcion || '',
      ip: d.ip || d.direccionIp || '',
    }));
  }, [apiData]);

  const pagination = (apiData as any)?.pagination;
  const totalItems = pagination?.total || logsData.length;
  const totalPages = pagination?.pages || Math.ceil(totalItems / itemsPerPage);

  // Client-side text search (on already-fetched page)
  const logsFiltrados = busqueda
    ? logsData.filter(log =>
        String(log.usuario).toLowerCase().includes(busqueda.toLowerCase()) ||
        String(log.detalle).toLowerCase().includes(busqueda.toLowerCase()) ||
        String(log.modulo).toLowerCase().includes(busqueda.toLowerCase()))
    : logsData;

  // Stats
  const stats = useMemo(() => {
    const resumen = (apiData as any)?.resumen;
    return {
      total: resumen?.total ?? totalItems,
      porTipo: resumen?.porTipo || {},
    };
  }, [apiData, totalItems]);

  const handleExportar = () => {
    if (logsFiltrados.length === 0) {
      toast.warning('Sin datos', 'No hay registros para exportar');
      return;
    }
    const headers = ['Fecha', 'Usuario', 'Rol', 'Accion', 'Modulo', 'Detalle', 'IP'];
    const rows = logsFiltrados.map(l => [l.fecha, l.usuario, l.rol, l.accion, l.modulo, l.detalle, l.ip]);
    downloadCsv(`auditoria_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    toast.success('Exportado', 'Registros descargados');
  };

  const setQuickDateRange = (days: number) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    setFechaDesde(start.toISOString().split('T')[0]);
    setFechaHasta(end.toISOString().split('T')[0]);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFiltroAccion('');
    setFiltroUsuario('');
    setFechaDesde('');
    setFechaHasta('');
    setBusqueda('');
    setCurrentPage(1);
  };

  const hasActiveFilters = filtroAccion || filtroUsuario || fechaDesde || fechaHasta;

  const formatFecha = (fecha: string) => {
    if (!fecha) return '—';
    try {
      return new Date(fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return fecha; }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-2 sm:p-3 bg-primary-100 rounded-xl">
            <Shield size={20} className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-neutral-900">Auditoría</h2>
            <p className="text-sm text-neutral-600">
              {isLoading ? <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Cargando...</span>
                : <>{stats.total.toLocaleString()} registros totales</>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" leftIcon={<Download size={16} />} onClick={handleExportar}>
            CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <Card><CardContent className="p-2.5 sm:p-3 text-center">
          <p className="text-xs text-neutral-500">Total</p>
          <p className="text-lg sm:text-xl font-bold text-neutral-900">{stats.total.toLocaleString()}</p>
        </CardContent></Card>
        {Object.entries(stats.porTipo).slice(0, 4).map(([tipo, count]) => {
          const cfg = accionConfig[tipo] || { color: 'neutral' };
          return (
            <Card key={tipo}><CardContent className="p-2.5 sm:p-3 text-center">
              <p className="text-xs text-neutral-500">{tipo}</p>
              <p className={`text-lg sm:text-xl font-bold text-${cfg.color}-700`}>{(count as number).toLocaleString()}</p>
            </CardContent></Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex-1">
              <Input placeholder="Buscar en resultados..." value={busqueda} onChange={e => setBusqueda(e.target.value)} leftIcon={<Search size={16} />} />
            </div>
            <div className="w-full sm:w-48">
              <Select value={filtroAccion} onChange={(val) => { setFiltroAccion(val); setCurrentPage(1); }} options={ACCION_OPTIONS} size="sm" placeholder="Acción" />
            </div>
            <div className="w-full sm:w-56">
              <Select value={filtroUsuario} onChange={(val) => { setFiltroUsuario(val); setCurrentPage(1); }} options={usuarioOptions} size="sm" placeholder="Usuario" searchable />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0 w-full sm:w-auto">
              <Calendar size={14} className="text-neutral-400 shrink-0" />
              <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setCurrentPage(1); }} className="text-sm border border-neutral-200 rounded-lg px-2 py-1.5 w-32 sm:w-36 min-w-0" />
              <span className="text-xs text-neutral-400">a</span>
              <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setCurrentPage(1); }} className="text-sm border border-neutral-200 rounded-lg px-2 py-1.5 w-32 sm:w-36 min-w-0" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setQuickDateRange(1)} className="text-xs px-2 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50">Hoy</button>
              <button onClick={() => setQuickDateRange(7)} className="text-xs px-2 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50">7 días</button>
              <button onClick={() => setQuickDateRange(30)} className="text-xs px-2 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50">30 días</button>
              <button onClick={() => setQuickDateRange(90)} className="text-xs px-2 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50">90 días</button>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs px-2 py-1 rounded-lg bg-error-50 text-error-600 border border-error-200 hover:bg-error-100">Limpiar</button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
        ) : logsFiltrados.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-sm">No se encontraron registros</div>
        ) : logsFiltrados.map((log) => {
          const cfg = accionConfig[log.accion] || { color: 'neutral', icon: Activity };
          const Icon = cfg.icon;
          return (
            <div key={log.id} className="bg-white rounded-xl border border-neutral-100 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-${cfg.color}-100 text-${cfg.color}-700`}>
                    <Icon size={10} /> {log.accion}
                  </div>
                  {log.modulo && <span className="text-[10px] text-neutral-400">{log.modulo}</span>}
                </div>
                <span className="text-[10px] text-neutral-400">{formatFecha(log.fecha)}</span>
              </div>
              <p className="text-sm text-neutral-900 truncate">{log.detalle || '—'}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <User size={10} className="text-neutral-400" />
                <span className="text-xs text-neutral-600">{log.usuario}</span>
                <Badge variant="outline" size="sm" className="text-[9px]">{log.rol}</Badge>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block" padding="none">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full table-fixed">
            <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0 z-10">
              <tr>
                {[
                  { key: 'createdAt', label: 'Fecha', w: '14%', sortable: true },
                  { key: 'usuario', label: 'Usuario', w: '18%', sortable: true },
                  { key: 'accion', label: 'Acción', w: '12%', sortable: true },
                  { key: 'modulo', label: 'Módulo', w: '12%', sortable: false, hide: 'hidden xl:table-cell' },
                  { key: 'detalle', label: 'Detalle', w: '30%', sortable: false },
                  { key: 'ip', label: 'IP', w: '14%', sortable: false, hide: 'hidden xl:table-cell' },
                ].map(col => (
                  <th key={col.key} className={`px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase ${col.hide || ''}`} style={{ width: col.w }}>
                    {col.sortable ? (
                      <button onClick={() => handleSort(col.key)} className="flex items-center gap-1 hover:text-primary-600 transition-colors">
                        {col.label}
                        {sortBy === col.key ? (sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={12} className="opacity-30" />}
                      </button>
                    ) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 size={24} className="animate-spin text-primary-500 mx-auto" /></td></tr>
              ) : logsFiltrados.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-neutral-500">No se encontraron registros</td></tr>
              ) : logsFiltrados.map((log) => {
                const cfg = accionConfig[log.accion] || { color: 'neutral', icon: Activity };
                const Icon = cfg.icon;
                return (
                  <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-3 py-2 text-xs text-neutral-600">{formatFecha(log.fecha)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-neutral-100 rounded-full flex items-center justify-center shrink-0">
                          <User size={12} className="text-neutral-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-neutral-900 text-sm truncate">{log.usuario}</p>
                          <Badge variant="outline" size="sm" className="text-[10px]">{log.rol}</Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${cfg.color}-100 text-${cfg.color}-700`}>
                        <Icon size={11} /> {log.accion}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-neutral-600 truncate hidden xl:table-cell">{log.modulo}</td>
                    <td className="px-3 py-2 text-sm text-neutral-900 truncate" title={log.detalle}>{log.detalle}</td>
                    <td className="px-3 py-2 text-xs text-neutral-500 font-mono hidden xl:table-cell">{log.ip}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3 text-neutral-600">
          <span>Pág. {currentPage}/{totalPages} — {totalItems.toLocaleString()} registros</span>
          <Select value={itemsPerPage.toString()} onChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }} options={ITEMS_PER_PAGE_OPTIONS} size="sm" isFullWidth={false} />
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-center max-w-full">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}>
            <ChevronLeft size={14} /><ChevronLeft size={14} className="-ml-2" />
          </Button>
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
            <ChevronLeft size={14} />
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
            const page = start + i;
            if (page > totalPages) return null;
            // On mobile, only show current page (hide 4 surrounding)
            const isCurrent = page === currentPage;
            return (
              <Button key={page} variant={isCurrent ? 'primary' : 'outline'} size="sm" onClick={() => setCurrentPage(page)} className={`min-w-[36px] ${isCurrent ? '' : 'hidden sm:inline-flex'}`}>
                {page}
              </Button>
            );
          })}
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
            <ChevronRight size={14} />
          </Button>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
            <ChevronRight size={14} /><ChevronRight size={14} className="-ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuditoriaPage;

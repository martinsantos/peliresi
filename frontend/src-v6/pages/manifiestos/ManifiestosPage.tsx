/**
 * SITREP v6 - Manifiestos Page
 * ============================
 * Listado de manifiestos con API real + fallback a mock
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, Search, Filter, Plus, Eye, Edit, Trash2, Loader2, AlertTriangle, ChevronDown, X, ArrowUpDown, ArrowUp, ArrowDown,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import { useManifiestos } from '../../hooks/useManifiestos';
import { manifiestoService } from '../../services/manifiesto.service';
import { EstadoManifiesto } from '../../types/models';
import { ESTADO_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/formatters';


const estadoBadgeColor: Record<string, string> = {
  BORRADOR: 'neutral',
  PENDIENTE_APROBACION: 'warning',
  APROBADO: 'success',
  EN_TRANSITO: 'info',
  ENTREGADO: 'secondary',
  RECIBIDO: 'warning',
  EN_TRATAMIENTO: 'info',
  TRATADO: 'primary',
  RECHAZADO: 'error',
  CANCELADO: 'neutral',
};

const ManifiestosPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [estadoFilter, setEstadoFilter] = useState(searchParams.get('estado') || '');
  const [fechaDesde, setFechaDesde] = useState(searchParams.get('fechaDesde') || '');
  const [fechaHasta, setFechaHasta] = useState(searchParams.get('fechaHasta') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; numero: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<'createdAt' | 'numero' | 'estado'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (col: 'createdAt' | 'numero' | 'estado') => {
    if (sortBy === col) {
      setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const filterCount = [fechaDesde, fechaHasta, estadoFilter].filter(Boolean).length;

  const { data: apiData, isLoading, isError, refetch } = useManifiestos({
    search: searchTerm || undefined,
    estado: (estadoFilter || undefined) as EstadoManifiesto | undefined,
    fechaDesde: fechaDesde || undefined,
    fechaHasta: fechaHasta || undefined,
    page,
    limit: 20,
    sortBy,
    sortOrder,
  });

  // Use API data only - no mock fallback
  const manifiestos = useMemo(() => {
    if (apiData?.items && Array.isArray(apiData.items)) {
      return apiData.items.map((m: any) => ({
        id: m.id,
        numero: m.numero,
        generadorNombre: m.generador?.razonSocial || 'Sin generador',
        estado: m.estado,
        fecha: m.createdAt,
        peso: Array.isArray(m.residuos) ? m.residuos.reduce((acc: number, r: any) => acc + (typeof r.cantidad === 'number' ? r.cantidad : 0), 0) : 0,
        unidad: Array.isArray(m.residuos) && m.residuos.length > 0 ? m.residuos[0]?.unidad || 'kg' : 'kg',
        blockchainStatus: m.blockchainStatus || null,
      }));
    }
    return [];
  }, [apiData]);

  const total = apiData?.total || manifiestos.length;
  const totalPages = apiData?.totalPages || 1;
  const isMobile = window.location.pathname.startsWith('/mobile');

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await manifiestoService.delete(deleteTarget.id);
      toast.success('Manifiesto eliminado', `El manifiesto ${deleteTarget.numero} fue eliminado exitosamente`);
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast.error('Error al eliminar', err?.response?.data?.message || 'No se pudo eliminar el manifiesto');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Manifiestos</h2>
            <p className="text-neutral-600 mt-1">
              Gestiona los manifiestos de residuos peligrosos
            </p>
          </div>
          <Button
            leftIcon={<Plus size={18} />}
            onClick={() => navigate(isMobile ? '/mobile/manifiestos/nuevo' : '/manifiestos/nuevo')}
            className="hover-glow"
          >
            Nuevo Manifiesto
          </Button>
        </div>
      </div>

      {/* Filters — sticky */}
      <div className="sticky top-0 z-20 bg-[#FAFAF8] -mx-4 lg:-mx-8 px-4 lg:px-8 pt-2 pb-2">
      <Card padding="base">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Buscar por número o generador..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              leftIcon={<Search size={18} />}
            />
          </div>
          <div className="flex gap-2 items-center">
            <div className="w-full md:w-48">
              <Select
                value={estadoFilter}
                onChange={(val) => { setEstadoFilter(val); setPage(1); }}
                options={[
                  { value: '', label: 'Todos los estados' },
                  ...Object.values(EstadoManifiesto).map((e) => ({
                    value: e,
                    label: ESTADO_LABELS[e] || e,
                  })),
                ]}
                placeholder="Filtrar estado..."
                size="sm"
                clearable
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors
                ${showFilters || filterCount > 0
                  ? 'bg-primary-50 text-primary-700 border-primary-200'
                  : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-300'
                }`}
            >
              <Filter size={15} />
              Fechas
              {filterCount > 0 && (
                <span className="bg-primary-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {filterCount}
                </span>
              )}
              <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Expandible date filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-500">Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => { setFechaDesde(e.target.value); setPage(1); }}
                className="text-sm border border-neutral-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-500">Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => { setFechaHasta(e.target.value); setPage(1); }}
                className="text-sm border border-neutral-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
            {(fechaDesde || fechaHasta) && (
              <button
                onClick={() => { setFechaDesde(''); setFechaHasta(''); setPage(1); }}
                className="flex items-center gap-1 text-xs text-neutral-500 hover:text-error-600 px-2 py-2"
              >
                <X size={13} />
                Limpiar fechas
              </button>
            )}
          </div>
        )}
      </Card>
      </div>

      <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      )}

      {/* Table */}
      {!isLoading && (
        <Card padding="none" className="max-h-[70vh] overflow-auto">
          <table className="w-full table-fixed">
              <thead className="bg-[#F5F5F3] border-b border-neutral-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider" style={{ width: "20%" }}>
                    <button onClick={() => handleSort('numero')} className="flex items-center gap-1 hover:text-primary-600 transition-colors">
                      Manifiesto
                      {sortBy === 'numero' ? (sortOrder === 'desc' ? <ArrowDown size={13} /> : <ArrowUp size={13} />) : <ArrowUpDown size={13} className="opacity-40" />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider" style={{ width: "25%" }}>Generador</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider" style={{ width: "15%" }}>
                    <button onClick={() => handleSort('estado')} className="flex items-center gap-1 hover:text-primary-600 transition-colors">
                      Estado
                      {sortBy === 'estado' ? (sortOrder === 'desc' ? <ArrowDown size={13} /> : <ArrowUp size={13} />) : <ArrowUpDown size={13} className="opacity-40" />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden md:table-cell" style={{ width: "15%" }}>
                    <button onClick={() => handleSort('createdAt')} className="flex items-center gap-1 hover:text-primary-600 transition-colors">
                      Fecha
                      {sortBy === 'createdAt' ? (sortOrder === 'desc' ? <ArrowDown size={13} /> : <ArrowUp size={13} />) : <ArrowUpDown size={13} className="opacity-40" />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden md:table-cell" style={{ width: "10%" }}>Peso</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wider" style={{ width: "15%" }}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {manifiestos.map((m, idx) => (
                  <tr
                    key={m.id}
                    className="table-row-hover cursor-pointer group"
                    style={{ animationDelay: `${idx * 30}ms` }}
                    onClick={() => navigate(isMobile ? `/mobile/manifiestos/${m.id}` : `/manifiestos/${m.id}`)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 group-hover:bg-primary-100 transition-colors">
                          <FileText size={18} />
                        </div>
                        <span className="font-mono font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                          {m.numero}
                        </span>
                        {m.blockchainStatus === 'CONFIRMADO' && (
                          <span title="Verificado en blockchain" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-semibold border border-emerald-200 shrink-0">
                            <ShieldCheck size={12} /> BC
                          </span>
                        )}
                        {m.blockchainStatus === 'PENDIENTE' && (
                          <span title="Registro blockchain pendiente" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-semibold border border-amber-200 animate-pulse shrink-0">
                            <ShieldCheck size={12} /> BC
                          </span>
                        )}
                        {m.blockchainStatus === 'ERROR' && (
                          <span title="Error en registro blockchain" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-semibold border border-red-200 shrink-0">
                            <ShieldCheck size={12} /> BC
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-700 truncate" title={m.generadorNombre}>{m.generadorNombre}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="soft" color={estadoBadgeColor[m.estado] || 'neutral'}>
                        {ESTADO_LABELS[m.estado as EstadoManifiesto] || m.estado}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-600 hidden md:table-cell">{formatDate(m.fecha)}</td>
                    <td className="px-3 py-2.5 text-neutral-700 font-medium hidden md:table-cell">
                      {typeof m.peso === 'number' ? m.peso.toLocaleString('es-AR') : '0'} {m.unidad}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="p-2" onClick={(e) => { e.stopPropagation(); navigate(isMobile ? `/mobile/manifiestos/${m.id}` : `/manifiestos/${m.id}`); }}>
                          <Eye size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" className="p-2" onClick={(e) => { e.stopPropagation(); navigate(isMobile ? `/mobile/manifiestos/${m.id}/editar` : `/manifiestos/${m.id}/editar`); }}>
                          <Edit size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" className="p-2 text-error-500 hover:text-error-600" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: m.id, numero: m.numero }); }}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

          {/* Empty state */}
          {manifiestos.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-neutral-300 mb-4" />
              <p className="text-neutral-500 font-medium">No se encontraron manifiestos</p>
              <p className="text-sm text-neutral-400 mt-1">Prueba con otros filtros de búsqueda</p>
            </div>
          )}

          {/* Pagination */}
          <div className="px-3 py-2.5 border-t border-neutral-200 flex items-center justify-between">
            <p className="text-sm text-neutral-600">
              Mostrando <span className="font-medium">{manifiestos.length}</span> de <span className="font-medium">{total}</span> manifiestos
              {isError && <span className="text-warning-600 ml-2">(datos locales)</span>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-error-50 rounded-full flex items-center justify-center">
                <AlertTriangle size={20} className="text-error-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Eliminar Manifiesto</h3>
                <p className="text-sm text-neutral-500">Esta accion no se puede deshacer</p>
              </div>
            </div>
            <p className="text-neutral-700 mb-6">
              Estas seguro de que deseas eliminar el manifiesto <span className="font-mono font-semibold">{deleteTarget.numero}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default ManifiestosPage;

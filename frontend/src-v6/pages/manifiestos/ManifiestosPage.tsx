/**
 * SITREP v6 - Manifiestos Page
 * ============================
 * Listado de manifiestos con API real + fallback a mock
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Search, Filter, Plus, Eye, Edit, Trash2, Loader2, AlertTriangle,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; numero: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: apiData, isLoading, isError, refetch } = useManifiestos({
    search: searchTerm || undefined,
    estado: (estadoFilter || undefined) as EstadoManifiesto | undefined,
    page,
    limit: 20,
  });

  // Use API data only - no mock fallback
  const manifiestos = useMemo(() => {
    if (apiData?.items && Array.isArray(apiData.items)) {
      return apiData.items.map((m: any) => ({
        id: m.id,
        numero: m.numero,
        generadorNombre: m.generador?.razonSocial || 'Sin generador',
        estado: m.estado,
        fecha: m.fechaCreacion,
        peso: Array.isArray(m.residuos) ? m.residuos.reduce((acc: number, r: any) => acc + (typeof r.cantidad === 'number' ? r.cantidad : 0), 0) : 0,
        unidad: Array.isArray(m.residuos) && m.residuos.length > 0 ? m.residuos[0]?.unidad || 'kg' : 'kg',
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
    <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
      {/* Header */}
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

      {/* Filters */}
      <Card padding="base">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por número o generador..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              leftIcon={<Search size={18} />}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={estadoFilter}
              onChange={(e) => { setEstadoFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none transition-colors input-polished"
            >
              <option value="">Todos los estados</option>
              {Object.values(EstadoManifiesto).map((e) => (
                <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
              ))}
            </select>
            <Button variant="outline" leftIcon={<Filter size={18} />}>
              Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      )}

      {/* Table */}
      {!isLoading && (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[600px]">
              <thead className="bg-[#F5F5F3] border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider" style={{ width: "20%" }}>Manifiesto</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider" style={{ width: "25%" }}>Generador</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider" style={{ width: "15%" }}>Estado</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden md:table-cell" style={{ width: "15%" }}>Fecha</th>
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
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-700 truncate">{m.generadorNombre}</td>
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
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
  );
};

export default ManifiestosPage;

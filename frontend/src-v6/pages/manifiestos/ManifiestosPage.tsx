/**
 * SITREP v6 - Manifiestos Page
 * ============================
 * Listado de manifiestos con API real + fallback a mock
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Search, Filter, Plus, Eye, Edit, Trash2, Loader2,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
import { useManifiestos } from '../../hooks/useManifiestos';
import { EstadoManifiesto } from '../../types/models';
import { ESTADO_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/formatters';

// Fallback mock data for when API is unavailable
const MOCK_DATA = [
  { id: 'mock-1', numero: 'M-2025-089', generador: { razonSocial: 'Química Mendoza S.A.' }, estado: 'EN_TRANSITO' as EstadoManifiesto, fechaCreacion: '2025-01-31', residuos: [{ cantidad: 2450, unidad: 'kg' }] },
  { id: 'mock-2', numero: 'M-2025-088', generador: { razonSocial: 'Industrias del Sur' }, estado: 'APROBADO' as EstadoManifiesto, fechaCreacion: '2025-01-31', residuos: [{ cantidad: 1800, unidad: 'kg' }] },
  { id: 'mock-3', numero: 'M-2025-087', generador: { razonSocial: 'Metalúrgica Argentina' }, estado: 'TRATADO' as EstadoManifiesto, fechaCreacion: '2025-01-30', residuos: [{ cantidad: 3200, unidad: 'kg' }] },
  { id: 'mock-4', numero: 'M-2025-086', generador: { razonSocial: 'Plásticos Argentinos' }, estado: 'BORRADOR' as EstadoManifiesto, fechaCreacion: '2025-01-30', residuos: [{ cantidad: 950, unidad: 'kg' }] },
  { id: 'mock-5', numero: 'M-2025-085', generador: { razonSocial: 'Textil Cuyo' }, estado: 'ENTREGADO' as EstadoManifiesto, fechaCreacion: '2025-01-29', residuos: [{ cantidad: 1500, unidad: 'kg' }] },
  { id: 'mock-6', numero: 'M-2025-084', generador: { razonSocial: 'Química Mendoza S.A.' }, estado: 'RECIBIDO' as EstadoManifiesto, fechaCreacion: '2025-01-29', residuos: [{ cantidad: 2100, unidad: 'kg' }] },
];

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

  const { data: apiData, isLoading, isError } = useManifiestos({
    search: searchTerm || undefined,
    estado: (estadoFilter || undefined) as EstadoManifiesto | undefined,
    page,
    limit: 20,
  });

  // Use API data if available, otherwise use mock
  const manifiestos = useMemo(() => {
    if (apiData?.items) {
      return apiData.items.map((m: any) => ({
        id: m.id,
        numero: m.numero,
        generadorNombre: m.generador?.razonSocial || 'Sin generador',
        estado: m.estado,
        fecha: m.fechaCreacion,
        peso: m.residuos?.reduce((acc: number, r: any) => acc + (r.cantidad || 0), 0) || 0,
        unidad: m.residuos?.[0]?.unidad || 'kg',
      }));
    }
    // Fallback to mock
    return MOCK_DATA
      .filter((m) => {
        const matchSearch = !searchTerm || m.numero.toLowerCase().includes(searchTerm.toLowerCase()) || m.generador.razonSocial.toLowerCase().includes(searchTerm.toLowerCase());
        const matchEstado = !estadoFilter || m.estado === estadoFilter;
        return matchSearch && matchEstado;
      })
      .map((m) => ({
        id: m.id,
        numero: m.numero,
        generadorNombre: m.generador.razonSocial,
        estado: m.estado,
        fecha: m.fechaCreacion,
        peso: m.residuos.reduce((acc, r) => acc + r.cantidad, 0),
        unidad: m.residuos[0]?.unidad || 'kg',
      }));
  }, [apiData, searchTerm, estadoFilter]);

  const total = apiData?.total || manifiestos.length;
  const totalPages = apiData?.totalPages || 1;
  const isMobile = window.location.pathname.startsWith('/mobile');

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
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F5F5F3] border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Manifiesto</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Generador</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Peso</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wider">Acciones</th>
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
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 group-hover:bg-primary-100 transition-colors">
                          <FileText size={18} />
                        </div>
                        <span className="font-mono font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                          {m.numero}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-neutral-700">{m.generadorNombre}</td>
                    <td className="px-6 py-4">
                      <Badge variant="soft" color={estadoBadgeColor[m.estado] || 'neutral'}>
                        {ESTADO_LABELS[m.estado as EstadoManifiesto] || m.estado}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-neutral-600">{formatDate(m.fecha)}</td>
                    <td className="px-6 py-4 text-neutral-700 font-medium">
                      {m.peso.toLocaleString('es-AR')} {m.unidad}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="p-2" onClick={(e) => e.stopPropagation()}>
                          <Eye size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" className="p-2" onClick={(e) => e.stopPropagation()}>
                          <Edit size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" className="p-2 text-error-500 hover:text-error-600" onClick={(e) => e.stopPropagation()}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {manifiestos.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-neutral-300 mb-4" />
              <p className="text-neutral-500 font-medium">No se encontraron manifiestos</p>
              <p className="text-sm text-neutral-400 mt-1">Prueba con otros filtros de búsqueda</p>
            </div>
          )}

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-between">
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
    </div>
  );
};

export default ManifiestosPage;

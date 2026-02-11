/**
 * SITREP v6 - Admin Residuos Page
 * ================================
 * Catálogo de residuos con enriquecimiento de corrientes Y y operadores
 */

import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  AlertTriangle,
  Leaf,
  Beaker,
  Download,
  Loader2,
  Flame,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Table, Pagination } from '../../components/ui/Table';
import { SearchInput } from '../../components/ui/SearchInput';
import { useTiposResiduo } from '../../hooks/useCatalogos';
import { toast } from '../../components/ui/Toast';
import { downloadCsv } from '../../utils/exportCsv';
import { CORRIENTES_Y, CORRIENTES_Y_CODES } from '../../data/corrientes-y';
import { OPERADORES_POR_CORRIENTE, OPERADORES_DATA } from '../../data/operadores-enrichment';

interface ResiduoDisplay {
  id: string;
  codigo: string;
  descripcion: string;
  categoria: string;
  tipo: string;
  peligrosidad: string;
  activo: boolean;
  corrienteY: string | null;
  corrienteDesc: string | null;
  operadoresCount: number;
  tecnologias: string[];
}

export const AdminResiduosPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [corrienteFilter, setCorrienteFilter] = useState('');
  const [peligrosidadFilter, setPeligrosidadFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');

  const { data: tiposResiduoRaw, isLoading, isError, error } = useTiposResiduo();
  const tiposResiduo = tiposResiduoRaw || [];

  // Map API data + enrich with corrientes Y and operadores
  const residuosData: ResiduoDisplay[] = useMemo(() =>
    tiposResiduo.map(r => {
      // Try to match categoría with a Y-code
      const cat = r.categoria || '';
      const yMatch = cat.match(/Y\d+/);
      const corrienteY = yMatch ? yMatch[0] : null;
      const corrienteDesc = corrienteY ? CORRIENTES_Y[corrienteY] || null : null;

      // How many operadores handle this corriente
      const operadoresCuits = corrienteY ? (OPERADORES_POR_CORRIENTE[corrienteY] || []) : [];
      const operadoresCount = operadoresCuits.length;

      // Collect unique tecnologías from those operadores
      const tecnologias: string[] = [];
      const tecSet = new Set<string>();
      for (const cuit of operadoresCuits.slice(0, 10)) {
        const op = OPERADORES_DATA[cuit];
        if (op?.tecnologia) {
          const parts = op.tecnologia.split(/,\s*(?=[A-Z])/).map(t => t.trim());
          for (const p of parts) {
            const clean = p.replace(/:\s*Y\d+[^,]*/g, '').trim();
            if (clean.length > 5 && !tecSet.has(clean)) {
              tecSet.add(clean);
              tecnologias.push(clean);
            }
          }
        }
      }

      return {
        id: r.id,
        codigo: r.codigo,
        descripcion: r.descripcion || r.nombre,
        categoria: r.categoria || 'Sin categoría',
        tipo: r.peligrosidad === 'alta' || r.peligrosidad === 'media' ? 'Peligroso' : 'No Peligroso',
        peligrosidad: r.peligrosidad || 'ninguna',
        activo: r.activo,
        corrienteY,
        corrienteDesc,
        operadoresCount,
        tecnologias: tecnologias.slice(0, 5),
      };
    }),
    [tiposResiduo]
  );

  // Stats
  const statsPeligrosos = residuosData.filter(r => r.tipo === 'Peligroso').length;
  const statsNoPeligrosos = residuosData.filter(r => r.tipo === 'No Peligroso').length;
  const statsTotal = residuosData.length;
  const corrientesActivas = useMemo(() => {
    const codes = new Set(residuosData.map(r => r.corrienteY).filter(Boolean));
    return codes.size;
  }, [residuosData]);

  // Filter
  const filteredData = residuosData.filter(r => {
    if (corrienteFilter && r.corrienteY !== corrienteFilter) return false;
    if (peligrosidadFilter && r.peligrosidad !== peligrosidadFilter) return false;
    if (estadoFilter === 'activo' && !r.activo) return false;
    if (estadoFilter === 'inactivo' && r.activo) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.codigo.toLowerCase().includes(q) ||
      r.descripcion.toLowerCase().includes(q) ||
      r.categoria.toLowerCase().includes(q) ||
      (r.corrienteY || '').toLowerCase().includes(q)
    );
  });

  // Pagination
  const itemsPerPage = 15;
  const totalFilteredPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExport = () => {
    downloadCsv(
      filteredData.map(r => ({
        Código: r.codigo,
        Descripción: r.descripcion,
        Categoría: r.categoria,
        'Corriente Y': r.corrienteY || '',
        'Desc. Corriente': r.corrienteDesc || '',
        Tipo: r.tipo,
        Peligrosidad: r.peligrosidad,
        'Operadores Autorizados': r.operadoresCount,
        Tecnologías: r.tecnologias.join('; '),
        Estado: r.activo ? 'Activo' : 'Inactivo',
      })),
      'catalogo-residuos'
    );
    toast.success('Exportar', 'CSV descargado');
  };

  const columns = [
    {
      key: 'residuo',
      width: '28%',
      header: 'Residuo',
      render: (row: ResiduoDisplay) => (
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            row.peligrosidad === 'alta' ? 'bg-error-100' :
            row.peligrosidad === 'media' ? 'bg-warning-100' :
            'bg-success-100'
          }`}>
            {row.peligrosidad === 'alta' ? (
              <AlertTriangle size={20} className="text-error-600" />
            ) : row.peligrosidad === 'media' ? (
              <Beaker size={20} className="text-warning-600" />
            ) : (
              <Leaf size={20} className="text-success-600" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-neutral-900">{row.codigo}</p>
            <p className="text-xs text-neutral-500 line-clamp-1 max-w-[220px]">{row.descripcion}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'corrienteY',
      width: '8%',
      header: 'Corriente Y',
      hiddenBelow: 'md' as const,
      render: (row: ResiduoDisplay) => row.corrienteY ? (
        <Badge variant="outline" color="warning" title={row.corrienteDesc || ''}>
          {row.corrienteY}
        </Badge>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'peligrosidad',
      width: '10%',
      header: 'Peligrosidad',
      render: (row: ResiduoDisplay) => {
        const colors: Record<string, string> = {
          alta: 'error',
          media: 'warning',
          baja: 'info',
          ninguna: 'success',
        };
        return (
          <Badge variant="soft" color={colors[row.peligrosidad] as any}>
            {row.peligrosidad.charAt(0).toUpperCase() + row.peligrosidad.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: 'operadores',
      width: '12%',
      header: 'Operadores',
      hiddenBelow: 'lg' as const,
      render: (row: ResiduoDisplay) => row.operadoresCount > 0 ? (
        <div className="flex items-center gap-1.5">
          <FlaskConical size={14} className="text-blue-500" />
          <span className="text-sm font-medium text-neutral-700">{row.operadoresCount}</span>
          <span className="text-xs text-neutral-400">autorizados</span>
        </div>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'tecnologias',
      width: '20%',
      header: 'Tecnologías',
      hiddenBelow: 'lg' as const,
      render: (row: ResiduoDisplay) => row.tecnologias.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {row.tecnologias.slice(0, 2).map((t, i) => (
            <span key={i} className="text-xs text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full truncate max-w-[140px]" title={t}>
              {t.length > 30 ? t.substring(0, 28) + '...' : t}
            </span>
          ))}
          {row.tecnologias.length > 2 && (
            <span className="text-xs text-neutral-400" title={row.tecnologias.join(', ')}>
              +{row.tecnologias.length - 2}
            </span>
          )}
        </div>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'estado',
      width: '8%',
      header: 'Estado',
      render: (row: ResiduoDisplay) => (
        <Badge variant="soft" color={row.activo ? 'success' : 'neutral'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-100 rounded-xl">
            <FlaskConical size={24} className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Catálogo de Residuos</h2>
            <p className="text-neutral-600">Tipos de residuos, corrientes Y y operadores autorizados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={18} />} onClick={handleExport}>
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-100 rounded-lg">
                <FlaskConical size={20} className="text-info-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{statsTotal}</p>
                <p className="text-sm text-neutral-600">Total Tipos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-error-100 rounded-lg">
                <AlertTriangle size={20} className="text-error-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{statsPeligrosos}</p>
                <p className="text-sm text-neutral-600">Peligrosos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-100 rounded-lg">
                <Leaf size={20} className="text-success-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{statsNoPeligrosos}</p>
                <p className="text-sm text-neutral-600">No Peligrosos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning-100 rounded-lg">
                <Flame size={20} className="text-warning-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{corrientesActivas}</p>
                <p className="text-sm text-neutral-600">Corrientes Y activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={searchQuery}
                onChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
                placeholder="Buscar por código, descripción o corriente Y..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={corrienteFilter}
                onChange={(e) => { setCorrienteFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Todas las corrientes</option>
                {CORRIENTES_Y_CODES.map(code => (
                  <option key={code} value={code}>{code} — {CORRIENTES_Y[code].substring(0, 40)}</option>
                ))}
              </select>
              <select
                value={peligrosidadFilter}
                onChange={(e) => { setPeligrosidadFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Todas las peligrosidades</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
                <option value="ninguna">Ninguna</option>
              </select>
              <select
                value={estadoFilter}
                onChange={(e) => { setEstadoFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>
          {(corrienteFilter || peligrosidadFilter || estadoFilter) && (
            <div className="flex items-center gap-2 mt-3 p-2 bg-primary-50 rounded-lg">
              <span className="text-sm text-primary-700">Filtros:</span>
              {corrienteFilter && (
                <Badge variant="solid" color="primary">
                  {corrienteFilter}
                  <button className="ml-1.5" onClick={() => { setCorrienteFilter(''); setCurrentPage(1); }}>&times;</button>
                </Badge>
              )}
              {peligrosidadFilter && (
                <Badge variant="solid" color="primary">
                  {peligrosidadFilter}
                  <button className="ml-1.5" onClick={() => { setPeligrosidadFilter(''); setCurrentPage(1); }}>&times;</button>
                </Badge>
              )}
              {estadoFilter && (
                <Badge variant="solid" color="primary">
                  {estadoFilter}
                  <button className="ml-1.5" onClick={() => { setEstadoFilter(''); setCurrentPage(1); }}>&times;</button>
                </Badge>
              )}
              <button
                className="ml-auto text-sm text-primary-600 hover:text-primary-800 font-medium"
                onClick={() => { setCorrienteFilter(''); setPeligrosidadFilter(''); setEstadoFilter(''); setCurrentPage(1); }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-primary-500" />
            <span className="ml-3 text-neutral-600">Cargando residuos...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 text-error-600">
            <span>Error al cargar datos: {(error as Error)?.message || 'Error desconocido'}</span>
          </div>
        ) : (
          <>
            <Table
              data={paginatedData}
              columns={columns}
              keyExtractor={(row) => row.id}
              stickyHeader
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalFilteredPages}
              totalItems={filteredData.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

    </div>
  );
};

export default AdminResiduosPage;

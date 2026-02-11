/**
 * SITREP v6 - Admin Tratamientos Page
 * ====================================
 * Catálogo clasificado de todos los tratamientos de residuos peligrosos.
 * 10 categorías, 47 métodos, interlinkeo con operadores y corrientes Y.
 * Patrón admin: Header + Stats + Filtros + Table + Pagination
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOperadores } from '../../hooks/useActores';
import {
  Search,
  Download,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Info,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
import { Table, Pagination } from '../../components/ui/Table';
import { downloadCsv } from '../../utils/exportCsv';
import { CORRIENTES_Y } from '../../data/corrientes-y';
import {
  CATEGORIAS_TRATAMIENTO,
  CATEGORIAS_POR_ID,
  TODOS_LOS_METODOS,
  STATS_TRATAMIENTOS,
  getRiesgoMetodo,
  getOperadorEnriched,
  type CategoriaId,
  type MetodoTratamiento,
} from '../../data/tratamientos-catalogo';

// ---------------------------------------------------------------------------
// Risk config
// ---------------------------------------------------------------------------

const RIESGO_CONFIG = {
  critico: { label: 'Crítico', color: 'error' as const, icon: <AlertCircle size={12} /> },
  alto: { label: 'Alto', color: 'warning' as const, icon: <AlertTriangle size={12} /> },
  medio: { label: 'Medio', color: 'info' as const, icon: <Info size={12} /> },
  bajo: { label: 'Bajo', color: 'success' as const, icon: <CheckCircle2 size={12} /> },
};

const CAT_COLORS: Record<string, string> = {
  biologico: 'bg-green-50 text-green-700',
  fisicoquimico: 'bg-blue-50 text-blue-700',
  termico: 'bg-red-50 text-red-700',
  extraccion_vapores: 'bg-cyan-50 text-cyan-700',
  extraccion_liquidos: 'bg-indigo-50 text-indigo-700',
  remediacion: 'bg-amber-50 text-amber-700',
  asbesto: 'bg-orange-50 text-orange-700',
  almacenamiento: 'bg-slate-50 text-slate-700',
  reciclaje: 'bg-teal-50 text-teal-700',
  industrial: 'bg-purple-50 text-purple-700',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AdminTratamientosPage: React.FC = () => {
  const navigate = useNavigate();

  // Fetch all operadores to resolve CUIT → DB ID for direct navigation
  const { data: operadoresApi } = useOperadores({ limit: 500 });
  const cuitToId = useMemo(() => {
    const map: Record<string, string> = {};
    const items = Array.isArray(operadoresApi?.items) ? operadoresApi.items : [];
    for (const o of items) if (o.cuit) map[o.cuit] = o.id;
    return map;
  }, [operadoresApi]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaId | ''>('');
  const [filtroRiesgo, setFiltroRiesgo] = useState('');
  const [filtroCorriente, setFiltroCorriente] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const itemsPerPage = 15;

  // ---- Filter ----
  const metodosFiltrados = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    return TODOS_LOS_METODOS.filter(m => {
      if (filtroCategoria) {
        const cat = CATEGORIAS_TRATAMIENTO.find(c => c.metodos.includes(m));
        if (cat?.id !== filtroCategoria) return false;
      }
      if (search) {
        const catName = CATEGORIAS_TRATAMIENTO.find(c => c.metodos.includes(m))?.nombre || '';
        const haystack = `${m.nombre} ${m.nombreCorto} ${m.descripcion} ${catName}`.toLowerCase();
        const operadorMatch = m.operadores.some(o => {
          const enr = getOperadorEnriched(o.cuit);
          return enr && enr.empresa.toLowerCase().includes(search);
        });
        if (!haystack.includes(search) && !operadorMatch) return false;
      }
      if (filtroRiesgo && getRiesgoMetodo(m) !== filtroRiesgo) return false;
      if (filtroCorriente && !m.corrientesY.includes(filtroCorriente)) return false;
      return true;
    });
  }, [searchTerm, filtroCategoria, filtroRiesgo, filtroCorriente]);

  const totalPages = Math.ceil(metodosFiltrados.length / itemsPerPage);
  const paginados = metodosFiltrados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // ---- Unique corrientes ----
  const corrientesUnicas = useMemo(() => {
    const set = new Set<string>();
    for (const m of TODOS_LOS_METODOS) for (const y of m.corrientesY) set.add(y);
    return Array.from(set).sort((a, b) => parseInt(a.replace('Y', '')) - parseInt(b.replace('Y', '')));
  }, []);

  // ---- Export ----
  const handleExport = () => {
    const rows = metodosFiltrados.map(m => {
      const cat = CATEGORIAS_TRATAMIENTO.find(c => c.metodos.includes(m));
      return {
        Categoría: cat?.nombre || '',
        Método: m.nombre,
        Descripción: m.descripcion,
        'Corrientes Y': m.corrientesY.join(', '),
        'Cant. Operadores': m.operadores.length,
        Operadores: m.operadores.map(o => {
          const enr = getOperadorEnriched(o.cuit);
          return enr ? `${enr.empresa} (${o.tipo})` : o.cuit;
        }).join('; '),
        Riesgo: getRiesgoMetodo(m),
      };
    });
    downloadCsv(rows, 'catalogo-tratamientos');
  };

  // ---- Get category for a method ----
  const getCatForMetodo = (m: MetodoTratamiento) =>
    CATEGORIAS_TRATAMIENTO.find(c => c.metodos.includes(m));

  // ---- Table columns ----
  const columns = [
    {
      key: 'metodo',
      header: 'Método de Tratamiento',
      width: '30%',
      render: (m: MetodoTratamiento) => {
        const cat = getCatForMetodo(m);
        const isExpanded = expandedRow === m.id;
        return (
          <div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); setExpandedRow(isExpanded ? null : m.id); }} className="shrink-0">
                {isExpanded ? <ChevronDown size={14} className="text-neutral-400" /> : <ChevronRight size={14} className="text-neutral-400" />}
              </button>
              <div className="min-w-0">
                <p className="font-semibold text-neutral-900 truncate">{m.nombre}</p>
                {cat && (
                  <span className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded mt-0.5 ${CAT_COLORS[cat.id] || 'bg-neutral-50 text-neutral-700'}`}>
                    {cat.nombre}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'riesgo',
      header: 'Riesgo',
      width: '10%',
      render: (m: MetodoTratamiento) => {
        const r = getRiesgoMetodo(m);
        const rc = RIESGO_CONFIG[r];
        return (
          <Badge variant="soft" color={rc.color}>
            <span className="flex items-center gap-1">{rc.icon} {rc.label}</span>
          </Badge>
        );
      },
    },
    {
      key: 'operadores',
      header: 'Operadores',
      width: '10%',
      render: (m: MetodoTratamiento) => {
        const fijo = m.operadores.filter(o => o.tipo === 'FIJO' || o.tipo === 'AMBOS').length;
        const inSitu = m.operadores.filter(o => o.tipo === 'IN SITU' || o.tipo === 'AMBOS').length;
        return (
          <div className="text-center">
            <p className="text-lg font-bold text-neutral-900">{m.operadores.length}</p>
            <div className="flex items-center justify-center gap-1 text-[10px] text-neutral-500">
              {fijo > 0 && <span>{fijo}F</span>}
              {fijo > 0 && inSitu > 0 && <span>/</span>}
              {inSitu > 0 && <span>{inSitu}IS</span>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'corrientes',
      header: 'Corrientes Y',
      width: '25%',
      hiddenBelow: 'md' as const,
      render: (m: MetodoTratamiento) => (
        <div className="flex flex-wrap gap-1">
          {m.corrientesY.slice(0, 6).map(y => (
            <span key={y} className="inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-neutral-100 text-neutral-700">
              {y}
            </span>
          ))}
          {m.corrientesY.length > 6 && (
            <span className="text-[10px] text-neutral-400 font-medium self-center">+{m.corrientesY.length - 6}</span>
          )}
        </div>
      ),
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      width: '25%',
      hiddenBelow: 'lg' as const,
      render: (m: MetodoTratamiento) => (
        <p className="text-xs text-neutral-500 line-clamp-2">{m.descripcion}</p>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="text-primary-600" size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Catálogo de Tratamientos</h2>
            <p className="text-neutral-500 text-sm mt-0.5">
              {STATS_TRATAMIENTOS.totalMetodos} métodos en {STATS_TRATAMIENTOS.totalCategorias} categorías — {STATS_TRATAMIENTOS.totalOperadores} operadores
            </p>
          </div>
        </div>
        <Button variant="outline" leftIcon={<Download size={16} />} onClick={handleExport}>
          Exportar CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <Card className="p-3">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Métodos</p>
          <p className="text-2xl font-bold text-neutral-900">{STATS_TRATAMIENTOS.totalMetodos}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Categorías</p>
          <p className="text-2xl font-bold text-neutral-900">{STATS_TRATAMIENTOS.totalCategorias}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Operadores</p>
          <p className="text-2xl font-bold text-neutral-900">{STATS_TRATAMIENTOS.totalOperadores}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Corrientes Y</p>
          <p className="text-2xl font-bold text-neutral-900">{STATS_TRATAMIENTOS.corrientesYCubiertas}</p>
        </Card>
        <Card className="p-3 border-l-4 border-l-red-400">
          <p className="text-xs text-red-600 uppercase tracking-wider">Riesgo Crítico</p>
          <p className="text-2xl font-bold text-red-700">{STATS_TRATAMIENTOS.metodosCriticos}</p>
        </Card>
        <Card className="p-3 border-l-4 border-l-amber-400">
          <p className="text-xs text-amber-600 uppercase tracking-wider">Riesgo Alto</p>
          <p className="text-2xl font-bold text-amber-700">{STATS_TRATAMIENTOS.metodosAltoRiesgo}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="base">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Buscar método, descripción u operador..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              leftIcon={<Search size={18} />}
            />
          </div>
          <select
            value={filtroCategoria}
            onChange={(e) => { setFiltroCategoria(e.target.value as CategoriaId | ''); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS_TRATAMIENTO.map(c => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.metodos.length})</option>
            ))}
          </select>
          <select
            value={filtroCorriente}
            onChange={(e) => { setFiltroCorriente(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">Todas las corrientes</option>
            {corrientesUnicas.map(y => (
              <option key={y} value={y}>{y} — {(CORRIENTES_Y[y] || '').substring(0, 40)}</option>
            ))}
          </select>
          <select
            value={filtroRiesgo}
            onChange={(e) => { setFiltroRiesgo(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">Todos los riesgos</option>
            <option value="critico">Crítico (1 operador)</option>
            <option value="alto">Alto (2 operadores)</option>
            <option value="medio">Medio (3-4)</option>
            <option value="bajo">Bajo (5+)</option>
          </select>
        </div>
        {(searchTerm || filtroCategoria || filtroRiesgo || filtroCorriente) && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-neutral-500">
              {metodosFiltrados.length} de {STATS_TRATAMIENTOS.totalMetodos} métodos
            </span>
            <button
              onClick={() => { setSearchTerm(''); setFiltroCategoria(''); setFiltroRiesgo(''); setFiltroCorriente(''); setCurrentPage(1); }}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </Card>

      {/* Table */}
      <Table
        data={paginados}
        columns={columns}
        keyExtractor={(m) => m.id}
        onRowClick={(m) => setExpandedRow(expandedRow === m.id ? null : m.id)}
        stickyHeader
        emptyMessage="No se encontraron tratamientos con esos filtros"
        renderExpandedRow={(m) => expandedRow === m.id ? <ExpandedMetodo metodo={m} navigate={navigate} cuitToId={cuitToId} /> : null}
      />

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={metodosFiltrados.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Expanded row detail
// ---------------------------------------------------------------------------

const ExpandedMetodo: React.FC<{
  metodo: MetodoTratamiento;
  navigate: ReturnType<typeof useNavigate>;
  cuitToId: Record<string, string>;
}> = ({ metodo, navigate, cuitToId }) => {
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  const prefix = isMobile ? '/mobile' : '';
  const operadoresEnriched = metodo.operadores.map(o => ({
    ...o,
    enriched: getOperadorEnriched(o.cuit),
  }));

  return (
    <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-100">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Corrientes Y */}
        <div>
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
            Corrientes Autorizadas ({metodo.corrientesY.length})
          </p>
          <div className="space-y-1">
            {metodo.corrientesY.map(y => (
              <div key={y} className="flex items-start gap-2">
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-neutral-200 text-neutral-800 shrink-0">
                  {y}
                </span>
                <span className="text-xs text-neutral-600">{CORRIENTES_Y[y] || '-'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Operadores */}
        <div>
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
            Operadores Habilitados ({operadoresEnriched.length})
          </p>
          <div className="space-y-1.5">
            {operadoresEnriched.map(o => {
              const dbId = cuitToId[o.cuit];
              const href = dbId
                ? `${prefix}/admin/actores/operadores/${dbId}`
                : `${prefix}/admin/actores/operadores?q=${encodeURIComponent(o.cuit)}`;
              return (
              <div
                key={o.cuit}
                className="flex items-center gap-2 p-2 rounded-lg bg-white hover:bg-primary-50 transition-colors cursor-pointer group"
                onClick={() => navigate(href)}
              >
                <FlaskConical size={14} className="text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-neutral-900 group-hover:text-primary-600 truncate block">
                    {o.enriched?.empresa || o.cuit}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">{o.cuit} {o.enriched?.certificado ? `· ${o.enriched.certificado}` : ''}</span>
                </div>
                <Badge variant="outline" color={o.tipo === 'FIJO' ? 'info' : o.tipo === 'AMBOS' ? 'primary' : 'warning'} className="text-[10px] shrink-0">
                  {o.tipo}
                </Badge>
                <ExternalLink size={10} className="text-neutral-300 group-hover:text-primary-400 shrink-0" />
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Full description */}
      <div className="mt-3 p-3 bg-white rounded-lg border border-neutral-100">
        <p className="text-xs font-semibold text-neutral-500 mb-1">Descripción</p>
        <p className="text-sm text-neutral-700">{metodo.descripcion}</p>
      </div>
    </div>
  );
};

export default AdminTratamientosPage;

/**
 * TrazabilidadTimeline — Infinite-scroll timeline for actor detail pages
 * ======================================================================
 * Groups manifiestos by month with sticky headers. Auto-loads next page
 * when the user scrolls near the bottom (IntersectionObserver).
 * Used in OperadorDetallePage, TransportistaDetallePage, GeneradorDetallePage.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Route,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Package,
  Filter,
  Loader2,
} from 'lucide-react';
import { Badge } from './ui/BadgeV2';
import { Card } from './ui/CardV2';
import type { Manifiesto } from '../types/models';
import type { ManifiestoFilters } from '../types/api';
import { useManifiestos } from '../hooks/useManifiestos';

// ── Types ────────────────────────────────────────────────────────────────────

type ActorType = 'generador' | 'transportista' | 'operador';

interface TrazabilidadTimelineProps {
  actorType: ActorType;
  actorId: string;
  emptyLabel: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const ESTADO_DOT: Record<string, string> = {
  BORRADOR: 'bg-neutral-400',
  APROBADO: 'bg-primary-500',
  EN_TRANSITO: 'bg-amber-500',
  ENTREGADO: 'bg-sky-500',
  RECIBIDO: 'bg-violet-500',
  EN_TRATAMIENTO: 'bg-orange-500',
  TRATADO: 'bg-emerald-500',
  RECHAZADO: 'bg-red-500',
  CANCELADO: 'bg-neutral-500',
};

const ESTADO_BADGE_COLOR: Record<string, string> = {
  TRATADO: 'success',
  EN_TRANSITO: 'warning',
  CANCELADO: 'error',
  RECHAZADO: 'error',
  EN_TRATAMIENTO: 'info',
  RECIBIDO: 'primary',
  ENTREGADO: 'info',
  APROBADO: 'primary',
  BORRADOR: 'neutral',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  if (key === 'sin-fecha') return 'Sin fecha';
  const label = new Date(key + '-15T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getRelatedActors(m: any, actorType: ActorType): { label: string; value: string }[] {
  const result: { label: string; value: string }[] = [];
  if (actorType !== 'generador' && m.generador?.razonSocial) {
    result.push({ label: 'Gen', value: m.generador.razonSocial });
  }
  if (actorType !== 'transportista' && m.transportista?.razonSocial) {
    result.push({ label: 'Trans', value: m.transportista.razonSocial });
  }
  if (actorType !== 'operador' && m.operador?.razonSocial) {
    result.push({ label: 'Op', value: m.operador.razonSocial });
  }
  if (!m.transportista && m.modalidad === 'IN_SITU') {
    result.push({ label: '', value: 'In situ' });
  }
  return result;
}

function countEstados(items: Manifiesto[]): { estado: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of items) {
    counts.set(m.estado, (counts.get(m.estado) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([estado, count]) => ({ estado, count }))
    .sort((a, b) => b.count - a.count);
}

/** Build the filter object for useManifiestos based on actorType */
function buildFilters(actorType: ActorType, actorId: string, page: number): ManifiestoFilters {
  const base = { limit: PAGE_SIZE, page };
  if (actorType === 'generador') return { ...base, generadorId: actorId };
  if (actorType === 'transportista') return { ...base, transportistaId: actorId };
  return { ...base, operadorId: actorId };
}

// ── Component ────────────────────────────────────────────────────────────────

const TrazabilidadTimeline: React.FC<TrazabilidadTimelineProps> = ({
  actorType,
  actorId,
  emptyLabel,
}) => {
  const navigate = useNavigate();

  // Infinite scroll state
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<Manifiesto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filter/sort state (client-side, on accumulated items)
  const [sort, setSort] = useState<'desc' | 'asc'>('desc');
  const [mesFilter, setMesFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');

  const filters = useMemo(() => buildFilters(actorType, actorId, page), [actorType, actorId, page]);
  const { data, isFetching } = useManifiestos(filters, { enabled: !!actorId });

  const totalPages = data?.totalPages || 1;
  const hasMore = page < totalPages;

  // Reset when actor changes
  useEffect(() => {
    setPage(1);
    setAllItems([]);
    setTotalCount(0);
    setMesFilter('');
    setEstadoFilter('');
  }, [actorId]);

  // Accumulate items as pages load
  useEffect(() => {
    if (!data?.items || data.items.length === 0) return;
    setTotalCount(data.total);
    setAllItems(prev => {
      if (page === 1) return data.items;
      const existingIds = new Set(prev.map(m => m.id));
      const newItems = data.items.filter(m => !existingIds.has(m.id));
      return [...prev, ...newItems];
    });
  }, [data, page]);

  // IntersectionObserver for auto-loading next page
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isFetching) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetching) {
          setPage(p => p + 1);
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetching]);

  // Available months/estados from ALL accumulated items
  const mesesDisponibles = useMemo(() => {
    const meses = new Set<string>();
    for (const m of allItems) {
      if (m.createdAt) meses.add(monthKey(m.createdAt));
    }
    return [...meses].sort().reverse();
  }, [allItems]);

  const estadosDisponibles = useMemo(() => {
    const estados = new Set<string>();
    for (const m of allItems) {
      if (m.estado) estados.add(m.estado);
    }
    return [...estados].sort();
  }, [allItems]);

  // Client-side filter + sort on accumulated items
  const filteredItems = useMemo(() => {
    let items = allItems;
    if (mesFilter) {
      items = items.filter(m => m.createdAt?.startsWith(mesFilter));
    }
    if (estadoFilter) {
      items = items.filter(m => m.estado === estadoFilter);
    }
    return [...items].sort((a, b) => {
      const da = new Date(a.createdAt || 0).getTime();
      const db = new Date(b.createdAt || 0).getTime();
      return sort === 'desc' ? db - da : da - db;
    });
  }, [allItems, mesFilter, estadoFilter, sort]);

  // Group by month
  const groups = useMemo(() => {
    const groupMap = new Map<string, Manifiesto[]>();
    for (const m of filteredItems) {
      const key = m.createdAt ? monthKey(m.createdAt) : 'sin-fecha';
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(m);
    }
    return [...groupMap.entries()].map(([key, items]) => ({
      key,
      label: monthLabel(key),
      items,
    }));
  }, [filteredItems]);

  const hasActiveFilters = mesFilter || estadoFilter;

  return (
    <Card>
      {/* ── Header bar ─────────────────────────────────────── */}
      <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-100 space-y-2">
        <div className="flex items-center gap-2">
          <Route size={18} className="text-primary-600 shrink-0" />
          <h3 className="font-semibold text-neutral-900 text-sm sm:text-base">Trazabilidad</h3>
          <Badge variant="soft" color="neutral" className="text-[10px] sm:text-xs">{totalCount}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={mesFilter}
            onChange={e => setMesFilter(e.target.value)}
            className="h-8 flex-1 min-w-0 sm:flex-none sm:w-auto px-2 pr-7 text-xs border border-neutral-200 rounded-lg bg-white focus:ring-1 focus:ring-primary-300 focus:border-primary-300 transition-colors"
          >
            <option value="">Meses</option>
            {mesesDisponibles.map(m => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <select
            value={estadoFilter}
            onChange={e => setEstadoFilter(e.target.value)}
            className="h-8 flex-1 min-w-0 sm:flex-none sm:w-auto px-2 pr-7 text-xs border border-neutral-200 rounded-lg bg-white focus:ring-1 focus:ring-primary-300 focus:border-primary-300 transition-colors"
          >
            <option value="">Estados</option>
            {estadosDisponibles.map(e => (
              <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button
            onClick={() => setSort(s => s === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-50 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors shrink-0"
          >
            {sort === 'desc' ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
            <span className="hidden sm:inline">{sort === 'desc' ? 'Reciente' : 'Antiguo'}</span>
          </button>
        </div>

        {/* Active filter indicator */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Filter size={12} className="text-primary-500 shrink-0" />
            {mesFilter && (
              <button
                onClick={() => setMesFilter('')}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full hover:bg-primary-100 transition-colors"
              >
                {monthLabel(mesFilter)} <span className="text-primary-400">&times;</span>
              </button>
            )}
            {estadoFilter && (
              <button
                onClick={() => setEstadoFilter('')}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full hover:bg-primary-100 transition-colors"
              >
                {estadoFilter.replace(/_/g, ' ')} <span className="text-primary-400">&times;</span>
              </button>
            )}
            <button
              onClick={() => { setMesFilter(''); setEstadoFilter(''); }}
              className="text-neutral-400 hover:text-neutral-600 underline"
            >
              Limpiar
            </button>
          </div>
        )}
      </div>

      {/* ── Timeline body (no fixed height — flows with page scroll) ── */}
      <div>
        {groups.length > 0 ? groups.map(group => (
          <div key={group.key}>
            {/* Sticky month header */}
            <div className="sticky top-0 z-[2] bg-white/95 backdrop-blur-sm border-b border-neutral-200 px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-primary-50 flex items-center justify-center shrink-0">
                  <Calendar size={12} className="text-primary-600" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-neutral-800 uppercase tracking-wider truncate">{group.label}</span>
                <Badge variant="soft" color="neutral" className="text-[10px] shrink-0">{group.items.length}</Badge>
              </div>
              <div className="hidden sm:flex items-center gap-1 shrink-0">
                {countEstados(group.items).slice(0, 4).map(({ estado, count }) => (
                  <span key={estado} className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
                    <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_DOT[estado] || 'bg-neutral-400'}`} />
                    {count}
                  </span>
                ))}
              </div>
            </div>

            {/* Timeline items */}
            <div className="relative px-1 sm:px-2 py-1">
              <div className="absolute left-[18px] sm:left-[26px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-neutral-200 via-neutral-200 to-transparent" />

              {group.items.map((m: any) => {
                const dot = ESTADO_DOT[m.estado] || 'bg-neutral-400';
                const fecha = m.createdAt ? new Date(m.createdAt) : null;
                const relatedActors = getRelatedActors(m, actorType);
                const residuoCount = m.residuos?.length || 0;

                return (
                  <button
                    key={m.id}
                    onClick={() => navigate(`/manifiestos/${m.id}`)}
                    className="relative flex items-start gap-2 sm:gap-3 pl-9 sm:pl-12 pr-2 sm:pr-3 py-2.5 w-full text-left hover:bg-neutral-50/80 rounded-lg transition-all group"
                  >
                    <div className={`absolute left-[13px] sm:left-[21px] top-[14px] w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full border-2 border-white ${dot} shadow-sm z-[1] group-hover:scale-125 transition-transform`} />
                    <div className="w-10 sm:w-12 shrink-0 pt-0.5 text-right">
                      {fecha && (
                        <p className="text-[10px] sm:text-[11px] font-semibold text-neutral-500">
                          {fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                        </p>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-mono text-xs sm:text-sm font-bold text-neutral-900 group-hover:text-primary-600 transition-colors">
                          {m.numero}
                        </span>
                        <Badge variant="soft" color={ESTADO_BADGE_COLOR[m.estado] || 'neutral'} className="text-[10px]">
                          {m.estado?.replace(/_/g, ' ')}
                        </Badge>
                        {m.modalidad === 'IN_SITU' && (
                          <Badge variant="outline" color="success" className="text-[10px]">IN SITU</Badge>
                        )}
                      </div>
                      {relatedActors.length > 0 && (
                        <div className="flex items-center gap-2 sm:gap-3 mt-0.5 text-[11px] sm:text-xs text-neutral-500 truncate">
                          {relatedActors.map((a, i) => (
                            <span key={i} className={`truncate ${!a.label ? 'text-emerald-600' : ''}`}>
                              {a.label ? `${a.label}: ` : ''}{a.value}
                            </span>
                          ))}
                        </div>
                      )}
                      {residuoCount > 0 && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-neutral-400">
                          <Package size={10} />
                          <span>{residuoCount} residuo{residuoCount !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                    <ArrowRight size={14} className="text-neutral-300 group-hover:text-primary-500 shrink-0 mt-1 transition-colors hidden sm:block" />
                  </button>
                );
              })}
            </div>
          </div>
        )) : !isFetching ? (
          <div className="text-center py-12">
            <Route size={32} className="mx-auto text-neutral-300 mb-3" />
            <p className="text-sm text-neutral-500">Sin actividad registrada</p>
            <p className="text-xs text-neutral-400 mt-1">
              {hasActiveFilters
                ? 'No hay manifiestos que coincidan con los filtros'
                : `Este ${emptyLabel} aún no tiene manifiestos`}
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => { setMesFilter(''); setEstadoFilter(''); }}
                className="mt-2 text-xs text-primary-600 hover:text-primary-700 underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : null}

        {/* Sentinel for IntersectionObserver + loading indicator */}
        {hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-6 gap-2 text-neutral-400">
            {isFetching && (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs">Cargando más...</span>
              </>
            )}
          </div>
        )}

        {/* "All loaded" footer */}
        {!hasMore && allItems.length > 0 && (
          <div className="text-center py-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-400">
              {totalCount} manifiestos cargados
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default TrazabilidadTimeline;

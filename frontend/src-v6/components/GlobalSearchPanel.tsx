import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, FileText, Factory, Truck, FlaskConical, Clock, X } from 'lucide-react';
import { useGlobalSearch, FlatResult } from '../hooks/useGlobalSearch';
import { ESTADO_LABELS, ESTADO_COLORS } from '../utils/constants';
import { EstadoManifiesto } from '../types/models';

interface Props {
  onClose: () => void;
}

const ESTADO_CHIPS: EstadoManifiesto[] = [
  EstadoManifiesto.BORRADOR,
  EstadoManifiesto.APROBADO,
  EstadoManifiesto.EN_TRANSITO,
  EstadoManifiesto.ENTREGADO,
  EstadoManifiesto.RECIBIDO,
  EstadoManifiesto.TRATADO,
];

const TYPE_ICONS: Record<FlatResult['type'], React.ReactNode> = {
  manifiesto: <FileText size={16} className="text-primary-500" />,
  generador: <Factory size={16} className="text-purple-500" />,
  transportista: <Truck size={16} className="text-orange-500" />,
  operador: <FlaskConical size={16} className="text-blue-500" />,
};

const TYPE_LABELS: Record<FlatResult['type'], string> = {
  manifiesto: 'Manifiestos',
  generador: 'Generadores',
  transportista: 'Transportistas',
  operador: 'Operadores',
};

export const GlobalSearchPanel: React.FC<Props> = ({ onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    query, setQuery,
    activeEstado, setActiveEstado,
    isLoading,
    isError,
    data,
    flatResults,
    focusedIndex, setFocusedIndex,
    recentSearches,
    navigateTo,
  } = useGlobalSearch({ onClose });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const showRecent = query.length < 2 && recentSearches.length > 0;
  const showEmpty = !isLoading && !isError && query.length >= 2 && (!data || data.totalHits === 0);
  const showError = isError && query.length >= 2 && !isLoading;

  // Group flatResults by type, preserving global index for keyboard nav
  const grouped = (['manifiesto', 'generador', 'transportista', 'operador'] as FlatResult['type'][]).map((type) => ({
    type,
    items: flatResults
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.type === type),
  })).filter((g) => g.items.length > 0);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[900]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-[72px] left-1/2 -translate-x-1/2 w-full max-w-2xl z-[901] px-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100">
            <Search size={20} className="text-neutral-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar manifiestos, generadores, CUIT..."
              className="flex-1 text-base text-neutral-900 placeholder:text-neutral-400 bg-transparent outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-neutral-400 hover:text-neutral-600">
                <X size={16} />
              </button>
            )}
            <kbd className="hidden sm:flex items-center text-[10px] text-neutral-400 bg-neutral-100 rounded px-1.5 py-0.5 border border-neutral-200 font-mono">
              Esc
            </kbd>
          </div>

          {/* Estado chips */}
          <div className="flex gap-1.5 px-4 py-2 border-b border-neutral-100 overflow-x-auto">
            {ESTADO_CHIPS.map((e) => {
              const active = activeEstado === e;
              const colors = ESTADO_COLORS[e];
              return (
                <button
                  key={e}
                  onClick={() => setActiveEstado(active ? '' : e)}
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium transition-all
                    ${active
                      ? `${colors.bg} ${colors.text} ${colors.border}`
                      : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:border-neutral-300'
                    }`}
                >
                  {ESTADO_LABELS[e]}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="max-h-[400px] overflow-y-auto">
            {/* Recent searches */}
            {showRecent && (
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Búsquedas recientes
                </p>
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="w-full flex items-center gap-2 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 text-left"
                  >
                    <Clock size={14} className="text-neutral-400 shrink-0" />
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Hint when no query and no recent */}
            {query.length < 2 && recentSearches.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-neutral-400">
                Buscar manifiestos, generadores, transportistas, CUIT...
              </div>
            )}

            {/* Loading skeleton */}
            {isLoading && (
              <div className="px-4 py-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="w-8 h-8 bg-neutral-100 rounded-lg animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-neutral-100 rounded animate-pulse w-1/3" />
                      <div className="h-2.5 bg-neutral-100 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error state */}
            {showError && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-neutral-500 font-medium">Error al conectar con el servidor</p>
                <p className="text-xs text-neutral-400 mt-1">Verificá tu conexión e intentá de nuevo</p>
              </div>
            )}

            {/* Empty state */}
            {showEmpty && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-neutral-500 font-medium">Sin resultados para "{query}"</p>
                <button
                  onClick={() => navigateTo('/manifiestos')}
                  className="mt-2 text-xs text-primary-600 hover:underline"
                >
                  Ver todos los manifiestos
                </button>
              </div>
            )}

            {/* Results grouped */}
            {!isLoading && grouped.map(({ type, items }) => (
              <div key={type} className="px-4 py-2">
                <div className="flex items-center gap-2 mb-1">
                  {TYPE_ICONS[type]}
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    {TYPE_LABELS[type]} ({items.length})
                  </p>
                </div>
                {items.map(({ item, idx }) => {
                  const isFocused = focusedIndex === idx;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigateTo(item.href)}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-colors
                        ${isFocused ? 'bg-primary-50' : 'hover:bg-neutral-50'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                        ${isFocused ? 'bg-primary-100' : 'bg-neutral-100'}`}>
                        {TYPE_ICONS[type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isFocused ? 'text-primary-700' : 'text-neutral-900'}`}>
                          {item.label}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">{item.sublabel}</p>
                      </div>
                      {item.estado && (
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium
                          ${ESTADO_COLORS[item.estado as EstadoManifiesto]?.bg || 'bg-neutral-100'}
                          ${ESTADO_COLORS[item.estado as EstadoManifiesto]?.text || 'text-neutral-600'}
                          ${ESTADO_COLORS[item.estado as EstadoManifiesto]?.border || 'border-neutral-200'}`}
                        >
                          {ESTADO_LABELS[item.estado as EstadoManifiesto] || item.estado}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer hint */}
          {flatResults.length > 0 && (
            <div className="px-4 py-2 border-t border-neutral-100 flex gap-4 text-xs text-neutral-400">
              <span>↑↓ navegar</span>
              <span>↵ abrir</span>
              <span>Esc cerrar</span>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

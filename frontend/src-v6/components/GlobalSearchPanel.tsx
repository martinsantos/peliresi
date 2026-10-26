import React, { useEffect, useId, useRef } from 'react';
import { Search, FileText, Factory, Truck, FlaskConical, Clock, X } from 'lucide-react';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import type { FlatResult } from '../hooks/useGlobalSearch';
import { ESTADO_LABELS } from '../utils/constants';
import { EstadoManifiesto } from '../types/models';
import { useAuth } from '../contexts/AuthContext';
import { workspaceRoleLabel } from '../utils/workspaceNavigation';
import { Modal } from './ui/Modal';
import { Button } from './ui/ButtonV2';

const icons = { manifiesto: FileText, generador: Factory, transportista: Truck, operador: FlaskConical };
const labels = { manifiesto: 'Manifiestos', generador: 'Generadores', transportista: 'Transportistas', operador: 'Operadores' };
const control = 'min-h-11 rounded-lg border border-neutral-300 bg-white px-3 text-base text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700';

export const GlobalSearchPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const input = useRef<HTMLInputElement>(null), id = useId();
  const { currentUser } = useAuth();
  const contextLabel = [workspaceRoleLabel(currentUser?.rol || ''), currentUser?.empresaContexto?.razonSocial || currentUser?.sector, currentUser?.empresaContexto?.establecimiento?.nombre].filter(Boolean).join(' · ');
  const { query, setQuery, activeEstado, setActiveEstado, isLoading, isError, data, flatResults,
    focusedIndex, setFocusedIndex, recentSearches, navigateTo, onQueryKeyDown, retry } = useGlobalSearch({ onClose });
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { if (focusedIndex >= 0) document.getElementById(`${id}-${focusedIndex}`)?.scrollIntoView?.({ block: 'nearest' }); }, [focusedIndex, id]);
  const searching = query.trim().length >= 2;
  return <Modal isOpen onClose={onClose} title="Buscar en SITREP" description={contextLabel} size="lg">
    <div className="space-y-4">
      <div>
        <label htmlFor={`${id}-query`} className="mb-2 block text-sm font-medium text-neutral-700">Número, razón social o CUIT</label>
        <div className="flex items-center gap-2">
          <Search size={20} aria-hidden="true" className="shrink-0 text-primary-700" />
          <input id={`${id}-query`} ref={input} type="text" inputMode="search" enterKeyHint="search" role="combobox" autoComplete="off" maxLength={200}
            aria-autocomplete="list" aria-expanded={flatResults.length > 0 && !isLoading} aria-controls={`${id}-results`}
            aria-activedescendant={!isLoading && flatResults[focusedIndex] ? `${id}-${focusedIndex}` : undefined}
            value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onQueryKeyDown} className={`${control} min-w-0 flex-1`} />
          {query && <button type="button" aria-label="Limpiar búsqueda" onClick={() => { setQuery(''); input.current?.focus(); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700"><X size={20} aria-hidden="true" /></button>}
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-state`} className="mb-2 block text-sm font-medium text-neutral-700">Estado del manifiesto</label>
        <select id={`${id}-state`} value={activeEstado} onChange={e => setActiveEstado(e.target.value)} className={`${control} w-full`}>
          <option value="">Todos los estados</option>
          {Object.values(EstadoManifiesto).map(state => <option key={state} value={state}>{ESTADO_LABELS[state] || state}</option>)}
        </select>
      </div>
      {!searching && <div>
        {recentSearches.length > 0 ? <><p className="text-sm font-medium text-neutral-600">Búsquedas recientes</p>
          {recentSearches.map(term => <button key={term} type="button" onClick={() => setQuery(term)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-neutral-700 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700"><Clock size={16} aria-hidden="true" /><span className="break-all">{term}</span></button>)}</>
          : <p className="text-sm text-neutral-600">Escribí al menos dos caracteres.</p>}
      </div>}
      <p role="status" className="text-sm text-neutral-600">{isLoading ? 'Buscando…' : searching && !isError && data ? `${flatResults.length} ${flatResults.length === 1 ? 'resultado' : 'resultados'}` : ''}</p>
      {isError && <div role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3">
        <p className="mb-2 text-sm text-neutral-900">No pudimos consultar los resultados. Intentá nuevamente.</p>
        <Button variant="outline" onClick={() => void retry()}>Reintentar búsqueda</Button>
      </div>}
      {searching && !isLoading && !isError && data && flatResults.length === 0 && <div className="space-y-2">
        <p className="break-words text-neutral-700">Sin coincidencias para «{query.trim()}» en tu contexto actual.</p>
        <Button variant="outline" onClick={() => navigateTo('/manifiestos')}>Ver manifiestos</Button>
      </div>}
      <ul id={`${id}-results`} role="listbox" aria-label="Resultados de búsqueda" className="space-y-3">
        {!isLoading && (Object.keys(labels) as FlatResult['type'][]).map(type => {
          const items = flatResults.map((item, index) => ({ item, index })).filter(result => result.item.type === type);
          if (!items.length) return null;
          const Icon = icons[type];
          return <li key={type} role="group" aria-label={labels[type]}><p className="mb-1 text-sm font-semibold text-neutral-600">{labels[type]}</p>
            {items.map(({ item, index }) => <button id={`${id}-${index}`} key={item.id} type="button" role="option" aria-selected={index === focusedIndex}
              onClick={() => navigateTo(item.href)} onFocus={() => setFocusedIndex(index)} onMouseEnter={() => setFocusedIndex(index)}
              className={`flex min-h-11 w-full items-start gap-3 rounded-lg p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 ${index === focusedIndex ? 'bg-primary-50' : 'hover:bg-neutral-50'}`}>
              <Icon size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-primary-700" />
              <span className="min-w-0 flex-1 break-words"><span className="block font-semibold text-neutral-900">{item.label}</span><span className="block text-sm text-neutral-600">{item.sublabel}</span>
                {item.estado && <span className="block text-sm text-primary-800">{ESTADO_LABELS[item.estado as EstadoManifiesto] || item.estado}</span>}</span>
            </button>)}
          </li>;
        })}
      </ul>
    </div>
  </Modal>;
};

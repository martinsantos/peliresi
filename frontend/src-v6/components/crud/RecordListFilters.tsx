import { useId, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '../ui/ButtonV2';
import { SearchInput } from '../ui/SearchInput';
import { Select } from '../ui/Select';
import type { CRUDFilter } from './GenericCRUDPage.types';

/** Keep results within reach; hidden filters retain their selection and summary. */
export function RecordListFilters({ title, value, onChange, placeholder, debounce = 0, filters = [] }: {
  title: string; value: string; onChange: (value: string) => void; placeholder?: string;
  debounce?: number; filters?: CRUDFilter[];
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const active = filters.filter(filter => filter.value !== (filter.defaultValue ?? filter.options[0]?.value));
  return <div role="search" aria-label={`Filtrar ${title.toLowerCase()}`} className="min-w-0 rounded-xl border border-neutral-200 bg-white p-3 sm:p-4">
    <div className="flex min-w-0 items-center gap-2">
      <SearchInput aria-label={`Buscar ${title.toLowerCase()}`} value={value} onChange={onChange} placeholder={placeholder} debounce={debounce} className="min-w-0 flex-1" />
      {filters.length > 0 && <Button variant="outline" leftIcon={<SlidersHorizontal size={16} />} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        Filtros{active.length ? ` (${active.length})` : ''}
      </Button>}
    </div>
    {active.length > 0 && !open && <p className="mt-2 text-xs leading-5 text-neutral-600" aria-live="polite">
      {active.map(filter => `${filter.label || filter.placeholder}: ${filter.options.find(option => option.value === filter.value)?.label || filter.value}`).join(' · ')}
    </p>}
    <div id={id} hidden={!open}>
      <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 border-t border-neutral-100 pt-3 sm:grid-cols-2 xl:grid-cols-3">
        {filters.map(filter => <Select key={filter.key} label={filter.label || filter.placeholder} value={filter.value} onChange={filter.onChange} options={filter.options} isFullWidth />)}
      </div>
      {active.length > 0 && <Button variant="ghost" className="mt-2" onClick={() => active.forEach(filter => filter.onChange(filter.defaultValue ?? filter.options[0]?.value ?? ''))}>Restablecer filtros</Button>}
    </div>
  </div>;
}

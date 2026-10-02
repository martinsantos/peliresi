import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMobilePrefix } from '../../../hooks/useMobilePrefix';

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-700';
const interactive = 'a,button,input,select,textarea,[role="button"],[contenteditable="true"]';

/** Keeps table semantics; only rows with a real destination become actionable. */
export function ReportRow({ to, children }: { to?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  return <tr tabIndex={to ? 0 : undefined}
    className={to ? 'cursor-pointer transition-colors hover:bg-primary-50 focus-visible:bg-primary-50 active:bg-primary-100 ' + focus : ''}
    onClick={to ? event => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if ((event.target as Element).closest(interactive)) return;
      navigate(mp(to));
    } : undefined}
    onKeyDown={to ? event => {
      if (event.target !== event.currentTarget || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      navigate(mp(to));
    } : undefined}>{children}</tr>;
}

export function ReportSortHeader({ column, label, sort, onSort, className = '' }: {
  column: string; label: string; sort: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (column: string) => void; className?: string;
}) {
  const active = sort?.key === column;
  const Icon = active && sort.direction === 'desc' ? ChevronDown : ChevronUp;
  return <th scope="col" aria-sort={active ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'} className={className}>
    <button type="button" aria-label={'Ordenar por ' + label} onClick={() => onSort(column)}
      className={'flex min-h-11 w-full items-center gap-1 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-800 ' + focus}>
      {label}<Icon size={14} aria-hidden="true" className={active ? 'shrink-0 text-primary-800' : 'shrink-0 text-neutral-500'} />
    </button>
  </th>;
}

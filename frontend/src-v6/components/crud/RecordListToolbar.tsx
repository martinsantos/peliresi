import { type ReactNode } from 'react';
import { Download, Plus } from 'lucide-react';
import { Button } from '../ui/ButtonV2';
import { PageToolbar } from '../ui/PageToolbar';

export interface RecordExportAction {
  label: string;
  icon: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}

/** One primary action and a secondary export group; the layout owns the title. */
export function RecordListToolbar({ title, onNew, newLabel, exports = [] }: {
  title: string; onNew?: () => void; newLabel?: string; exports?: RecordExportAction[];
}) {
  return <PageToolbar label={`Acciones de ${title}`}>
    <h2 className="sr-only">{title}</h2>
    {onNew ? <Button aria-label={newLabel || 'Nuevo'} leftIcon={<Plus size={18} />} onClick={onNew}><span className="sm:hidden">Nuevo</span><span className="hidden sm:inline">{newLabel || 'Nuevo'}</span></Button> : <span />}
    {exports.length > 0 && <details className="group relative" onKeyDown={event => {
      if (event.key === 'Escape') {
        event.currentTarget.removeAttribute('open');
        event.currentTarget.querySelector('summary')?.focus();
      }
    }} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.removeAttribute('open');
    }}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 [&::-webkit-details-marker]:hidden">
        <Download size={16} aria-hidden="true" /> Exportar
      </summary>
      <div className="absolute right-0 z-20 mt-2 flex w-48 flex-col rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
        {exports.map(action => <button type="button" key={action.label} disabled={action.disabled}
          onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); void action.onClick(); }}
          className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm text-neutral-700 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
          {action.icon}{action.label}
        </button>)}
      </div>
    </details>}
  </PageToolbar>;
}

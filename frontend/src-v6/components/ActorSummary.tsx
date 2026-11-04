import type { ReactNode } from 'react';
import { Card } from './ui/CardV2';

/** Compact facts for the overview; other tabs should lead with their own content. */
export function ActorSummary({ items }: { items: ReadonlyArray<{ key: string; label: ReactNode; value: ReactNode }> }) {
  return <Card className="p-4">
    <dl className={items.length === 3 ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-2 gap-3'}>
      {items.map(item => <div key={item.key} className="min-w-0">
        <dt className="break-words text-sm text-neutral-600">{item.label}</dt>
        <dd className="mt-1 break-words font-semibold text-neutral-900">{item.value}</dd>
      </div>)}
    </dl>
  </Card>;
}

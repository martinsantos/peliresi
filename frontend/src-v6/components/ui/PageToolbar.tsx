import type { ReactNode } from 'react';

/** The same action row for operational lists and dossiers, on web and app. */
export function PageToolbar({ children, label }: { children: ReactNode; label: string }) {
  return <div aria-label={label} data-page-toolbar className="flex min-h-11 min-w-0 flex-wrap items-center justify-between gap-2">{children}</div>;
}

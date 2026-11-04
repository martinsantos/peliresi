import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './ButtonV2';
import { LoadingIndicator } from './LoadingState';

/** Failed reads are unavailable, never empty. Background refresh keeps loaded forms mounted. */
export function QueryContent({ query, loading, error, retryLabel, children }: {
  query: { isPending: boolean; isError: boolean; isFetching: boolean; refetch: () => unknown };
  loading: string;
  error: string;
  retryLabel: string;
  children?: ReactNode;
}) {
  const result = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  const [retried, setRetried] = useState(false);
  useEffect(() => {
    if (query.isPending || query.isError || query.isFetching || !returnFocus.current) return;
    if (document.activeElement === document.body || result.current?.contains(document.activeElement)) result.current?.focus();
    returnFocus.current = false;
  }, [query.isPending, query.isError, query.isFetching]);
  return <div ref={result} tabIndex={-1} className="min-w-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 focus-visible:outline-offset-2"
    onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) returnFocus.current = false; }}>
  {query.isPending ? <LoadingIndicator label={loading} /> : query.isError ? <div role="alert" className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
    <AlertCircle size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
    <div className="min-w-0 flex-1 space-y-2">
      <p>{error}</p>
      <Button variant="outline" size="sm" disabled={query.isFetching} onClick={event => {
        returnFocus.current = document.activeElement === event.currentTarget;
        setRetried(true);
        void query.refetch();
      }}>{query.isFetching ? 'Reintentando…' : retryLabel}</Button>
    </div>
  </div> : <>{retried && <span role="status" className="sr-only">Consulta actualizada.</span>}{children}</>}
  </div>;
}

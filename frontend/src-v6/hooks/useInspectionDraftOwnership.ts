import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type InspectionDraftOwnershipStatus = 'checking' | 'owned' | 'blocked' | 'unavailable';

interface OwnershipRequest {
  key: string;
  enabled: boolean;
  revision: number;
}

interface OwnershipAttempt {
  request: OwnershipRequest;
  held: boolean;
  release: (() => void) | null;
}

/**
 * Elects one editor for a user-scoped inspection draft within this origin.
 * Call canWrite immediately before every draft write/remove or synchronization;
 * the rendered status alone can be stale inside an asynchronous callback.
 * Unsupported browsers fail closed: a localStorage lease cannot elect one writer
 * atomically, so it is intentionally not used as a fallback.
 */
export function useInspectionDraftOwnership(key: string, enabled: boolean) {
  const [revision, setRevision] = useState(0);
  const request = useMemo(() => ({ key, enabled, revision }), [key, enabled, revision]);
  const [state, setState] = useState<{
    request: OwnershipRequest;
    status: InspectionDraftOwnershipStatus;
  } | null>(null);
  const attemptRef = useRef<OwnershipAttempt | null>(null);
  const previousRequestRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!request.enabled || !request.key) return;

    let active = true;
    const attempt: OwnershipAttempt = { request, held: false, release: null };
    attemptRef.current = attempt;

    // A cleaned-up request may still be waiting for the browser's callback.
    // Wait for it to release before retrying, including StrictMode effect replay.
    previousRequestRef.current = previousRequestRef.current.then(async () => {
      if (!active) return;
      if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') {
        setState({ request, status: 'unavailable' });
        return;
      }

      await navigator.locks.request(
        `sitrep:inspection-draft:${request.key}`,
        { mode: 'exclusive', ifAvailable: true },
        async (lock) => {
          // Returning immediately releases a grant that arrived after cleanup.
          if (!active) return;
          if (!lock) {
            setState({ request, status: 'blocked' });
            return;
          }

          attempt.held = true;
          setState({ request, status: 'owned' });
          await new Promise<void>((resolve) => { attempt.release = resolve; });
          attempt.held = false;
        },
      );
    }).catch(() => {
      attempt.held = false;
      if (active) setState({ request, status: 'unavailable' });
    });

    return () => {
      active = false;
      // Revoke synchronously, before the browser finishes releasing the lock.
      attempt.held = false;
      attempt.release?.();
      if (attemptRef.current === attempt) attemptRef.current = null;
    };
  }, [request]);

  const status: InspectionDraftOwnershipStatus = !enabled || !key
    ? 'unavailable'
    : state?.request === request ? state.status : 'checking';

  const canWrite = useCallback(() => Boolean(
    request.enabled
    && request.key
    && attemptRef.current?.request === request
    && attemptRef.current.held,
  ), [request]);

  const retry = useCallback(() => {
    if (!enabled || !key || status === 'checking' || canWrite()) return;
    setRevision((previous) => previous + 1);
  }, [canWrite, enabled, key, status]);

  return { status, canWrite, retry };
}

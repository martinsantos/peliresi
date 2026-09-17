import { useCallback, useEffect, useRef, useState } from 'react';

export type WakeLockStatus = 'unsupported' | 'requesting' | 'active' | 'released' | 'error';

function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator && typeof navigator.wakeLock?.request === 'function';
}

export function useScreenWakeLock(enabled: boolean) {
  const [status, setStatus] = useState<WakeLockStatus>(() => wakeLockSupported() ? 'released' : 'unsupported');
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const requestPromiseRef = useRef<Promise<boolean> | null>(null);

  const handleRelease = useCallback(() => {
    sentinelRef.current = null;
    setStatus('released');
  }, []);

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (sentinel && !sentinel.released) {
      sentinel.removeEventListener('release', handleRelease);
      await sentinel.release().catch(() => undefined);
    }
    if (wakeLockSupported()) setStatus('released');
  }, [handleRelease]);

  const request = useCallback((): Promise<boolean> => {
    if (!wakeLockSupported()) {
      setStatus('unsupported');
      return Promise.resolve(false);
    }
    if (!enabled || document.visibilityState !== 'visible') {
      setStatus('released');
      return Promise.resolve(false);
    }
    if (sentinelRef.current && !sentinelRef.current.released) {
      setStatus('active');
      return Promise.resolve(true);
    }
    if (requestPromiseRef.current) return requestPromiseRef.current;

    setStatus('requesting');
    setError(null);
    const pending = navigator.wakeLock.request('screen')
      .then((sentinel) => {
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', handleRelease);
        setStatus('active');
        return true;
      })
      .catch((requestError: unknown) => {
        setStatus('error');
        setError(requestError instanceof Error ? requestError.message : 'No se pudo mantener la pantalla activa.');
        return false;
      })
      .finally(() => {
        requestPromiseRef.current = null;
      });
    requestPromiseRef.current = pending;
    return pending;
  }, [enabled, handleRelease]);

  useEffect(() => {
    if (!wakeLockSupported()) {
      return;
    }
    if (!enabled) {
      return;
    }

    const initialRequest = window.setTimeout(() => void request(), 0);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(initialRequest);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void release();
    };
  }, [enabled, release, request]);

  return { status, error, supported: wakeLockSupported(), request, release };
}

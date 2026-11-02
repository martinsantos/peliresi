import { useEffect, useState, type ReactNode } from 'react';

/** A labelled preview must not open the app against an unverified API. */
export function allowedSyntheticPreviewOrigin(actual: string, configured: string): boolean {
  try {
    const expected = new URL(configured);
    if (expected.username || expected.password || expected.pathname !== '/' || expected.search || expected.hash) return false;
    const host = expected.hostname.replace(/\.$/, '');
    const dedicatedTrainingOrigin = expected.protocol === 'https:'
      && expected.hostname === 'sitrep.ultimamilla.com.ar'
      && expected.port === '8443';
    if (expected.origin !== actual || (host === 'sitrep.ultimamilla.com.ar' && !dedicatedTrainingOrigin)) return false;
    return expected.protocol === 'https:'
      || (expected.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(expected.hostname));
  } catch { return false; }
}

type Props = { children: ReactNode; enabled?: boolean; configuredOrigin?: string; origin?: string; apiBase?: string };
export function SyntheticPreviewGate({ children,
  enabled = import.meta.env.VITE_SYNTHETIC_PREVIEW === 'true',
  configuredOrigin = import.meta.env.VITE_SYNTHETIC_PREVIEW_ORIGIN || '',
  origin = window.location.origin, apiBase = import.meta.env.VITE_API_URL || '/api' }: Props) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([origin, configuredOrigin, apiBase, attempt]);
  const [result, setResult] = useState<{ key: string; state: 'checking' | 'ready' | 'error' }>({ key: '', state: 'checking' });
  const state = result.key === key ? result.state : 'checking';
  useEffect(() => {
    if (!enabled) { setResult({ key: '', state: 'checking' }); return; }
    if (apiBase !== '/api' || !allowedSyntheticPreviewOrigin(origin, configuredOrigin)) { setResult({ key, state: 'error' }); return; }
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setResult({ key, state: 'checking' });
    void fetch('/api/preview/identity', { cache: 'no-store', credentials: 'omit', signal: controller.signal })
      .then(async response => {
        if (!response.ok || (await response.json()).mode !== 'synthetic-preview-v1') throw new Error('Invalid preview identity');
        if (active) setResult({ key, state: 'ready' });
      }).catch(() => { if (active) setResult({ key, state: 'error' }); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [enabled, configuredOrigin, origin, apiBase, key]);

  if (!enabled) return <>{children}</>;
  return <div className="flex h-dvh flex-col bg-white">
    <div role="status" className="shrink-0 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-bold text-amber-950">
      ENTORNO DE PRÁCTICA · DATOS FICTICIOS · SIN VALIDEZ OFICIAL
    </div>
    {state === 'ready'
      ? <div className="synthetic-preview-content min-h-0 flex-1 overflow-auto">{children}</div>
      : <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6 py-8 text-neutral-900">
        {state === 'checking'
          ? <p role="status">Verificando el entorno de práctica…</p>
          : <><h1 className="text-xl font-bold">No se pudo verificar el entorno de práctica</h1>
            <p>No ingreses datos ni continúes hasta comprobar la dirección y la conexión.</p>
            <button type="button" onClick={() => setAttempt(value => value + 1)}
              className="min-h-11 self-start rounded-lg bg-[#1B5E3C] px-4 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5E3C]">Reintentar</button></>}
      </main>}
  </div>;
}

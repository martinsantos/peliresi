import { useEffect, useRef } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { canonicalLink, linkDestination, publicLink } from '../../utils/linkPreference';
import { LoadingIndicator } from '../../components/ui/LoadingState';

/** A read-only resolver: the destination still enforces its own permissions. */
export default function OpenLinkPage() {
  const { currentUser, isLoading, authError } = useAuth();
  const location = useLocation();
  const target = canonicalLink(new URLSearchParams(location.search).get('destino'));
  const routed = useRef(false);
  const publicTarget = target && publicLink(target);
  useEffect(() => {
    if (isLoading || !target || (!currentUser && !publicTarget) || routed.current) return;
    routed.current = true;
    window.location.replace(linkDestination(target, currentUser?.preferenciaEnlaces || 'AUTO',
      window.matchMedia('(max-width: 900px) and (pointer: coarse)').matches,
      window.matchMedia('(display-mode: standalone)').matches, currentUser?.rol, currentUser?.esInspector));
  }, [isLoading, target, currentUser, publicTarget]);
  if (!target) return <main className="mx-auto max-w-lg space-y-4 p-6"><h1 className="text-xl font-semibold">Este enlace no es válido</h1><p>Consultá el aviso desde tu cuenta.</p><Link className="inline-flex min-h-11 items-center underline" to="/notificaciones">Ir a mis avisos</Link></main>;
  if (!isLoading && !currentUser && !publicTarget) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  return <main className="mx-auto max-w-lg space-y-4 p-6"><LoadingIndicator label="Abriendo el contenido en tu vista preferida…" />
    {authError && <p role="alert">{authError}</p>}
    <p className="text-sm text-neutral-600">Podés elegir otra vista para este enlace.</p>
    <div className="flex gap-4"><a className="inline-flex min-h-11 items-center text-primary-800 underline" href={target}>Abrir en la web</a><a className="inline-flex min-h-11 items-center text-primary-800 underline" href={'/app' + target}>Abrir en la app</a></div>
  </main>;
}

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { User } from '../contexts/AuthContext';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { activateActorActivity } from '../services/activateActorActivity';
import { personalManifestAccess, type ManifestPersonalAccess } from '../services/manifestPersonalAccess';
import { inspectionWorkspaceOwner } from '../utils/inspectionWorkspace';
import { Button } from './ui/ButtonV2';

const labels = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transporte', OPERADOR: 'Operador' } as const;

/** A read-only check supplies choices; activation confirms the exact actor
 * again before persisting a personal role and navigating. */
export default function PersonalManifestNoticeAction({ manifestId, target, user, quietEmpty = false, onCurrent }: {
  manifestId: string; target: string; user: User; quietEmpty?: boolean; onCurrent?: () => void;
}) {
  const mp = useMobilePrefix(), alive = useRef(true), lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const roles = [...new Set([...(user.actividades || []), user.rol])].filter(role => role in labels);
  const owner = inspectionWorkspaceOwner(user);
  const query = useQuery({ queryKey: ['manifest-personal-access', owner, manifestId, roles.join(',')],
    queryFn: ({ signal }) => personalManifestAccess(manifestId, roles, signal), retry: false, staleTime: 0, refetchOnMount: 'always' });
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const dossier = '/manifiestos/' + manifestId, addenda = dossier + '/adendas';
  const safeTarget = target === dossier || target.startsWith(dossier + '?') || target.startsWith(dossier + '#')
    || target === addenda || target.startsWith(addenda + '?') || target.startsWith(addenda + '#')
    ? target : '/manifiestos/' + manifestId;
  async function open(access: ManifestPersonalAccess) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await activateActorActivity(user.id, access.rol, access.actorId, () => alive.current);
      if (!alive.current) return;
      window.location.replace((window.location.pathname.startsWith('/app/') ? '/app' : '') + mp(safeTarget));
    } catch { if (alive.current) setError('No pudimos abrir el manifiesto con esta actividad. Reintentá o revisá tus roles.'); }
    finally { if (alive.current) { lock.current = false; setBusy(false); } }
  }
  if (query.isPending || query.isFetching) return <div role="region" aria-label="Actividades con acceso al manifiesto"><p role="status" className="text-sm text-neutral-700">Comprobando tus actividades…</p></div>;
  const accesses = query.data?.accesses || [];
  const incomplete = query.isError || query.data?.incomplete;
  if (!accesses.length && !incomplete && quietEmpty) return null;
  return <div role="region" aria-label="Actividades con acceso al manifiesto" className="space-y-3 rounded-lg border border-primary-100 bg-primary-50 p-3 text-left">
    {accesses.length > 0 && <p className="text-sm text-neutral-700">Elegí la actividad autorizada para abrir este manifiesto.</p>}
    {!accesses.length && !incomplete && <p className="text-sm text-neutral-700">Ninguna actividad personal de esta cuenta puede abrir el manifiesto. Revisá tus autorizaciones o consultá a Administración.</p>}
    {accesses.length > 0 && <div className="flex flex-wrap gap-2">
      {accesses.map(access => {
        const matches = user.rol === access.rol && user.actorId === access.actorId && !user.empresaContexto;
        return matches && onCurrent ? <Button key={access.rol} onClick={onCurrent}>Abrir como {labels[access.rol]}</Button>
          : matches ? <Link key={access.rol} className="inline-flex min-h-11 items-center rounded-lg bg-primary-700 px-4 py-3 font-semibold text-white"
          to={mp(safeTarget)}>Abrir como {labels[access.rol]}</Link>
          : <Button key={access.rol} disabled={busy} onClick={() => void open(access)}>Abrir como {labels[access.rol]}</Button>;
      })}
    </div>}
    {incomplete && <div role="alert" className="space-y-2 text-sm text-neutral-700"><p>No pudimos comprobar todas tus actividades. Reintentá antes de elegir otra.</p>
      <Button variant="outline" onClick={() => void query.refetch()}>Reintentar comprobación</Button></div>}
    {error && <p role="alert" className="text-sm text-error-700">{error}</p>}
  </div>;
}

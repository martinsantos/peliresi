import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/ButtonV2';
import api, { getAccessToken } from '../../../services/api';
import { registrationDraftHint, registrationSessionOwner } from '../../../services/registrationSession';
import type { TipoActor } from './shared';

/** No public CUIT lookup. The authenticated profile is the authoritative owner,
 * and existing actors continue through their existing review/update circuit. */
export function RegisteredAccount({ type, children }: { type: TipoActor; children: ReactNode }) {
  const navigate = useNavigate();
  const [actor, setActor] = useState<{ razonSocial: string; cuit: string; domicilio: string } | null>(null);
  useEffect(() => {
    let active = true;
    const token = getAccessToken(), owner = registrationSessionOwner(token);
    if (!owner || (token && registrationDraftHint(token))) return;
    api.get('/auth/profile').then(response => {
      const user = response.data?.data?.user;
      if (!active || registrationSessionOwner(getAccessToken()) !== owner || user?.id !== owner || !user.activo || user.rol !== type) return;
      const record = user[type.toLowerCase()];
      if (record) setActor({ razonSocial: record.razonSocial, cuit: record.cuit, domicilio: record.domicilio });
    }).catch(() => { /* no private fallback from local storage or public identity */ });
    const boundary = () => { if (registrationSessionOwner(getAccessToken()) !== owner) setActor(null); };
    window.addEventListener('storage', boundary); window.addEventListener('focus', boundary);
    return () => { active = false; window.removeEventListener('storage', boundary); window.removeEventListener('focus', boundary); };
  }, [type]);
  if (!actor) return children;
  return <section className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4" aria-label="Datos de tu padrón">
    <h3 className="text-lg font-semibold text-neutral-900">Ya estás en el padrón</h3>
    <dl className="space-y-2 text-sm"><div><dt className="text-neutral-600">Razón social</dt><dd className="font-semibold text-neutral-900">{actor.razonSocial}</dd></div><div><dt className="text-neutral-600">CUIT</dt><dd className="text-neutral-900">{actor.cuit}</dd></div><div><dt className="text-neutral-600">Domicilio registrado</dt><dd className="text-neutral-900">{actor.domicilio || 'Sin domicilio registrado'}</dd></div></dl>
    <p className="text-sm leading-6 text-neutral-700">Estos datos provienen de tu cuenta verificada. No hace falta crear otra cuenta ni duplicar la ficha.</p>
    <Button fullWidth onClick={() => navigate(type === 'TRANSPORTISTA' ? '/mi-perfil' : '/mi-perfil/solicitar-cambios')}>{type === 'TRANSPORTISTA' ? 'Revisar mi ficha y documentación' : 'Revisar mis datos precargados'}</Button>
    <p className="text-xs leading-5 text-neutral-600">Las modificaciones sujetas a aprobación siguen su circuito administrativo; no se reemplaza el padrón automáticamente.</p>
  </section>;
}

import { useEffect, useRef, useState } from 'react';
import api, { getAccessToken } from '../services/api';
import { registrationSessionOwner } from '../services/registrationSession';
import { clearRegistrationDraft, readRegistrationDraft, writeRegistrationDraft, type RegistrationDraft } from '../services/registrationDraft';
import { getApiErrorMessage } from '../utils/api-error';
import { useInspectionDraftOwnership } from './useInspectionDraftOwnership';

/** Administrative form recovery, not a second actor or a new server session. */
export function useActorRegistrationDraft(type: 'GENERADOR' | 'OPERADOR' | 'TRANSPORTISTA', actorId: string | undefined,
  data: Record<string, unknown>, onRestore: (value: Record<string, unknown>) => void, dirty: boolean) {
  const owner = registrationSessionOwner(getAccessToken());
  const scope = `admin:${type}:${actorId || 'new'}`;
  const [verified, setVerified] = useState<string | null>(null);
  const [available, setAvailable] = useState<RegistrationDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const dataRef = useRef(data); dataRef.current = data;
  const restoreRef = useRef(onRestore); restoreRef.current = onRestore;
  const previousOwner = useRef(owner);
  const paused = useRef(false);
  const serialized = JSON.stringify(data);
  const ownership = useInspectionDraftOwnership(`registration:${owner}:${scope}`, Boolean(owner && verified === owner));
  useEffect(() => {
    let cancelled = false; setVerified(null); setAvailable(null); setSaved(false); setError(null); paused.current = false;
    if (previousOwner.current !== owner) { restoreRef.current({}); previousOwner.current = owner; }
    if (!owner) return;
    api.get('/auth/profile').then(response => {
      if (cancelled || registrationSessionOwner(getAccessToken()) !== owner) return;
      if (response.data?.data?.user?.id !== owner) throw new Error('La sesión no corresponde al borrador');
      setVerified(owner); setAvailable(readRegistrationDraft(owner, scope));
    }).catch(() => { if (!cancelled) setError('No se pudo verificar la cuenta para recuperar el borrador. Los datos siguen en pantalla.'); });
    return () => { cancelled = true; };
  }, [owner, scope]);
  const assertSession = () => {
    if (!owner || verified !== owner || registrationSessionOwner(getAccessToken()) !== owner) throw new Error('La sesión cambió o no está verificada. Iniciá sesión antes de guardar.');
    if (!ownership.canWrite()) throw new Error('El borrador está abierto en otra pestaña o no se pudo proteger su edición. Cerrá la otra pestaña y reintentá.');
  };
  const checkpoint = (value = dataRef.current) => {
    try {
      assertSession();
      if (available || paused.current) throw new Error('Elegí si querés recuperar el borrador anterior antes de reemplazarlo.');
      const ok = writeRegistrationDraft(owner!, scope, value); setSaved(ok);
      if (!ok) setError('No se pudo guardar en este dispositivo. Los datos siguen en pantalla; no cierres el formulario.');
      else setError(null);
      return ok;
    } catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo guardar el borrador')); return false; }
  };
  useEffect(() => {
    if (verified !== owner || !owner || available || !dirty || paused.current || !ownership.canWrite()) return;
    const ok = writeRegistrationDraft(owner, scope, dataRef.current); setSaved(ok);
    if (!ok) setError('No se pudo guardar en este dispositivo. Los datos siguen en pantalla; no cierres el formulario.');
  }, [serialized, verified, owner, scope, available, dirty, ownership.status, ownership.canWrite]);
  const restore = async () => {
    if (!available || restoring) return;
    setRestoring(true); setError(null);
    try {
      assertSession();
      const proposed = { ...available.data };
      if (typeof proposed.savedActorId === 'string') {
        const plural = type === 'GENERADOR' ? 'generadores' : type === 'OPERADOR' ? 'operadores' : 'transportistas';
        const actor = await api.get(`/actores/${plural}/${proposed.savedActorId}`); assertSession();
        const actual = actor.data.data[type.toLowerCase()] || actor.data.data;
        const form = proposed.form as Record<string, unknown> | undefined;
        if (!form || String(actual.cuit).replace(/\D/g, '') !== String(form.cuit).replace(/\D/g, '')) throw new Error('La ficha guardada no coincide con el CUIT del borrador. No se repetirá ni modificará el alta.');
        const documents = await api.get(`/actores/${plural}/${proposed.savedActorId}/documentos`); assertSession();
        const confirmed = documents.data.data.documentos || [];
        proposed.uploadedDocs = Object.fromEntries(confirmed.map((item: { tipo: string; nombre: string }) => [item.tipo, item.nombre]));
        proposed.savedDocuments = confirmed;
      }
      restoreRef.current(proposed); setAvailable(null); setSaved(true);
    } catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo recuperar el borrador. Se conserva sin reemplazarlo.')); }
    finally { setRestoring(false); }
  };
  const discard = () => {
    try { assertSession(); clearRegistrationDraft(owner!, scope); setAvailable(null); setSaved(false); }
    catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo iniciar otro borrador')); }
  };
  const clear = () => { paused.current = true; if (owner) clearRegistrationDraft(owner, scope); };
  return { owner, available, saved, error, restoring, checkpoint, restore, discard, clear, assertSession,
    blocked: ownership.status === 'blocked' || (verified === owner && ownership.status === 'unavailable'), retry: ownership.retry };
}

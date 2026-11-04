import { useEffect, useRef, useState } from 'react';
import { clearInvitationPreparation, INVITATION_PREPARATION_PREFIX, isUncertainInvitation, readInvitationPreparation, writeInvitationPreparation, type InvitationPreparation } from '../services/invitationPreparation';

type InvitationRead = { puedeGestionar: boolean; invitaciones: Array<{ email: string; actividadId: string; venceAt: string; aceptadaAt?: string | null; revocadaAt?: string | null }> };
export function useInvitationPreparation(scope: string) {
  const [pending, setPending] = useState(() => readInvitationPreparation(scope));
  const [result, setResult] = useState('');
  const [checked, setChecked] = useState<InvitationPreparation | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const lock = useRef(false);
  const active = useRef(true);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (!event.key || event.key === INVITATION_PREPARATION_PREFIX + scope) {
        const current = readInvitationPreparation(scope);
        pendingRef.current = current; setPending(current); setResult(''); setChecked(null);
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [scope]);
  const clear = (receipt: InvitationPreparation) => {
    const stored = readInvitationPreparation(scope);
    if (stored && stored.id !== receipt.id) { setPending(stored); return false; }
    const cleared = clearInvitationPreparation(scope, receipt.id);
    setStorageFailed(!cleared);
    setPending(current => current?.id === receipt.id ? null : current);
    // A verified server read can resolve the in-memory result even if this browser cannot clear its copy.
    return true;
  };
  return {
    pending, checked, result, storageFailed, checking,
    canReceive(receipt: InvitationPreparation) { return active.current && pendingRef.current?.id === receipt.id; },
    begin(email: string, activityId: string) {
      const stored = readInvitationPreparation(scope);
      const existing = pending || (stored?.id === checked?.id ? null : stored);
      if (existing) { setPending(existing); return null; }
      const receipt = { id: crypto.randomUUID(), email, activityId, startedAt: Date.now() };
      setStorageFailed(!writeInvitationPreparation(scope, receipt));
      pendingRef.current = receipt; setPending(receipt); setResult(''); setChecked(null);
      return receipt;
    },
    confirmed: clear,
    failed(error: unknown, receipt: InvitationPreparation) {
      if (!isUncertainInvitation(error)) { clear(receipt); return false; }
      setPending(receipt); setResult(''); return true;
    },
    async check(refresh: () => Promise<InvitationRead | undefined>) {
      if (!pending || lock.current) return;
      lock.current = true; setChecking(true); setResult('');
      try {
        const details = await refresh();
        if (!details?.puedeGestionar) {
          setResult('No pudimos comprobar la preparación. Reintentá la consulta cuando recuperes el acceso a esta empresa.');
          return;
        }
        const current = details.invitaciones.find(i => i.email.toLowerCase() === pending.email && i.actividadId === pending.activityId && !i.aceptadaAt && !i.revocadaAt && new Date(i.venceAt).getTime() > Date.now());
        if (!clear(pending)) {
          setResult('La empresa fue consultada, pero no pudimos retirar el pendiente de este dispositivo. Revisá Accesos e invitaciones antes de continuar.');
          return;
        }
        setChecked(pending);
        setResult(current
          ? 'Hay una invitación vigente para esta persona y rol. Revisala en Accesos e invitaciones. Si no recibiste el enlace, revocá esa invitación antes de preparar otra.'
          : 'No figura una invitación vigente para esta persona y rol. Revisá los accesos y los datos conservados antes de preparar otra. Esta comprobación no envió una invitación.');
      } catch {
        setResult('No pudimos comprobar la preparación. Conservamos el pendiente; reintentá la consulta.');
      } finally { lock.current = false; setChecking(false); }
    },
  };
}

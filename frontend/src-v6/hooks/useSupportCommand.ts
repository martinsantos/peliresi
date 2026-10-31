import { useEffect, useRef, useState } from 'react';
import { supportService } from '../services/support.service';
import { supportRequestContext, supportSessionMatches } from '../utils/supportSession';
import { claimSupportCommand, confirmSupportCommand, rejectSupportCommand, loadSupportCommand, releaseSupportCommand, supportCommandKey,
  type SupportCommand, type SupportCommandInput, type SupportCommandScope } from '../services/supportCommand';

const message = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message
  || (failure instanceof Error ? failure.message : 'No pudimos confirmar el envío.');

/** The parent must remount for each verified account/role/ticket context. No automatic sends. */
export function useSupportCommand(scope: SupportCommandScope) {
  const key = supportCommandKey(scope);
  const [command, setCommand] = useState<SupportCommand | null>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), inFlight = useRef(false), generation = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const requestContext = useRef(supportRequestContext());
  const active = () => alive.current && supportSessionMatches(scope.userId) && !!requestContext.current && requestContext.current === supportRequestContext();
  const announce = () => channel.current?.postMessage('changed');
  const reload = async () => {
    if (inFlight.current) return;
    const read = ++generation.current;
    try {
      const saved = await loadSupportCommand(scope);
      if (!active() || read !== generation.current) return;
      setCommand(saved); setReady(true); setError('');
    } catch (failure) { if (active() && read === generation.current) { setReady(false); setError(message(failure)); } }
  };
  useEffect(() => {
    alive.current = true; void reload();
    const focus = () => void reload();
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('sitrep-support-command-' + key);
      channel.current.onmessage = focus;
    }
    window.addEventListener('focus', focus);
    return () => { alive.current = false; generation.current += 1; channel.current?.close(); channel.current = null; window.removeEventListener('focus', focus); };
  }, [key]);
  const run = async (proposed?: SupportCommandInput) => {
    if (inFlight.current || !ready || !active()) return;
    inFlight.current = true; generation.current += 1; setBusy(true); setError('');
    try {
      const saved = proposed ? await claimSupportCommand(scope, proposed) : await loadSupportCommand(scope);
      if (!active()) return;
      setCommand(saved); announce();
      if (!saved) { setError('No hay un envío pendiente para reintentar.'); return; }
      if (proposed && saved.key !== proposed.key) { setError('Hay un envío anterior guardado. Confirmá su resultado antes de preparar otro.'); return; }
      if (saved.status !== 'pending') return;
      let receipt;
      try { receipt = await supportService.act(scope.ticketId, saved.input, saved.files, saved.key); }
      catch (failure) {
        if ((failure as { response?: { data?: { code?: string } } }).response?.data?.code === 'SUPPORT_ACTION_NOT_APPLIED') {
          const rejected = await rejectSupportCommand(scope, saved.key, message(failure));
          if (active()) setCommand(rejected);
          announce();
        } else if (active()) setError(message(failure));
        return;
      }
      // Preserve the HTTP acknowledgement even when saving it locally fails.
      if (receipt.id !== scope.ticketId || !Number.isSafeInteger(receipt.version)) {
        if (active()) setError('No pudimos verificar la confirmación. Conservamos el mismo envío.'); return;
      }
      if (active()) setCommand({ ...saved, status: 'confirmed', receipt });
      try {
        const confirmed = await confirmSupportCommand(scope, saved.key, receipt);
        if (active()) setCommand(confirmed);
        announce();
      } catch { if (active()) setError('El servidor confirmó la acción. No pudimos guardar su confirmación aquí; al reabrir se conservará la misma clave de envío.'); }
    } catch (failure) { if (active()) setError('No se envió esta solicitud: ' + message(failure)); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  const recover = async () => {
    if (inFlight.current || !ready || !active()) return;
    inFlight.current = true; generation.current += 1; setBusy(true); setError('');
    try {
      const saved = await loadSupportCommand(scope);
      if (!active()) return;
      setCommand(saved);
      if (!saved || saved.status !== 'pending') return;
      const result = await supportService.recoverAction(scope.ticketId, saved.key);
      if (result.id !== scope.ticketId || !Number.isSafeInteger(result.version) || !['confirmed', 'rejected'].includes(result.status)) {
        throw new Error('No pudimos verificar el resultado. Conservamos el envío sin cambios.');
      }
      const resolved = result.status === 'confirmed'
        ? await confirmSupportCommand(scope, saved.key, result)
        : await rejectSupportCommand(scope, saved.key, 'El servidor retiró este envío. Podés corregir el texto y los archivos.');
      if (active()) setCommand(resolved);
      announce();
    } catch (failure) { if (active()) setError(message(failure)); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  const release = async (beforeRelease: (saved: SupportCommand) => Promise<void>) => {
    if (inFlight.current || !active() || !command || command.status === 'pending') return;
    inFlight.current = true; generation.current += 1; setBusy(true); setError('');
    try {
      // Verify the durable record before cleaning any draft. The server can
      // have confirmed while the local confirmation write failed. Persist
      // that acknowledgement again without retransmitting the action.
      let saved = await loadSupportCommand(scope);
      if (!active()) return;
      if (!saved || saved.key !== command.key) throw new Error('El envío guardado cambió. Conservamos el resultado; reintentá.');
      if (saved.status === 'pending' && command.status === 'confirmed' && command.receipt) {
        saved = await confirmSupportCommand(scope, command.key, command.receipt);
      }
      if (!active()) return;
      if (saved.status !== command.status) throw new Error('No pudimos guardar el resultado. Conservamos el envío; reintentá.');
      // Cleanup can fail; keep the receipt until it succeeds, preventing a new send.
      await beforeRelease(saved);
      if (!active()) return;
      await releaseSupportCommand(scope, command.key);
      if (active()) setCommand(null);
      announce();
    } catch (failure) { if (active()) setError(message(failure)); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  return { command, ready, busy, error, reload, submit: run, retry: () => run(), recover, release };
}

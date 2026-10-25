import { useEffect, useRef, useState } from 'react';
import { inspeccionService } from '../services/inspeccion.service';
import { matchingExchangeReceipt } from '../services/inspectionCommandReceipt';
import type { InspectionExchangeTimeline } from '../types/inspection';
import {
  claimExchangeCommand, exchangeCommandKey, loadExchangeCommand, releaseExchangeCommand, settleExchangeCommand,
  type ExchangeCommand, type ExchangeCommandInput, type ExchangeCommandScope,
} from '../services/inspectionExchangeCommand';

const messageOf = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  || (error instanceof Error ? error.message : 'No pudimos confirmar el resultado.');

/** Never auto-sends on mount, focus or reconnection. Retry uses the saved bytes. */
export function useInspectionExchangeCommand(scope: ExchangeCommandScope) {
  const key = exchangeCommandKey(scope);
  const [command, setCommand] = useState<ExchangeCommand | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const alive = useRef(true);
  const generation = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const announce = () => channel.current?.postMessage('changed');
  const reload = async () => {
    if (inFlight.current) return;
    const read = ++generation.current;
    try {
      const saved = await loadExchangeCommand(scope);
      if (!alive.current || read !== generation.current) return;
      setCommand(saved); setReady(true); setError('');
    } catch (failure) {
      if (alive.current && read === generation.current) { setReady(false); setError(messageOf(failure)); }
    }
  };
  useEffect(() => {
    alive.current = true;
    void reload();
    const onFocus = () => void reload();
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('sitrep-exchange-' + key);
      channel.current.onmessage = onFocus;
    }
    window.addEventListener('focus', onFocus);
    return () => { alive.current = false; generation.current += 1; channel.current?.close(); channel.current = null; window.removeEventListener('focus', onFocus); };
  }, [key]); // Scoped panel remounts when the account/role/case changes.

  const send = async (saved: ExchangeCommand) => {
    if (saved.status !== 'pending' || !alive.current) return;
    let receipt;
    try {
      receipt = saved.kind === 'presentation'
        ? await inspeccionService.presentExchange(scope.inspectionId, saved.input)
        : await inspeccionService.decideExchange(scope.inspectionId, saved.input);
    } catch (failure) {
      const code = (failure as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'INSPECTION_COMMAND_NOT_APPLIED') {
        try {
          const rejected = await settleExchangeCommand(scope, saved.input.clienteId, { status: 'rejected', rejection: messageOf(failure) });
          if (alive.current) setCommand(rejected);
          announce();
        } catch (storageFailure) { if (alive.current) setError(messageOf(storageFailure)); }
      } else if (alive.current) setError(messageOf(failure));
      return;
    }
    // The HTTP receipt is authoritative even if local saving or UI refresh fails.
    const confirmed = { ...saved, status: 'confirmed' as const, receipt };
    if (alive.current) setCommand(confirmed);
    try {
      const recorded = await settleExchangeCommand(scope, saved.input.clienteId, { status: 'confirmed', receipt });
      if (alive.current) setCommand(recorded);
      announce();
    } catch {
      if (alive.current) setError('El servidor confirmó el registro. No pudimos guardar esa confirmación en este dispositivo; al reabrir, el reintento consultará el mismo envío.');
    }
  };
  const run = async (proposed?: ExchangeCommandInput) => {
    if (inFlight.current || !ready || !navigator.onLine) return;
    inFlight.current = true; generation.current += 1; setBusy(true); setError('');
    try {
      const saved = proposed ? await claimExchangeCommand(scope, proposed) : await loadExchangeCommand(scope);
      if (!alive.current) return;
      if (!saved) { setCommand(null); setError('No hay un envío pendiente para reintentar.'); return; }
      setCommand(saved); announce();
      if (proposed && saved.input.clienteId !== proposed.input.clienteId) {
        setError('Hay un envío anterior en este expediente. Resolvé su confirmación antes de preparar otro.');
        return;
      }
      await send(saved);
    } catch (failure) {
      if (alive.current) setError('No se envió esta solicitud: ' + messageOf(failure));
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  const release = async (beforeRelease: (saved: ExchangeCommand) => Promise<void>) => {
    if (inFlight.current || !command || command.status === 'pending') return;
    inFlight.current = true; generation.current += 1; setBusy(true); setError('');
    try {
      // Cleanup/restore must finish before the durable acknowledgement is removed.
      await beforeRelease(command);
      await releaseExchangeCommand(scope, command.input.clienteId);
      if (alive.current) setCommand(null);
      announce();
    } catch (failure) { if (alive.current) setError(messageOf(failure)); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  const reconcile = async (timeline: InspectionExchangeTimeline) => {
    if (inFlight.current || !command || command.status !== 'pending' || timeline.inspeccion.id !== scope.inspectionId) return;
    const read = generation.current;
    try {
      const receipt = await matchingExchangeReceipt(command, timeline.intercambios, timeline.parteActual);
      if (!receipt || !alive.current || inFlight.current || read !== generation.current) return;
      const recorded = await settleExchangeCommand(scope, command.input.clienteId, { status: 'confirmed', receipt });
      if (!alive.current || read !== generation.current) return;
      setCommand(recorded); setError(''); announce();
    } catch {
      // A failed read/comparison cannot declare the command absent or change it.
      if (alive.current && read === generation.current) setError('No pudimos cotejar la confirmación guardada. Conservamos el envío para reintentar.');
    }
  };
  return { command, ready, busy, error, reload, submit: run, retry: () => run(), release, reconcile };
}

import { useEffect, useRef, useState } from 'react';
import { useInspectionDraftOwnership } from './useInspectionDraftOwnership';
import { supportRequestContext, supportSessionMatches } from '../utils/supportSession';
import { supportCommandKey, type SupportCommand, type SupportCommandScope } from '../services/supportCommand';
import { emptySupportActionDraft, emptySupportWorkspace, readSupportActionDraft, resolveSupportDraft, writeSupportActionDraft,
  type SupportActionDraft, type SupportDraftWorkspace } from '../services/supportActionDraft';
import type { SupportAction } from '../types/support';

/** One editor per scoped ticket. Completed audio/files stay device-local; no background sends. */
export function useSupportActionDraft(scope: SupportCommandScope) {
  const id = supportCommandKey(scope);
  const ownership = useInspectionDraftOwnership('support:' + id, true);
  const [workspace, setWorkspace] = useState(emptySupportWorkspace);
  const current = useRef(workspace);
  const [ready, setReady] = useState(false), readyRef = useRef(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [restored, setRestored] = useState(false);
  const alive = useRef(true), writes = useRef(0), saved = useRef(true);
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const requestContext = useRef(supportRequestContext());
  const active = () => alive.current && supportSessionMatches(scope.userId) && !!requestContext.current && requestContext.current === supportRequestContext();
  const canWrite = () => active() && readyRef.current && ownership.canWrite();
  const read = async () => {
    if (!active() || !ownership.canWrite() || writes.current) return;
    readyRef.current = false; setReady(false); setError('');
    try {
      const value = await readSupportActionDraft(scope);
      if (!active() || !ownership.canWrite()) return;
      current.current = value || emptySupportWorkspace(); setWorkspace(current.current);
      setRestored(!!value && Object.keys(value.drafts).length > 0);
      saved.current = true; readyRef.current = true; setReady(true);
    } catch { if (active()) setError('No pudimos leer el borrador. Reintentá antes de editar para no reemplazar una copia anterior.'); }
  };
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; readyRef.current = false; };
  }, [id]);
  useEffect(() => { if (ownership.status === 'owned') void read(); }, [id, ownership.status]);
  useEffect(() => {
    const closing = (event: BeforeUnloadEvent) => {
      if (!saved.current || writes.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', closing);
    return () => window.removeEventListener('beforeunload', closing);
  }, []);
  const persist = (next: SupportDraftWorkspace) => {
    if (!canWrite()) return Promise.resolve(false);
    current.current = next; setWorkspace(next); saved.current = false;
    writes.current += 1; setSaving(true); setError('');
    const task = async () => {
      try {
        await writeSupportActionDraft(scope, next, canWrite);
        if (canWrite() && current.current === next) { saved.current = true; setError(''); }
        return true;
      } catch {
        if (active()) setError('No se guardó el borrador en este dispositivo. El contenido sigue en pantalla: no cierres y reintentá guardar.');
        return false;
      } finally {
        writes.current -= 1;
        if (alive.current) setSaving(writes.current > 0);
      }
    };
    const result = queue.current.then(task, task); queue.current = result; return result;
  };
  const update = (action: SupportAction, version: number, patch: Partial<SupportActionDraft>) => {
    if (!canWrite()) return;
    void persist({ ...current.current, drafts: { ...current.current.drafts,
      [action]: { ...(current.current.drafts[action] || emptySupportActionDraft(version)), ...patch } } });
  };
  const select = (action: SupportAction) => { if (canWrite()) void persist({ ...current.current, action }); };
  const flush = async () => {
    await queue.current;
    if (!canWrite()) return false;
    return saved.current || await persist(current.current);
  };
  const finish = async (command: SupportCommand) => {
    await queue.current;
    if (!canWrite() || !await persist(resolveSupportDraft(current.current, command))) {
      throw new Error('No se confirmó la limpieza del borrador. Conservamos el resultado del envío; reintentá continuar.');
    }
    setRestored(false);
  };
  return { workspace, ready, saving, error, restored, ownership, canWrite, update, select, flush, finish, reload: read };
}

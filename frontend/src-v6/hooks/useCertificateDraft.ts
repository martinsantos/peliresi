import { useEffect, useRef, useState } from 'react';
import { useInspectionDraftOwnership } from './useInspectionDraftOwnership';
import { supportRequestContext, supportSessionMatches } from '../utils/supportSession';
import { certificateDraftKey, readCertificateDraft, writeCertificateDraft, draftAfterCertificate, type CertificateDraft } from '../services/certificateDraft';
import type { CertificateScope, CertificateCommand } from '../services/certificateCommand';

/** One scoped editor; every change is queued locally, never sent in the background. */
export function useCertificateDraft(scope: CertificateScope, enabled: boolean) {
  const id = certificateDraftKey(scope);
  const ownership = useInspectionDraftOwnership(id, enabled);
  const [draft, setDraft] = useState<CertificateDraft | null>(null);
  const current = useRef<CertificateDraft | null>(null);
  const [ready, setReady] = useState(!enabled), readyRef = useRef(!enabled);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [restored, setRestored] = useState(false);
  const alive = useRef(true), writes = useRef(0), saved = useRef(true);
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const context = useRef(supportRequestContext());
  const active = () => enabled && alive.current && supportSessionMatches(scope.userId) && !!context.current && context.current === supportRequestContext();
  const canWrite = () => active() && readyRef.current && ownership.canWrite();
  const read = async () => {
    if (!active() || !ownership.canWrite() || writes.current || !saved.current) return;
    readyRef.current = false; setReady(false); setError('');
    try {
      const value = await readCertificateDraft(scope);
      if (!active() || !ownership.canWrite()) return;
      current.current = value; setDraft(value); setRestored(!!value);
      saved.current = true; readyRef.current = true; setReady(true);
    } catch { if (active()) setError('No pudimos leer el borrador. Reintentá antes de editar para no reemplazar la copia anterior.'); }
  };
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; readyRef.current = false; };
  }, [id]);
  useEffect(() => { if (enabled && ownership.status === 'owned') void read(); }, [id, enabled, ownership.status]);
  useEffect(() => {
    const closing = (event: BeforeUnloadEvent) => {
      if (!saved.current || writes.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', closing);
    return () => window.removeEventListener('beforeunload', closing);
  }, []);
  const persist = (next: CertificateDraft | null) => {
    if (!canWrite()) return Promise.resolve(false);
    current.current = next; setDraft(next); saved.current = false;
    writes.current += 1; setSaving(true); setError('');
    const task = async () => {
      try {
        await writeCertificateDraft(scope, next, canWrite);
        if (canWrite() && current.current === next) { saved.current = true; setError(''); }
        return true;
      } catch {
        if (active()) setError('No se guardó el borrador en este dispositivo. Conservamos lo escrito: no cierres y reintentá guardar.');
        return false;
      } finally {
        writes.current -= 1;
        if (alive.current) setSaving(writes.current > 0);
      }
    };
    const result = queue.current.then(task, task); queue.current = result; return result;
  };
  const update = (patch: Partial<CertificateDraft>) => {
    if (current.current && canWrite()) void persist({ ...current.current, ...patch });
  };
  const flush = async () => {
    await queue.current;
    if (!canWrite()) return false;
    return saved.current || await persist(current.current);
  };
  const finish = async (command: CertificateCommand) => {
    await queue.current;
    if (!canWrite() || !await persist(draftAfterCertificate(command))) {
      throw Error('No se confirmó la actualización del borrador. Conservamos el resultado del envío; reintentá continuar.');
    }
    setRestored(command.status === 'withdrawn');
  };
  return { draft, ready, saving, error, restored, ownership, canWrite, update,
    replace: persist, flush, finish, reload: read };
}

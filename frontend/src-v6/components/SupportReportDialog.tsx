import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LifeBuoy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { Modal } from './ui/Modal';
import { Button } from './ui/ButtonV2';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { supportService, supportError } from '../services/support.service';
import { clearSupportDraft, readSupportDraft, writeSupportDraft, supportFileDigests, type SupportDraft } from '../utils/supportDraft';
import { supportCategories, type SupportCategory, type SupportCreate } from '../types/support';

export function SupportReportDialog({ open, onClose, onSubmitted }: { open: boolean; onClose: () => void; onSubmitted?: () => void }) {
  const { currentUser } = useAuth();
  const { impersonationData, exitImpersonation } = useImpersonation();
  if (!open || !currentUser) return null;
  // Existing impersonation tokens identify the represented account, not the
  // human administrator. Do not pretend a local role label proves authorship.
  if (impersonationData) return <Modal isOpen onClose={onClose} title="Reportar con tu cuenta">
    <p className="text-neutral-700 mb-4">Estás viendo otra cuenta. Volvé a tu sesión para que el ticket quede a tu nombre.</p>
    <Button onClick={exitImpersonation}>Volver a mi sesión</Button>
  </Modal>;
  return <ReportForm key={String(currentUser.id)} owner={String(currentUser.id)} onClose={onClose} onSubmitted={onSubmitted} />;
}

function ReportForm({ owner, onClose, onSubmitted }: { owner: string; onClose: () => void; onSubmitted?: () => void }) {
  const initial = useRef(readSupportDraft(owner));
  const [draft, setDraft] = useState<SupportDraft>(initial.current || { asunto: '', descripcion: '', categoria: 'GENERAL' });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const acknowledged = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mp = useMobilePrefix();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!acknowledged.current) setSaved(writeSupportDraft(owner, draft)); }, [owner, draft]);
  const complete = (ticket: { id: string }) => {
    acknowledged.current = true; clearSupportDraft(owner);
    // Invalidate only after the server acknowledges this owner's report. The
    // list may still be fresh in React Query when returning from the detail.
    void queryClient.invalidateQueries({ queryKey: ['soporte', owner] });
    if (mounted.current) { onClose(); onSubmitted?.(); navigate(mp('/soporte/' + ticket.id)); }
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      if (!navigator.onLine) throw new Error('offline');
      const digests = await supportFileDigests(files);
      const pending = draft.pendiente;
      if (pending && JSON.stringify(digests) !== JSON.stringify(pending.files)) throw new Error('Adjuntá los mismos archivos para reintentar este envío. También podés comprobar si ya llegó.');
      const input: SupportCreate = pending?.input || { asunto: draft.asunto, descripcion: draft.descripcion, categoria: draft.categoria,
        contexto: { ruta: location.pathname, ancho: innerWidth, alto: innerHeight, online: navigator.onLine } };
      const key = pending?.key || crypto.randomUUID();
      const frozen = { ...draft, pendiente: { key, input, files: digests } };
      setDraft(frozen); writeSupportDraft(owner, frozen);
      complete(await supportService.create(input, files, key));
    } catch (failure) {
      if (failure instanceof Error && failure.message.startsWith('Adjuntá')) setError(failure.message);
      else setError(supportError(failure));
      // Validation failures prove the transaction was rejected. A timeout does
      // not: keep its exact body/key and do not silently create a second ticket.
      const status = (failure as { response?: { status?: number } }).response?.status;
      if (status === 400 || status === 413 || status === 422) setDraft(previous => ({ ...previous, pendiente: undefined }));
    } finally { inFlight.current = false; setBusy(false); }
  };
  const check = async () => {
    if (!draft.pendiente || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { complete(await supportService.sent(draft.pendiente.key)); }
    catch (failure) { setError((failure as { response?: { status?: number } }).response?.status === 404
      ? 'Todavía no hay constancia del ticket. Reintentá el mismo envío; no se generará un duplicado.' : supportError(failure)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const update = (change: Partial<SupportDraft>) => setDraft(previous => ({ ...previous, ...change }));
  return <Modal isOpen onClose={onClose} title="Reportar un problema" description="Tu reporte queda en Soporte de SITREP. No modifica el trámite que estás completando."
    isBusy={busy} footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Continuar luego</Button>
      <Button type="submit" form="sitrep-support-report" isLoading={busy} disabled={draft.asunto.trim().length < 5 || draft.descripcion.trim().length < 10}>Enviar ticket</Button></>}>
    <form id="sitrep-support-report" onSubmit={send} className="space-y-4">
      <Input label="Asunto" helperText="Mínimo 5 caracteres." value={draft.asunto} maxLength={180} disabled={busy || !!draft.pendiente} onChange={event => update({ asunto: event.target.value })} required />
      <Select label="Área del problema" value={draft.categoria} onChange={value => update({ categoria: value as SupportCategory })}
        disabled={busy || !!draft.pendiente} options={Object.entries(supportCategories).map(([value, label]) => ({ value, label }))} />
      <label className="block text-sm font-medium text-neutral-700" htmlFor="support-description">¿Qué intentabas hacer y qué ocurrió?</label>
      <textarea id="support-description" value={draft.descripcion} onChange={event => update({ descripcion: event.target.value })} maxLength={8000} required minLength={10}
        aria-describedby="support-description-help" disabled={busy || !!draft.pendiente} rows={5} className="w-full rounded-lg border border-neutral-400 p-3 text-base text-neutral-900 focus-visible:outline-primary-700" />
      <p id="support-description-help" className="text-sm text-neutral-600">Mínimo 10 caracteres. Describí qué esperabas y qué viste.</p>
      <label className="block text-sm font-medium text-neutral-700" htmlFor="support-files">Capturas o documentos · opcional</label>
      <input id="support-files" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy}
        className="block w-full min-h-11 text-sm text-neutral-700 file:mr-2 file:min-h-11 file:rounded-lg file:border file:border-neutral-400 file:bg-white file:px-3 file:text-neutral-900"
        onChange={event => { const selected = Array.from(event.target.files || []); if (selected.length > 3 || selected.some(file => file.size > 5 * 1024 * 1024)) { setError('Hasta 3 archivos, de 5 MB cada uno.'); setFiles([]); event.target.value = ''; } else { setError(''); setFiles(selected); } }} />
      <p className="text-sm text-neutral-600">Hasta 3 archivos de 5 MB. No incluyas contraseñas ni datos ajenos al problema. Los archivos no se guardan en el borrador local.</p>
      {draft.pendiente && <div className="space-y-2 border-l-4 border-warning-600 pl-3 text-sm text-neutral-800"><p>Envío pendiente de confirmación. El texto se conserva sin cambios.</p>
        <Button variant="outline" disabled={busy} onClick={check}>Comprobar si llegó</Button></div>}
      {error && <p role="alert" className="text-sm text-error-700">{error}</p>}
      <p role="status" className="text-sm text-neutral-600">{saved ? 'Borrador guardado sólo en este dispositivo y para tu cuenta. No se envía automáticamente.' : 'Este navegador no permitió guardar el borrador. No cierres esta ventana hasta copiar tu texto.'}</p>
    </form>
  </Modal>;
}

export function SupportEntry({ className, onSubmitted }: { className?: string; onSubmitted?: () => void }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={className || 'inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-400 bg-white px-4 text-neutral-900 hover:bg-neutral-50 focus-visible:outline-primary-700'} onClick={() => setOpen(true)}>
    <LifeBuoy size={20} className="shrink-0" />Reportar problema</button><SupportReportDialog open={open} onClose={() => setOpen(false)} onSubmitted={onSubmitted} /></>;
}

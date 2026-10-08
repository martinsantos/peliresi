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
import { assertSupportSession, supportSessionMatches } from '../utils/supportSession';
import { supportCategories, supportFileAccept, type SupportCategory, type SupportCreate } from '../types/support';
import { SupportAudioInput } from './SupportAudioInput';

type ReportProps = { open: boolean; onClose: () => void; onSubmitted?: () => void; screenshot?: File; captureError?: string; returnToTask?: boolean; context?: SupportCreate['contexto'] };
export function SupportReportDialog({ open, onClose, onSubmitted, screenshot, captureError, returnToTask, context }: ReportProps) {
  const { currentUser } = useAuth();
  const { impersonationData, exitImpersonation } = useImpersonation();
  if (!open || !currentUser) return null;
  // Older impersonation tokens lack signed operator identity. Never invent it
  // from localStorage or submit an unsigned administrator ID in the payload.
  if (impersonationData && !supportSessionMatches(String(currentUser.id), String(impersonationData.adminUser.id))) return <Modal isOpen onClose={onClose} title="Renovar impersonación para reportar">
    <p className="text-neutral-700 mb-4">Esta sesión anterior no identifica al administrador que registra el reporte. Volvé a tu cuenta y seleccioná otra vez al usuario para reportar a su nombre.</p>
    <Button onClick={exitImpersonation}>Volver a mi sesión</Button>
  </Modal>;
  return <ReportForm key={String(currentUser.id)} owner={String(currentUser.id)} onClose={onClose} onSubmitted={onSubmitted}
    screenshot={screenshot} captureError={captureError} returnToTask={returnToTask} context={context}
    administratorId={impersonationData ? String(impersonationData.adminUser.id) : undefined} representedName={impersonationData ? currentUser.nombre : undefined} />;
}

function ReportForm({ owner, onClose, onSubmitted, screenshot, captureError, returnToTask, context, administratorId, representedName }: Omit<ReportProps, 'open'> & { owner: string; administratorId?: string; representedName?: string }) {
  const initial = useRef(readSupportDraft(owner));
  const [draft, setDraft] = useState<SupportDraft>(initial.current || { asunto: '', descripcion: '', categoria: 'GENERAL' });
  const [files, setFiles] = useState<File[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [screenFile, setScreenFile] = useState(initial.current?.pendiente ? undefined : screenshot);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const acknowledged = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(true);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const subjectInput = useRef<HTMLInputElement>(null);
  const descriptionInput = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const descriptionLength = draft.descripcion.trim().length;
  const shortDescription = descriptionLength === 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mp = useMobilePrefix();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!screenFile) { setPreview(''); return; }
    const url = URL.createObjectURL(screenFile); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [screenFile]);
  useEffect(() => { if (!acknowledged.current) setSaved(writeSupportDraft(owner, draft)); }, [owner, draft]);
  const complete = (ticket: { id: string }) => {
    acknowledged.current = true; clearSupportDraft(owner);
    // Invalidate only after the server acknowledges this owner's report. The
    // list may still be fresh in React Query when returning from the detail.
    if (mounted.current && supportSessionMatches(owner, administratorId)) {
      void queryClient.invalidateQueries({ queryKey: ['soporte', owner] });
      onClose(); onSubmitted?.(); if (!returnToTask) navigate(mp('/soporte/' + ticket.id));
    }
  };
  const send = async (event?: React.FormEvent, withoutAttachments = false) => {
    event?.preventDefault();
    if (inFlight.current || recording) return;
    // A disabled submit hides the reason, especially after scrolling on mobile.
    // Guide the human to the first incomplete field without freezing/sending it.
    if (shortDescription) {
      setValidationAttempted(true); setError('');
      descriptionInput.current?.focus();
      return;
    }
    inFlight.current = true; setBusy(true); setError('');
    try {
      if (!navigator.onLine) throw new Error('offline');
      assertSupportSession(owner, administratorId);
      const attachments = withoutAttachments ? [] : [...(screenFile ? [screenFile] : []), ...files, ...(audio ? [audio] : [])];
      if (attachments.length > 3) throw new Error('Adjuntá hasta 3 archivos, incluyendo la captura.');
      const digests = await supportFileDigests(attachments);
      if (!mounted.current) return;
      assertSupportSession(owner, administratorId);
      const pending = draft.pendiente;
      const changedFiles = pending && JSON.stringify(digests) !== JSON.stringify(pending.files);
      if (pending && (withoutAttachments || changedFiles)) {
        // A reload loses optional files, not the report. Reconcile first and
        // retain the SAME key: a racing original request cannot create a second
        // ticket even when the human explicitly chooses a text-only retry.
        try { const received = await supportService.sent(pending.key); complete(received); return; }
        catch (failure) { if ((failure as { response?: { status?: number } }).response?.status !== 404) throw failure; }
        if (!mounted.current) return;
        assertSupportSession(owner, administratorId);
        if (changedFiles && !withoutAttachments) throw new Error('Los adjuntos del intento anterior no están disponibles. Podés enviar solo el texto, sin volver a adjuntarlos.');
      }
      const input: SupportCreate = pending?.input || { asunto: draft.asunto.trim() || draft.descripcion.trim().split(/\r?\n/)[0].slice(0, 180), descripcion: draft.descripcion, categoria: draft.categoria,
        contexto: context || { ruta: location.pathname, ancho: innerWidth, alto: innerHeight, online: navigator.onLine } };
      const key = pending?.key || crypto.randomUUID();
      const frozen = { ...draft, pendiente: { key, input, files: digests } };
      setDraft(frozen); writeSupportDraft(owner, frozen);
      if (withoutAttachments) { setScreenFile(undefined); setFiles([]); setAudio(null); if (fileInput.current) fileInput.current.value = ''; }
      complete(await supportService.create(input, attachments, key));
    } catch (failure) {
      const status = (failure as { response?: { status?: number } }).response?.status;
      if (status === 409 && draft.pendiente) {
        // The original attachment upload may have committed after the 404.
        // Its owned receipt is authoritative; do not invent a new sending key.
        try { assertSupportSession(owner, administratorId); complete(await supportService.sent(draft.pendiente.key)); return; }
        catch { /* Keep the same pending key if reconciliation is unavailable. */ }
      }
      if (failure instanceof Error && (failure.message.startsWith('Adjuntá') || failure.message.startsWith('Los adjuntos'))) setError(failure.message);
      else setError(supportError(failure));
      // Validation failures prove the transaction was rejected. A timeout does
      // not: keep its exact body/key and do not silently create a second ticket.
      if (status === 400 || status === 413 || status === 422) setDraft(previous => ({ ...previous, pendiente: undefined }));
    } finally { inFlight.current = false; setBusy(false); }
  };
  const check = async () => {
    if (!draft.pendiente || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { assertSupportSession(owner, administratorId); complete(await supportService.sent(draft.pendiente.key)); }
    catch (failure) { setError((failure as { response?: { status?: number } }).response?.status === 404
      ? 'Todavía no hay constancia del ticket. Reintentá el mismo envío; no se generará un duplicado.' : supportError(failure)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const update = (change: Partial<SupportDraft>) => setDraft(previous => ({ ...previous, ...change }));
  return <Modal isOpen onClose={onClose} title="Reportar un problema" description="Tu reporte queda en Soporte de SITREP. No modifica el trámite que estás completando."
    isBusy={busy || recording} footer={<>
      <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Continuar luego</Button>
      <Button type="submit" form="sitrep-support-report" isLoading={busy} disabled={recording}>Enviar ticket</Button></>}>
    <form id="sitrep-support-report" onSubmit={send} noValidate className="space-y-4">
      {representedName && <p className="border-l-4 border-primary-700 pl-3 text-sm text-neutral-800">El ticket y las respuestas quedarán para {representedName}. Se registrará también el administrador que lo cargó.</p>}
      {preview && <figure className="space-y-2">
        <img src={preview} alt="Captura de la pantalla que estabas usando" className="max-h-48 w-full rounded-lg border border-neutral-200 object-contain" />
        <figcaption className="text-sm text-neutral-700">Esta captura se adjuntará al ticket. Revisá que no muestre datos que no quieras compartir.</figcaption>
        <Button type="button" variant="outline" disabled={busy || !!draft.pendiente} onClick={() => setScreenFile(undefined)}>Quitar captura</Button>
      </figure>}
      {captureError && <p role="status" className="text-sm text-neutral-700">{captureError}</p>}
      <Input ref={subjectInput} label="Asunto" helperText="Opcional. Si lo dejás vacío, usamos el inicio de tu descripción."
        value={draft.asunto} maxLength={180} disabled={busy || !!draft.pendiente} onChange={event => update({ asunto: event.target.value })} />
      <Select label="Área del problema" value={draft.categoria} onChange={value => update({ categoria: value as SupportCategory })}
        disabled={busy || !!draft.pendiente} options={Object.entries(supportCategories).map(([value, label]) => ({ value, label }))} />
      <label className="block text-sm font-medium text-neutral-700" htmlFor="support-description">¿Qué intentabas hacer y qué ocurrió?</label>
      <textarea ref={descriptionInput} id="support-description" value={draft.descripcion} onChange={event => update({ descripcion: event.target.value })} maxLength={8000} required
        aria-describedby="support-description-help" aria-invalid={validationAttempted && shortDescription} disabled={busy || !!draft.pendiente} rows={5}
        className={`w-full rounded-lg border p-3 text-base text-neutral-900 focus-visible:outline-primary-700 ${validationAttempted && shortDescription ? 'border-error-500' : 'border-neutral-400'}`} />
      <p id="support-description-help" className={validationAttempted && shortDescription ? 'text-sm text-error-700' : 'text-sm text-neutral-600'}>
        {validationAttempted && shortDescription ? 'Describí el problema para enviar el ticket.' : 'Contanos qué pasó. Podés enviar sólo texto.'}</p>
      <label className="block text-sm font-medium text-neutral-700" htmlFor="support-files">Capturas o documentos · opcional</label>
      <SupportAudioInput value={audio} onChange={setAudio} onBusyChange={setRecording} disabled={busy || !!draft.pendiente} />
      <input ref={fileInput} id="support-files" type="file" multiple accept={supportFileAccept} disabled={busy}
        className="block w-full min-h-11 text-sm text-neutral-700 file:mr-2 file:min-h-11 file:rounded-lg file:border file:border-neutral-400 file:bg-white file:px-3 file:text-neutral-900"
        onChange={event => { const selected = Array.from(event.target.files || []); if (selected.length + (screenFile ? 1 : 0) + (audio ? 1 : 0) > 3 || selected.some(file => file.size > 5 * 1024 * 1024)) { setError('Hasta 3 archivos, incluidos captura y audio, de 5 MB cada uno.'); setFiles([]); event.target.value = ''; } else { setError(''); setFiles(selected); } }} />
      <p className="text-sm text-neutral-600">Hasta 3 archivos de 5 MB. No incluyas contraseñas ni datos ajenos al problema. Los archivos no se guardan en el borrador local.</p>
      {draft.pendiente && <div className="space-y-2 border-l-4 border-warning-600 pl-3 text-sm text-neutral-800"><p>Envío pendiente de confirmación. El texto se conserva sin cambios.</p>
        <Button type="button" variant="outline" disabled={busy} onClick={check}>Comprobar si llegó</Button>
        {!!draft.pendiente.files.length && <><p>Si perdiste los adjuntos, podés enviar solo el texto. Primero comprobamos si el ticket ya llegó para no duplicarlo.</p>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void send(undefined, true)}>Enviar solo texto</Button></>}
      </div>}
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

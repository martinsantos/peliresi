
import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { inspectionContextKey, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import { actReplyDraftKey, readReplyDrafts, saveReplyDraft } from '../../services/inspectionActDrafts';
import { inspectionDate, inspectionErrorMessage } from './inspectionPresentation';

type ActMail = { id: string; eventoId: string; audiencia: 'INSPECCIONADO' | 'INSPECTOR' | 'JEFATURA'; destinatario: string; asunto: string; html: string; estado: string; motivo?: string | null };
const AUDIENCE: Record<ActMail['audiencia'], string> = { INSPECCIONADO: 'Inspeccionado', INSPECTOR: 'Inspector asignado', JEFATURA: 'Jefatura de inspecciones' };
function mailState(mail: ActMail) {
  if (mail.estado === 'ENVIADO') return 'Enviado';
  if (mail.estado === 'PENDIENTE') return 'En cola de envío';
  return mail.motivo === 'EMAIL_DISABLED' || mail.motivo === 'EVENT_NOT_ENABLED' || mail.motivo === 'ACTIVATION_CUTOFF_REQUIRED' || mail.motivo === 'ACTIVATION_NOT_STARTED' ? 'Preparado, no enviado: el envío de correos está desactivado' : 'No enviado';
}
function MailLedger({ mails }: { mails: ActMail[] }) {
  if (!mails.length) return null;
  return <details className="rounded-lg border border-neutral-200 p-3 text-sm"><summary className="min-h-11 cursor-pointer font-semibold">Avisos por correo ({mails.length})</summary><ul className="mt-2 space-y-3">{mails.map(mail => <li key={mail.id} className="space-y-1"><p><span className="font-semibold">{AUDIENCE[mail.audiencia]}</span> · <span className="break-all">{mail.destinatario}</span></p><p className="text-neutral-700">{mail.asunto.replace(/^\[SITREP\]\s*/, '')}</p><p className="text-xs text-neutral-600">{mailState(mail)}</p><details><summary className="min-h-11 cursor-pointer text-green-900 underline">Ver correo</summary><iframe title={`Correo para ${AUDIENCE[mail.audiencia]}`} sandbox="" srcDoc={mail.html} className="mt-2 h-[32rem] w-full rounded border bg-white" /></details></li>)}</ul></details>;
}

export function InspectionActAccessPanel({ inspection }: { inspection: any }) {
  const { currentUser } = useAuth(); const owner = inspectionWorkspaceOwner(currentUser);
  const contextKey = currentUser?.id && owner ? inspectionContextKey(currentUser.id, owner, inspection.id) : '';
  const [email, setEmail] = useState(inspection.datosActa?.contactoActa || ''); const [share, setShare] = useState<any>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const flight = useRef(false); const query = useQueryClient();
  const signatures = (inspection.eventos || []).filter((e: any) => e.tipo === 'ACTA_FIRMADA').sort((a: any, b: any) => Date.parse(b.createdAt) - Date.parse(a.createdAt)); const [selected, setSelected] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({}); const attempts = useRef<Record<string, string>>({});
  const [restored, setRestored] = useState<Record<string, string>>({}); const [conflicts, setConflicts] = useState<Record<string, boolean>>({}); const [storageFailed, setStorageFailed] = useState(false);
  const saved = useRef<Record<string, string>>({}); const live = useRef(replies); live.current = replies;
  const answers = (inspection.eventos || []).filter((e: any) => e.tipo === 'ACTA_PRESENTACION_RESPONDIDA');
  const answeredIds = new Set(answers.map((a: any) => a.metadata?.respondeAId));
  // Pending first, newest first: an unanswered presentation must not sink below answered ones.
  const presentations = (inspection.eventos || []).filter((e: any) => e.tipo === 'ACTA_PRESENTACION_RECIBIDA')
    .sort((a: any, b: any) => Number(answeredIds.has(a.id)) - Number(answeredIds.has(b.id)) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const pendingCount = presentations.filter((p: any) => !answeredIds.has(p.id)).length;
  const shares = (inspection.eventos || []).filter((e: any) => e.tipo === 'ACTA_ACCESO_HABILITADO');
  const revoked = new Set((inspection.eventos || []).filter((e: any) => e.tipo === 'ACTA_ACCESO_REVOCADO').map((e: any) => e.metadata?.accesoId));
  const mails = useQuery({ queryKey: ['inspecciones', 'detail', inspection.id, 'correos-acta', answers.length, presentations.length], enabled: presentations.length > 0, queryFn: async () => (await api.get(`/inspecciones/${inspection.id}/correos-acta`)).data.data as { envioHabilitado: boolean; correos: ActMail[] } });
  const answeredText = (id: string) => new Set(answers.filter((a: any) => a.metadata?.respondeAId === id).map((a: any) => String(a.detalle || '').trim()));
  // Unpublished replies belong to this staff context and dossier only; a published one is dropped.
  useEffect(() => {
    const stored = readReplyDrafts(contextKey), next: Record<string, string> = {}, notes: Record<string, string> = {};
    for (const [id, reply] of Object.entries(stored)) {
      if (answeredText(id).has(reply.texto.trim())) { saveReplyDraft(contextKey, id, null); continue; }
      next[id] = reply.texto; attempts.current[id] = reply.clienteId; notes[id] = reply.savedAt;
    }
    saved.current = Object.fromEntries(Object.entries(next)); setReplies(next); setRestored(notes); setConflicts({});
  }, [contextKey]);
  useEffect(() => {
    const key = actReplyDraftKey(contextKey); if (!key) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      const incoming = readReplyDrafts(contextKey), ids = new Set([...Object.keys(incoming), ...Object.keys(saved.current)]);
      const adopt: Record<string, string> = {}, clash: Record<string, boolean> = {};
      for (const id of ids) {
        const theirs = incoming[id]?.texto || '', ours = live.current[id] || '';
        if (theirs === ours) continue;
        if (ours === (saved.current[id] || '')) { adopt[id] = theirs; attempts.current[id] = incoming[id]?.clienteId || ''; saved.current[id] = theirs; } else clash[id] = true;
      }
      if (Object.keys(adopt).length) setReplies(r => ({ ...r, ...adopt }));
      if (Object.keys(clash).length) setConflicts(c => ({ ...c, ...clash }));
    };
    window.addEventListener('storage', onStorage); return () => window.removeEventListener('storage', onStorage);
  }, [contextKey]);
  function keep(id: string, texto: string, clienteId: string) {
    const ok = saveReplyDraft(contextKey, id, texto.trim() ? { texto, clienteId, savedAt: new Date().toISOString() } : null);
    saved.current[id] = texto; setStorageFailed(!ok);
  }
  function edit(id: string, texto: string) { setReplies(r => ({ ...r, [id]: texto })); attempts.current[id] = ''; setConflicts(c => ({ ...c, [id]: false })); keep(id, texto, ''); }
  function takeOther(id: string) { const other = readReplyDrafts(contextKey)[id]; setReplies(r => ({ ...r, [id]: other?.texto || '' })); attempts.current[id] = other?.clienteId || ''; saved.current[id] = other?.texto || ''; setConflicts(c => ({ ...c, [id]: false })); }
  const [replyErrors, setReplyErrors] = useState<Record<string, string>>({});
  // A reply error is shown under its own button; the section-level alert may be screens away.
  async function run(action: () => Promise<void>, replyId = '') { if (flight.current) return; flight.current = true; setBusy(true); setError(''); if (replyId) setReplyErrors(r => ({ ...r, [replyId]: '' })); try { await action(); await query.invalidateQueries({ queryKey: ['inspecciones', 'detail'] }); } catch(e) { const message = inspectionErrorMessage(e, 'No se confirmó la operación. Reintentá.'); if (replyId) setReplyErrors(r => ({ ...r, [replyId]: `${message} El texto de la respuesta sigue guardado en este dispositivo.` })); else setError(message); } finally { setBusy(false); flight.current = false; } }
  function saveMail() { const url = URL.createObjectURL(new Blob([share.correo.html], { type: 'text/html' })); const a = document.createElement('a'); a.href = url; a.download = 'correo-acta-no-enviado.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
  async function publish(id: string) {
    if (!attempts.current[id]) attempts.current[id] = crypto.randomUUID();
    // Stored before the request: reopening after a lost answer replays the same operation.
    keep(id, replies[id] || '', attempts.current[id]);
    await api.post(`/inspecciones/${inspection.id}/presentaciones-acta/responder`, { clienteId: attempts.current[id], respondeAId: id, texto: replies[id] });
    saveReplyDraft(contextKey, id, null); saved.current[id] = ''; attempts.current[id] = '';
    setReplies(r => ({ ...r, [id]: '' })); setRestored(r => { const { [id]: _drop, ...rest } = r; return rest; });
  }
  const mailsFor = (id: string) => (mails.data?.correos || []).filter(m => m.eventoId === id);
  return <section className="mt-6 space-y-4 border-t pt-5"><h3 className="text-lg font-semibold">Copia y presentaciones del inspeccionado</h3><p className="text-sm text-neutral-600">Acceso limitado a una copia firmada y a sus presentaciones. El enlace no permite ver el expediente interno ni modificar el acta.</p>
    {!signatures.length ? <p className="text-sm">Primero registrá la firma de una versión revisada.</p> : <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(async () => { const { data } = await api.post(`/inspecciones/${inspection.id}/accesos-acta`, { firmaId: selected || signatures[0].id, destinatario: email, diasAcceso: 7 }); setShare(data.data); }); }}><label className="block text-sm">Versión firmada<select value={selected || signatures[0].id} onChange={e => setSelected(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border p-3">{signatures.map((s: any) => <option key={s.id} value={s.id}>{s.metadata?.firma?.nombre} · {inspectionDate(s.createdAt, true)}</option>)}</select></label><label className="block text-sm">Correo declarado del destinatario<input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border p-3" /></label><button disabled={busy} className="min-h-11 rounded-lg border border-green-800 px-4 font-semibold text-green-900">Preparar enlace y correo · sin enviar</button></form>}
    {share && <div role="status" className="space-y-3 rounded-lg bg-green-50 p-4"><p>Enlace preparado para {share.destinatario}. No se envió correo.</p><label className="block text-sm">Enlace personal<input readOnly value={share.url} className="mt-1 min-h-11 w-full rounded-lg border bg-white p-2" /></label><a href={share.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold text-green-900 underline">Revisar vista del destinatario</a><button type="button" onClick={saveMail} className="block min-h-11 font-semibold text-green-900 underline">Descargar muestra del correo</button></div>}
    {(() => { const list = <div className="space-y-2">{shares.map((s: any) => <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><span className="min-w-0 break-words">{s.destinatario} · {revoked.has(s.id) ? 'Revocado' : Date.parse(s.metadata?.expiresAt) <= Date.now() ? 'Vencido' : 'Acceso habilitado'} · hasta {inspectionDate(s.metadata?.expiresAt, true)}</span>{!revoked.has(s.id) && <button type="button" disabled={busy} className="min-h-11 px-3 text-red-800 underline" onClick={() => void run(async () => { await api.post(`/inspecciones/${inspection.id}/accesos-acta/${s.id}/revocar`); if (share?.id === s.id) setShare(null); })}>Revocar enlace</button>}</div>)}</div>; const live = shares.filter((s: any) => !revoked.has(s.id) && Date.parse(s.metadata?.expiresAt) > Date.now()).length;
      return shares.length > 3 ? <details className="rounded-lg border p-3 text-sm"><summary className="min-h-11 cursor-pointer font-semibold">Enlaces preparados ({shares.length}) · {live} vigentes</summary><div className="mt-2">{list}</div></details> : list; })()}
    {presentations.length > 0 && <p className="text-sm font-semibold">{pendingCount ? `${pendingCount} ${pendingCount === 1 ? 'presentación pendiente' : 'presentaciones pendientes'} de respuesta · ${presentations.length - pendingCount} respondidas` : `Todas las presentaciones tienen respuesta (${presentations.length})`}</p>}
    {presentations.map((p: any) => { const responded = answers.filter((a: any) => a.metadata?.respondeAId === p.id); const linkClosed = revoked.has(p.metadata?.accesoId); return <article key={p.id} className="space-y-3 rounded-lg border p-4"><h4 className="font-semibold">{({ APELACION: 'Apelación', DESCARGO: 'Descargo', CONSULTA: 'Consulta' } as Record<string, string>)[p.metadata?.tipo] || p.metadata?.tipo} · {p.metadata?.nombre}</h4><p className="text-sm text-neutral-600">Identidad declarada por quien utilizó el enlace · {inspectionDate(p.createdAt, true)}</p><p className="whitespace-pre-wrap break-words">{p.detalle}</p><MailLedger mails={mailsFor(p.id)} /><p className="text-sm font-semibold">{responded.length ? 'Con respuesta del equipo' : 'Pendiente de respuesta del equipo de inspección'}</p>{responded.map((a: any) => <div key={a.id} className="space-y-2"><p className="whitespace-pre-wrap break-words rounded-lg bg-green-50 p-3">{a.detalle}</p><MailLedger mails={mailsFor(a.id)} /></div>)}
      {linkClosed && <p className="text-sm text-amber-900">El enlace de esta presentación fue revocado: una nueva respuesta queda en el expediente, pero el destinatario no podrá verla ni se le preparará correo.</p>}
      {restored[p.id] && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Respuesta recuperada sin publicar (guardada {inspectionDate(restored[p.id], true)}).</p>}
      {conflicts[p.id] && <div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p>Esta respuesta se modificó en otra pestaña.</p><div className="flex flex-wrap gap-3"><button type="button" className="min-h-11 font-semibold underline" onClick={() => takeOther(p.id)}>Usar el texto de la otra pestaña</button><button type="button" className="min-h-11 font-semibold underline" onClick={() => { keep(p.id, replies[p.id] || '', attempts.current[p.id] || ''); setConflicts(c => ({ ...c, [p.id]: false })); }}>Conservar el texto de esta pestaña</button></div></div>}
      <label className="block text-sm">Respuesta al inspeccionado<textarea rows={4} value={replies[p.id] || ''} onChange={e => edit(p.id, e.target.value)} className="mt-1 w-full rounded-lg border p-3 text-base" /></label>
      {(replies[p.id] || '').trim().length > 0 && (replies[p.id] || '').trim().length < 10 && <p className="text-xs text-neutral-600">Escribí al menos 10 caracteres para publicar.</p>}
      {storageFailed && <p className="text-xs text-amber-900">Este dispositivo no permite guardar el borrador de la respuesta: publicala antes de cerrar.</p>}
      <button type="button" disabled={busy || (replies[p.id] || '').trim().length < 10} className="min-h-11 rounded-lg bg-green-800 px-4 font-semibold text-white disabled:opacity-50" onClick={() => void run(() => publish(p.id), p.id)}>Publicar respuesta en el enlace</button>{replyErrors[p.id] && <p role="alert" className="text-sm text-red-800">{replyErrors[p.id]}</p>}</article>; })}
    {mails.isError && <p className="text-sm text-amber-900">No se pudo consultar el registro de avisos por correo. La presentación y las respuestas no se ven afectadas.</p>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
  </section>;
}

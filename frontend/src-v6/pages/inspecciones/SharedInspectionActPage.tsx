import { syntheticPreviewHeaders } from '../../services/syntheticPreviewHeaders';
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { inspectionDate } from './inspectionPresentation';
import { actPresentationDraftKey, clearPresentationDraft, readPresentationDraft, savePresentationDraft } from '../../services/inspectionActDrafts';

const KIND_LABEL: Record<string, string> = { DESCARGO: 'descargo', APELACION: 'apelación', CONSULTA: 'consulta' };
// Invalid, expired or revoked links answer 403; unknown ones 404. Network and 5xx keep the draft.
const terminal = (status?: number) => status === 403 || status === 404 || status === 410;
type Fields = { name: string; kind: string; text: string };

export default function SharedInspectionActPage() {
  const { accesoId = '' } = useParams();
  const [data, setData] = useState<any>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [success, setSuccess] = useState('');
  const [name, setName] = useState(''), [text, setText] = useState(''), [kind, setKind] = useState('DESCARGO');
  const [submitError, setSubmitError] = useState(''), [restored, setRestored] = useState(''), [conflict, setConflict] = useState<'changed' | 'cleared' | ''>(''), [storageFailed, setStorageFailed] = useState(false);
  const attempt = useRef(''), flight = useRef(false), hydrated = useRef(''), saved = useRef('');
  const form = useRef<HTMLFormElement>(null);
  const token = useRef(window.location.hash.slice(1));
  const fields = useRef<Fields>({ name, kind, text }); fields.current = { name, kind, text };
  async function request(suffix = '', body?: unknown, pdf = false) {
    const response = await fetch(`/api/inspecciones/acta-compartida/${encodeURIComponent(accesoId)}${suffix}`, {
      method: body ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { ...syntheticPreviewHeaders(), 'X-Sitrep-Acta-Token': token.current, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) { const problem = await response.json().catch(() => ({})); throw Object.assign(new Error(problem.message || 'No se pudo abrir el acta. Revisá el enlace o pedí uno nuevo al equipo de inspección.'), { status: response.status }); }
    return pdf ? response.blob() : (await response.json()).data;
  }
  function persist(next: Fields, clienteId: string, expiresAt = data?.expiresAt) {
    if (hydrated.current !== accesoId) return;
    const ok = savePresentationDraft(accesoId, { nombre: next.name, tipo: next.kind, texto: next.text, clienteId, expiresAt });
    saved.current = localStorage.getItem(actPresentationDraftKey(accesoId)) || '';
    setStorageFailed(!ok);
  }
  function forget() { clearPresentationDraft(accesoId); saved.current = ''; }
  function adopt(value: ReturnType<typeof readPresentationDraft>) {
    setName(value?.nombre || ''); setKind(value?.tipo || 'DESCARGO'); setText(value?.texto || ''); attempt.current = value?.clienteId || '';
  }
  function hydrate(loaded: any) {
    if (hydrated.current === accesoId) return;
    hydrated.current = accesoId;
    const draft = readPresentationDraft(accesoId);
    if (!draft) return;
    const sent = (loaded.mensajes || []).find((m: any) => !m.autoridad && m.tipo === draft.tipo && m.nombre === draft.nombre.trim() && m.texto === draft.texto.trim());
    if (sent) { forget(); setSuccess(`Tu ${KIND_LABEL[sent.tipo] || 'presentación'} ya estaba registrada · ${inspectionDate(sent.fecha, true)}. No hace falta enviarla de nuevo.`); return; }
    adopt(draft); saved.current = localStorage.getItem(actPresentationDraftKey(accesoId)) || '';
    setRestored(`Recuperamos el texto que no se había enviado (guardado ${inspectionDate(draft.savedAt, true)}). Revisalo y registralo cuando quieras.`);
  }
  async function load() {
    setError('');
    try { const loaded = await request(); setData(loaded); hydrate(loaded); }
    catch(e) {
      setData(null); setError((e as Error).message);
      if (terminal((e as any).status)) { forget(); hydrated.current = ''; adopt(null); setRestored(''); }
    }
  }
  useEffect(() => { token.current = window.location.hash.slice(1); hydrated.current = ''; setData(null); setRestored(''); setSuccess(''); setConflict(''); adopt(null); void load(); }, [accesoId]);
  useEffect(() => {
    const key = actPresentationDraftKey(accesoId);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || event.newValue === saved.current || hydrated.current !== accesoId) return;
      // Every edit is written at once, so this tab is behind only if the other write started from our last copy.
      const untouched = saved.current === (event.oldValue || '');
      if (event.newValue === null) {
        // Another tab registered or discarded it. Refresh the history before any resend.
        void load();
        if (untouched) { saved.current = ''; adopt(null); setRestored(''); } else setConflict('cleared');
        return;
      }
      if (untouched) { adopt(readPresentationDraft(accesoId)); saved.current = event.newValue; setRestored('Se cargó el texto actualizado en otra pestaña.'); }
      else setConflict('changed');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [accesoId]);
  function edit(next: Partial<Fields>) {
    const merged = { ...fields.current, ...next };
    attempt.current = ''; setSuccess(''); setConflict(''); setSubmitError('');
    if (next.name !== undefined) setName(next.name); if (next.kind !== undefined) setKind(next.kind); if (next.text !== undefined) setText(next.text);
    persist(merged, '');
  }
  function resolveConflict(useOther: boolean) {
    if (useOther) { adopt(readPresentationDraft(accesoId)); saved.current = localStorage.getItem(actPresentationDraftKey(accesoId)) || ''; }
    else persist(fields.current, attempt.current);
    setConflict('');
  }
  async function download() {
    setError('');
    try { const blob = await request('/pdf', undefined, true), url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'acta-firmada.pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    catch(e) { setError((e as Error).message); }
  }
  async function submit() {
    if (flight.current) return; flight.current = true; setBusy(true); setSubmitError(''); setSuccess(''); setConflict('');
    if (!attempt.current) attempt.current = crypto.randomUUID();
    // The request id is stored first: a reopen after a lost answer replays it instead of duplicating.
    persist(fields.current, attempt.current);
    try {
      const result = await request('/presentaciones', { clienteId: attempt.current, tipo: kind, nombre: name, texto: text });
      forget(); setRestored('');
      setSuccess(`Presentación registrada · ${inspectionDate(result.fecha, true)}. El equipo de inspección debe revisarla; la respuesta aparecerá en esta página.`);
      setText(''); attempt.current = ''; await load();
    } catch(e) {
      const status = (e as any).status;
      // Shown next to the button: the page-level alert is out of view at the end of the form.
      if (terminal(status)) { forget(); setSubmitError(`${(e as Error).message} El texto no quedó guardado en este dispositivo: copialo si lo necesitás.`); }
      else setSubmitError(`No se pudo registrar: ${(e as Error).message === 'Failed to fetch' ? 'sin conexión con SITREP' : (e as Error).message}. Tu texto sigue guardado en este dispositivo; podés reintentar.`);
    }
    finally { flight.current = false; setBusy(false); }
  }
  const field = 'mt-2 min-h-12 w-full rounded-lg border border-neutral-300 bg-white p-3 text-base';
  return <main className="mx-auto min-h-screen max-w-3xl space-y-6 bg-white px-4 py-6 sm:px-8">
    <header className="border-b pb-4"><p className="text-2xl font-bold text-green-900">SITREP</p><h1 className="mt-3 text-xl font-bold">Mi acta de inspección</h1></header>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-900">{error}<button type="button" onClick={() => void load()} className="block min-h-11 underline">Reintentar</button></div>}
    {!data && !error && <p role="status">Verificando acceso…</p>}
    {data && <>
      {restored && (name || text) && <button type="button" onClick={() => form.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="min-h-11 w-full rounded-lg bg-amber-50 px-4 py-2 text-left text-sm font-semibold text-amber-950 underline">Tenés un texto sin registrar · ir al formulario</button>}
      <section className="space-y-3"><h2 className="text-lg font-semibold">Acta {data.numero}</h2><p>Firma registrada: {data.firmante}</p><button type="button" onClick={() => void download()} className="min-h-12 rounded-lg bg-green-800 px-5 font-semibold text-white">Ver y descargar acta firmada</button><p className="text-sm text-neutral-600">El enlace vence el {inspectionDate(data.expiresAt, true)}; ese vencimiento no modifica los plazos indicados en el acta.</p></section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Presentaciones y respuestas</h2>{!data.mensajes.length && <p className="text-sm text-neutral-600">Todavía no hay presentaciones.</p>}{data.mensajes.map((m: any) => <article key={m.id} className={`rounded-lg border p-4 ${m.autoridad ? 'border-green-200 bg-green-50' : 'border-neutral-200'}`}><h3 className="font-semibold">{m.autoridad ? 'Respuesta del equipo de inspección' : m.tipo === 'APELACION' ? 'Apelación presentada' : m.tipo === 'DESCARGO' ? 'Descargo presentado' : 'Consulta'}</h3><p className="text-xs text-neutral-600">{m.nombre} · {inspectionDate(m.fecha, true)}</p><p className="mt-3 whitespace-pre-wrap break-words">{m.texto}</p></article>)}</section>
      <form ref={form} className="scroll-mt-4 space-y-4 border-t pt-5" onSubmit={e => { e.preventDefault(); void submit(); }}><h2 className="text-lg font-semibold">Enviar una presentación</h2>
        {restored && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{restored}</p>}
        {conflict && <div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p>{conflict === 'cleared' ? 'En otra pestaña este borrador se registró o se descartó. Revisá el historial de arriba antes de volver a enviar.' : 'Este borrador se modificó en otra pestaña.'}</p><div className="flex flex-wrap gap-3">{conflict === 'changed' && <button type="button" className="min-h-11 font-semibold underline" onClick={() => resolveConflict(true)}>Usar el texto de la otra pestaña</button>}<button type="button" className="min-h-11 font-semibold underline" onClick={() => resolveConflict(false)}>Conservar el texto de esta pestaña</button></div></div>}
        <label className="block text-sm font-medium">Nombre y apellido<input required minLength={2} maxLength={200} className={field} disabled={busy} value={name} onChange={e => edit({ name: e.target.value })} /></label>
        <label className="block text-sm font-medium">Tipo de presentación<select className={field} disabled={busy} value={kind} onChange={e => edit({ kind: e.target.value })}><option value="DESCARGO">Descargo</option><option value="APELACION">Apelación</option><option value="CONSULTA">Consulta</option></select></label>
        <label className="block text-sm font-medium">Qué querés informar<textarea required minLength={10} maxLength={12000} rows={6} className={field} disabled={busy} value={text} onChange={e => edit({ text: e.target.value })} /></label>
        <p className="text-sm text-neutral-600">Se registra para revisión del equipo de inspección. No implica aceptación ni suspende automáticamente los plazos. Conservá el enlace para consultar la respuesta.</p>
        <p className="text-xs text-neutral-600">{storageFailed ? 'Este dispositivo no permite guardar el borrador: si cerrás la página antes de registrar, el texto se pierde.' : 'Mientras no se registre, el texto queda guardado sólo en este dispositivo y para este enlace. Se borra al registrarlo o cuando el enlace vence o se revoca.'}</p>
        {submitError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{submitError}</p>}
        <button disabled={busy} className="min-h-12 w-full rounded-lg bg-green-800 px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Registrando…' : 'Registrar presentación'}</button>{success && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-900">{success}</p>}
      </form>
    </>}
  </main>;
}

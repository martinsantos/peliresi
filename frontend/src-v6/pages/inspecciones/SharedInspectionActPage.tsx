import { syntheticPreviewHeaders } from '../../services/syntheticPreviewHeaders';
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function SharedInspectionActPage() {
  const { accesoId } = useParams();
  const [data, setData] = useState<any>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [success, setSuccess] = useState('');
  const [name, setName] = useState(''), [text, setText] = useState(''), [kind, setKind] = useState('DESCARGO');
  const attempt = useRef(''), flight = useRef(false);
  const token = useRef(window.location.hash.slice(1));
  async function request(suffix = '', body?: unknown, pdf = false) {
    const response = await fetch(`/api/inspecciones/acta-compartida/${encodeURIComponent(accesoId || '')}${suffix}`, {
      method: body ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { ...syntheticPreviewHeaders(), 'X-Sitrep-Acta-Token': token.current, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) { const problem = await response.json().catch(() => ({})); throw new Error(problem.message || 'No se pudo abrir el acta. Revisá el enlace o pedí uno nuevo al equipo de inspección.'); }
    return pdf ? response.blob() : (await response.json()).data;
  }
  async function load() { setError(''); try { setData(await request()); } catch(e) { setData(null); setError((e as Error).message); } }
  useEffect(() => { token.current = window.location.hash.slice(1); setData(null); void load(); }, [accesoId]);
  async function download() {
    setError('');
    try { const blob = await request('/pdf', undefined, true), url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'acta-firmada.pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    catch(e) { setError((e as Error).message); }
  }
  async function submit() {
    if (flight.current) return; flight.current = true; setBusy(true); setError(''); setSuccess('');
    if (!attempt.current) attempt.current = crypto.randomUUID();
    try {
      const result = await request('/presentaciones', { clienteId: attempt.current, tipo: kind, nombre: name, texto: text });
      setSuccess(`Presentación registrada · ${new Date(result.fecha).toLocaleString('es-AR')}. El equipo de inspección debe revisarla.`);
      setText(''); attempt.current = ''; await load();
    } catch(e) { setError((e as Error).message); }
    finally { flight.current = false; setBusy(false); }
  }
  const field = 'mt-2 min-h-12 w-full rounded-lg border border-neutral-300 bg-white p-3 text-base';
  return <main className="mx-auto min-h-screen max-w-3xl space-y-6 bg-white px-4 py-6 sm:px-8">
    <header className="border-b pb-4"><p className="text-2xl font-bold text-green-900">SITREP</p><h1 className="mt-3 text-xl font-bold">Mi acta de inspección</h1></header>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-900">{error}<button type="button" onClick={() => void load()} className="block min-h-11 underline">Reintentar</button></div>}
    {!data && !error && <p role="status">Verificando acceso…</p>}
    {data && <>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Acta {data.numero}</h2><p>Firma registrada: {data.firmante}</p><button type="button" onClick={() => void download()} className="min-h-12 rounded-lg bg-green-800 px-5 font-semibold text-white">Ver y descargar acta firmada</button><p className="text-sm text-neutral-600">Acceso hasta {new Date(data.expiresAt).toLocaleString('es-AR')}. Este vencimiento es del enlace y no modifica los plazos indicados en el acta.</p></section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Presentaciones y respuestas</h2>{!data.mensajes.length && <p className="text-sm text-neutral-600">Todavía no hay presentaciones.</p>}{data.mensajes.map((m: any) => <article key={m.id} className={`rounded-lg border p-4 ${m.autoridad ? 'border-green-200 bg-green-50' : 'border-neutral-200'}`}><h3 className="font-semibold">{m.autoridad ? 'Respuesta del equipo de inspección' : m.tipo === 'APELACION' ? 'Apelación presentada' : m.tipo === 'DESCARGO' ? 'Descargo presentado' : 'Consulta'}</h3><p className="text-xs text-neutral-600">{m.nombre} · {new Date(m.fecha).toLocaleString('es-AR')}</p><p className="mt-3 whitespace-pre-wrap break-words">{m.texto}</p></article>)}</section>
      <form className="space-y-4 border-t pt-5" onSubmit={e => { e.preventDefault(); void submit(); }}><h2 className="text-lg font-semibold">Enviar una presentación</h2>
        <label className="block text-sm font-medium">Nombre y apellido<input required minLength={2} maxLength={200} className={field} disabled={busy} value={name} onChange={e => { setName(e.target.value); attempt.current = ''; }} /></label>
        <label className="block text-sm font-medium">Tipo de presentación<select className={field} disabled={busy} value={kind} onChange={e => { setKind(e.target.value); attempt.current = ''; }}><option value="DESCARGO">Descargo</option><option value="APELACION">Apelación</option><option value="CONSULTA">Consulta</option></select></label>
        <label className="block text-sm font-medium">Qué querés informar<textarea required minLength={10} maxLength={12000} rows={6} className={field} disabled={busy} value={text} onChange={e => { setText(e.target.value); attempt.current = ''; }} /></label>
        <p className="text-sm text-neutral-600">Se registra para revisión del equipo de inspección. No implica aceptación ni suspende automáticamente los plazos. Conservá el enlace para consultar la respuesta.</p>
        <button disabled={busy} className="min-h-12 w-full rounded-lg bg-green-800 px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Registrando…' : 'Registrar presentación'}</button>{success && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-900">{success}</p>}
      </form>
    </>}
  </main>;
}

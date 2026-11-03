import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { inspectionFieldDraftKey, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import { useInspectionDraftOwnership } from '../../hooks/useInspectionDraftOwnership';
import { readInspectionFieldCheckpoint, writeInspectionFieldCheckpoint } from '../../services/inspectionFieldCheckpoint';
import type { InspectionEvidence } from '../../types/inspection';
import { InspectionEvidenceImage } from './InspectionEvidenceImage';
import { inspectionErrorMessage } from './inspectionPresentation';
export function InspectionPhotoDescriptions({ inspection, editable }: { inspection: { id: string; version: number; evidencias: InspectionEvidence[] }; editable: boolean }) {
  const photos = inspection.evidencias.filter(e => e.tipo === 'FOTO' && !e.anuladaAt && !e.intercambioId);
  if (!photos.length) return null;
  return <section aria-label="Fotografías del acta" className="mb-6 space-y-4"><h3 className="text-lg font-semibold">Fotografías y descripción</h3><p className="text-sm text-neutral-600">Cada fotografía tendrá su propia página en el acta, con la descripción debajo.</p><div className="grid gap-5 lg:grid-cols-2">{photos.map(photo => <Photo key={photo.id} inspection={inspection} photo={photo} editable={editable} />)}</div></section>;
}
function Photo({ inspection, photo, editable }: { inspection: { id: string; version: number }; photo: InspectionEvidence; editable: boolean }) {
  const [text, setText] = useState(photo.descripcion || ''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const inFlight = useRef(false); const query = useQueryClient();
  const { currentUser } = useAuth();
  const key = inspectionFieldDraftKey(currentUser?.id || '', inspectionWorkspaceOwner(currentUser), inspection.id) + ':photo:' + photo.id;
  const ownership = useInspectionDraftOwnership(key, editable);
  const [ready, setReady] = useState(false), [localSaved, setLocalSaved] = useState(true), [conflict, setConflict] = useState(false);
  const base = useRef(photo.descripcion || ''), alive = useRef(true), pending = useRef(Promise.resolve());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true; setReady(false);
    if (ownership.status !== 'owned') return;
    void (async () => { try {
      const durable = await readInspectionFieldCheckpoint(key), journal = localStorage.getItem(key);
      if (!active || !ownership.canWrite()) return;
      const copies = [durable, journal].filter(Boolean).map(raw => JSON.parse(raw!)).filter(d => typeof d.text === 'string' && d.text.length <= 2000 && typeof d.base === 'string').sort((a,b) => b.checkpointAt-a.checkpointAt);
      const draft = copies[0]; base.current = draft?.base ?? (photo.descripcion || '');
      setText(draft?.text ?? (photo.descripcion || '')); setConflict(!!draft && draft.base !== (photo.descripcion || '') && draft.text !== (photo.descripcion || '')); setReady(true);
    } catch { if (active) setError('No pudimos recuperar la descripción local. No reemplazamos la copia guardada.'); } })();
    return () => { active = false; };
  }, [key, ownership.status]);
  function edit(value: string) {
    if (!ready || !ownership.canWrite()) return;
    setText(value); setLocalSaved(false);
    const raw = JSON.stringify({ text: value, base: base.current, checkpointAt: Date.now() });
    try { localStorage.setItem(key, raw); } catch { setError('No se guardó la copia local. Conservá esta pantalla abierta.'); }
    pending.current = writeInspectionFieldCheckpoint(key, raw).then(() => { if (alive.current) setLocalSaved(true); }).catch(() => { if (alive.current) setError('No se confirmó la copia local. No cierres esta pantalla.'); });
  }
  useEffect(() => { const guard = (e: BeforeUnloadEvent) => { if (!localSaved) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [localSaved]);
  async function save() {
    if (!editable || !ready || conflict || !ownership.canWrite() || inFlight.current) return; inFlight.current = true; setBusy(true); setError('');
    try { await pending.current; if (!ownership.canWrite()) return; await api.patch(`/inspecciones/${inspection.id}/evidencias/${photo.id}/descripcion`, { version: inspection.version, descripcion: text }); if (ownership.canWrite()) { await writeInspectionFieldCheckpoint(key, null); localStorage.removeItem(key); base.current = text; } await query.invalidateQueries({ queryKey: ['inspecciones', 'detail'] }); }
    catch(e) { setError(inspectionErrorMessage(e, 'No se guardó la descripción. El texto sigue aquí.')); }
    finally { setBusy(false); inFlight.current = false; }
  }
  return <figure className="min-w-0 rounded-xl border bg-white p-3"><InspectionEvidenceImage inspectionId={inspection.id} evidenceId={photo.id} alt={photo.descripcion || photo.nombreOriginal} preview className="h-64 w-full object-contain" /><figcaption className="mt-3 space-y-2"><label className="block text-sm font-semibold">Descripción de {photo.nombreOriginal}<textarea className="mt-2 min-h-24 w-full rounded-lg border p-3 text-base font-normal" value={text} onChange={e => edit(e.target.value)} maxLength={2000} disabled={!editable || !ready || busy} /></label>{text !== (photo.descripcion || '') && <button type="button" disabled={!editable || !ready || busy} onClick={() => void save()} className="min-h-11 rounded-lg bg-green-800 px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar descripción'}</button>}{conflict && <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm">La descripción del servidor cambió: {photo.descripcion || 'Sin descripción'}. Tu copia permanece en el campo.<button type="button" className="block min-h-11 underline" onClick={() => { base.current = photo.descripcion || ''; setConflict(false); }}>Revisé ambas; conservar mi texto para guardar</button></div>}{ownership.status === 'blocked' && <p role="status">La descripción está abierta en otra pestaña. Cerrala para editar aquí.<button type="button" className="min-h-11 underline" onClick={ownership.retry}>Reintentar</button></p>}{error && <p role="alert" className="text-sm text-red-800">{error}</p>}{!editable && <p className="text-xs text-neutral-600">Guardá los cambios del acta antes de editar las descripciones.</p>}</figcaption></figure>;
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, MapPin } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/ButtonV2';
import { INSPECTION_PHOTO_ACCEPT } from '../../services/inspectionOfflineEvidence';
import { findingHasContent, protectSpontaneousText, saveSpontaneousFinding, spontaneousPhoto, type SpontaneousFindingDraft } from '../../services/inspectionSpontaneousDraft';
import type { InspectionActorType } from '../../types/inspection';
import { INSPECTION_TYPES, inspectionNumberExample } from '../../types/inspection';
import { INSPECTION_ACTOR_LABELS } from './inspectionPresentation';
import { OfflineDictation } from './OfflineDictation';
import { appendDictatedText } from './appendDictatedText';
import { InspectionLocationField } from './InspectionLocationField';
import { inspectionLocationSuggestions, type DeclaredLocationSource } from './inspectionLocations';

type ActorOption = DeclaredLocationSource & { id?: string | number; razonSocial?: string; nombre?: string };
type Props = {
  initial: SpontaneousFindingDraft;
  actors: Record<InspectionActorType, ActorOption[]>;
  onActorTypeNeeded?: (type?: InspectionActorType) => void;
  onClose: () => void;
  online?: boolean;
  registering?: boolean;
  onRegister?: (draft: SpontaneousFindingDraft) => Promise<boolean | void>;
};

/** Local protection precedes registration; a failed request never discards the draft. */
export function SpontaneousFindingEditor({ initial, actors, onActorTypeNeeded, onClose, online = false, registering = false, onRegister }: Props) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(findingHasContent(initial) ? 'saved' : 'idle');
  const [error, setError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [dictating, setDictating] = useState(false);
  const current = useRef(draft);
  const mounted = useRef(true);
  const closed = useRef(false);
  const closingRef = useRef(false);
  const touched = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writes = useRef<Promise<boolean>>(Promise.resolve(true));

  const persist = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const snapshot = current.current;
    if (!findingHasContent(snapshot) && !touched.current) return Promise.resolve(true);
    const write = async () => {
      try {
        await saveSpontaneousFinding(snapshot);
        if (mounted.current && current.current === snapshot) setStatus('saved');
        return true;
      } catch (cause) {
        if (mounted.current) {
          setStatus('error');
          setError(cause instanceof Error ? cause.message : 'No hay espacio disponible. Conservá esta pantalla abierta.');
        }
        return false;
      }
    };
    writes.current = writes.current.then(write, write);
    return writes.current;
  }, []);

  const update = (patch: Partial<SpontaneousFindingDraft>, immediate = false) => {
    touched.current = true;
    const next = { ...current.current, ...patch, updatedAt: new Date().toISOString() };
    current.current = next;
    setDraft(next);
    setStatus('saving');
    try { protectSpontaneousText(next); }
    catch { setStatus('error'); setError('No se confirmó la copia de texto. Conservá la pantalla abierta hasta que termine el guardado.'); }
    if (timer.current) clearTimeout(timer.current);
    if (immediate) return persist();
    timer.current = setTimeout(() => void persist(), 350);
    return Promise.resolve(true);
  };

  useEffect(() => {
    mounted.current = true;
    const flush = () => { void persist(); };
    const hidden = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', flush);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', flush);
      if (!closed.current) void persist();
    };
  }, [persist]);

  const close = useCallback(async () => {
    if (photoBusy || dictating || registering || closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    try {
      // Typing may continue while a slow local transaction is pending.
      let snapshot: SpontaneousFindingDraft;
      do {
        snapshot = current.current;
        if (!await persist()) return;
      } while (snapshot !== current.current);
      closed.current = true;
      onClose();
    } finally {
      closingRef.current = false;
      if (mounted.current) setClosing(false);
    }
  }, [onClose, persist, photoBusy, dictating, registering]);

  const addPhoto = async (file?: File) => {
    if (!file || photoBusy || closingRef.current) return;
    setPhotoBusy(true);
    try {
      const photo = await spontaneousPhoto(file);
      await update({ photos: [...current.current.photos, photo] }, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la foto. Conservá el archivo original.');
      setStatus('error');
    } finally { setPhotoBusy(false); }
  };

  const captureLocation = () => {
    if (!navigator.geolocation) { setError('GPS no disponible. Podés escribir una referencia.'); return; }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setGpsBusy(false);
      if (mounted.current) void update({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    }, () => { setGpsBusy(false); setError('No se pudo obtener el GPS. La referencia escrita es suficiente para guardar.'); }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 });
  };

  const register = async () => {
    if (!onRegister || photoBusy || dictating || closingRef.current || registering) return;
    if (!current.current.description.trim()) { setError('Describí brevemente lo ocurrido.'); return; }
    closingRef.current = true;
    setClosing(true);
    try {
      if (!await persist()) return;
      // Wait for in-flight local writes before the server can consume this snapshot.
      closed.current = true;
      const registered = await onRegister(current.current);
      if (registered === false) closed.current = false;
    } finally { closingRef.current = false; if (mounted.current) setClosing(false); }
  };

  return <Modal isOpen onClose={() => void close()} closeOnOverlayClick={false} title="Denuncia o hallazgo" description="No necesitás identificar un responsable para registrarlo." size="lg" footer={<div className="w-full">
    <p role="status" aria-live="polite" className={`mb-3 text-sm ${status === 'error' ? 'text-error-800' : 'text-neutral-500'}`}>{dictating ? 'Dictado en curso' : photoBusy ? 'Guardando foto…' : status === 'saved' ? 'Borrador protegido en este dispositivo' : status === 'saving' ? 'Guardando borrador…' : status === 'error' ? error : !online ? 'Sin conexión · se guardará en este dispositivo' : ''}</p>
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={photoBusy || closing || dictating || registering} onClick={() => void close()}>{online && onRegister ? 'Guardar borrador' : 'Guardar y salir'}</Button>{online && onRegister && <Button isLoading={registering || closing} disabled={photoBusy || dictating} onClick={() => void register()}>Registrar denuncia</Button>}</div>
  </div>}>
    <fieldset disabled={closing || registering} className="space-y-5">
      <label className="block text-sm font-semibold text-neutral-900">Tipo de inspección<select disabled={Boolean(draft.serverInspectionId)} value={draft.inspectionType || 'ESPONTANEA'} onChange={(event) => void update({ inspectionType: event.target.value as SpontaneousFindingDraft['inspectionType'] })} className="mt-2 min-h-11 w-full rounded-lg border border-neutral-400 bg-white px-3 text-base font-normal">{(['ESPONTANEA', 'PETROLEO', 'AIRE'] as const).map((type) => <option key={type} value={type}>{INSPECTION_TYPES[type].label} · {INSPECTION_TYPES[type].serie}</option>)}</select></label>
      <p className="text-sm text-neutral-600">{draft.serverInspectionNumber ? `Legajo: ${draft.serverInspectionNumber}` : `Legajo automático · ejemplo ${inspectionNumberExample(draft.inspectionType || draft.actorType || 'ESPONTANEA')}. El número se asigna al registrar con conexión.`}</p>
      <label className="block text-sm font-semibold text-neutral-900">Descripción del hallazgo<textarea rows={3} value={draft.description} onChange={(event) => void update({ description: event.target.value })} placeholder="Qué viste y dónde. Podés completar los detalles después." className="mt-2 w-full rounded-lg border border-neutral-400 p-3 text-base font-normal leading-relaxed" /></label>
      <OfflineDictation onText={(text) => { void update({ description: appendDictatedText(current.current.description, text) }, true); }} onActiveChange={setDictating} disabled={closing} />
      <label className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-primary-700 bg-primary-50 px-3 text-base font-semibold text-primary-900 focus-within:ring-2 focus-within:ring-primary-700 ${photoBusy ? 'opacity-60' : ''}`}><Camera size={20} />{photoBusy ? 'Guardando foto…' : 'Tomar foto'}<input aria-label="Foto del hallazgo" type="file" accept={INSPECTION_PHOTO_ACCEPT} capture="environment" disabled={photoBusy || closing} className="sr-only" onChange={(event) => { void addPhoto(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} /></label>
      {draft.photos.length > 0 && <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 px-3">{draft.photos.map((photo) => <li key={photo.id} className="flex min-w-0 items-center gap-3"><span className="min-w-0 flex-1 break-words py-3 text-sm">{photo.fileName}</span><button type="button" disabled={photoBusy || closing} onClick={() => void update({ photos: current.current.photos.filter((entry) => entry.id !== photo.id) }, true)} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-error-700">Quitar</button></li>)}</ul>}
      <InspectionLocationField label="Ubicación o referencia" value={draft.location} onChange={location => void update({ location })} disabled={closing || registering} placeholder="Ej. portón sur, junto al desagüe" options={inspectionLocationSuggestions(draft.actorType ? actors[draft.actorType].find(actor => String(actor.id) === draft.actorId) : undefined)} />
      <Button className="min-h-11" variant="outline" leftIcon={<MapPin size={16} />} disabled={gpsBusy} onClick={captureLocation}>{gpsBusy ? 'Buscando ubicación…' : draft.latitude != null ? 'Actualizar GPS' : 'Agregar GPS (opcional)'}</Button>
      {error && status !== 'error' && <p role="status" className="text-sm text-amber-900">{error}</p>}
      <details onToggle={(event) => { if (event.currentTarget.open) onActorTypeNeeded?.(current.current.actorType); }} className="border-t border-neutral-200 pt-1"><summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-neutral-700">Identificar al actor · puede hacerse después</summary><div className="space-y-4 pb-2"><label className="block text-sm font-semibold">Tipo de actor<select value={draft.actorType || ''} onChange={(event) => { const type = event.target.value as InspectionActorType || undefined; void update({ actorType: type, actorId: undefined }); onActorTypeNeeded?.(type); }} className="mt-2 h-12 w-full rounded-lg border border-neutral-400 bg-white px-3 text-base font-normal"><option value="">Identificar más tarde</option>{Object.entries(INSPECTION_ACTOR_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm font-semibold">Actor<select disabled={!draft.actorType} value={draft.actorId || ''} onChange={(event) => void update({ actorId: event.target.value || undefined })} className="mt-2 h-12 w-full rounded-lg border border-neutral-400 bg-white px-3 text-base font-normal disabled:bg-neutral-100"><option value="">Seleccionar…</option>{(draft.actorType ? actors[draft.actorType] : []).map((actor) => <option key={String(actor.id)} value={String(actor.id)}>{String(actor.razonSocial || actor.nombre || actor.id)}</option>)}</select></label></div></details>
    </fieldset>
  </Modal>;
}

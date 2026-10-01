import React, { useCallback, useEffect, useState } from 'react';
import { Camera, CloudOff, FilePlus2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/ButtonV2';
import { toast } from '../../components/ui/Toast';
import { inspeccionService } from '../../services/inspeccion.service';
import {
  listSpontaneousFindings,
  removeSpontaneousFinding,
  saveSpontaneousFinding,
  spontaneousFindingFile,
  newSpontaneousFinding,
  type SpontaneousFindingDraft,
} from '../../services/inspectionSpontaneousDraft';
import { SpontaneousFindingEditor } from './SpontaneousFindingEditor';
import type { InspectionActorType } from '../../types/inspection';
import { INSPECTION_ACTOR_LABELS, inspectionDate } from './inspectionPresentation';

type ActorOption = { id?: string | number; razonSocial?: string; nombre?: string };
type Props = { userId: string | number; online: boolean; mobile: boolean; actors: Record<InspectionActorType, ActorOption[]>; onActorTypeNeeded?: (type?: InspectionActorType) => void; createRequest?: number; hideTrigger?: boolean };


export function SpontaneousFindingPanel({ userId, online, mobile, actors, onActorTypeNeeded, createRequest = 0, hideTrigger = false }: Props) {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<SpontaneousFindingDraft[]>([]);
  const [editing, setEditing] = useState<SpontaneousFindingDraft | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const refresh = useCallback(async () => setDrafts(await listSpontaneousFindings(userId)), [userId]);
  useEffect(() => { void refresh().catch(() => toast.error('No se pudieron leer los hallazgos locales')); }, [refresh]);

  useEffect(() => { if (createRequest > 0) setEditing(newSpontaneousFinding(userId)); }, [createRequest, userId]);

  const formalize = async (draft: SpontaneousFindingDraft) => {
    if (!draft.description.trim()) { setEditing(draft); toast.warning('Falta describir el hallazgo'); return false; }
    if (!online || !navigator.onLine) { toast.warning('Sin conexión', 'El hallazgo sigue protegido en este dispositivo.'); return false; }
    setBusyId(draft.id);
    let persistedDraft = draft;
    try {
      let inspectionId = draft.serverInspectionId;
      let inspectionNumber = draft.serverInspectionNumber;
      if (!inspectionId) {
        const created = await inspeccionService.create({ clienteId: draft.id, tipoInspeccion: draft.inspectionType, tipoActor: draft.actorId ? draft.actorType : undefined, actorId: draft.actorId || undefined, latitud: draft.latitude, longitud: draft.longitude, ubicacion: draft.location || undefined, observaciones: `Hallazgo espontáneo: ${draft.description}` });
        inspectionId = created.id;
        inspectionNumber = created.numero;
        persistedDraft = { ...draft, serverInspectionId: inspectionId, serverInspectionNumber: inspectionNumber, lastError: undefined };
        await saveSpontaneousFinding(persistedDraft);
      }
      for (const photo of draft.photos) await inspeccionService.uploadEvidence(inspectionId, spontaneousFindingFile(photo), { tipo: 'FOTO', descripcion: draft.description, latitud: draft.latitude, longitud: draft.longitude, clienteId: photo.id, capturadaAt: photo.capturedAt });
      await removeSpontaneousFinding(draft.id);
      await refresh();
      setEditing(null);
      toast.success('Denuncia registrada', inspectionNumber || 'Expediente creado');
      navigate(`${mobile ? '/mobile' : ''}/inspecciones/${inspectionId}#acta`);
      return true;
    } catch (error) {
      await saveSpontaneousFinding({ ...persistedDraft, lastError: error instanceof Error ? error.message : 'No se pudo formalizar.' }).catch(() => undefined);
      await refresh().catch(() => undefined);
      toast.error('Registro pendiente', 'El borrador y sus fotos siguen guardados; podés reintentar sin duplicar el expediente.');
      return false;
    } finally { setBusyId(null); }
  };

  return <>
    {(!hideTrigger || drafts.length > 0) && <section className="border-b border-neutral-200 py-3">
      {!hideTrigger && <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-neutral-950">¿Encontraste algo fuera de la inspección?</h3><p className="mt-1 text-sm text-neutral-600">Registralo ahora, incluso sin señal.</p></div><Button className="w-full sm:w-auto" variant="outline" leftIcon={<Camera size={17} />} onClick={() => setEditing(newSpontaneousFinding(userId))}>Registrar hallazgo</Button></div>}
      {drafts.length > 0 && <div className="mt-4 space-y-2">{drafts.map((draft) => <article key={draft.id} className="rounded-lg border border-primary-200 bg-white p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold text-neutral-950">{draft.description || 'Hallazgo por describir'}</p><p className="mt-1 text-xs text-neutral-600">{draft.actorType ? INSPECTION_ACTOR_LABELS[draft.actorType] : 'Actor pendiente'} · {draft.photos.length} {draft.photos.length === 1 ? 'foto' : 'fotos'} · {inspectionDate(draft.createdAt, true)}</p>{draft.lastError && <p className="mt-1 text-xs font-semibold text-error-800">Requiere reintento: {draft.lastError}</p>}</div>{!online && <CloudOff size={18} className="shrink-0 text-amber-700" />}</div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setEditing(draft)}>Completar</Button><Button size="sm" leftIcon={<FilePlus2 size={15} />} isLoading={busyId === draft.id} onClick={() => void formalize(draft)}>{draft.serverInspectionId ? 'Continuar formalización' : 'Crear expediente'}</Button><button type="button" aria-label="Eliminar hallazgo local" onClick={() => { if (window.confirm('¿Eliminar este hallazgo y sus fotos guardadas en el dispositivo?')) void removeSpontaneousFinding(draft.id).then(refresh); }} className="ml-auto min-h-11 min-w-11 rounded-md px-2 text-error-700"><Trash2 size={17} /></button></div></article>)}</div>}
    </section>}
    {editing && <SpontaneousFindingEditor key={editing.id} initial={editing} actors={actors} onActorTypeNeeded={onActorTypeNeeded} online={online} registering={busyId === editing.id} onRegister={formalize} onClose={() => { setEditing(null); void refresh(); }} />}
  </>;
}

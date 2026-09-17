import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarDays, Camera, Check, ChevronDown, ChevronUp, ClipboardCheck,
  CloudOff, FileAudio, FileText, MapPin, Mic, Paperclip, Save, Send, ShieldCheck,
  Square, UserRound, XCircle,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/ButtonV2';
import { Badge, type BadgeColor } from '../../components/ui/BadgeV2';
import { Card } from '../../components/ui/CardV2';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useInspection, useInspectionMutation } from '../../hooks/useInspecciones';
import { inspeccionService } from '../../services/inspeccion.service';
import type { Inspection, InspectionItem, InspectionItemResult, InspectionState } from '../../types/inspection';
import { inspectionActor } from '../../types/inspection';

const STATE_LABELS: Record<InspectionState, string> = {
  BORRADOR: 'Borrador', PLANIFICADA: 'Planificada', EN_CAMPO: 'En campo', EN_REVISION: 'En revisión',
  NOTIFICADA: 'Notificada', EN_DESCARGO: 'En descargo', REQUIERE_SUBSANACION: 'Requiere subsanación',
  CERRADA_CONFORME: 'Cerrada conforme', DERIVADA_LEGALES: 'Derivada a legales', EN_TRAMITE_LEGAL: 'En trámite legal',
  DERIVADA_ATM: 'Derivada a ATM', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada',
};

const STATE_COLORS: Partial<Record<InspectionState, BadgeColor>> = {
  BORRADOR: 'neutral', PLANIFICADA: 'info', EN_CAMPO: 'primary', EN_REVISION: 'warning', NOTIFICADA: 'info',
  EN_DESCARGO: 'warning', REQUIERE_SUBSANACION: 'error', CERRADA_CONFORME: 'success', DERIVADA_LEGALES: 'error',
  EN_TRAMITE_LEGAL: 'warning', DERIVADA_ATM: 'warning', FINALIZADA: 'success', CANCELADA: 'neutral',
};

const RESULT_OPTIONS: Array<{ value: InspectionItemResult; label: string; style: string }> = [
  { value: 'CUMPLE', label: 'Cumple', style: 'border-emerald-600 bg-emerald-600 text-white' },
  { value: 'NO_CUMPLE', label: 'No cumple', style: 'border-red-600 bg-red-600 text-white' },
  { value: 'NO_APLICA', label: 'No aplica', style: 'border-slate-500 bg-slate-500 text-white' },
];

type Draft = { version: number; observaciones: string; numeroActa: string; ubicacion: string; plazoRespuestaAt: string; items: InspectionItem[] };

function toLocalDatetime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const InspeccionDetallePage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const mobile = location.pathname.startsWith('/mobile');
  const { currentUser } = useAuth();
  const inspectionQuery = useInspection(id);
  const inspection = inspectionQuery.data;
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [numeroActa, setNumeroActa] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [plazoRespuestaAt, setPlazoRespuestaAt] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const draftKey = currentUser?.id && id ? `sitrep_inspection_draft_${currentUser.id}_${id}` : '';
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);

  useEffect(() => {
    if (!inspection) return;
    const serverDraft: Draft = {
      version: inspection.version,
      observaciones: inspection.observaciones || '',
      numeroActa: inspection.numeroActa || '',
      ubicacion: inspection.ubicacion || '',
      plazoRespuestaAt: toLocalDatetime(inspection.plazoRespuestaAt),
      items: inspection.items,
    };
    if (draftKey) {
      try {
        const local = JSON.parse(localStorage.getItem(draftKey) || 'null') as Draft | null;
        if (local?.version === inspection.version) Object.assign(serverDraft, local);
      } catch { /* corrupted local draft is ignored */ }
    }
    setItems(serverDraft.items);
    setObservaciones(serverDraft.observaciones);
    setNumeroActa(serverDraft.numeroActa);
    setUbicacion(serverDraft.ubicacion);
    setPlazoRespuestaAt(serverDraft.plazoRespuestaAt);
    const groups = Array.from(new Set(serverDraft.items.map((item) => item.categoria)));
    setExpanded(Object.fromEntries(groups.map((group) => [group, true])));
  }, [inspection?.id, inspection?.version, draftKey]);

  useEffect(() => {
    if (!draftKey || !inspection || items.length === 0) return;
    const draft: Draft = { version: inspection.version, observaciones, numeroActa, ubicacion, plazoRespuestaAt, items };
    const timer = window.setTimeout(() => localStorage.setItem(draftKey, JSON.stringify(draft)), 350);
    return () => window.clearTimeout(timer);
  }, [draftKey, inspection?.version, items, observaciones, numeroActa, ubicacion, plazoRespuestaAt]);

  const saveMutation = useInspectionMutation(async () => {
    if (!inspection) return;
    const metadata = await inspeccionService.update(id, {
      version: inspection.version,
      observaciones: observaciones || null,
      numeroActa: numeroActa || null,
      ubicacion: ubicacion || null,
      plazoRespuestaAt: plazoRespuestaAt ? new Date(plazoRespuestaAt).toISOString() : null,
    });
    return inspeccionService.updateItems(id, metadata.version, items.map((item) => ({
      id: item.id, resultado: item.resultado, observacion: item.observacion || null,
    })));
  }, id);
  const transitionMutation = useInspectionMutation(async (next: InspectionState) => {
    if (!inspection) return;
    return inspeccionService.transition(id, inspection.version, next, {
      plazoRespuestaAt: plazoRespuestaAt ? new Date(plazoRespuestaAt).toISOString() : undefined,
    });
  }, id);
  const uploadMutation = useInspectionMutation(async (file: File) => {
    await inspeccionService.uploadEvidence(id, file);
  }, id);

  const save = async () => {
    if (!inspection) return;
    if (!isOnline) {
      toast.info('Borrador guardado en el dispositivo', 'Se sincronizará cuando vuelva la conexión y usted pulse Guardar.');
      return;
    }
    try {
      await saveMutation.mutateAsync(undefined);
      if (draftKey) localStorage.removeItem(draftKey);
      toast.success('Borrador guardado', 'Checklist, acta y observaciones quedaron sincronizados.');
    } catch (error: any) {
      toast.error('No se pudo guardar', error?.response?.data?.message || 'Los cambios siguen guardados en este dispositivo.');
    }
  };

  const transition = async (next: InspectionState) => {
    if (!inspection) return;
    if (!isOnline) return toast.warning('Conexión requerida', 'El cierre de una etapa necesita confirmación del servidor.');
    try {
      await transitionMutation.mutateAsync(next);
      toast.success('Estado actualizado', next === 'NOTIFICADA' ? 'Acta aprobada. No se envió ninguna comunicación externa.' : STATE_LABELS[next]);
    } catch (error: any) {
      toast.error('Acción rechazada', error?.response?.data?.message || 'No se pudo cambiar el estado.');
    }
  };

  const uploadFile = async (file?: File) => {
    if (!file) return;
    if (!isOnline) return toast.warning('Carga pendiente', 'Conserve el archivo; la carga de evidencia requiere conexión en esta versión.');
    try {
      await uploadMutation.mutateAsync(file);
      toast.success('Evidencia agregada', file.name);
    } catch (error: any) {
      toast.error('Evidencia rechazada', error?.response?.data?.message || 'No se pudo cargar el archivo.');
    }
  };

  const toggleRecording = async () => {
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return toast.warning('Audio no disponible', 'Este navegador no permite grabar audio.');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const extension = recorder.mimeType.includes('ogg') ? 'ogg' : 'webm';
        await uploadFile(new File([blob], `audio-inspeccion-${Date.now()}.${extension}`, { type: blob.type }));
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error('Permiso de micrófono denegado', 'Habilítelo para incorporar un audio al expediente.');
    }
  };

  if (inspectionQuery.isLoading) return <p className="p-8 text-center text-sm text-neutral-500">Cargando expediente…</p>;
  if (!inspection) return <Card><p className="font-semibold text-neutral-900">Inspección no encontrada</p></Card>;

  const actor = inspectionActor(inspection);
  const groups = Array.from(new Set(items.map((item) => item.categoria)));
  const completed = items.filter((item) => item.resultado !== 'PENDIENTE').length;
  const canEdit = ['BORRADOR', 'PLANIFICADA', 'EN_CAMPO'].includes(inspection.estado);
  const isAdmin = currentUser?.rol === 'ADMIN' || currentUser?.rol === `ADMIN_${inspection.tipoActor}`;

  const primaryAction = (() => {
    if (inspection.estado === 'BORRADOR' || inspection.estado === 'PLANIFICADA') return { label: 'Iniciar inspección', state: 'EN_CAMPO' as InspectionState };
    if (inspection.estado === 'EN_CAMPO') return { label: 'Enviar a revisión', state: 'EN_REVISION' as InspectionState };
    if (inspection.estado === 'EN_REVISION' && isAdmin) return { label: 'Aprobar acta', state: 'NOTIFICADA' as InspectionState };
    if (inspection.estado === 'NOTIFICADA' && isAdmin) return { label: 'Cerrar conforme', state: 'CERRADA_CONFORME' as InspectionState };
    if (inspection.estado === 'DERIVADA_LEGALES' && isAdmin) return { label: 'Registrar trámite legal', state: 'EN_TRAMITE_LEGAL' as InspectionState };
    if (inspection.estado === 'DERIVADA_ATM' && isAdmin) return { label: 'Finalizar expediente', state: 'FINALIZADA' as InspectionState };
    return null;
  })();

  return (
    <div className="space-y-4 animate-fade-in">
      {!isOnline && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950"><CloudOff size={18} /><span>Sin conexión · cambios guardados en este dispositivo</span></div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={() => navigate(`${mobile ? '/mobile' : ''}/inspecciones`)} className="flex w-fit items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"><ArrowLeft size={18} /> Volver al listado</button>
        <div className="flex items-center gap-2"><Badge color={STATE_COLORS[inspection.estado] || 'neutral'} size="lg" dot={inspection.estado === 'EN_CAMPO'} pulse={inspection.estado === 'EN_CAMPO'}>{STATE_LABELS[inspection.estado]}</Badge><span className="text-sm text-neutral-500">v{inspection.version}</span></div>
      </div>

      <Card className="!p-4 sm:!p-5">
        <div className="flex flex-col gap-4 border-b border-neutral-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-sm font-semibold text-primary-700">Acta de inspección</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-950">{inspection.numero}</h2></div>
          <label className="min-w-0 text-xs font-semibold uppercase tracking-wide text-neutral-500 sm:w-64">Número de acta
            <input disabled={!canEdit} value={numeroActa} onChange={(event) => setNumeroActa(event.target.value)} placeholder="Asignar número" className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm font-medium normal-case text-neutral-900 disabled:bg-neutral-50" />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex gap-3"><ClipboardCheck className="mt-0.5 shrink-0 text-neutral-500" size={19} /><div><p className="text-xs text-neutral-500">Actor inspeccionado</p><p className="font-semibold text-neutral-950">{actor?.razonSocial}</p><p className="text-xs text-neutral-500">CUIT {actor?.cuit}</p></div></div>
          <div className="flex gap-3"><UserRound className="mt-0.5 shrink-0 text-neutral-500" size={19} /><div><p className="text-xs text-neutral-500">Inspector</p><p className="font-semibold text-neutral-950">{inspection.inspector.nombre} {inspection.inspector.apellido || ''}</p></div></div>
          <div className="flex gap-3"><MapPin className="mt-0.5 shrink-0 text-neutral-500" size={19} /><div className="min-w-0 flex-1"><p className="text-xs text-neutral-500">Ubicación</p>{canEdit ? <input value={ubicacion} onChange={(event) => setUbicacion(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-neutral-300 px-2 text-sm" /> : <p className="font-semibold text-neutral-950">{ubicacion || 'Sin informar'}</p>}</div></div>
          <div className="flex gap-3"><CalendarDays className="mt-0.5 shrink-0 text-neutral-500" size={19} /><div><p className="text-xs text-neutral-500">Inicio</p><p className="font-semibold text-neutral-950">{inspection.iniciadaAt ? new Date(inspection.iniciadaAt).toLocaleString('es-AR') : 'Pendiente'}</p></div></div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.8fr)]">
        <div className="space-y-4">
          <Card className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-4 sm:px-5"><div><h3 className="font-bold text-neutral-950">Checklist</h3><p className="mt-0.5 text-xs text-neutral-500">{completed} de {items.length} puntos respondidos</p></div><Badge color={completed === items.length ? 'success' : 'warning'}>{Math.round((completed / Math.max(1, items.length)) * 100)}%</Badge></div>
            {groups.map((group) => {
              const groupItems = items.filter((item) => item.categoria === group);
              const groupDone = groupItems.filter((item) => item.resultado !== 'PENDIENTE').length;
              return (
                <section key={group} className="border-b border-neutral-200 last:border-0">
                  <button onClick={() => setExpanded((value) => ({ ...value, [group]: !value[group] }))} className="flex w-full items-center justify-between bg-neutral-50 px-4 py-3 text-left sm:px-5">
                    <span className="font-bold text-neutral-900">{group} <span className="ml-1 text-sm font-medium text-neutral-500">({groupDone}/{groupItems.length})</span></span>
                    {expanded[group] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {expanded[group] && groupItems.map((item) => (
                    <div key={item.id} className="border-t border-neutral-100 px-4 py-4 first:border-t-0 sm:px-5">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${item.resultado === 'CUMPLE' ? 'bg-emerald-600 text-white' : item.resultado === 'NO_CUMPLE' ? 'bg-red-600 text-white' : item.resultado === 'NO_APLICA' ? 'bg-slate-500 text-white' : 'border border-neutral-300 text-neutral-300'}`}>{item.resultado === 'CUMPLE' ? <Check size={15} /> : item.resultado === 'NO_CUMPLE' ? <XCircle size={15} /> : null}</div>
                        <div className="min-w-0 flex-1"><p className="text-sm font-medium leading-relaxed text-neutral-900">{item.etiqueta}</p><p className="mt-0.5 text-xs text-neutral-400">{item.codigo}</p></div>
                      </div>
                      {canEdit && (
                        <div className="mt-3 flex flex-wrap gap-2 pl-9">
                          {RESULT_OPTIONS.map((option) => <button key={option.value} onClick={() => setItems((current) => current.map((row) => row.id === item.id ? { ...row, resultado: option.value } : row))} className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${item.resultado === option.value ? option.style : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'}`}>{option.label}</button>)}
                          <input value={item.observacion || ''} onChange={(event) => setItems((current) => current.map((row) => row.id === item.id ? { ...row, observacion: event.target.value } : row))} placeholder="Observación del punto" className="h-9 min-w-[220px] flex-1 rounded-lg border border-neutral-300 px-3 text-sm" />
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              );
            })}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <div className="flex items-center justify-between"><h3 className="font-bold text-neutral-950">Evidencias ({inspection.evidencias.length})</h3><Paperclip size={18} className="text-neutral-400" /></div>
            {inspection.evidencias.length === 0 ? <p className="mt-4 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-500">Todavía no se incorporaron fotos, audios o documentos.</p> : (
              <div className="mt-4 space-y-2">{inspection.evidencias.map((evidence) => <div key={evidence.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3">{evidence.tipo === 'FOTO' ? <Camera size={19} className="text-primary-700" /> : evidence.tipo === 'AUDIO' ? <FileAudio size={19} className="text-blue-700" /> : <FileText size={19} className="text-purple-700" />}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-neutral-900">{evidence.nombreOriginal}</p><p className="text-xs text-neutral-500">{(evidence.bytes / 1024 / 1024).toFixed(1)} MB · {new Date(evidence.createdAt).toLocaleString('es-AR')}</p></div></div>)}</div>
            )}
            {canEdit && <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <Button variant="outline" size="sm" leftIcon={<Camera size={16} />} onClick={() => cameraInputRef.current?.click()}>Foto</Button>
              <Button variant="outline" size="sm" leftIcon={<Paperclip size={16} />} onClick={() => fileInputRef.current?.click()}>Archivo</Button>
              <Button variant={recording ? 'danger' : 'outline'} size="sm" leftIcon={recording ? <Square size={15} /> : <Mic size={16} />} onClick={toggleRecording}>{recording ? 'Detener' : 'Audio'}</Button>
              <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={(event) => uploadFile(event.target.files?.[0])} />
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,application/pdf,audio/*" className="hidden" onChange={(event) => uploadFile(event.target.files?.[0])} />
            </div>}
            <p className="mt-3 text-xs leading-relaxed text-neutral-500">El audio original queda preservado. La transcripción automática se incorporará en una etapa posterior y requerirá validación humana.</p>
          </Card>

          <Card>
            <h3 className="font-bold text-neutral-950">Observaciones generales</h3>
            <textarea disabled={!canEdit} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} rows={5} placeholder="Describa hallazgos, contexto y acciones requeridas…" className="mt-3 w-full resize-y rounded-lg border border-neutral-300 p-3 text-sm leading-relaxed text-neutral-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50" />
          </Card>

          {(inspection.estado === 'EN_REVISION' || inspection.estado === 'NOTIFICADA') && isAdmin && (
            <Card>
              <h3 className="font-bold text-neutral-950">Plazo de respuesta</h3>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">La aprobación no envía correos todavía; sólo deja preparado el expediente.</p>
              <input type="datetime-local" value={plazoRespuestaAt} onChange={(event) => setPlazoRespuestaAt(event.target.value)} className="mt-3 h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm" />
            </Card>
          )}

          <Card>
            <h3 className="font-bold text-neutral-950">Trazabilidad</h3>
            <div className="mt-4 space-y-0">{inspection.eventos.map((event, index) => <div key={event.id} className="relative flex gap-3 pb-5 last:pb-0">{index < inspection.eventos.length - 1 && <span className="absolute left-[5px] top-3 h-full w-px bg-neutral-200" />}<span className="relative mt-1 h-3 w-3 shrink-0 rounded-full bg-primary-600 ring-4 ring-white" /><div><p className="text-sm font-semibold text-neutral-900">{event.titulo}</p><p className="mt-0.5 text-xs text-neutral-500">{new Date(event.createdAt).toLocaleString('es-AR')} · {event.usuario.nombre}</p>{event.detalle && <p className="mt-1 text-xs leading-relaxed text-neutral-600">{event.detalle}</p>}</div></div>)}</div>
          </Card>
        </aside>
      </div>

      <div className={`sticky ${mobile ? 'bottom-[64px]' : 'bottom-0'} z-30 -mx-4 border-t border-neutral-200 bg-white/95 px-3 py-3 shadow-[0_-6px_20px_rgba(0,0,0,0.06)] backdrop-blur sm:mx-0 sm:rounded-xl sm:border`}>
        <div className="mx-auto flex max-w-[1500px] flex-row gap-2 [&>button]:min-w-0 [&>button]:flex-1 sm:justify-end sm:[&>button]:flex-none">
          {canEdit && <Button variant="outline" leftIcon={<Save size={17} />} isLoading={saveMutation.isPending} onClick={save}>Guardar borrador</Button>}
          {inspection.estado === 'EN_REVISION' && isAdmin && <Button variant="outline" onClick={() => transition('EN_CAMPO')}>Devolver a campo</Button>}
          {primaryAction && <Button leftIcon={primaryAction.state === 'EN_REVISION' ? <Send size={17} /> : <ShieldCheck size={17} />} isLoading={transitionMutation.isPending} onClick={() => transition(primaryAction.state)} disabled={primaryAction.state === 'NOTIFICADA' && !plazoRespuestaAt}>{primaryAction.label}</Button>}
          {inspection.estado === 'NOTIFICADA' && isAdmin && <Button variant="danger" onClick={() => transition('DERIVADA_LEGALES')}>Derivar a legales</Button>}
        </div>
      </div>
    </div>
  );
};

export default InspeccionDetallePage;

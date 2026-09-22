import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  Files,
  Hash,
  Landmark,
  Paperclip,
  Reply,
  Scale,
  Send,
  ShieldCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { Badge, type BadgeColor } from '../../components/ui/BadgeV2';
import { Button } from '../../components/ui/ButtonV2';
import { Card } from '../../components/ui/CardV2';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { inspeccionService } from '../../services/inspeccion.service';
import { loadOfflineExchangeDraft, removeOfflineExchangeDraft, saveOfflineExchangeDraft } from '../../services/inspectionOfflineExchange';
import type {
  InspectionExchange,
  InspectionExchangeParty,
  InspectionExchangeType,
} from '../../types/inspection';
import { INSPECTION_STATE_COLORS, INSPECTION_STATE_LABELS, inspectionDate, inspectionErrorMessage } from './inspectionPresentation';

const TYPE_LABELS: Record<InspectionExchangeType, string> = {
  REQUERIMIENTO: 'Requerimiento',
  RESPUESTA: 'Respuesta',
  DESCARGO: 'Descargo',
  SUBSANACION: 'Subsanación',
  PRONUNCIAMIENTO: 'Pronunciamiento',
  CIERRE_CONFORME: 'Cierre conforme',
  DERIVACION_LEGALES: 'Derivación a Legales',
};

const TYPE_COLORS: Record<InspectionExchangeType, BadgeColor> = {
  REQUERIMIENTO: 'warning',
  RESPUESTA: 'info',
  DESCARGO: 'info',
  SUBSANACION: 'primary',
  PRONUNCIAMIENTO: 'primary',
  CIERRE_CONFORME: 'success',
  DERIVACION_LEGALES: 'error',
};

const OPEN_STATES = new Set(['NOTIFICADA', 'EN_DESCARGO', 'REQUIERE_SUBSANACION']);
const CLOSED_TYPES = new Set<InspectionExchangeType>(['CIERRE_CONFORME', 'DERIVACION_LEGALES']);

type ExchangeDraft = {
  tipo: InspectionExchangeType;
  asunto: string;
  cuerpo: string;
  respondeAId: string;
  plazoRespuestaAt: string;
};

const initialDraft = (party: InspectionExchangeParty): ExchangeDraft => ({
  tipo: party === 'INSPECCIONADO' ? 'DESCARGO' : 'REQUERIMIENTO',
  asunto: '',
  cuerpo: '',
  respondeAId: '',
  plazoRespuestaAt: '',
});

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const localDate = (value?: string | null) => value
  ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  : '';

function storedExchangeDraft(key: string): ExchangeDraft | null {
  if (!key) return null;
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null') as ExchangeDraft | null;
    return value && typeof value.asunto === 'string' && typeof value.cuerpo === 'string' ? value : null;
  } catch {
    return null;
  }
}

function exchangeTypeOptions(party: InspectionExchangeParty, responding: boolean): Array<{ value: InspectionExchangeType; label: string }> {
  if (party === 'INSPECCIONADO') return [
    { value: 'DESCARGO', label: 'Presentar descargo' },
    { value: 'RESPUESTA', label: 'Responder requerimiento' },
    { value: 'SUBSANACION', label: 'Acreditar subsanación' },
  ];
  if (responding) return [
    { value: 'RESPUESTA', label: 'Responder al inspeccionado' },
    { value: 'PRONUNCIAMIENTO', label: 'Emitir pronunciamiento técnico' },
    { value: 'REQUERIMIENTO', label: 'Formular nuevo requerimiento' },
  ];
  return [{ value: 'REQUERIMIENTO', label: 'Formular requerimiento' }];
}

function groupExchangeCycles(entries: InspectionExchange[]): Array<{ root: InspectionExchange; entries: InspectionExchange[] }> {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const groups = new Map<string, InspectionExchange[]>();
  const rootFor = (entry: InspectionExchange) => {
    let current = entry;
    const visited = new Set<string>();
    while (current.respondeAId && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = byId.get(current.respondeAId);
      if (!parent) break;
      current = parent;
    }
    return current;
  };
  for (const entry of [...entries].sort((left, right) => left.secuencia - right.secuencia)) {
    const root = rootFor(entry);
    groups.set(root.id, [...(groups.get(root.id) || []), entry]);
  }
  return [...groups.entries()]
    .map(([rootId, grouped]) => ({ root: byId.get(rootId) || grouped[0], entries: grouped }))
    .sort((left, right) => left.root.secuencia - right.root.secuencia);
}

export interface InspectionExchangePanelProps {
  inspectionId: string;
  compact?: boolean;
}

export const InspectionExchangePanel: React.FC<InspectionExchangePanelProps> = ({ inspectionId, compact = false }) => {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const draftKey = currentUser?.id ? `sitrep_exchange_draft_${currentUser.id}_${inspectionId}` : '';
  const [restoredDraft] = useState<ExchangeDraft | null>(() => storedExchangeDraft(draftKey));
  const [online, setOnline] = useState(navigator.onLine);
  const [now, setNow] = useState(() => Date.now());
  const [composeOpen, setComposeOpen] = useState(Boolean(restoredDraft?.asunto || restoredDraft?.cuerpo));
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<ExchangeDraft>(() => restoredDraft || initialDraft('AUTORIDAD'));
  const [decision, setDecision] = useState<'CERRADA_CONFORME' | 'DERIVADA_LEGALES' | null>(null);
  const [fundamento, setFundamento] = useState('');
  const [expedienteLegal, setExpedienteLegal] = useState('');
  const [decisionFiles, setDecisionFiles] = useState<File[]>([]);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);

  const exchangeQuery = useQuery({
    queryKey: ['inspecciones', 'intercambios', currentUser?.id, inspectionId],
    queryFn: () => inspeccionService.getExchanges(inspectionId),
    enabled: Boolean(inspectionId && currentUser?.id),
    staleTime: 15_000,
  });
  const timeline = exchangeQuery.data;
  const party = timeline?.parteActual || 'AUTORIDAD';

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!draftKey || !composeOpen) return;
    const timer = window.setTimeout(() => localStorage.setItem(draftKey, JSON.stringify(draft)), 250);
    return () => window.clearTimeout(timer);
  }, [composeOpen, draft, draftKey]);

  useEffect(() => {
    if (!currentUser?.id || !inspectionId) return;
    let cancelled = false;
    void loadOfflineExchangeDraft(String(currentUser.id), inspectionId).then((saved) => {
      if (cancelled || !saved) return;
      setDraft(saved.draft);
      setFiles(saved.files);
      setRestoredAt(saved.savedAt);
      setComposeOpen(true);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [currentUser?.id, inspectionId]);

  useEffect(() => {
    if (!composeOpen || !currentUser?.id || !inspectionId) return;
    const timer = window.setTimeout(() => {
      void saveOfflineExchangeDraft(String(currentUser.id), inspectionId, draft, files).catch(() => undefined);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [composeOpen, currentUser?.id, draft, files, inspectionId]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inspecciones', 'intercambios', currentUser?.id, inspectionId] }),
      queryClient.invalidateQueries({ queryKey: ['inspecciones', 'participacion'] }),
      queryClient.invalidateQueries({ queryKey: ['inspecciones', 'detail'] }),
    ]);
  };

  const presentMutation = useMutation({
    mutationFn: () => {
      if (!timeline) throw new Error('Expediente no disponible');
      return inspeccionService.presentExchange(inspectionId, {
        version: timeline.inspeccion.version,
        clienteId: `exchange_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        tipo: draft.tipo,
        asunto: draft.asunto.trim(),
        cuerpo: draft.cuerpo.trim(),
        respondeAId: draft.respondeAId || undefined,
        plazoRespuestaAt: draft.plazoRespuestaAt ? new Date(draft.plazoRespuestaAt).toISOString() : undefined,
        files,
      });
    },
    onSuccess: async () => {
      if (draftKey) localStorage.removeItem(draftKey);
      if (currentUser?.id) await removeOfflineExchangeDraft(String(currentUser.id), inspectionId).catch(() => undefined);
      setDraft(initialDraft(party));
      setFiles([]);
      setComposeOpen(false);
      setRestoredAt(null);
      if (fileRef.current) fileRef.current.value = '';
      await refresh();
      toast.success('Presentación registrada', 'Quedó incorporada al expediente con huella de integridad. No se envió correo.');
    },
    onError: (error) => toast.error('No se pudo presentar', inspectionErrorMessage(error, 'Conserve el borrador y vuelva a intentar.')),
  });

  const decisionMutation = useMutation({
    mutationFn: () => {
      if (!timeline || !decision) throw new Error('Decisión incompleta');
      return inspeccionService.decideExchange(inspectionId, {
        version: timeline.inspeccion.version,
        clienteId: `decision_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        decision,
        fundamento: fundamento.trim(),
        expedienteLegal: decision === 'DERIVADA_LEGALES' && expedienteLegal.trim() ? expedienteLegal.trim() : undefined,
        files: decisionFiles,
      });
    },
    onSuccess: async () => {
      setDecision(null);
      setFundamento('');
      setExpedienteLegal('');
      setDecisionFiles([]);
      await refresh();
      toast.success('Decisión registrada', 'El cierre quedó incorporado a la cadena auditable. No se envió correo.');
    },
    onError: (error) => toast.error('No se pudo registrar la decisión', inspectionErrorMessage(error, 'Actualice el expediente e intente nuevamente.')),
  });

  const parentById = useMemo(() => new Map((timeline?.intercambios || []).map((entry) => [entry.id, entry])), [timeline?.intercambios]);
  const exchangeCycles = useMemo(() => groupExchangeCycles(timeline?.intercambios || []), [timeline?.intercambios]);
  const canDecide = Boolean(timeline && currentUser && (
    currentUser.rol === 'ADMIN' || currentUser.rol === `ADMIN_${timeline.inspeccion.tipoActor}`
  ));
  const open = Boolean(timeline && OPEN_STATES.has(timeline.inspeccion.estado));

  const beginNew = () => {
    const next = initialDraft(party);
    setDraft(next);
    setFiles([]);
    setComposeOpen(true);
  };

  const beginReply = (entry: InspectionExchange) => {
    const next = initialDraft(party);
    next.respondeAId = entry.id;
    next.tipo = party === 'INSPECCIONADO' ? 'DESCARGO' : 'RESPUESTA';
    next.asunto = `Respuesta a presentación #${entry.secuencia}: ${entry.asunto}`.slice(0, 180);
    setDraft(next);
    setFiles([]);
    setComposeOpen(true);
    window.setTimeout(() => {
      const form = document.getElementById('inspection-exchange-form');
      if (typeof form?.scrollIntoView === 'function') form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  };

  const submitPresentation = (event: React.FormEvent) => {
    event.preventDefault();
    if (!online) return toast.warning('Sin conexión', 'El texto quedó guardado en este dispositivo. Envíelo al recuperar conexión y vuelva a seleccionar los adjuntos.');
    if (draft.asunto.trim().length < 5 || draft.cuerpo.trim().length < 10) return toast.warning('Presentación incompleta', 'Complete asunto y contenido antes de presentar.');
    if (party === 'INSPECCIONADO' && !draft.respondeAId) return toast.warning('Seleccione el antecedente', 'Toda presentación del inspeccionado debe responder a una actuación de la autoridad.');
    if (files.length > 5 || files.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024) return toast.warning('Adjuntos excedidos', 'Puede adjuntar hasta 5 archivos y 50 MB por presentación.');
    presentMutation.mutate();
  };

  const downloadAttachment = async (entry: InspectionExchange, evidenceId: string, name: string) => {
    try {
      const url = await inspeccionService.exchangeAttachmentObjectUrl(inspectionId, entry.id, evidenceId);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      toast.error('Adjunto no disponible', inspectionErrorMessage(error, 'No se pudo descargar el archivo preservado.'));
    }
  };

  if (exchangeQuery.isLoading) return <Card className="text-sm text-neutral-600">Cargando presentaciones auditadas…</Card>;
  if (exchangeQuery.isError || !timeline) return <Card className="border-error-200 bg-error-50 text-sm text-error-800">No se pudo abrir el intercambio formal de este expediente.</Card>;

  const deadlineExpired = Boolean(timeline.inspeccion.plazoRespuestaAt && new Date(timeline.inspeccion.plazoRespuestaAt).getTime() < now);

  return (
    <section className={compact ? 'space-y-4' : 'space-y-5'} aria-labelledby="inspection-exchange-title">
      <Card className="overflow-hidden !p-0">
        <div className="border-b border-neutral-200 bg-[#F8FAF8] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E6F4EC] text-[#1B5E3C]"><Scale size={21} /></div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1B5E3C]">Instancia contradictoria</p>
                <h3 id="inspection-exchange-title" className="mt-1 text-xl font-extrabold tracking-tight text-[#10213A]">Presentaciones y respuestas</h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">Cada actuación queda fechada, atribuida, vinculada a sus adjuntos y encadenada por huellas SHA-256. Este canal registra en SITREP; no envía correos.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Badge color={INSPECTION_STATE_COLORS[timeline.inspeccion.estado] || 'neutral'}>{INSPECTION_STATE_LABELS[timeline.inspeccion.estado]}</Badge>
              <Badge color={party === 'AUTORIDAD' ? 'primary' : 'info'} variant="outline">Vista: {party === 'AUTORIDAD' ? 'Organismo' : 'Inspeccionado'}</Badge>
            </div>
          </div>
        </div>
        <div className="grid gap-0 divide-y divide-neutral-200 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
          <div className="py-3 sm:pr-4"><p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Expediente</p><p className="mt-1 font-bold text-[#10213A]">{timeline.inspeccion.numero}</p></div>
          <div className="py-3 sm:px-4"><p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Presentaciones</p><p className="mt-1 font-bold text-[#10213A]">{timeline.intercambios.length}</p></div>
          <div className="py-3 sm:pl-4"><p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Plazo vigente</p><p className={`mt-1 font-bold ${deadlineExpired ? 'text-error-700' : 'text-[#10213A]'}`}>{timeline.inspeccion.plazoRespuestaAt ? inspectionDate(timeline.inspeccion.plazoRespuestaAt, true) : 'Sin plazo abierto'}</p></div>
        </div>
      </Card>

      {!online && <div role="status" className="flex items-start gap-3 rounded-xl border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-900"><WifiOff className="mt-0.5 shrink-0" size={18} /><div><p className="font-bold">Sin conexión: no se enviará ninguna actuación.</p><p className="mt-0.5 leading-5">El texto y los adjuntos seleccionados se conservan en el almacenamiento local del navegador de este dispositivo. Al reconectar, revise la versión y confirme manualmente; SITREP nunca autoenvía un descargo.</p></div></div>}
      {restoredAt && composeOpen && <div role="status" className="flex items-start gap-3 rounded-xl border border-info-200 bg-info-50 px-4 py-3 text-sm text-info-900"><FileCheck2 className="mt-0.5 shrink-0" size={18} /><div><p className="font-bold">Borrador local recuperado</p><p className="mt-0.5 leading-5">Guardado {inspectionDate(restoredAt, true)} con {files.length} {files.length === 1 ? 'adjunto' : 'adjuntos'}. Revíselo antes de presentar; todavía no integra el expediente.</p></div></div>}
      {deadlineExpired && open && <div className="flex items-start gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-900"><AlertTriangle className="mt-0.5 shrink-0" size={18} /><div><p className="font-bold">Plazo vencido</p><p className="mt-0.5">El sistema admite la presentación y la marcará como fuera de plazo; la valoración corresponde a la autoridad competente.</p></div></div>}

      <div className="space-y-3">
        {timeline.intercambios.length === 0 ? (
          <Card className="py-10 text-center"><Files className="mx-auto text-neutral-300" size={36} /><p className="mt-3 font-bold text-[#10213A]">Todavía no hay presentaciones formales</p><p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-neutral-600">La autoridad inicia el circuito con un requerimiento. El inspeccionado podrá responder sobre ese antecedente.</p></Card>
        ) : exchangeCycles.map((cycle, cycleIndex) => <section key={cycle.root.id} aria-label={`Ciclo ${cycleIndex + 1}: ${cycle.root.asunto}`} className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-2 sm:p-3"><header className="mb-2 flex flex-col gap-1 px-1 py-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Ciclo {cycleIndex + 1}</p><p className="text-sm font-bold text-[#10213A]">Iniciado por #{cycle.root.secuencia} · {TYPE_LABELS[cycle.root.tipo]}</p></div><p className="text-xs text-neutral-500">{cycle.entries.length} {cycle.entries.length === 1 ? 'actuación' : 'actuaciones'} vinculadas</p></header><div className="space-y-2">{cycle.entries.map((entry) => {
          const authority = entry.parte === 'AUTORIDAD';
          const parent = entry.respondeAId ? parentById.get(entry.respondeAId) : undefined;
          const mayReply = open && entry.parte !== party && !CLOSED_TYPES.has(entry.tipo);
          return <article key={entry.id} className={`relative overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,.03)] ${authority ? 'border-primary-200' : 'border-info-200'}`}><div className={`absolute inset-y-0 left-0 w-1 ${authority ? 'bg-[#1B5E3C]' : 'bg-info-600'}`} /><div className="px-4 py-4 pl-5 sm:px-5 sm:pl-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-neutral-500">#{entry.secuencia}</span><Badge color={authority ? 'primary' : 'info'} variant="outline">{authority ? 'Organismo' : 'Inspeccionado'}</Badge><Badge color={TYPE_COLORS[entry.tipo]}>{TYPE_LABELS[entry.tipo]}</Badge>{entry.presentadoFueraDePlazo && <Badge color="error">Fuera de plazo</Badge>}</div><h4 className="mt-2 text-base font-extrabold leading-6 text-[#10213A]">{entry.asunto}</h4>{parent && <p className="mt-1 text-xs font-medium text-neutral-500">Responde a #{parent.secuencia}: {parent.asunto}</p>}</div><div className="shrink-0 text-left text-xs leading-5 text-neutral-500 sm:text-right"><p className="font-semibold text-neutral-700">{entry.autor.nombre} {entry.autor.apellido || ''}</p><p>{inspectionDate(entry.createdAt, true)}</p><p>Canal: Portal SITREP</p></div></div><p className="mt-4 max-w-[76ch] whitespace-pre-wrap text-sm leading-6 text-neutral-800">{entry.cuerpo}</p>{entry.plazoRespuestaAt && <div className="mt-4 flex w-fit items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs font-semibold text-warning-900"><Clock3 size={15} />Responder hasta {inspectionDate(entry.plazoRespuestaAt, true)}</div>}{entry.adjuntos.length > 0 && <div className="mt-4 border-t border-neutral-100 pt-3"><p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500">Adjuntos preservados</p><div className="flex flex-wrap gap-2">{entry.adjuntos.map((file) => <button key={file.id} type="button" onClick={() => void downloadAttachment(entry, file.id, file.nombreOriginal)} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs font-semibold text-neutral-700 hover:border-primary-300 hover:bg-primary-50"><Paperclip size={14} className="shrink-0" /><span className="truncate">{file.nombreOriginal}</span><span className="shrink-0 font-normal text-neutral-500">{formatBytes(file.bytes)}</span><Download size={13} className="shrink-0" /></button>)}</div></div>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3"><details className="text-xs text-neutral-500"><summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold hover:text-neutral-800"><Hash size={14} />Integridad y versión</summary><dl className="mt-2 grid gap-1 font-mono text-[10px]"><div>Versión: {entry.versionExpediente}</div><div>Contenido: {entry.contenidoSha256}</div><div>Cadena: {entry.hashCadena}</div></dl></details>{mayReply && <Button size="sm" variant="outline" leftIcon={<Reply size={15} />} onClick={() => beginReply(entry)}>Responder esta actuación</Button>}</div></div></article>;
        })}</div></section>)}
      </div>

      {open && !composeOpen && party === 'AUTORIDAD' && <Button leftIcon={<FileCheck2 size={17} />} onClick={beginNew}>Nuevo requerimiento</Button>}
      {open && !composeOpen && party === 'INSPECCIONADO' && timeline.intercambios.some((entry) => entry.parte === 'AUTORIDAD') && <p className="rounded-xl border border-info-200 bg-info-50 px-4 py-3 text-sm text-info-900">Para contestar, seleccione <strong>Responder esta actuación</strong> en el requerimiento correspondiente. Así la relación queda inequívoca.</p>}

      {open && composeOpen && (
        <Card id="inspection-exchange-form" className="border-primary-200">
          <form onSubmit={submitPresentation} className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 pb-4">
              <div><p className="text-xs font-bold uppercase tracking-wide text-primary-700">Nueva presentación formal</p><h4 className="mt-1 text-lg font-extrabold text-[#10213A]">{draft.respondeAId ? 'Respuesta vinculada' : 'Requerimiento de la autoridad'}</h4></div>
              <button type="button" aria-label="Cerrar formulario" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" onClick={() => setComposeOpen(false)}><X size={18} /></button>
            </div>
            {draft.respondeAId && <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">Antecedente: presentación #{parentById.get(draft.respondeAId)?.secuencia || '—'} · {parentById.get(draft.respondeAId)?.asunto}</div>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-neutral-800">Tipo de actuación<select value={draft.tipo} onChange={(event) => setDraft((value) => ({ ...value, tipo: event.target.value as InspectionExchangeType, plazoRespuestaAt: event.target.value === 'REQUERIMIENTO' ? value.plazoRespuestaAt : '' }))} className="mt-1.5 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal">{exchangeTypeOptions(party, Boolean(draft.respondeAId)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              {party === 'AUTORIDAD' && draft.tipo === 'REQUERIMIENTO' && <label className="text-sm font-semibold text-neutral-800">Plazo de respuesta<input type="datetime-local" min={localDate(new Date(now).toISOString())} value={draft.plazoRespuestaAt} onChange={(event) => setDraft((value) => ({ ...value, plazoRespuestaAt: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-neutral-300 px-3 font-normal" /></label>}
            </div>
            <label className="block text-sm font-semibold text-neutral-800">Asunto<input value={draft.asunto} maxLength={180} onChange={(event) => setDraft((value) => ({ ...value, asunto: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-neutral-300 px-3 font-normal" placeholder="Objeto preciso de la presentación" /></label>
            <label className="block text-sm font-semibold text-neutral-800">Contenido<textarea value={draft.cuerpo} maxLength={12_000} onChange={(event) => setDraft((value) => ({ ...value, cuerpo: event.target.value }))} className="mt-1.5 min-h-36 w-full resize-y rounded-lg border border-neutral-300 px-3 py-3 font-normal leading-6" placeholder="Exponga hechos, documentación y petición de forma clara." /></label>
            <label className="block text-sm font-semibold text-neutral-800">Adjuntos probatorios <span className="font-normal text-neutral-500">(hasta 5 archivos, 50 MB total)</span><input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm" onChange={(event) => setFiles(Array.from(event.target.files || []))} className="mt-1.5 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:font-semibold file:text-primary-800" /></label>
            {files.length > 0 && <ul className="grid gap-2 sm:grid-cols-2">{files.map((file, index) => <li key={`${file.name}-${file.size}-${index}`} className="flex min-w-0 items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-700"><Paperclip size={14} className="shrink-0" /><span className="truncate">{file.name}</span><span className="ml-auto shrink-0 text-neutral-500">{formatBytes(file.size)}</span></li>)}</ul>}
            <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-xs text-neutral-500"><ShieldCheck size={15} />Se registra autor, fecha, canal, versión, adjuntos y huella encadenada.</p><Button type="submit" disabled={!online} isLoading={presentMutation.isPending} leftIcon={<Send size={16} />}>Presentar en expediente</Button></div>
          </form>
        </Card>
      )}

      {canDecide && open && timeline.intercambios.length > 0 && (
        <Card className="border-neutral-300">
          <div className="flex items-start gap-3"><Landmark className="mt-0.5 text-[#1B5E3C]" size={21} /><div><h4 className="font-extrabold text-[#10213A]">Decisión de la autoridad competente</h4><p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">El cierre o la derivación concluye esta instancia de intercambio. Requiere fundamento expreso y queda encadenado al expediente.</p></div></div>
          {!decision ? <div className="mt-4 flex flex-col gap-3 sm:flex-row"><Button variant="outline" leftIcon={<CheckCircle2 size={17} />} onClick={() => setDecision('CERRADA_CONFORME')}>Cerrar conforme</Button><Button variant="danger" leftIcon={<Scale size={17} />} onClick={() => setDecision('DERIVADA_LEGALES')}>Derivar a Legales</Button></div> : <form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); if (fundamento.trim().length >= 20) decisionMutation.mutate(); }}><div className={`rounded-lg border px-3 py-2 text-sm font-bold ${decision === 'CERRADA_CONFORME' ? 'border-success-200 bg-success-50 text-success-900' : 'border-error-200 bg-error-50 text-error-900'}`}>{decision === 'CERRADA_CONFORME' ? 'Cierre conforme del intercambio' : 'Derivación formal a Legales'}</div><label className="block text-sm font-semibold text-neutral-800">Fundamento de la decisión<textarea value={fundamento} onChange={(event) => setFundamento(event.target.value)} className="mt-1.5 min-h-28 w-full rounded-lg border border-neutral-300 px-3 py-3 font-normal leading-6" placeholder="Fundamento verificable, hechos considerados y alcance de la decisión." /></label>{decision === 'DERIVADA_LEGALES' && <label className="block text-sm font-semibold text-neutral-800">Referencia de expediente legal <span className="font-normal text-neutral-500">(si ya fue asignada)</span><input value={expedienteLegal} onChange={(event) => setExpedienteLegal(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-neutral-300 px-3 font-normal" /></label>}<label className="block text-sm font-semibold text-neutral-800">Adjuntos de la decisión <span className="font-normal text-neutral-500">(dictamen, nota o constancia)</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm" onChange={(event) => setDecisionFiles(Array.from(event.target.files || []))} className="mt-1.5 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:font-semibold file:text-primary-800" /></label>{decisionFiles.length > 0 && <ul className="grid gap-2 sm:grid-cols-2">{decisionFiles.map((file, index) => <li key={`${file.name}-${file.size}-${index}`} className="flex min-w-0 items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-700"><Paperclip size={14} className="shrink-0" /><span className="truncate">{file.name}</span><span className="ml-auto shrink-0 text-neutral-500">{formatBytes(file.size)}</span></li>)}</ul>}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={() => { setDecision(null); setDecisionFiles([]); }}>Cancelar</Button><Button type="submit" variant={decision === 'DERIVADA_LEGALES' ? 'danger' : 'primary'} disabled={fundamento.trim().length < 20 || !online || decisionFiles.length > 5 || decisionFiles.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024} isLoading={decisionMutation.isPending}>{decision === 'CERRADA_CONFORME' ? 'Confirmar cierre conforme' : 'Confirmar derivación'}</Button></div></form>}
        </Card>
      )}
    </section>
  );
};

export default InspectionExchangePanel;

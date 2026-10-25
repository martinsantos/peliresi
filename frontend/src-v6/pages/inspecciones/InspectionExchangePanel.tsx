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
import { Badge } from '../../components/ui/BadgeV2';
import { Button } from '../../components/ui/ButtonV2';
import { Card } from '../../components/ui/CardV2';
import { InspectionLegalProgress } from './InspectionLegalProgress';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { inspectionContextKey, inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import { inspeccionService } from '../../services/inspeccion.service';
import { loadOfflineExchangeDraft, removeOfflineExchangeDraft, saveOfflineExchangeDraft } from '../../services/inspectionOfflineExchange';
import type {
  InspectionExchange,
  InspectionExchangeParty,
  InspectionExchangeType,
} from '../../types/inspection';
import { INSPECTION_STATE_COLORS, INSPECTION_STATE_LABELS, inspectionDate, inspectionErrorMessage } from './inspectionPresentation';
import { INSPECTION_PHASES, inspectionPhaseOf, inspectionExchangeNextStep, inspectionExchangeDeadline, inspectionDeadlineDate, inspectionDeadlineStatus, inspectionFollowUpFromEntries, inspectionFollowUpStatus, inspectionReplyDeadline, inspectionDeadlineInput, inspectionDeadlineFromInput, inspectionLegalFollowUp } from './inspectionProcess';

const TYPE_LABELS: Record<InspectionExchangeType, string> = {
  REQUERIMIENTO: 'Requerimiento',
  RESPUESTA: 'Respuesta',
  DESCARGO: 'Descargo',
  SUBSANACION: 'Subsanación',
  PRONUNCIAMIENTO: 'Pronunciamiento',
  CIERRE_CONFORME: 'Cierre conforme',
  DERIVACION_LEGALES: 'Derivación a Legales',
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

type ExchangeCycle = ReturnType<typeof groupExchangeCycles>[number];

function ExchangeIntegrity({ entry }: { entry: InspectionExchange }) {
  return (
    <details data-testid={`exchange-integrity-${entry.id}`} className="min-w-0 flex-1 text-xs text-neutral-500">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md py-1 font-semibold hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
        <Hash size={14} aria-hidden="true" />
        Integridad y versión
      </summary>
      <dl className="mt-2 grid min-w-0 gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-[10px] leading-4 sm:grid-cols-2">
        <div className="min-w-0 sm:col-span-2">
          <dt className="font-sans font-bold uppercase tracking-wide text-neutral-500">Versión del expediente</dt>
          <dd className="mt-0.5 text-neutral-800">{entry.versionExpediente}</dd>
        </div>
        <div className="min-w-0">
          <dt className="font-sans font-bold uppercase tracking-wide text-neutral-500">Huella de contenido</dt>
          <dd data-testid="exchange-content-hash" className="mt-0.5 max-w-full break-all text-neutral-700 [overflow-wrap:anywhere]">{entry.contenidoSha256}</dd>
        </div>
        <div className="min-w-0">
          <dt className="font-sans font-bold uppercase tracking-wide text-neutral-500">Huella encadenada</dt>
          <dd data-testid="exchange-chain-hash" className="mt-0.5 max-w-full break-all text-neutral-700 [overflow-wrap:anywhere]">{entry.hashCadena}</dd>
        </div>
      </dl>
    </details>
  );
}

function ExchangeLedger({
  cycles,
  parentById,
  party,
  open,
  onDownload,
  onReply,
}: {
  cycles: ExchangeCycle[];
  parentById: Map<string, InspectionExchange>;
  party: InspectionExchangeParty;
  open: boolean;
  onDownload: (entry: InspectionExchange, evidenceId: string, name: string) => void;
  onReply: (entry: InspectionExchange) => void;
}) {
  return (
    <section data-testid="inspection-exchange-ledger" aria-labelledby="inspection-exchange-ledger-title" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <header className="flex flex-col gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700">Libro de actuaciones</p>
          <h4 id="inspection-exchange-ledger-title" className="mt-1 text-lg font-extrabold tracking-tight text-[#10213A]">Registro cronológico formal</h4>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600">Secuencia íntegra de requerimientos, respuestas y decisiones incorporadas al expediente.</p>
        </div>
        <p className="font-mono text-[11px] font-semibold text-neutral-500">{cycles.reduce((total, cycle) => total + cycle.entries.length, 0)} actuaciones · {cycles.length} {cycles.length === 1 ? 'ciclo' : 'ciclos'}</p>
      </header>

      <div className="divide-y divide-neutral-200">
        {cycles.map((cycle, cycleIndex) => (
          <section key={cycle.root.id} aria-label={`Ciclo ${cycleIndex + 1}: ${cycle.root.asunto}`}>
            <header className="flex flex-col gap-1 border-b border-neutral-100 bg-[#FAFBFA] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 font-mono text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary-700">Ciclo {String(cycleIndex + 1).padStart(2, '0')}</span>
                <span className="truncate text-xs font-bold text-[#10213A]">Actuación inicial #{cycle.root.secuencia} · {TYPE_LABELS[cycle.root.tipo]}</span>
              </div>
              <p className="shrink-0 text-[11px] text-neutral-500">{cycle.entries.length} {cycle.entries.length === 1 ? 'actuación vinculada' : 'actuaciones vinculadas'}</p>
            </header>

            <ol className="relative before:absolute before:bottom-8 before:left-[1.12rem] before:top-8 before:w-px before:bg-neutral-200 sm:before:left-[1.5rem]" aria-label={`Actuaciones del ciclo ${cycleIndex + 1}`}>
              {cycle.entries.map((entry) => {
                const authority = entry.parte === 'AUTORIDAD';
                const parent = entry.respondeAId ? parentById.get(entry.respondeAId) : undefined;
                const mayReply = open && entry.parte !== party && !CLOSED_TYPES.has(entry.tipo);
                return (
                  <li key={entry.id} data-testid="inspection-exchange-row" className="relative grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] sm:grid-cols-[3rem_minmax(0,1fr)]">
                    <div className="relative z-10 flex justify-center pt-5" aria-hidden="true">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white font-mono text-[10px] font-extrabold shadow-sm ${authority ? 'border-[#1B5E3C] text-[#1B5E3C]' : 'border-info-600 text-info-700'}`}>{entry.secuencia}</span>
                    </div>
                    <article className="min-w-0 border-b border-neutral-100 px-2 py-5 pr-4 last:border-b-0 sm:px-3 sm:pr-6">
                      <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                            <Badge color={authority ? 'primary' : 'info'} variant="outline">{authority ? 'Organismo' : 'Inspeccionado'}</Badge>
                            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-neutral-600">{TYPE_LABELS[entry.tipo]}</span>
                            {entry.presentadoFueraDePlazo && <Badge color="error">Fuera de plazo</Badge>}
                          </div>
                          <h5 className="mt-2 break-words text-[15px] font-extrabold leading-6 text-[#10213A]">{entry.asunto}</h5>
                          {parent && <p className="mt-1 break-words text-xs font-semibold text-primary-700">Responde a actuación #{parent.secuencia} · {parent.asunto}</p>}
                        </div>
                        <dl className="grid shrink-0 grid-cols-2 gap-x-3 gap-y-1 text-[11px] leading-4 text-neutral-500 lg:block lg:text-right">
                          <div className="contents lg:block"><dt className="sr-only">Fecha</dt><dd className="font-semibold text-neutral-700">{inspectionDate(entry.createdAt, true)}</dd></div>
                          <div className="contents lg:block"><dt className="sr-only">Autor</dt><dd>{entry.autor.nombre} {entry.autor.apellido || ''}</dd></div>
                          <div className="contents lg:block"><dt className="sr-only">Canal</dt><dd>Portal SITREP</dd></div>
                          <div className="contents lg:block"><dt className="sr-only">Destinatario</dt><dd>Para: {entry.destinatario === 'INSPECCIONADO' ? 'Inspeccionado' : 'Organismo'}</dd></div>
                        </dl>
                      </div>

                      <p className="mt-3 max-w-[76ch] whitespace-pre-wrap break-words text-sm leading-6 text-neutral-800">{entry.cuerpo}</p>

                      {entry.plazoRespuestaAt && <div className="mt-3 flex w-fit max-w-full items-start gap-2 border-l-2 border-warning-500 bg-warning-50 px-3 py-2 text-xs font-semibold leading-5 text-warning-900"><Clock3 size={15} className="mt-0.5 shrink-0" aria-hidden="true" /><span>Plazo de este pedido: {inspectionDeadlineDate(entry.plazoRespuestaAt)} · Mendoza</span></div>}

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-600"><span>Puesta a disposición: {inspectionDate(entry.puestaDisposicionAt || entry.createdAt, true)}</span><span className={entry.vistaPorDestinatarioAt ? 'font-semibold text-success-800' : 'font-semibold text-warning-800'}>{entry.vistaPorDestinatarioAt ? `Vista por el destinatario: ${inspectionDate(entry.vistaPorDestinatarioAt, true)}` : 'Aún no abierta por el destinatario'}</span></div>

                      {entry.adjuntos.length > 0 && <div className="mt-4 min-w-0"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">Adjuntos preservados</p><div className="grid min-w-0 gap-2 sm:grid-cols-2">{entry.adjuntos.map((file) => <button key={file.id} type="button" onClick={() => onDownload(entry, file.id, file.nombreOriginal)} className="flex min-w-0 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs font-semibold text-neutral-700 hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"><Paperclip size={14} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{file.nombreOriginal}</span><span className="shrink-0 font-normal text-neutral-500">{formatBytes(file.bytes)}</span><Download size={13} className="shrink-0" aria-hidden="true" /></button>)}</div></div>}

                      <div className="mt-4 flex min-w-0 flex-col gap-3 border-t border-neutral-100 pt-3 sm:flex-row sm:items-start sm:justify-between">
                        <ExchangeIntegrity entry={entry} />
                        {mayReply && <Button size="sm" variant="outline" leftIcon={<Reply size={15} />} onClick={() => onReply(entry)} className="w-full shrink-0 sm:w-auto">Responder esta actuación</Button>}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}

export interface InspectionExchangePanelProps {
  inspectionId: string;
  compact?: boolean;
}

export const InspectionExchangePanel: React.FC<InspectionExchangePanelProps> = (props) => {
  const { currentUser } = useAuth();
  const owner = inspectionWorkspaceOwner(currentUser);
  // Reset the entire editor synchronously, including decision/files and in-flight
  // local reads. Effects alone would expose the previous role for one render.
  return <ScopedInspectionExchangePanel key={JSON.stringify([owner, props.inspectionId])} {...props} owner={owner} />;
};

const ScopedInspectionExchangePanel: React.FC<InspectionExchangePanelProps & { owner: string }> = ({ inspectionId, compact = false, owner }) => {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const draftKey = currentUser?.id && owner ? `sitrep_exchange_draft_v2_${inspectionContextKey(currentUser.id, owner, inspectionId)}` : '';
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
  const draftWrites = useRef<Promise<void>>(Promise.resolve());
  const persistenceBlocked = useRef(false);
  const draftSaveEpoch = useRef(0);
  const draftInteraction = useRef(0);
  const [persistenceRevision, setPersistenceRevision] = useState(0);
  const [draftStorageError, setDraftStorageError] = useState(false);

  const exchangeQuery = useQuery({
    queryKey: ['inspecciones', 'intercambios', currentUser?.id, inspectionId, owner],
    queryFn: () => inspeccionService.getExchanges(inspectionId),
    enabled: Boolean(inspectionId && currentUser?.id),
    staleTime: 15_000,
    refetchInterval: query => query.state.data && inspectionLegalFollowUp(query.state.data.inspeccion.estado) ? 30_000 : false,
    refetchIntervalInBackground: false,
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
    const epoch = draftSaveEpoch.current;
    const timer = window.setTimeout(() => {
      if (persistenceBlocked.current || epoch !== draftSaveEpoch.current) return;
      try { localStorage.setItem(draftKey, JSON.stringify(draft)); } catch { setDraftStorageError(true); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [composeOpen, draft, draftKey, persistenceRevision]);

  useEffect(() => {
    if (!currentUser?.id || !inspectionId) return;
    let cancelled = false;
    const interaction = draftInteraction.current;
    void loadOfflineExchangeDraft(String(currentUser.id), inspectionId, owner).then((saved) => {
      if (cancelled || !saved || persistenceBlocked.current || interaction !== draftInteraction.current) return;
      setDraft(saved.draft);
      setFiles(saved.files);
      setRestoredAt(saved.savedAt);
      setComposeOpen(true);
    }).catch(() => { if (!cancelled) setDraftStorageError(true); });
    return () => { cancelled = true; };
  }, [currentUser?.id, inspectionId, owner]);

  useEffect(() => {
    if (!composeOpen || !currentUser?.id || !inspectionId) return;
    const epoch = draftSaveEpoch.current;
    const timer = window.setTimeout(() => {
      if (persistenceBlocked.current || epoch !== draftSaveEpoch.current) return;
      // Acknowledgement must wait for every queued write before removing the draft.
      draftWrites.current = saveOfflineExchangeDraft(String(currentUser.id), inspectionId, owner, draft, files)
        .catch(() => { setDraftStorageError(true); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [composeOpen, currentUser?.id, draft, files, inspectionId, owner, persistenceRevision]);

  const departingDraft = useRef({ draft, files, composeOpen });
  departingDraft.current = { draft, files, composeOpen };
  useEffect(() => {
    // A role change or close can happen before debounce. Flush only the old
    // editor's key; never carry its values into the new account/context.
    const flush = () => {
      const snapshot = departingDraft.current;
      if (!snapshot.composeOpen || persistenceBlocked.current || !currentUser?.id || !draftKey) return;
      try { localStorage.setItem(draftKey, JSON.stringify(snapshot.draft)); } catch { setDraftStorageError(true); }
      draftWrites.current = saveOfflineExchangeDraft(String(currentUser.id), inspectionId, owner, snapshot.draft, snapshot.files)
        .catch(() => { setDraftStorageError(true); });
    };
    const hidden = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => { flush(); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', hidden); };
  }, [currentUser?.id, draftKey, inspectionId, owner]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inspecciones', 'intercambios', currentUser?.id, inspectionId] }),
      queryClient.invalidateQueries({ queryKey: ['inspecciones', 'participacion'] }),
      queryClient.invalidateQueries({ queryKey: ['inspecciones', 'detail'] }),
      queryClient.invalidateQueries({ queryKey: ['inspecciones', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['inspecciones', 'operaciones'] }),
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
        plazoRespuestaAt: draft.plazoRespuestaAt ? inspectionDeadlineFromInput(draft.plazoRespuestaAt) : undefined,
        files,
      });
    },
    onSuccess: async () => {
      persistenceBlocked.current = true;
      setComposeOpen(false);
      if (draftKey) { try { localStorage.removeItem(draftKey); } catch { setDraftStorageError(true); } }
      await draftWrites.current;
      if (currentUser?.id) await removeOfflineExchangeDraft(String(currentUser.id), inspectionId, owner).catch(() => { setDraftStorageError(true); });
      setDraft(initialDraft(party));
      setFiles([]);
      setComposeOpen(false);
      setRestoredAt(null);
      if (fileRef.current) fileRef.current.value = '';
      await refresh();
      persistenceBlocked.current = false;
      toast.success('Presentación registrada', 'Quedó incorporada al expediente con huella de integridad. No se envió correo.');
    },
    onError: (error) => {
      persistenceBlocked.current = false;
      setPersistenceRevision((value) => value + 1);
      toast.error('No se pudo presentar', inspectionErrorMessage(error, 'Conserve el borrador y vuelva a intentar.'));
    },
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
    if (presentMutation.isPending) return;
    draftInteraction.current += 1;
    const next = initialDraft(party);
    setDraft(next);
    setFiles([]);
    setComposeOpen(true);
  };

  const beginReply = (entry: InspectionExchange) => {
    if (presentMutation.isPending) return;
    draftInteraction.current += 1;
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
    persistenceBlocked.current = true;
    draftSaveEpoch.current += 1;
    draftInteraction.current += 1;
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
  if (exchangeQuery.isError || !timeline) {
    const status = (exchangeQuery.error as { response?: { status?: number } } | null)?.response?.status;
    const inaccessible = status === 403 || status === 404;
    return <Card className="border-error-200 bg-error-50 text-sm text-error-800">
      <div role="alert"><p className="font-semibold">{inaccessible ? 'Requerimiento no disponible para esta cuenta' : 'No se pudo cargar el requerimiento'}</p>
        <p className="mt-1">{inaccessible ? 'Volvé a Avisos y abrí un pedido dirigido a tu rol y cuenta actual.' : 'Comprobá tu conexión y volvé a intentar.'}</p></div>
      {!inaccessible && <Button variant="outline" className="mt-3" onClick={() => void exchangeQuery.refetch()}>Reintentar</Button>}
    </Card>;
  }

  const followUp = inspectionFollowUpStatus(timeline.inspeccion.seguimiento || inspectionFollowUpFromEntries(timeline.inspeccion.estado, timeline.intercambios), now);
  const legal = inspectionLegalFollowUp(timeline.inspeccion.estado);
  const deadlineExpired = followUp.overdue > 0;
  const displayedDeadline = followUp.next ? followUp.next.plazoRespuestaAt : inspectionExchangeDeadline(timeline.inspeccion.estado, timeline.inspeccion.plazoRespuestaAt, timeline.intercambios);
  const nextStep = inspectionExchangeNextStep(timeline.inspeccion.estado, timeline.intercambios, party === 'INSPECCIONADO', now);
  const selectedDeadline = draft.respondeAId ? inspectionReplyDeadline(timeline.intercambios, draft.respondeAId) : null;

  return (
    <section className={compact ? 'space-y-4' : 'space-y-5'} aria-labelledby="inspection-exchange-title">
      {draftStorageError && <Card role="alert" className="border-warning-200 bg-warning-50 text-sm text-warning-900">No pudimos confirmar la copia local del borrador. Conservá esta pantalla abierta hasta guardar con conexión.</Card>}
      <Card className="overflow-hidden !p-0">
        <div className="border-b border-neutral-200 bg-[#F8FAF8] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E6F4EC] text-[#1B5E3C]"><Scale size={21} /></div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1B5E3C]">{party === 'INSPECCIONADO' ? 'Expediente · '+timeline.inspeccion.numero : 'PSIP · '+INSPECTION_PHASES[inspectionPhaseOf(timeline.inspeccion.estado)].label}</p>
                <h3 id="inspection-exchange-title" className="mt-1 text-xl font-extrabold tracking-tight text-[#10213A]">{party === 'INSPECCIONADO' ? 'Requerimiento de la autoridad' : 'Presentaciones y respuestas'}</h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">{party === 'INSPECCIONADO' ? (timeline.inspeccion.actor?.razonSocial || 'Comunicación dirigida a tu cuenta') : 'Observaciones de la autoridad, respuesta del inspeccionado y decisión en el mismo expediente.'}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Badge color={INSPECTION_STATE_COLORS[timeline.inspeccion.estado] || 'neutral'}>{INSPECTION_STATE_LABELS[timeline.inspeccion.estado]}</Badge>
              {party === 'AUTORIDAD' && <Badge color="primary" variant="outline">Organismo</Badge>}
            </div>
          </div>
        </div>
        <div className={`grid gap-0 divide-y divide-neutral-200 px-4 sm:px-6 ${party === 'AUTORIDAD' ? 'sm:grid-cols-3 sm:divide-x sm:divide-y-0' : ''}`}>
          {party === 'AUTORIDAD' && <div className="py-3 sm:pr-4"><p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Expediente</p><p className="mt-1 font-bold text-[#10213A]">{timeline.inspeccion.numero}</p></div>}
          {party === 'AUTORIDAD' && <div className="py-3 sm:px-4"><p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Presentaciones</p><p className="mt-1 font-bold text-[#10213A]">{timeline.intercambios.length}</p></div>}
          <div className={`py-3 ${party === 'AUTORIDAD' ? 'sm:pl-4' : ''}`}><p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{!open ? 'Último plazo · histórico' : followUp.next ? `Plazo del pedido #${followUp.next.secuencia}` : 'Último plazo registrado · referencia'}</p><p data-testid="inspection-deadline-value" className={`mt-1 font-bold ${deadlineExpired && open ? 'text-error-700' : 'text-[#10213A]'}`}>{inspectionDeadlineDate(displayedDeadline)}</p>{displayedDeadline && <p className="mt-1 text-xs text-neutral-500">Hora de Mendoza</p>}</div>
        </div>
        <div data-testid="inspection-next-step" className="border-t border-neutral-200 px-4 py-4 sm:px-6">
          <p data-testid="inspection-responsible" className="mb-2 text-xs font-bold uppercase tracking-wide text-primary-800">{legal ? 'Debe actuar: Administración competente' : followUp.responsible ? `Debe actuar: ${followUp.responsible}` : 'Sin intercambio abierto'}</p>
          <p className="flex items-center gap-2 font-bold text-neutral-900"><Reply size={18} className="shrink-0 text-primary-800" aria-hidden="true" />{nextStep.title}</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">{nextStep.detail}</p>
          {open && nextStep.pending.length > 0 && <div aria-label="Requerimientos sin respuesta" role="region" className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {nextStep.pending.map(entry => {
              const status = inspectionDeadlineStatus(entry.plazoRespuestaAt, now);
              return <div key={entry.id} data-testid="inspection-pending-request" className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="col-span-2 min-w-0 sm:col-span-1"><p className="break-words text-sm font-semibold text-neutral-900">#{entry.secuencia} · {entry.asunto}</p><p className="mt-1 text-xs text-neutral-600">{inspectionDeadlineDate(entry.plazoRespuestaAt)}{entry.plazoRespuestaAt ? ' · Mendoza' : ''}</p></div>
                {party === 'INSPECCIONADO' && <p className="col-span-2 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-700 sm:col-span-3">{entry.cuerpo}</p>}
                <Badge className="justify-self-start" color={status === 'Vencido' ? 'error' : status === 'Vence hoy' ? 'warning' : 'neutral'}>{status}</Badge>
                {party === 'INSPECCIONADO' && <Button aria-label={`Responder requerimiento #${entry.secuencia}`} className="justify-self-end" size="sm" variant="outline" disabled={presentMutation.isPending} onClick={() => beginReply(entry)}>Responder</Button>}
              </div>;
            })}
          </div>}
          {party === 'AUTORIDAD' ? (<p className="mt-3 text-xs leading-5 text-neutral-600">Cada actuación avisa en la campana a la contraparte con cuenta activa y acceso al expediente. Este canal no envía correos ni push. Leer el aviso no responde el requerimiento; la primera apertura del intercambio queda registrada y no acredita notificación fehaciente. <a className="font-semibold text-primary-800 underline underline-offset-2" href="/manual/tutorial.html?guide=psip-flujo-inspecciones" target="_blank" rel="noopener noreferrer">Ver flujo PSIP</a></p>) : <p className="mt-3 text-xs text-neutral-600">Tu respuesta queda registrada y la autoridad recibe un aviso.</p>}
        </div>
      </Card>

      {legal && <InspectionLegalProgress id={inspectionId} state={timeline.inspeccion.estado} version={timeline.inspeccion.version} canManage={canDecide && party === 'AUTORIDAD'} online={online} onRecorded={() => exchangeQuery.refetch()} />}

      {timeline.inspeccion.estado === 'FINALIZADA' && timeline.resultadoAdministrativo && <Card data-testid="inspection-public-result" className="space-y-3"><h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900"><FileCheck2 size={21} className="shrink-0 text-primary-800" aria-hidden="true" />Resultado administrativo registrado</h3><p className="whitespace-pre-wrap break-words text-sm leading-6 text-neutral-800">{timeline.resultadoAdministrativo.detalle || 'La administración registró la finalización sin un resumen público adicional.'}</p><p className="text-xs text-neutral-600">{inspectionDeadlineDate(timeline.resultadoAdministrativo.createdAt)} · Mendoza. El registro no acredita por sí solo sanción ni firmeza.</p></Card>}

      {!online && <div role="status" className="flex items-start gap-3 rounded-xl border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-900"><WifiOff className="mt-0.5 shrink-0" size={18} /><div><p className="font-bold">Sin conexión: no se enviará ninguna actuación.</p><p className="mt-0.5 leading-5">El texto y los adjuntos seleccionados se conservan en el almacenamiento local del navegador de este dispositivo. Al reconectar, revise la versión y confirme manualmente; SITREP nunca autoenvía un descargo.</p></div></div>}
      {restoredAt && composeOpen && <div role="status" className="flex items-start gap-3 rounded-xl border border-info-200 bg-info-50 px-4 py-3 text-sm text-info-900"><FileCheck2 className="mt-0.5 shrink-0" size={18} /><div><p className="font-bold">Borrador local recuperado</p><p className="mt-0.5 leading-5">Guardado {inspectionDate(restoredAt, true)} con {files.length} {files.length === 1 ? 'adjunto' : 'adjuntos'}. Revíselo antes de presentar; todavía no integra el expediente.</p></div></div>}
      {deadlineExpired && open && <div data-testid="inspection-overdue" className="flex items-start gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-900"><AlertTriangle className="mt-0.5 shrink-0" size={18} /><div><p className="font-bold">{followUp.overdue} {followUp.overdue === 1 ? 'requerimiento vencido sin respuesta' : 'requerimientos vencidos sin respuesta'}</p><p className="mt-0.5">Se admiten presentaciones; la marca fuera de plazo depende del pedido al que respondés. La autoridad debe evaluar lo presentado; no se aplica una decisión automática.</p></div></div>}

      {timeline.intercambios.length === 0 ? (
        <Card className="py-10 text-center"><Files className="mx-auto text-neutral-300" size={36} /><p className="mt-3 font-bold text-[#10213A]">Todavía no hay presentaciones formales</p><p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-neutral-600">La autoridad inicia el circuito con un requerimiento. El inspeccionado podrá responder sobre ese antecedente.</p></Card>
      ) : (
        party === 'INSPECCIONADO' ? <details open={nextStep.pending.length === 0} className="rounded-xl border border-neutral-200 bg-white p-4"><summary className="min-h-11 cursor-pointer font-semibold text-primary-800">Historial y documentación</summary>
        <ExchangeLedger
          cycles={exchangeCycles}
          parentById={parentById}
          party={party}
          open={open && !presentMutation.isPending && nextStep.pending.length === 0}
          onDownload={(entry, evidenceId, name) => void downloadAttachment(entry, evidenceId, name)}
          onReply={beginReply}
        />
        </details> : (
        <ExchangeLedger
          cycles={exchangeCycles}
          parentById={parentById}
          party={party}
          open={open && !presentMutation.isPending}
          onDownload={(entry, evidenceId, name) => void downloadAttachment(entry, evidenceId, name)}
          onReply={beginReply}
        />
        )
      )}

      {open && !composeOpen && party === 'AUTORIDAD' && <Button disabled={presentMutation.isPending} leftIcon={<FileCheck2 size={17} />} onClick={beginNew}>Nuevo requerimiento</Button>}

      {open && composeOpen && (
        <Card id="inspection-exchange-form" className="border-primary-200">
          <form onSubmit={submitPresentation} onChange={() => { draftInteraction.current += 1; }} className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 pb-4">
              <div><p className="text-xs font-bold uppercase tracking-wide text-primary-700">Nueva presentación formal</p><h4 className="mt-1 text-lg font-extrabold text-[#10213A]">{draft.respondeAId ? 'Respuesta vinculada' : 'Requerimiento de la autoridad'}</h4></div>
              <button type="button" aria-label="Cerrar formulario" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" onClick={() => setComposeOpen(false)}><X size={18} /></button>
            </div>
            {draft.respondeAId && <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">Antecedente: presentación #{parentById.get(draft.respondeAId)?.secuencia || '—'} · {parentById.get(draft.respondeAId)?.asunto}</div>}
            {party === 'INSPECCIONADO' && draft.respondeAId && <p data-testid="inspection-reply-deadline" className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-800">Plazo del pedido respondido: <strong>{inspectionDeadlineDate(selectedDeadline)}{selectedDeadline ? ' · Mendoza' : ''}</strong>{selectedDeadline && <span className="ml-2 font-semibold">{inspectionDeadlineStatus(selectedDeadline, now)}</span>}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-neutral-800">Tipo de actuación<select value={draft.tipo} onChange={(event) => setDraft((value) => ({ ...value, tipo: event.target.value as InspectionExchangeType, plazoRespuestaAt: event.target.value === 'REQUERIMIENTO' ? value.plazoRespuestaAt : '' }))} className="mt-1.5 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal">{exchangeTypeOptions(party, Boolean(draft.respondeAId)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              {party === 'AUTORIDAD' && draft.tipo === 'REQUERIMIENTO' && <label className="text-sm font-semibold text-neutral-800">Plazo de respuesta<input aria-label="Plazo de respuesta" type="datetime-local" min={inspectionDeadlineInput(new Date((Math.floor(now / 60_000) + 1) * 60_000).toISOString())} value={draft.plazoRespuestaAt} onChange={(event) => setDraft((value) => ({ ...value, plazoRespuestaAt: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-neutral-300 px-3 font-normal" /><span className="mt-1 block text-xs font-normal text-neutral-600">Fecha y hora de Mendoza. Sin fecha, este pedido queda sin plazo registrado.</span></label>}
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

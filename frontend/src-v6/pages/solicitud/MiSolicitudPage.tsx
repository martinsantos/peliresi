/**
 * SITREP v6 - Mi Solicitud Page
 * Candidate's view of their inscription solicitud
 */

import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, CheckCircle, Clock, AlertTriangle, XCircle, Send,
  ArrowRight, Eye, MessageSquare,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { FormSkeleton } from '../../components/ui/LoadingState';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import {
  useMisSolicitudes,
  useMensajesSolicitud,
  useEnviarMensaje,
  useEnviarSolicitud,
} from '../../hooks/useSolicitudes';
import type { EstadoSolicitud, SolicitudInscripcion, MensajeSolicitud } from '../../types/api';
import ActorActivities from '../../components/ActorActivities';
import { ApplicantDocuments } from '../../components/registration/ApplicantDocuments';
import { useAdmissionContext } from '../../hooks/useAdmissionContext';
import { useRecoverableForm } from '../../hooks/useRecoverableForm';
import { DraftConflictNotice } from '../../components/DraftConflictNotice';
import { getApiErrorMessage } from '../../utils/api-error';
import { pendingRegistrationFiles } from '../../services/registrationDraft';
import { useAuth } from '../../contexts/AuthContext';

// ── Status config ──

const ESTADO_CONFIG: Record<EstadoSolicitud, {
  label: string;
  color: 'neutral' | 'info' | 'warning' | 'success' | 'error';
  icon: typeof Clock;
}> = {
  BORRADOR:    { label: 'Borrador',     color: 'neutral',  icon: FileText },
  ENVIADA:     { label: 'Enviada',      color: 'info',     icon: Send },
  EN_REVISION: { label: 'En revisión',  color: 'warning',  icon: Eye },
  OBSERVADA:   { label: 'Observada',    color: 'warning',  icon: AlertTriangle },
  APROBADA:    { label: 'Aprobada',     color: 'success',  icon: CheckCircle },
  RECHAZADA:   { label: 'Rechazada',    color: 'error',    icon: XCircle },
};

const ACTOR_LABELS: Record<string,string> = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador' };

// Dates identify the presentation, not a new official application number.
function creationDate(application: SolicitudInscripcion): string | null {
  const date = application.createdAt ? new Date(application.createdAt) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : null;
}
function applicationLabel(application: SolicitudInscripcion): string {
  return `${ACTOR_LABELS[application.tipoActor] || application.tipoActor} · ${ESTADO_CONFIG[application.estado].label} · ${creationDate(application) || 'Sin fecha registrada'}`;
}

// ── Component ──

type ConversationCommand = { id: string; text: string; version?: string; confirmed?: boolean };
type ConversationDraft = { reply: string; message: string; replyCommand: ConversationCommand | null; messageCommand: ConversationCommand | null };
const emptyConversation = (): ConversationDraft => ({ reply: '', message: '', replyCommand: null, messageCommand: null });
function validConversations(value: unknown): value is Record<string, ConversationDraft> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, item]) => {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !item || typeof item !== 'object') return false;
    const d = item as ConversationDraft;
    return ['reply', 'message'].every(k => typeof d[k as 'reply'] === 'string' && d[k as 'reply'].length <= 5000)
      && [d.replyCommand, d.messageCommand].every(c => c === null || (c && /^[0-9a-f-]{36}$/.test(c.id) && typeof c.text === 'string' && c.text.length <= 5000 && !!c.text.trim() && (c.version === undefined || (typeof c.version === 'string' && Number.isFinite(Date.parse(c.version)))) && (c.confirmed === undefined || typeof c.confirmed === 'boolean')));
  });
}
const MiSolicitudPage: React.FC = () => {
  const { owner } = useAdmissionContext();
  return <ApplicationWorkspace key={owner} owner={owner} />;
};
const ApplicationWorkspace: React.FC<{ owner: string }> = ({ owner }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isRestricted, logout } = useAuth();
  const [, refreshFileState] = useState(0);
  useEffect(() => {
    const refresh = () => refreshFileState(value => value + 1);
    window.addEventListener('storage', refresh); window.addEventListener('focus', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); };
  }, []);
  const [entering, setEntering] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const enterSystem = async () => {
    setEntryError(null);
    if (!isRestricted) { navigate('/dashboard'); return; }
    // Approval does not turn the existing limited credential into full access.
    setEntering(true);
    try { await logout(); navigate('/login', { replace: true, state: { from: '/dashboard' } }); }
    catch { setEntryError('No se pudo renovar el acceso. Volvé a intentar.'); }
    finally { setEntering(false); }
  };
  const [params, setParams] = useSearchParams();
  const draft = useRecoverableForm<Record<string, ConversationDraft>>('sitrep:applicant-conversations:v1:' + owner, {}, validConversations);
  const conversations = draft.value;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [feedbackById, setFeedbackById] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const messagesPanelRef = useRef<HTMLDivElement>(null);

  const { data: solicitudes, isLoading, isError, isFetching, refetch } = useMisSolicitudes();
  const [selectedId, setSelectedId] = useState('');
  const requestedId = params.get('solicitud');
  const solicitud = (requestedId ? solicitudes?.find(s => s.id === requestedId) : solicitudes?.find(s => s.id === selectedId) || solicitudes?.[0]) as SolicitudInscripcion | undefined;
  const missingFiles = solicitud ? pendingRegistrationFiles(solicitud.usuarioId, solicitud.tipoActor, solicitud.id) : [];
  const feedback = feedbackById[solicitud?.id || ''] || '';
  const setFeedback = (text: string) => { if (solicitud) setFeedbackById(previous => ({ ...previous, [solicitud.id]: text })); };
  const replyText = conversations[solicitud?.id || '']?.reply || '';
  const messageText = conversations[solicitud?.id || '']?.message || '';
  // Each callback retains its originating application, including after a
  // pending request finishes while the person is editing another activity.
  const updateConversation = (field: 'reply' | 'message', value: React.SetStateAction<string>) => {
    if (!solicitud) return;
    const id = solicitud.id;
    draft.update(previous => {
      const draft = previous[id] || emptyConversation();
      const next = typeof value === 'function' ? value(draft[field]) : value;
      if (next === draft[field]) return previous;
      return { ...previous, [id]: { ...draft, [field]: next } };
    });
  };
  const setReplyText = (value: React.SetStateAction<string>) => updateConversation('reply', value);
  const setMessageText = (value: React.SetStateAction<string>) => updateConversation('message', value);
  useEffect(() => { if (!selectedId && solicitud) setSelectedId(solicitud.id); }, [selectedId, solicitud?.id]);
  useEffect(() => {
    if (!requestedId || requestedId === selectedId || !solicitudes?.some(s => s.id === requestedId)) return;
    setSelectedId(requestedId);
  }, [requestedId, selectedId, solicitudes]);

  const { data: mensajes, isLoading: loadingMessages, isError: messageError, refetch: retryMessages } = useMensajesSolicitud(solicitud?.id || '');
  const enviarMensaje = useEnviarMensaje();
  const enviarSolicitud = useEnviarSolicitud();

  useEffect(() => {
    // Updating the conversation must not scroll the whole application past
    // its heading and observations, especially when arriving from an email.
    const panel = messagesPanelRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [mensajes]);

  // ── Handlers ──

  const sending = useRef(false);
  const finish = (id: string, kind: 'reply' | 'message', command: ConversationCommand) => draft.update(previous => {
    const row = previous[id] || emptyConversation();
    if (row[kind + 'Command' as 'replyCommand']?.id !== command.id) return previous;
    return { ...previous, [id]: { ...row, [kind]: row[kind].trim() === command.text ? '' : row[kind], [kind + 'Command']: null } };
  });
  const sendConversation = async (kind: 'reply' | 'message') => {
    if (!solicitud || sending.current || draft.conflict || draft.error || isError || isLoading || isFetching || messageError || loadingMessages) return;
    if (kind === 'reply' ? solicitud.estado !== 'OBSERVADA' : ['APROBADA', 'RECHAZADA'].includes(solicitud.estado)) return;
    if (kind === 'reply' && pendingRegistrationFiles(solicitud.usuarioId, solicitud.tipoActor, solicitud.id).length) { setFeedback('Hay archivos pendientes de recuperar. Abrí Corregir datos y documentos antes de reenviar.'); return; }
    const row = conversations[solicitud.id] || emptyConversation();
    const command = row[kind + 'Command' as 'replyCommand'] || { id: crypto.randomUUID(), text: row[kind].trim(), version: solicitud.updatedAt };
    if (!command.text || (kind === 'reply' && command.version && command.version !== solicitud.updatedAt)) return;
    const stored = draft.update(previous => ({ ...previous, [solicitud.id]: { ...(previous[solicitud.id] || emptyConversation()), [kind + 'Command']: command } }));
    if (!stored.saved || stored.conflict) return;
    sending.current = true; setBusy(true); setFeedback('');
    try {
      const known = mensajes?.find(m => m.id === 'ui-' + command.id);
      if (!known && !command.confirmed) await enviarMensaje.mutateAsync({ solicitudId: solicitud.id, contenido: command.text, clientMessageId: command.id });
      if (!alive.current) return;
      if (kind === 'reply') {
        const checkpoint = draft.update(previous => ({ ...previous, [solicitud.id]: { ...(previous[solicitud.id] || emptyConversation()), replyCommand: { ...command, confirmed: true } } }));
        if (!checkpoint.saved || checkpoint.conflict) { setFeedback('La respuesta quedó registrada. No pudimos guardar la continuidad local; reintentá el guardado antes de reenviar.'); return; }
        if (pendingRegistrationFiles(solicitud.usuarioId, solicitud.tipoActor, solicitud.id).length) { setFeedback('La respuesta quedó registrada. Hay archivos pendientes de recuperar; corregilos antes de reenviar.'); return; }
        await enviarSolicitud.mutateAsync({ id: solicitud.id, expectedUpdatedAt: command.version });
      }
      if (!alive.current) return;
      const cleared = finish(solicitud.id, kind, command);
      setFeedback((kind === 'reply' ? 'Respuesta registrada y solicitud reenviada a revisión.' : 'Mensaje registrado en la conversación.') + (!cleared.saved ? ' Conservamos una copia local; resolvé el guardado antes de continuar.' : ''));
    } catch (error) {
      if (alive.current) setFeedback(getApiErrorMessage(error, 'No pudimos confirmar toda la acción. Conservamos el texto y su referencia; reintentá sin duplicar el mensaje.'));
    } finally { sending.current = false; if (alive.current) { setBusy(false); void refetch?.(); } }
  };
  const handleSendMessage = () => sendConversation('message');
  const handleReplyAndResend = () => sendConversation('reply');
  const activeDraft = conversations[solicitud?.id || ''];
  // A successful read reconciles a response whose confirmation was lost.
  // A newly OBSERVADA cycle is deliberately not re-sent by this effect.
  useEffect(() => {
    if (!solicitud || isError || messageError || loadingMessages || busy || draft.error || draft.conflict) return;
    for (const kind of ['message', 'reply'] as const) {
      const command = activeDraft?.[kind + 'Command' as 'replyCommand'];
      if (!command || !mensajes?.some(m => m.id === 'ui-' + command.id && m.contenido === command.text)) continue;
      if (kind === 'reply' && ['BORRADOR', 'OBSERVADA'].includes(solicitud.estado)) continue;
      finish(solicitud.id, kind, command);
      setFeedback(kind === 'reply' ? 'Tu respuesta está registrada. Estado actual: ' + ESTADO_CONFIG[solicitud.estado].label + '. No se volvió a enviar.' : 'Tu mensaje ya está registrado. No se volvió a enviar.');
    }
  }, [solicitud?.id, solicitud?.estado, mensajes, busy, isError, messageError, loadingMessages]);

  // ── Loading / Empty ──

  if (isLoading && !solicitudes) {
    return <FormSkeleton label="Cargando tu solicitud…" />;
  }

  if (isError && !solicitudes) {
    return (
      <Card><div role="alert" className="space-y-3">
        <p>No se pudo cargar tu solicitud.</p>
        <Button variant="outline" onClick={() => void refetch()}>Reintentar</Button>
      </div></Card>
    );
  }

  if (!solicitud && requestedId) {
    if (isFetching) return <FormSkeleton label="Buscando la solicitud elegida…" />;
    return <Card><div role="alert" className="space-y-3"><p>No pudimos abrir la solicitud elegida con esta cuenta.</p><p className="text-sm text-neutral-600">Revisá el enlace o elegí otro de tus trámites.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void refetch()}>Reintentar</Button><Button onClick={() => { setSelectedId(''); setParams({}, { replace: true }); }}>Elegir otra solicitud</Button></div></div></Card>;
  }

  if (!solicitud) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card className="text-center !py-16">
          <FileText size={48} className="text-neutral-300 mx-auto mb-4" />
          <p className="text-neutral-600 mb-2">Todavía no tenés solicitudes</p>
          <p className="text-sm text-neutral-400 mb-6">Elegí la actividad que querés inscribir. Podés sumar otras con la misma cuenta.</p>
          <div className="flex flex-wrap justify-center gap-2">{Object.entries(ACTOR_LABELS).map(([role,label])=><Button key={role} variant="outline" onClick={() => navigate('/inscripcion/'+role.toLowerCase())}>{label}</Button>)}</div>
        </Card>
      </div>
    );
  }

  const cfg = ESTADO_CONFIG[solicitud.estado];
  const createdDate = creationDate(solicitud);
  const activeApplication = solicitudes?.filter(item => item.id !== solicitud.id && item.tipoActor === solicitud.tipoActor && item.estado !== 'RECHAZADA')
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))[0];
  const selectApplication = (id: string) => {
    setSelectedId(id);
    setParams({ solicitud: id }, { replace: true });
  };
  const sentAt = solicitud.fechaEnvio ? new Date(solicitud.fechaEnvio) : null;
  const sentDate = sentAt && Number.isFinite(sentAt.getTime())
    ? sentAt.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' }) : null;

  return (
    <div className="mx-auto w-full max-w-[960px] space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3" aria-label="Solicitud seleccionada" aria-live="polite" aria-atomic="true">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-neutral-900">Inscripción de {ACTOR_LABELS[solicitud.tipoActor] || solicitud.tipoActor}</h2>
          {createdDate && <p className="mt-1 text-sm text-neutral-600">Creada {createdDate}</p>}
          {sentDate && <p className="mt-1 text-sm text-neutral-600">Enviada {sentDate}</p>}
        </div>
        <Badge variant="soft" color={cfg.color} size="lg"><cfg.icon size={16} aria-hidden="true" />{cfg.label}</Badge>
      </div>
      {isError && <div role="alert" className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-neutral-800">No pudimos actualizar el estado. Conservamos lo escrito; revisá la conexión.<Button variant="outline" onClick={()=>void refetch()}>Actualizar solicitud</Button></div>}

      {(solicitudes?.length || 0) > 1 && <div>
          <label htmlFor="application-activity" className="block text-sm font-medium">Solicitud por actividad</label>
          <select id="application-activity" className="mt-1 w-full min-w-0 max-w-full min-h-11 rounded-lg border border-neutral-300 bg-white px-3 text-base"
            value={solicitud.id} onChange={event => selectApplication(event.target.value)}>
            {solicitudes?.map(item => {
              const label = applicationLabel(item);
              const duplicate = solicitudes.some(other => other.id !== item.id && applicationLabel(other) === label);
              return <option key={item.id} value={item.id}>{label}{duplicate ? ` · Ref. ${item.id}` : ''}</option>;
            })}
          </select>
        </div>}
      {solicitud.estado === 'BORRADOR' && <Card><p className="mb-3 text-neutral-700">Completá los datos y documentos para enviar tu inscripción a revisión.</p><Button onClick={() => navigate('/inscripcion/' + solicitud.tipoActor.toLowerCase() + '?solicitud=' + encodeURIComponent(solicitud.id))}>Continuar borrador</Button></Card>}
      {(solicitud.estado === 'ENVIADA' || solicitud.estado === 'EN_REVISION') && <Card><p className="font-semibold text-neutral-900">Administración revisa tu solicitud</p><p className="mt-2 text-neutral-700">{solicitud.estado === 'ENVIADA' ? 'Recibimos tu presentación. Te avisaremos cuando haya una decisión o algo que corregir.' : 'Tu presentación está en revisión. Te avisaremos si necesitás completar algo.'}</p><p className="mt-2 text-sm text-neutral-600">No hace falta volver a enviarla. Podés consultar a administración en Mensajes.</p></Card>}

      {feedback && <p role="status" className="rounded-xl border border-primary-200 bg-primary-50 p-4 text-primary-950">{feedback}</p>}
      {draft.conflict && <DraftConflictNotice durable={draft.conflictSaved} count={draft.conflictCount} onReload={draft.reload} onKeep={draft.overwrite} />}
      {draft.error && <div role="alert" className="space-y-2 rounded-xl bg-warning-50 p-4"><p>No pudimos guardar tus textos en este dispositivo. Mantené esta pantalla abierta y reintentá antes de enviar.</p><Button variant="outline" onClick={() => draft.update(draft.value)}>Reintentar guardado</Button></div>}
      {(replyText || messageText) && <p role="status" className="text-sm text-neutral-600">{draft.saved ? 'Textos guardados en este dispositivo, separados por solicitud y cuenta.' : 'Los textos se envían sólo al confirmar.'}</p>}
      {activeDraft?.replyCommand && <div className="rounded-xl border border-warning-200 bg-warning-50 p-4 space-y-2"><p className="font-medium">Respuesta pendiente de confirmar</p><p className="whitespace-pre-wrap break-words">{activeDraft.replyCommand.text}</p><p className="text-sm">Reintentar conserva la misma referencia. Si editaste el texto después, esa nueva versión queda guardada sin reemplazar el envío pendiente.</p></div>}
      {solicitud.estado === 'OBSERVADA' && activeDraft?.replyCommand?.version && activeDraft.replyCommand.version !== solicitud.updatedAt && <div role="alert" className="space-y-2 rounded-xl bg-warning-50 p-4"><p>Los datos u observaciones cambiaron desde tu respuesta pendiente. Revisalos antes de continuar.</p><Button variant="outline" disabled={busy || draft.error || draft.conflict || isError} onClick={() => draft.update(previous => ({ ...previous, [solicitud.id]: { ...previous[solicitud.id], replyCommand: null } }))}>Preparar respuesta con los datos actuales</Button></div>}
      {replyText && solicitud.estado !== 'OBSERVADA' && <div className="rounded-xl border p-4"><p className="font-medium">Respuesta local conservada</p><p className="whitespace-pre-wrap break-words">{replyText}</p><p>El estado actual no admite reenviar esta respuesta.</p></div>}

      {solicitud.estado === 'OBSERVADA' && <ApplicantDocuments key={solicitud.id} applicationId={solicitud.id} documents={solicitud.documentos}
        fresh={!isError && !isFetching} targetDocumentId={params.get('documento')} targetVisitKey={location.key} activityLabel={ACTOR_LABELS[solicitud.tipoActor] || solicitud.tipoActor} onRetry={() => void refetch()} />}

      {/* OBSERVADA Banner */}
      {solicitud.estado === 'OBSERVADA' && (
        <Card className="!border-amber-300 !bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="font-semibold text-amber-800">Tu solicitud tiene observaciones</p>
                <p className="text-sm text-amber-700 mt-1">
                  {solicitud.observaciones || 'El administrador ha dejado observaciones. Revisa los mensajes y responde para continuar.'}
                </p>
              </div>
              <Button variant="primary" size="sm" leftIcon={<FileText size={16} />} onClick={() => navigate('/inscripcion/' + solicitud.tipoActor.toLowerCase() + '?solicitud=' + encodeURIComponent(solicitud.id))}>
                Corregir datos y documentos
              </Button>
              <div>
                {missingFiles.length > 0 && <p role="alert" className="mb-3 text-sm font-medium text-amber-900">Hay archivos pendientes de recuperar. Abrí Corregir datos y documentos para volver a seleccionarlos o conservar los originales antes de reenviar.</p>}
                <label htmlFor="application-observation-reply" className="block text-sm font-medium text-amber-800 mb-1">Tu respuesta</label>
                <textarea
                  id="application-observation-reply"
                  maxLength={5000}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-amber-300 bg-white focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-700 text-sm"
                  rows={3}
                  placeholder="Escribe tu respuesta a las observaciones..."
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleReplyAndResend}
                disabled={missingFiles.length > 0 || Boolean(activeDraft?.replyCommand?.version && activeDraft.replyCommand.version !== solicitud.updatedAt) || (!replyText.trim() && !activeDraft?.replyCommand) || busy || draft.error || draft.conflict || isError || isFetching || messageError || loadingMessages}
                isLoading={busy}
              >
                {activeDraft?.replyCommand ? 'Reintentar respuesta y reenvío' : 'Responder y Re-enviar'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* APROBADA Card */}
      {solicitud.estado === 'APROBADA' && (
        <Card className="!border-green-300 !bg-green-50">
          <h3 className="text-xl font-bold text-green-800 mb-2">Tu inscripción fue aprobada</h3>
          <p className="text-sm text-green-700 mb-6">
            Tu inscripción como {ACTOR_LABELS[solicitud.tipoActor] || solicitud.tipoActor} fue aprobada. {isRestricted ? 'Ingresá nuevamente con tu cuenta habilitada y verificada para empezar.' : 'Ya podés continuar en SITREP.'}
          </p>
          <Button variant="primary" isLoading={entering} rightIcon={<ArrowRight size={16} />} onClick={() => void enterSystem()}>
            {isRestricted ? 'Ingresar con mi cuenta' : 'Ir a Inicio'}
          </Button>
          {entryError && <p role="alert" className="mt-3 text-sm text-error-700">{entryError}</p>}
        </Card>
      )}

      {/* RECHAZADA Card */}
      {solicitud.estado === 'RECHAZADA' && (
        <Card className="!border-red-300 !bg-red-50">
          <div className="flex items-start gap-3">
            <XCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold text-red-800">Tu solicitud fue rechazada</p>
              {solicitud.motivoRechazo && (
                <p className="whitespace-pre-wrap break-words text-sm text-red-700">Motivo: {solicitud.motivoRechazo}</p>
              )}
              <p className="text-sm text-red-700">Trámite cerrado. Conservás el resultado y los mensajes.{activeApplication ? '' : import.meta.env.VITE_ACTOR_MULTIROLE_ENABLED === 'true' ? ' Nueva solicitud inicia otro expediente; no modifica éste.' : ' Para otra presentación, consultá a administración.'}</p>
              {activeApplication && <div className="space-y-2">
                <p className="text-sm text-neutral-800">Tenés otra solicitud de {ACTOR_LABELS[activeApplication.tipoActor]}: {ESTADO_CONFIG[activeApplication.estado].label.toLowerCase()}.</p>
                <Button variant="outline" onClick={() => selectApplication(activeApplication.id)}>Ver solicitud vigente</Button>
              </div>}
            </div>
          </div>
        </Card>
      )}

      {solicitud.estado === 'RECHAZADA' && import.meta.env.VITE_ACTOR_MULTIROLE_ENABLED === 'true' && <ActorActivities mode="request" />}

      {solicitud.estado !== 'OBSERVADA' && <ApplicantDocuments key={solicitud.id} applicationId={solicitud.id} documents={solicitud.documentos}
        fresh={!isError && !isFetching} targetDocumentId={params.get('documento')} targetVisitKey={location.key} activityLabel={ACTOR_LABELS[solicitud.tipoActor] || solicitud.tipoActor} onRetry={() => void refetch()} />}

      {/* Messages Thread */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center gap-2">
          <MessageSquare size={16} className="text-neutral-500" />
          <h3 className="font-semibold text-neutral-800">Mensajes</h3>
          {mensajes && mensajes.length > 0 && (
            <Badge variant="soft" color="info" size="sm">{mensajes.length}</Badge>
          )}
        </div>

        <div ref={messagesPanelRef} role="region" aria-label="Mensajes de la solicitud" className="max-h-80 overflow-y-auto p-4 space-y-3">
          {messageError ? <div role="alert" className="space-y-2 text-sm text-neutral-800"><p>No pudimos consultar los mensajes.</p><Button variant="outline" onClick={()=>void retryMessages()}>Reintentar mensajes</Button></div> : loadingMessages && !mensajes ? <p role="status">Consultando mensajes…</p> : (!mensajes || mensajes.length === 0) ? (
            <p className="text-center text-sm text-neutral-600 py-6">Todavía no hay mensajes</p>
          ) : (
            mensajes.map((msg: MensajeSolicitud) => {
              const isAdmin = msg.autorRol === 'ADMIN' || msg.autorRol.startsWith('ADMIN_');
              return (
                <div key={msg.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[90%] break-words rounded-xl sm:max-w-[75%] px-4 py-2.5 ${
                    isAdmin
                      ? 'bg-primary-50 border border-primary-100 rounded-bl-sm'
                      : 'bg-neutral-100 border border-neutral-200 rounded-br-sm'
                  }`}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                      <span className={`text-xs font-semibold ${
                        isAdmin ? 'text-primary-600' : 'text-neutral-500'
                      }`}>
                        {isAdmin ? 'Administración' : 'Vos'}
                      </span>
                      <span className="text-xs text-neutral-600">
                        {new Date(msg.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-800">{msg.contenido}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {activeDraft?.messageCommand && <div className="px-4 py-3 text-sm bg-warning-50"><p className="font-medium">Mensaje pendiente de confirmar</p><p className="whitespace-pre-wrap break-words">{activeDraft.messageCommand.text}</p><p>Reintentar conserva la misma referencia y no reemplaza lo que escribiste después.</p></div>}
        {messageText && ['APROBADA', 'RECHAZADA'].includes(solicitud.estado) && <div className="p-4"><p className="font-medium">Mensaje local conservado</p><p className="whitespace-pre-wrap break-words">{messageText}</p></div>}
        {/* Compose */}
        {solicitud.estado === 'RECHAZADA' && <p className="border-t border-neutral-200 px-4 py-3 text-sm text-neutral-600">Este trámite está cerrado: podés consultar los mensajes, pero no enviar respuestas.</p>}
        {solicitud.estado !== 'APROBADA' && solicitud.estado !== 'RECHAZADA' && (
        <div className="px-4 py-3 border-t border-neutral-200 flex gap-2">
            <input
              type="text"
              maxLength={5000}
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              aria-label="Mensaje a administración"
              className="min-w-0 flex-1 min-h-11 px-3 rounded-lg border border-neutral-200 text-sm focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-700"
              placeholder="Escribe un mensaje..."
            />
            <Button
              variant="primary"
              size="base"
              aria-label={activeDraft?.messageCommand ? 'Reintentar envío de mensaje' : 'Enviar mensaje'}
              onClick={handleSendMessage}
              disabled={(!messageText.trim() && !activeDraft?.messageCommand) || busy || draft.error || draft.conflict || isError || isFetching || messageError || loadingMessages}
              isLoading={busy}
            >
              <Send size={14} />
            </Button>
        </div>
        )}
      </Card>
      {solicitud.estado !== 'RECHAZADA' && import.meta.env.VITE_ACTOR_MULTIROLE_ENABLED === 'true' && <ActorActivities mode="request" />}
    </div>
  );
};

export default MiSolicitudPage;

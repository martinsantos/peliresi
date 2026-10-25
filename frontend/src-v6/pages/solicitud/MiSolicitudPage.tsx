/**
 * SITREP v6 - Mi Solicitud Page
 * Candidate's view of their inscription solicitud
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, CheckCircle, Clock, AlertTriangle, XCircle, Send,
  ArrowRight, Eye, MessageSquare,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { FormSkeleton } from '../../components/ui/LoadingState';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { toast } from '../../components/ui/Toast';
import {
  useMisSolicitudes,
  useMensajesSolicitud,
  useEnviarMensaje,
  useEnviarSolicitud,
} from '../../hooks/useSolicitudes';
import type { EstadoSolicitud, SolicitudInscripcion, MensajeSolicitud } from '../../types/api';
import ActorActivities from '../../components/ActorActivities';
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

// ── Component ──

const MiSolicitudPage: React.FC = () => {
  const navigate = useNavigate();
  const { isRestricted, logout } = useAuth();
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
  const [conversations, setConversations] = useState<Record<string, { reply: string; message: string }>>({});
  const messagesPanelRef = useRef<HTMLDivElement>(null);

  const { data: solicitudes, isLoading, isError, refetch } = useMisSolicitudes();
  const [selectedId, setSelectedId] = useState('');
  const solicitud = (solicitudes?.find(s => s.id === selectedId) || solicitudes?.[0]) as SolicitudInscripcion | undefined;
  const replyText = conversations[solicitud?.id || '']?.reply || '';
  const messageText = conversations[solicitud?.id || '']?.message || '';
  // Each callback retains its originating application, including after a
  // pending request finishes while the person is editing another activity.
  const updateConversation = (field: 'reply' | 'message', value: React.SetStateAction<string>) => {
    if (!solicitud) return;
    const id = solicitud.id;
    setConversations(previous => {
      const draft = previous[id] || { reply: '', message: '' };
      const next = typeof value === 'function' ? value(draft[field]) : value;
      if (next === draft[field]) return previous;
      return { ...previous, [id]: { ...draft, [field]: next } };
    });
  };
  const setReplyText = (value: React.SetStateAction<string>) => updateConversation('reply', value);
  const setMessageText = (value: React.SetStateAction<string>) => updateConversation('message', value);
  useEffect(() => { if (!selectedId && solicitud) setSelectedId(solicitud.id); }, [selectedId, solicitud?.id]);
  const requestedId = params.get('solicitud');
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

  const sendingMessage = useRef(false);
  const handleSendMessage = async () => {
    if (!solicitud || !messageText.trim() || sendingMessage.current) return;
    sendingMessage.current = true;
    const submitted = messageText;
    try {
      await enviarMensaje.mutateAsync({ solicitudId: solicitud.id, contenido: submitted.trim() });
      setMessageText(current => current === submitted ? '' : current);
    } catch {
      toast.error('Error', 'No se pudo enviar el mensaje');
    } finally {
      sendingMessage.current = false;
    }
  };

  // A retry after a failed resend must not post the same reply twice.
  const postedReply = useRef<{ solicitudId: string; contenido: string } | null>(null);
  const handleReplyAndResend = async () => {
    if (!solicitud || !replyText.trim()) return;
    const submitted = replyText;
    const contenido = submitted.trim();
    try {
      const alreadyPosted = postedReply.current?.solicitudId === solicitud.id && postedReply.current.contenido === contenido;
      if (!alreadyPosted) {
        await enviarMensaje.mutateAsync({ solicitudId: solicitud.id, contenido });
        postedReply.current = { solicitudId: solicitud.id, contenido };
      }
      await enviarSolicitud.mutateAsync(solicitud.id);
      postedReply.current = null;
      setReplyText(current => current === submitted ? '' : current);
      toast.success('Enviada', 'Tu solicitud fue re-enviada con la respuesta');
    } catch {
      const replySaved = postedReply.current?.solicitudId === solicitud.id && postedReply.current.contenido === contenido;
      toast.error('Error', replySaved ? 'La respuesta quedó guardada, pero no se re-envió la solicitud. Reintentá.' : 'No se pudo re-enviar la solicitud');
    }
  };

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
  const sentAt = solicitud.fechaEnvio ? new Date(solicitud.fechaEnvio) : null;
  const sentDate = sentAt && Number.isFinite(sentAt.getTime())
    ? sentAt.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' }) : null;

  return (
    <div className="mx-auto w-full max-w-[960px] space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3" aria-label="Solicitud seleccionada">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-neutral-900">Inscripción de {ACTOR_LABELS[solicitud.tipoActor] || solicitud.tipoActor}</h2>
          {sentDate && <p className="mt-1 text-sm text-neutral-600">Enviada {sentDate}</p>}
        </div>
        <Badge variant="soft" color={cfg.color} size="lg"><cfg.icon size={16} aria-hidden="true" />{cfg.label}</Badge>
      </div>
      {isError && <div role="alert" className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-neutral-800">No pudimos actualizar el estado. Conservamos lo escrito; revisá la conexión.<Button variant="outline" onClick={()=>void refetch()}>Actualizar solicitud</Button></div>}

      {import.meta.env.VITE_ACTOR_MULTIROLE_ENABLED === 'true' && <>
        {(solicitudes?.length || 0) > 1 && <div>
          <label htmlFor="application-activity" className="block text-sm font-medium">Solicitud por actividad</label>
          <select id="application-activity" className="mt-1 w-full min-h-11 rounded-lg border border-neutral-300 bg-white px-3 text-base"
            value={solicitud.id} onChange={event => {
              setSelectedId(event.target.value);
              setParams({ solicitud: event.target.value }, { replace: true });
            }}>
            {solicitudes?.map(item => <option key={item.id} value={item.id}>{ACTOR_LABELS[item.tipoActor] || item.tipoActor} · {ESTADO_CONFIG[item.estado].label}</option>)}
          </select>
        </div>}
      </>}
      {solicitud.estado === 'BORRADOR' && <Card><p className="mb-3 text-neutral-700">Completá los datos y documentos para enviar tu inscripción a revisión.</p><Button onClick={() => navigate('/inscripcion/' + solicitud.tipoActor.toLowerCase())}>Continuar borrador</Button></Card>}
      {(solicitud.estado === 'ENVIADA' || solicitud.estado === 'EN_REVISION') && <Card><p className="font-semibold text-neutral-900">Administración revisa tu solicitud</p><p className="mt-2 text-neutral-700">{solicitud.estado === 'ENVIADA' ? 'Recibimos tu presentación. Te avisaremos cuando haya una decisión o algo que corregir.' : 'Tu presentación está en revisión. Te avisaremos si necesitás completar algo.'}</p><p className="mt-2 text-sm text-neutral-600">No hace falta volver a enviarla. Podés consultar a administración en Mensajes.</p></Card>}

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
              <Button variant="primary" size="sm" leftIcon={<FileText size={16} />} onClick={() => navigate('/inscripcion/' + solicitud.tipoActor.toLowerCase())}>
                Corregir datos y documentos
              </Button>
              <div>
                <label htmlFor="application-observation-reply" className="block text-sm font-medium text-amber-800 mb-1">Tu respuesta</label>
                <textarea
                  id="application-observation-reply"
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
                disabled={!replyText.trim() || enviarMensaje.isPending || enviarSolicitud.isPending}
                isLoading={enviarMensaje.isPending || enviarSolicitud.isPending}
              >
                Responder y Re-enviar
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
            <div className="space-y-2">
              <p className="font-semibold text-red-800">Tu solicitud fue rechazada</p>
              {solicitud.motivoRechazo && (
                <p className="text-sm text-red-700">Motivo: {solicitud.motivoRechazo}</p>
              )}
              <p className="text-sm text-red-700">Este trámite finalizó. Conservás el resultado y sus mensajes. Para evaluar otra presentación, consultá a administración por los canales habituales.</p>
            </div>
          </div>
        </Card>
      )}

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

        {/* Compose */}
        {solicitud.estado === 'RECHAZADA' && <p className="border-t border-neutral-200 px-4 py-3 text-sm text-neutral-600">Este trámite está cerrado: podés consultar los mensajes, pero no enviar respuestas.</p>}
        {solicitud.estado !== 'APROBADA' && solicitud.estado !== 'RECHAZADA' && (
        <div className="px-4 py-3 border-t border-neutral-200 flex gap-2">
            <input
              type="text"
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
              aria-label="Enviar mensaje"
              onClick={handleSendMessage}
              disabled={!messageText.trim() || enviarMensaje.isPending}
              isLoading={enviarMensaje.isPending}
            >
              <Send size={14} />
            </Button>
        </div>
        )}
      </Card>
      {import.meta.env.VITE_ACTOR_MULTIROLE_ENABLED === 'true' && <ActorActivities mode="request" />}
    </div>
  );
};

export default MiSolicitudPage;

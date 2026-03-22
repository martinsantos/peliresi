/**
 * SITREP v6 - Mi Solicitud Page
 * Candidate's view of their inscription solicitud
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, CheckCircle, Clock, AlertTriangle, XCircle, Send,
  Loader2, ArrowRight, Eye, MessageSquare,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
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

// ── Status config ──

const ESTADO_CONFIG: Record<EstadoSolicitud, {
  label: string;
  color: 'neutral' | 'info' | 'warning' | 'success' | 'error';
  icon: typeof Clock;
  stepIndex: number;
}> = {
  BORRADOR:    { label: 'Borrador',     color: 'neutral',  icon: FileText,      stepIndex: 0 },
  ENVIADA:     { label: 'Enviada',      color: 'info',     icon: Send,          stepIndex: 1 },
  EN_REVISION: { label: 'En Revision',  color: 'warning',  icon: Eye,           stepIndex: 2 },
  OBSERVADA:   { label: 'Observada',    color: 'warning',  icon: AlertTriangle, stepIndex: 2 },
  APROBADA:    { label: 'Aprobada',     color: 'success',  icon: CheckCircle,   stepIndex: 3 },
  RECHAZADA:   { label: 'Rechazada',    color: 'error',    icon: XCircle,       stepIndex: 3 },
};

const STEPS = [
  { key: 'BORRADOR',    label: 'Borrador' },
  { key: 'ENVIADA',     label: 'Enviada' },
  { key: 'EN_REVISION', label: 'En Revision' },
  { key: 'RESULTADO',   label: 'Resultado' },
];

// ── Component ──

const MiSolicitudPage: React.FC = () => {
  const navigate = useNavigate();
  const [replyText, setReplyText] = useState('');
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: solicitudes, isLoading } = useMisSolicitudes();
  const solicitud = solicitudes?.[0] as SolicitudInscripcion | undefined;

  const { data: mensajes } = useMensajesSolicitud(solicitud?.id || '');
  const enviarMensaje = useEnviarMensaje();
  const enviarSolicitud = useEnviarSolicitud();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // ── Handlers ──

  const handleSendMessage = async () => {
    if (!solicitud || !messageText.trim()) return;
    try {
      await enviarMensaje.mutateAsync({ solicitudId: solicitud.id, contenido: messageText.trim() });
      setMessageText('');
    } catch {
      toast.error('Error', 'No se pudo enviar el mensaje');
    }
  };

  const handleReplyAndResend = async () => {
    if (!solicitud || !replyText.trim()) return;
    try {
      await enviarMensaje.mutateAsync({ solicitudId: solicitud.id, contenido: replyText.trim() });
      await enviarSolicitud.mutateAsync(solicitud.id);
      setReplyText('');
      toast.success('Enviada', 'Tu solicitud fue re-enviada con la respuesta');
    } catch {
      toast.error('Error', 'No se pudo re-enviar la solicitud');
    }
  };

  // ── Loading / Empty ──

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (!solicitud) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-xl">
            <FileText size={22} className="text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900">Mi Solicitud de Inscripcion</h2>
        </div>
        <Card className="text-center !py-16">
          <FileText size={48} className="text-neutral-300 mx-auto mb-4" />
          <p className="text-neutral-600 mb-2">No tienes solicitudes de inscripcion</p>
          <p className="text-sm text-neutral-400 mb-6">Inicia tu tramite para registrarte como Generador u Operador</p>
          <Button variant="primary" onClick={() => navigate('/inscripcion/generador')}>
            Iniciar Solicitud
          </Button>
        </Card>
      </div>
    );
  }

  const cfg = ESTADO_CONFIG[solicitud.estado];
  const currentStep = cfg.stepIndex;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary-100 rounded-xl">
          <FileText size={22} className="text-primary-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Mi Solicitud de Inscripcion</h2>
          <p className="text-sm text-neutral-500">
            Tipo: {solicitud.tipoActor} &middot; Enviada {solicitud.fechaEnvio
              ? new Date(solicitud.fechaEnvio).toLocaleDateString('es-AR')
              : 'pendiente'}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <Card>
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => {
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            const isFailed = i === 3 && solicitud.estado === 'RECHAZADA';

            return (
              <React.Fragment key={step.key}>
                {i > 0 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded ${isDone ? 'bg-primary-500' : 'bg-neutral-200'}`} />
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isFailed
                      ? 'bg-error-100 text-error-600 ring-2 ring-error-300'
                      : isActive
                        ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-300'
                        : isDone
                          ? 'bg-primary-500 text-white'
                          : 'bg-neutral-100 text-neutral-400'
                  }`}>
                    {isDone ? <CheckCircle size={16} /> : isFailed ? <XCircle size={16} /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${
                    isActive ? 'text-primary-700' : isFailed ? 'text-error-600' : isDone ? 'text-primary-600' : 'text-neutral-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      {/* Status Badge */}
      <div className="flex items-center gap-3">
        <Badge
          variant="default"
          color={cfg.color}
          size="lg"
          dot={solicitud.estado === 'OBSERVADA'}
          pulse={solicitud.estado === 'OBSERVADA'}
        >
          <cfg.icon size={14} />
          {cfg.label}
        </Badge>
        {solicitud.fechaRevision && (
          <span className="text-xs text-neutral-500">
            Revisada el {new Date(solicitud.fechaRevision).toLocaleDateString('es-AR')}
          </span>
        )}
      </div>

      {/* OBSERVADA Banner */}
      {solicitud.estado === 'OBSERVADA' && (
        <Card className="!border-amber-300 !bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="font-semibold text-amber-800">Tu solicitud tiene observaciones</p>
                <p className="text-sm text-amber-700 mt-1">
                  {solicitud.observaciones || 'El administrador ha dejado observaciones. Revisa los mensajes y responde para continuar.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-amber-800 mb-1">Tu respuesta</label>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-amber-300 bg-white focus:border-primary-500 focus:outline-none text-sm"
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
        <Card className="!border-green-300 !bg-green-50 text-center !py-8">
          <div className="text-4xl mb-3">&#127881;</div>
          <h3 className="text-xl font-bold text-green-800 mb-2">Tu inscripcion fue aprobada</h3>
          <p className="text-sm text-green-700 mb-6">
            Ya puedes acceder al sistema como {solicitud.tipoActor}.
          </p>
          <Button variant="primary" onClick={() => navigate('/dashboard')}>
            Ir al Dashboard <ArrowRight size={16} className="ml-1" />
          </Button>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/inscripcion/${solicitud.tipoActor.toLowerCase()}`)}
              >
                Crear nueva solicitud
              </Button>
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

        <div className="max-h-80 overflow-y-auto p-4 space-y-3">
          {(!mensajes || mensajes.length === 0) ? (
            <p className="text-center text-sm text-neutral-400 py-6">No hay mensajes aun</p>
          ) : (
            mensajes.map((msg: MensajeSolicitud) => {
              const isAdmin = msg.autorRol === 'ADMIN';
              return (
                <div key={msg.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                    isAdmin
                      ? 'bg-primary-50 border border-primary-100 rounded-bl-sm'
                      : 'bg-neutral-100 border border-neutral-200 rounded-br-sm'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold uppercase ${
                        isAdmin ? 'text-primary-600' : 'text-neutral-500'
                      }`}>
                        {isAdmin ? 'Administrador' : 'Tu'}
                      </span>
                      <span className="text-[10px] text-neutral-400">
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
          <div ref={messagesEndRef} />
        </div>

        {/* Compose */}
        {solicitud.estado !== 'APROBADA' && solicitud.estado !== 'RECHAZADA' && (
          <div className="px-4 py-3 border-t border-neutral-200 flex gap-2">
            <input
              type="text"
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              className="flex-1 h-9 px-3 rounded-lg border border-neutral-200 text-sm focus:border-primary-500 focus:outline-none"
              placeholder="Escribe un mensaje..."
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendMessage}
              disabled={!messageText.trim() || enviarMensaje.isPending}
              isLoading={enviarMensaje.isPending}
            >
              <Send size={14} />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MiSolicitudPage;

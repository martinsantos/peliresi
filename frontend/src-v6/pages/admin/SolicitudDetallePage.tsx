/**
 * SITREP v6 - Solicitud Detalle Page (Admin)
 * Review a specific inscription solicitud
 */

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, CheckCircle, XCircle, AlertTriangle, Eye,
  Send, Download, Loader2, MessageSquare, User, File, Clock,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import {
  useSolicitud,
  useMensajesSolicitud,
  useEnviarMensaje,
  useRevisarSolicitud,
  useObservarSolicitud,
  useAprobarSolicitud,
  useRechazarSolicitud,
  useRevisarDocumento,
} from '../../hooks/useSolicitudes';
import type { EstadoSolicitud, DocumentoSolicitud, MensajeSolicitud } from '../../types/api';

// ── Status config ──

const ESTADO_CONFIG: Record<EstadoSolicitud, {
  label: string;
  color: 'neutral' | 'info' | 'warning' | 'success' | 'error';
}> = {
  BORRADOR:    { label: 'Borrador',     color: 'neutral' },
  ENVIADA:     { label: 'Enviada',      color: 'info' },
  EN_REVISION: { label: 'En Revision',  color: 'warning' },
  OBSERVADA:   { label: 'Observada',    color: 'warning' },
  APROBADA:    { label: 'Aprobada',     color: 'success' },
  RECHAZADA:   { label: 'Rechazada',    color: 'error' },
};

const DOC_ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  PENDIENTE:  { label: 'Pendiente',  color: 'warning' },
  APROBADO:   { label: 'Aprobado',   color: 'success' },
  RECHAZADO:  { label: 'Rechazado',  color: 'error' },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseDatosActor(json: string): Record<string, string> {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === 'object' && parsed !== null) {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        result[key] = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      }
      return result;
    }
  } catch { /* ignore */ }
  return {};
}

function fieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

// ── Component ──

const SolicitudDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messageText, setMessageText] = useState('');
  const [observarModal, setObservarModal] = useState(false);
  const [observarText, setObservarText] = useState('');
  const [rechazarModal, setRechazarModal] = useState(false);
  const [rechazarText, setRechazarText] = useState('');
  const [confirmarAprobar, setConfirmarAprobar] = useState(false);

  const { data: solicitud, isLoading } = useSolicitud(id || '');
  const { data: mensajes } = useMensajesSolicitud(id || '');

  const enviarMensaje = useEnviarMensaje();
  const revisarSolicitud = useRevisarSolicitud();
  const observarSolicitud = useObservarSolicitud();
  const aprobarSolicitud = useAprobarSolicitud();
  const rechazarSolicitud = useRechazarSolicitud();
  const revisarDocumento = useRevisarDocumento();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // Auto-mark as EN_REVISION when admin opens an ENVIADA solicitud
  useEffect(() => {
    if (solicitud?.estado === 'ENVIADA' && id) {
      revisarSolicitud.mutate(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitud?.estado, id]);

  // ── Handlers ──

  const handleSendMessage = async () => {
    if (!id || !messageText.trim()) return;
    try {
      await enviarMensaje.mutateAsync({ solicitudId: id, contenido: messageText.trim() });
      setMessageText('');
    } catch {
      toast.error('Error', 'No se pudo enviar el mensaje');
    }
  };

  const handleObservar = async () => {
    if (!id || !observarText.trim()) return;
    try {
      await observarSolicitud.mutateAsync({ id, mensaje: observarText.trim() });
      toast.success('Observada', 'La solicitud fue marcada con observaciones');
      setObservarModal(false);
      setObservarText('');
    } catch {
      toast.error('Error', 'No se pudo observar la solicitud');
    }
  };

  const handleAprobar = async () => {
    if (!id) return;
    try {
      await aprobarSolicitud.mutateAsync(id);
      toast.success('Aprobada', 'La solicitud fue aprobada exitosamente');
      setConfirmarAprobar(false);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo aprobar');
    }
  };

  const handleRechazar = async () => {
    if (!id || !rechazarText.trim()) return;
    try {
      await rechazarSolicitud.mutateAsync({ id, motivoRechazo: rechazarText.trim() });
      toast.success('Rechazada', 'La solicitud fue rechazada');
      setRechazarModal(false);
      setRechazarText('');
    } catch {
      toast.error('Error', 'No se pudo rechazar la solicitud');
    }
  };

  const handleDocReview = async (docId: string, estado: 'APROBADO' | 'RECHAZADO') => {
    if (!id) return;
    try {
      await revisarDocumento.mutateAsync({ solicitudId: id, docId, estado });
      toast.success('Documento actualizado', `Documento ${estado.toLowerCase()}`);
    } catch {
      toast.error('Error', 'No se pudo actualizar el documento');
    }
  };

  // ── Loading ──

  if (isLoading || !solicitud) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  const eCfg = ESTADO_CONFIG[solicitud.estado] || ESTADO_CONFIG.ENVIADA;
  const datosActor = parseDatosActor(solicitud.datosActor || '{}');
  const documentos = solicitud.documentos || [];
  const canAct = solicitud.estado === 'EN_REVISION' || solicitud.estado === 'OBSERVADA';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/solicitudes')}
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-neutral-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-neutral-900">
              {solicitud.usuario?.nombre || 'Candidato'}
            </h2>
            <Badge
              variant="default"
              color={eCfg.color}
              size="lg"
              dot={solicitud.estado === 'OBSERVADA'}
              pulse={solicitud.estado === 'OBSERVADA'}
            >
              {eCfg.label}
            </Badge>
          </div>
          <p className="text-sm text-neutral-500 mt-0.5">
            {solicitud.usuario?.email} &middot; {solicitud.tipoActor} &middot; Creada{' '}
            {new Date(solicitud.createdAt).toLocaleDateString('es-AR')}
          </p>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Datos del Actor */}
        <Card padding="none">
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center gap-2">
            <User size={16} className="text-neutral-500" />
            <h3 className="font-semibold text-neutral-800">Datos del Actor</h3>
          </div>
          <div className="p-5 space-y-3">
            {Object.keys(datosActor).length === 0 ? (
              <p className="text-sm text-neutral-400">Sin datos cargados</p>
            ) : (
              Object.entries(datosActor).map(([key, value]) => (
                <div key={key}>
                  <p className="text-xs text-neutral-500 mb-0.5">{fieldLabel(key)}</p>
                  <p className="text-sm font-medium text-neutral-800 break-words">{value || '-'}</p>
                </div>
              ))
            )}

            {/* Extra JSON sections */}
            {solicitud.datosResiduos && (
              <div className="pt-3 border-t border-neutral-100">
                <p className="text-xs font-semibold text-neutral-600 mb-2">Datos de Residuos</p>
                {Object.entries(parseDatosActor(solicitud.datosResiduos)).map(([k, v]) => (
                  <div key={k} className="mb-2">
                    <p className="text-xs text-neutral-500">{fieldLabel(k)}</p>
                    <p className="text-sm text-neutral-800 break-words">{v || '-'}</p>
                  </div>
                ))}
              </div>
            )}
            {solicitud.datosRegulatorio && (
              <div className="pt-3 border-t border-neutral-100">
                <p className="text-xs font-semibold text-neutral-600 mb-2">Datos Regulatorios</p>
                {Object.entries(parseDatosActor(solicitud.datosRegulatorio)).map(([k, v]) => (
                  <div key={k} className="mb-2">
                    <p className="text-xs text-neutral-500">{fieldLabel(k)}</p>
                    <p className="text-sm text-neutral-800 break-words">{v || '-'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Column 2: Documentos */}
        <Card padding="none">
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center gap-2">
            <File size={16} className="text-neutral-500" />
            <h3 className="font-semibold text-neutral-800">Documentos</h3>
            <Badge variant="soft" color="neutral" size="sm">{documentos.length}</Badge>
          </div>
          <div className="p-4 space-y-3">
            {documentos.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-6">Sin documentos</p>
            ) : (
              documentos.map((doc: DocumentoSolicitud) => {
                const dCfg = DOC_ESTADO_CONFIG[doc.estado] || DOC_ESTADO_CONFIG.PENDIENTE;
                return (
                  <div key={doc.id} className="border border-neutral-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-800 truncate" title={doc.nombre}>
                          {doc.nombre}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-neutral-400">{doc.tipo}</span>
                          <span className="text-[10px] text-neutral-400">{formatFileSize(doc.size)}</span>
                        </div>
                      </div>
                      <Badge variant="soft" color={dCfg.color as any} size="sm">{dCfg.label}</Badge>
                    </div>

                    {doc.observaciones && (
                      <p className="text-xs text-neutral-500 bg-neutral-50 px-2 py-1 rounded">
                        {doc.observaciones}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5">
                      <a
                        href={doc.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500"
                        title="Descargar"
                      >
                        <Download size={13} />
                      </a>
                      {doc.estado === 'PENDIENTE' && canAct && (
                        <>
                          <button
                            onClick={() => handleDocReview(doc.id, 'APROBADO')}
                            className="p-1.5 rounded-lg hover:bg-green-50"
                            title="Aprobar documento"
                            disabled={revisarDocumento.isPending}
                          >
                            <CheckCircle size={13} className="text-green-600" />
                          </button>
                          <button
                            onClick={() => handleDocReview(doc.id, 'RECHAZADO')}
                            className="p-1.5 rounded-lg hover:bg-red-50"
                            title="Rechazar documento"
                            disabled={revisarDocumento.isPending}
                          >
                            <XCircle size={13} className="text-red-600" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Column 3: Mensajes */}
        <Card padding="none" className="flex flex-col">
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center gap-2">
            <MessageSquare size={16} className="text-neutral-500" />
            <h3 className="font-semibold text-neutral-800">Mensajes</h3>
            {mensajes && mensajes.length > 0 && (
              <Badge variant="soft" color="info" size="sm">{mensajes.length}</Badge>
            )}
          </div>

          <div className="flex-1 max-h-96 overflow-y-auto p-4 space-y-3">
            {(!mensajes || mensajes.length === 0) ? (
              <p className="text-center text-sm text-neutral-400 py-6">No hay mensajes</p>
            ) : (
              mensajes.map((msg: MensajeSolicitud) => {
                const isAdmin = msg.autorRol === 'ADMIN';
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                      isAdmin
                        ? 'bg-primary-50 border border-primary-100 rounded-br-sm'
                        : 'bg-neutral-100 border border-neutral-200 rounded-bl-sm'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold uppercase ${
                          isAdmin ? 'text-primary-600' : 'text-neutral-500'
                        }`}>
                          {isAdmin ? 'Admin' : 'Candidato'}
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
        </Card>
      </div>

      {/* Action Bar */}
      {canAct && (
        <Card className="!bg-neutral-50 flex items-center justify-end gap-3 flex-wrap">
          <Button
            variant="primary"
            leftIcon={<CheckCircle size={16} />}
            onClick={() => setConfirmarAprobar(true)}
            disabled={aprobarSolicitud.isPending}
          >
            Aprobar
          </Button>
          <Button
            variant="outline"
            leftIcon={<AlertTriangle size={16} />}
            onClick={() => setObservarModal(true)}
          >
            Observar
          </Button>
          <Button
            variant="danger"
            leftIcon={<XCircle size={16} />}
            onClick={() => setRechazarModal(true)}
          >
            Rechazar
          </Button>
        </Card>
      )}

      {/* Confirm Aprobar Modal */}
      {confirmarAprobar && (
        <Modal isOpen onClose={() => setConfirmarAprobar(false)} title="Confirmar Aprobacion" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Vas a aprobar la solicitud de <strong>{solicitud.usuario?.nombre}</strong> como{' '}
              <strong>{solicitud.tipoActor}</strong>. Esto creara el actor y habilitara la cuenta.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmarAprobar(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAprobar}
                isLoading={aprobarSolicitud.isPending}
              >
                Confirmar Aprobacion
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Observar Modal */}
      {observarModal && (
        <Modal isOpen onClose={() => { setObservarModal(false); setObservarText(''); }} title="Observar Solicitud" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              La solicitud volvera al candidato con tus observaciones para que corrija y re-envie.
            </p>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Observaciones *</label>
              <textarea
                value={observarText}
                onChange={e => setObservarText(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm"
                rows={3}
                placeholder="Describe las correcciones necesarias..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setObservarModal(false); setObservarText(''); }}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleObservar}
                disabled={!observarText.trim() || observarSolicitud.isPending}
                isLoading={observarSolicitud.isPending}
              >
                Enviar Observaciones
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rechazar Modal */}
      {rechazarModal && (
        <Modal isOpen onClose={() => { setRechazarModal(false); setRechazarText(''); }} title="Rechazar Solicitud" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Rechazar la solicitud de <strong>{solicitud.usuario?.nombre}</strong>. Esta accion es definitiva.
            </p>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Motivo de rechazo *</label>
              <textarea
                value={rechazarText}
                onChange={e => setRechazarText(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm"
                rows={3}
                placeholder="Indique el motivo del rechazo..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setRechazarModal(false); setRechazarText(''); }}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRechazar}
                disabled={!rechazarText.trim() || rechazarSolicitud.isPending}
                isLoading={rechazarSolicitud.isPending}
              >
                Confirmar Rechazo
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SolicitudDetallePage;

/**
 * SITREP v6 - Solicitud Detalle Page (Admin)
 * Review a specific inscription solicitud
 */

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { useAdmissionContext } from '../../hooks/useAdmissionContext';
import { ACTOR_NAMES, APPLICATION_STATES, applicantName, applicationReturn } from '../../utils/admissionReview';
import {
  ArrowLeft, FileText, CheckCircle, XCircle, AlertTriangle, Eye,
  Send, Download, MessageSquare, User, File, Clock,
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { QueryContent } from '../../components/ui/QueryContent';
import { useRecoverableForm } from '../../hooks/useRecoverableForm';
import { DraftConflictNotice } from '../../components/DraftConflictNotice';
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
import { solicitudService } from '../../services/solicitud.service';
import { DocumentAnalysis } from '../../components/DocumentAnalysis';
import { PaymentIdentityReview } from '../../components/PaymentIdentityReview';
import { AdministrativeTEF } from '../../components/AdministrativeTEF';
import { useAuth } from '../../contexts/AuthContext';
import { getApiErrorMessage } from '../../utils/api-error';
import { RegistrationFleetSummary } from '../../components/registration/RegistrationFleetSummary';
import { RegistrationReviewEditor } from '../../components/registration/RegistrationReviewEditor';
import { EMPTY_DRIVER, fleetRows, licenseDocumentType } from '../../services/registrationFleet';

// ── Status config ──

const ESTADO_CONFIG: Record<EstadoSolicitud, {
  label: string;
  color: 'neutral' | 'info' | 'warning' | 'success' | 'error';
}> = {
  BORRADOR:    { label: 'Borrador',     color: 'neutral' },
  ENVIADA:     { label: 'Enviada',      color: 'info' },
  EN_REVISION: { label: 'En revisión',  color: 'warning' },
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
  const { owner } = useAdmissionContext();
  return <SolicitudReview key={owner + ':' + id} />;
};

const validText = (v: unknown): v is string => typeof v === 'string' && v.length <= 5000;
function ReviewDraftNotice({ draft }: { draft: Pick<ReturnType<typeof useRecoverableForm>, 'conflict' | 'conflictSaved' | 'conflictCount' | 'reload' | 'overwrite' | 'error' | 'saved'> }) {
  return <div className="space-y-2 text-sm text-neutral-600">
    {draft.conflict && <DraftConflictNotice durable={draft.conflictSaved} count={draft.conflictCount} onReload={draft.reload} onKeep={draft.overwrite} />}
    <p role="status">{draft.error ? 'No pudimos guardar en este dispositivo. Mantené esta pantalla abierta.' : draft.saved ? 'Borrador guardado en este dispositivo. Todavía no enviado.' : 'El texto se enviará sólo al confirmar.'}</p>
  </div>;
}

const SolicitudReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation(), mp = useMobilePrefix();
  const { owner } = useAdmissionContext();
  const backToList = () => navigate(applicationReturn(location.state, mp('/admin/solicitudes'), owner), { state: { admissionSectionReturn: location.state?.admissionSectionReturn } });
  const { currentUser } = useAuth();
  const scope = 'sitrep:application-review:v1:' + owner + ':' + id;
  const message = useRecoverableForm(scope + ':message-v2', { text: '', requestId: crypto.randomUUID() }, (v): v is { text: string; requestId: string } => !!v && typeof v === 'object' && validText((v as { text?: unknown }).text) && typeof (v as { requestId?: unknown }).requestId === 'string');
  const observation = useRecoverableForm(scope + ':observation', '', validText);
  const rejection = useRecoverableForm(scope + ':rejection', '', validText);
  const messageText = message.value.text, observarText = observation.value, rechazarText = rejection.value;
  const [observarModal, setObservarModal] = useState(false);
  const [rechazarModal, setRechazarModal] = useState(false);
  const [confirmarAprobar, setConfirmarAprobar] = useState(false);
  const [readingReceipt, setReadingReceipt] = useState(false);
  const [editingData, setEditingData] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (feedback) feedbackRef.current?.focus(); }, [feedback]);

  const detail = useSolicitud(id || ''), messages = useMensajesSolicitud(id || '');
  const { data: solicitud, refetch } = detail;
  const mensajes = messages.data;
  const enviarMensaje = useEnviarMensaje(), revisarSolicitud = useRevisarSolicitud();
  const observarSolicitud = useObservarSolicitud(), aprobarSolicitud = useAprobarSolicitud();
  const rechazarSolicitud = useRechazarSolicitud(), revisarDocumento = useRevisarDocumento();
  const fresh = !!solicitud && !detail.isError && !detail.isPending && !detail.isFetching;
  const reviewer = !!solicitud && !!currentUser && ['ADMIN', `ADMIN_${solicitud.tipoActor}`].includes(currentUser.rol);
  const canDecide = fresh && reviewer && solicitud?.estado === 'EN_REVISION' && !busy;
  const canAct = fresh && reviewer && ['EN_REVISION', 'OBSERVADA'].includes(solicitud!.estado) && !busy;
  const canMessage = fresh && reviewer && !messages.isError && !messages.isPending && !messages.isFetching && !busy;

  const run = async (allowed: boolean, action: () => Promise<unknown>, confirmed: () => void, success: string) => {
    if (!allowed || running.current) return;
    running.current = true; setBusy(true); setFeedback(null);
    try { await action(); confirmed(); setFeedback({ error: false, text: success }); }
    catch (error) { setFeedback({ error: true, text: getApiErrorMessage(error, 'No pudimos confirmar la acción. Tus textos se conservan; revisá el estado actualizado antes de reintentar.') }); }
    finally { await refetch(); running.current = false; setBusy(false); }
  };
  const handleRetryReading = (docId: string) => run(canAct, async () => {
    setReadingReceipt(true);
    try { await solicitudService.analizarDocumento(id!, docId); } finally { setReadingReceipt(false); }
  }, () => {}, 'Lectura actualizada. Revisá el resultado del documento.');
  const handleSendMessage = () => run(canMessage && !!messageText.trim() && !message.conflict,
    () => enviarMensaje.mutateAsync({ solicitudId: id!, contenido: messageText.trim(), clientMessageId: message.value.requestId }),
    () => { message.clear(); }, 'Mensaje enviado. Quedó registrado en la conversación.');
  const handleObservar = () => run(canDecide && !!observarText.trim() && !observation.conflict,
    () => observarSolicitud.mutateAsync({ id: id!, mensaje: observarText.trim(), expectedUpdatedAt: solicitud?.updatedAt }),
    () => { observation.clear(); setObservarModal(false); }, 'Observaciones enviadas. El solicitante debe corregir y reenviar.');
  const handleAprobar = () => run(canDecide,
    () => aprobarSolicitud.mutateAsync({ id: id!, expectedUpdatedAt: solicitud?.updatedAt }),
    () => { setConfirmarAprobar(false); observation.clear(); rejection.clear(); }, 'Solicitud aprobada. El alta quedó habilitada.');
  const handleRechazar = () => run(canDecide && !!rechazarText.trim() && !rejection.conflict,
    () => rechazarSolicitud.mutateAsync({ id: id!, motivoRechazo: rechazarText.trim(), expectedUpdatedAt: solicitud?.updatedAt }),
    () => { rejection.clear(); observation.clear(); setRechazarModal(false); }, 'Solicitud rechazada. El motivo quedó registrado.');
  const handleDocReview = (docId: string, estado: 'APROBADO' | 'RECHAZADO') => run(canAct,
    () => revisarDocumento.mutateAsync({ solicitudId: id!, docId, estado }),
    () => {}, estado === 'APROBADO' ? 'Documento aprobado.' : 'Documento rechazado.');

  const feedbackPanel = feedback && <p ref={feedbackRef} tabIndex={-1} role={feedback.error ? 'alert' : 'status'} className={'rounded-lg border p-3 text-sm ' + (feedback.error ? 'border-error-200 bg-error-50 text-error-900' : 'border-primary-200 bg-primary-50 text-primary-900')}>{feedback.text}</p>;
  // A failed fresh read must hide cached private data and decision controls.
  if (detail.isPending || detail.isError || !solicitud) return <div className="space-y-4">
    <Button variant="outline" onClick={backToList}>Volver a solicitudes</Button>
    {feedbackPanel}
    <QueryContent query={detail} loading="Cargando solicitud" error="No pudimos verificar la solicitud. Tus borradores se conservan; las decisiones esperan una consulta actualizada." retryLabel="Actualizar solicitud">
      {!solicitud && <p role="alert">Solicitud no disponible.</p>}
    </QueryContent>
  </div>;

  const eCfg = ESTADO_CONFIG[solicitud.estado] || ESTADO_CONFIG.ENVIADA;
  const datosActor = parseDatosActor(solicitud.datosActor || '{}');
  const declaredDrivers = fleetRows(datosActor.choferesJson, EMPTY_DRIVER);
  const documentos = solicitud.documentos || [];
  const statusText = APPLICATION_STATES[solicitud.estado]?.next || 'Estado por verificar';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Volver a solicitudes de inscripción"
          onClick={backToList}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"
        >
          <ArrowLeft size={20} className="text-neutral-500" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-neutral-900 [overflow-wrap:anywhere]">
              {applicantName(solicitud)}
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
          <p className="text-sm text-neutral-600 mt-0.5 [overflow-wrap:anywhere]">
            {solicitud.usuario?.email} &middot; {ACTOR_NAMES[solicitud.tipoActor]} &middot; Creada{' '}
            {new Date(solicitud.createdAt).toLocaleDateString('es-AR')}
          </p>
        </div>
      </div>

      {!observarModal && !rechazarModal && !confirmarAprobar && feedbackPanel}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary-100 bg-primary-50 p-4">
        <p className="min-w-0 flex-1 text-sm text-primary-900">{statusText}</p>
        {solicitud.estado === 'ENVIADA' && reviewer && <Button disabled={!fresh || busy} onClick={() => void run(fresh && reviewer, () => revisarSolicitud.mutateAsync({ id: id!, expectedUpdatedAt: solicitud?.updatedAt }), () => {}, 'Revisión iniciada. Podés revisar documentos y resolver la solicitud.')}>Iniciar revisión</Button>}
        {detail.isFetching && <span role="status" className="text-sm">Actualizando solicitud…</span>}
      </div>

      {solicitud.estado === 'RECHAZADA' && solicitud.motivoRechazo && <section aria-label="Motivo de rechazo" className="rounded-lg border border-error-200 bg-error-50 p-4">
        <h3 className="text-sm font-semibold text-error-900">Motivo de rechazo</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-error-900 [overflow-wrap:anywhere]">{solicitud.motivoRechazo}</p>
      </section>}
      {solicitud.estado === 'OBSERVADA' && solicitud.observaciones && <section aria-label="Correcciones solicitadas" className="rounded-lg border border-warning-200 bg-warning-50 p-4">
        <h3 className="text-sm font-semibold text-warning-900">Correcciones solicitadas</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-warning-900 [overflow-wrap:anywhere]">{solicitud.observaciones}</p>
      </section>}

      <AdministrativeTEF actorType={solicitud.tipoActor} identity={solicitud.id}
        declaration={datosActor}
        corrientesY={(datosActor.corrientesControl || datosActor.corrientesY || '').split(/[,;/]/).map(value => value.trim().toUpperCase()).filter(value => /^Y\d+$/.test(value))}
        tieneISO={!!datosActor.certificacionISO} />

      {/* Documents and correspondence retain one common workspace. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* Column 1: Datos del Actor */}
        <Card padding="none">
          <div className="px-5 py-4 border-b border-neutral-200 flex flex-wrap items-center gap-2">
            <User size={16} className="text-neutral-500" />
            <h3 className="font-semibold text-neutral-800">Datos del Actor</h3>
            {canAct && solicitud.estado === 'EN_REVISION' && <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEditingData(true)}>Corregir datos</Button>}
          </div>
          <div className="p-5 space-y-3">
            {Object.keys(datosActor).length === 0 ? (
              <p className="text-sm text-neutral-400">Sin datos cargados</p>
            ) : (
              Object.entries(datosActor).filter(([key]) => !['choferesJson', 'vehiculosJson'].includes(key)).map(([key, value]) => (
                <div key={key}>
                  <p className="text-xs text-neutral-500 mb-0.5">{fieldLabel(key)}</p>
                  <p className="text-sm font-medium text-neutral-800 break-words">{value || '-'}</p>
                </div>
              ))
            )}

            <RegistrationFleetSummary form={datosActor} />
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
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-600">
                          <span className="min-w-0 break-words">{doc.tipo.startsWith('LICENCIA_CHOFER_') ? (() => {
                            const index = declaredDrivers.findIndex(driver => licenseDocumentType(driver.key) === doc.tipo);
                            const driver = declaredDrivers[index];
                            return driver ? `Licencia · Chofer ${index + 1} · ${driver.nombre} ${driver.apellido}` : 'Licencia de chofer · declaración original';
                          })() : doc.tipo.replaceAll('_', ' ')}</span>
                          <span className="shrink-0">{formatFileSize(doc.size)}</span>
                        </div>
                      </div>
                      <Badge variant="soft" color={dCfg.color} size="sm">{dCfg.label}</Badge>
                    </div>

                    {doc.observaciones && (
                      <p className="text-xs text-neutral-500 bg-neutral-50 px-2 py-1 rounded">
                        {doc.observaciones}
                      </p>
                    )}
                    <DocumentAnalysis analysis={doc.analisis} kind={doc.tipo.startsWith('LICENCIA_CHOFER_') ? 'license' : doc.tipo === 'COMPROBANTE_PAGO' ? 'receipt' : doc.tipo === 'FACTURA_ELECTRICA' ? 'electricity' : 'document'} retrying={readingReceipt || !fresh || busy} onRetry={reviewer && ['EN_REVISION', 'OBSERVADA'].includes(solicitud.estado) && (['COMPROBANTE_PAGO', 'FACTURA_ELECTRICA'].includes(doc.tipo) || doc.tipo.startsWith('LICENCIA_CHOFER_')) ? () => void handleRetryReading(doc.id) : undefined} />
                    {doc.tipo === 'COMPROBANTE_PAGO' && reviewer && (['EN_REVISION', 'OBSERVADA'].includes(solicitud.estado) || doc.estado === 'APROBADO') && <fieldset disabled={!fresh || busy}><PaymentIdentityReview key={doc.id + doc.sha256} analysis={doc.analisis} sha256={doc.sha256} cuit={datosActor.cuit || ''} referencia={solicitud.id} onConfirm={async input => { if (!fresh || busy) throw new Error('Esperá a verificar la solicitud antes de confirmar el pago.'); await solicitudService.confirmarPago(solicitud.id, doc.id, input); await refetch(); }} /></fieldset>}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Descargar ${doc.nombre}`}
                        onClick={() => { if (id) void solicitudService.downloadDocumento(id, doc).catch(() => toast.error('Error', 'No se pudo descargar el documento')); }}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-neutral-100 text-neutral-700 focus-visible:ring-2 focus-visible:ring-primary-700"
                        title="Descargar"
                      >
                        <Download size={13} />
                      </button>
                      {doc.estado === 'PENDIENTE' && canAct && (
                        <>
                          <button
                            onClick={() => handleDocReview(doc.id, 'APROBADO')}
                            aria-label={`Aprobar documento ${doc.nombre}`}
                            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-green-800 hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-primary-700"
                            title="Aprobar documento"
                            disabled={revisarDocumento.isPending}
                          >
                            <CheckCircle size={13} className="text-green-600" />
                          </button>
                          <button
                            onClick={() => handleDocReview(doc.id, 'RECHAZADO')}
                            aria-label={`Rechazar documento ${doc.nombre}`}
                            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-red-800 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-primary-700"
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

        {/* Correspondence follows the document review at full width. */}
        <Card padding="none" className="flex min-w-0 flex-col xl:col-span-2">
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center gap-2">
            <MessageSquare size={16} className="text-neutral-500" />
            <h3 className="font-semibold text-neutral-800">Mensajes</h3>
            {mensajes && mensajes.length > 0 && (
              <Badge variant="soft" color="info" size="sm">{mensajes.length}</Badge>
            )}
          </div>

          <div className="flex-1 max-h-96 overflow-y-auto p-4 space-y-3">
            <QueryContent query={messages} loading="Cargando conversación" error="No pudimos consultar los mensajes. Tu borrador se conserva." retryLabel="Reintentar mensajes">
            {(!mensajes || mensajes.length === 0) ? (
              <p className="text-center text-sm text-neutral-400 py-6">No hay mensajes</p>
            ) : (
              mensajes.map((msg: MensajeSolicitud) => {
                const isAdmin = msg.autorRol === 'ADMIN' || msg.autorRol.startsWith('ADMIN_');
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
                          {isAdmin ? 'Administración' : 'Solicitante'}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {new Date(msg.createdAt).toLocaleDateString('es-AR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-neutral-800 [overflow-wrap:anywhere]">{msg.contenido}</p>
                    </div>
                  </div>
                );
              })
            )}
            </QueryContent>
          </div>

          {/* Compose */}
          <div className="px-4 py-3 border-t border-neutral-200 flex gap-2">
            <input
              type="text"
              aria-label="Mensaje sobre la solicitud"
              value={messageText}
              onChange={e => message.update({ text: e.target.value, requestId: crypto.randomUUID() })}
              maxLength={5000}
              disabled={!canMessage}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              className="min-w-0 flex-1 min-h-11 px-3 rounded-lg border border-neutral-200 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-700"
              placeholder="Escribe un mensaje..."
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendMessage}
              aria-label="Enviar mensaje sobre la solicitud"
              disabled={!canMessage || !messageText.trim() || message.conflict}
              isLoading={enviarMensaje.isPending}
            >
              <Send size={14} />
            </Button>
          </div>
          {reviewer && <div className="px-4 pb-3"><ReviewDraftNotice draft={message} /></div>}
        </Card>
      </div>

      {/* Action Bar */}
      {editingData && reviewer && solicitud.estado === 'EN_REVISION' && <RegistrationReviewEditor key={solicitud.id} application={solicitud} readOnly={!fresh || busy} onClose={() => setEditingData(false)} onConfirmed={() => setFeedback({ error: false, text: 'Corrección guardada. Los datos se actualizaron; la solicitud sigue en revisión.' })} onSaved={async () => { const current = await refetch(); if (current.isError) throw current.error; }} />}
      {reviewer && solicitud.estado === 'EN_REVISION' && (
        <Card className="!bg-neutral-50 flex items-center justify-end gap-3 flex-wrap">
          <Button
            variant="primary"
            leftIcon={<CheckCircle size={16} />}
            onClick={() => { setFeedback(null); setConfirmarAprobar(true); }}
            disabled={!canDecide}
          >
            Aprobar
          </Button>
          <Button
            variant="outline"
            leftIcon={<AlertTriangle size={16} />}
            onClick={() => { setFeedback(null); setObservarModal(true); }}
            disabled={!canDecide}
          >
            Observar
          </Button>
          <Button
            variant="danger"
            leftIcon={<XCircle size={16} />}
            onClick={() => { setFeedback(null); setRechazarModal(true); }}
            disabled={!canDecide}
          >
            Rechazar
          </Button>
        </Card>
      )}

      {/* Confirm Aprobar Modal */}
      {confirmarAprobar && (
        <Modal isOpen onClose={() => setConfirmarAprobar(false)} isBusy={busy} title="Confirmar aprobación" size="sm">
          <div className="space-y-4">
            {feedbackPanel}
            {!canDecide && <p role="status" className="text-sm">Esperá a verificar el estado. Sólo se puede resolver una solicitud en revisión.</p>}
            <p className="text-sm text-neutral-600">
              Vas a aprobar la solicitud de <strong>{solicitud.usuario?.nombre}</strong> como{' '}
              <strong>{solicitud.tipoActor}</strong>. Esto habilitará el alta de esa actividad.
            </p>
            {import.meta.env.VITE_ENTERPRISE_ENABLED === 'true' && <p className="text-sm text-neutral-700">La cuenta titular, con correo verificado, quedará vinculada al CUIT como responsable ante SITREP. Podrá autorizar a una segunda persona. Los demás roles conservan su revisión y no agregan cupos.</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirmarAprobar(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAprobar}
                disabled={!canDecide}
                isLoading={aprobarSolicitud.isPending}
              >
                Confirmar aprobación
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Observar Modal */}
      {observarModal && (
        <Modal isOpen onClose={() => setObservarModal(false)} isBusy={busy} title="Solicitar correcciones" size="sm">
          <div className="space-y-4">
            {feedbackPanel}
            {!canDecide && <p role="status" className="text-sm">Esperá a verificar el estado. Sólo se puede resolver una solicitud en revisión.</p>}
            <p className="text-sm text-neutral-600">
              El solicitante recibirá tus observaciones para corregir y reenviar.
            </p>
            <div>
              <label htmlFor="solicitud-observaciones" className="block text-sm font-medium text-neutral-700 mb-1">Observaciones *</label>
              <textarea
                id="solicitud-observaciones"
                value={observarText}
                onChange={e => observation.update(e.target.value)}
                maxLength={5000}
                disabled={!canDecide}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm"
                rows={3}
                placeholder="Describí las correcciones necesarias..."
              />
              <ReviewDraftNotice draft={observation} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => { setObservarModal(false); }}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleObservar}
                disabled={!canDecide || !observarText.trim() || observation.conflict}
                isLoading={observarSolicitud.isPending}
              >
                Enviar observaciones
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rechazar Modal */}
      {rechazarModal && (
        <Modal isOpen onClose={() => setRechazarModal(false)} isBusy={busy} title="Rechazar Solicitud" size="sm">
          <div className="space-y-4">
            {feedbackPanel}
            {!canDecide && <p role="status" className="text-sm">Esperá a verificar el estado. Sólo se puede resolver una solicitud en revisión.</p>}
            <p className="text-sm text-neutral-600">
              Rechazar la solicitud de <strong>{solicitud.usuario?.nombre}</strong>. La decisión y su motivo quedarán registrados.
            </p>
            <div>
              <label htmlFor="solicitud-motivo-rechazo" className="block text-sm font-medium text-neutral-700 mb-1">Motivo de rechazo *</label>
              <textarea
                id="solicitud-motivo-rechazo"
                value={rechazarText}
                onChange={e => rejection.update(e.target.value)}
                maxLength={5000}
                disabled={!canDecide}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm"
                rows={3}
                placeholder="Indicá el motivo del rechazo..."
              />
              <ReviewDraftNotice draft={rejection} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => { setRechazarModal(false); }}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRechazar}
                disabled={!canDecide || !rechazarText.trim() || rejection.conflict}
                isLoading={rechazarSolicitud.isPending}
              >
                Confirmar rechazo
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SolicitudDetallePage;

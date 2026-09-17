import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Award, Check, CheckCircle2, Clock3, Download, FileText, Loader2, ScanLine, ShieldCheck, Upload, WifiOff, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/CardV2';
import { Button } from './ui/ButtonV2';
import { Badge } from './ui/BadgeV2';
import { toast } from './ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { getSyncQueue } from '../services/indexeddb';
import { offlineSafeMultipartMutation } from '../utils/offline-mutation';
import { getApiErrorMessage } from '../utils/api-error';

type ActorType = 'generador' | 'transportista' | 'operador';
type UploadMode = 'document' | 'atm';
type DocumentKind = 'CONSTANCIA_AFIP' | 'MEMORIA_TECNICA' | 'CERTIFICADO_HABILITACION' | 'RESOLUCION_DPA' | 'SEGURO_AMBIENTAL' | 'HABILITACION_ACTOR' | 'TARJETA_IDENTIFICACION_VEHICULO' | 'AUTORIZACION_USO_VEHICULO' | 'LICENCIA_CONDUCIR' | 'OTRO';

interface RegulatoryDocument {
  id: string;
  tipo: DocumentKind;
  estado: string;
  vigenteHasta?: string | null;
  confianzaOcr?: number | null;
  datosOcr?: unknown;
  archivo?: { nombreOriginal?: string; bytes?: number; mimeDetectado?: string };
  motivoRechazo?: string | null;
}

interface Credential {
  id: string;
  tipo: string;
  estado: string;
  vigenteDesde: string;
  vigenteHasta: string;
  emisiones?: Array<{ id: string; serial: string; pdfSha256: string }>;
}

interface Requirement { tipo: string; nombre: string; requiereVigencia: boolean; completo?: boolean }

const LABELS: Record<string, string> = {
  CONSTANCIA_AFIP: 'Constancia AFIP',
  MEMORIA_TECNICA: 'Memoria técnica',
  CERTIFICADO_HABILITACION: 'Certificado de habilitación',
  RESOLUCION_DPA: 'Resolución DPA',
  SEGURO_AMBIENTAL: 'Seguro ambiental',
  HABILITACION_ACTOR: 'Habilitación del actor',
  TARJETA_IDENTIFICACION_VEHICULO: 'Cédula / identificación del vehículo',
  AUTORIZACION_USO_VEHICULO: 'Autorización de uso del vehículo',
  LICENCIA_CONDUCIR: 'Licencia de conducir',
  OTRO: 'Otro documento',
};

const STATUS_COLOR: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
  APROBADO: 'success', ACTIVA: 'success', RECHAZADO: 'error', REVOCADA: 'error', PENDIENTE: 'warning',
};

function ocrFields(value: unknown): Array<{ key: string; label: string; value: string; confidence?: number }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const fields = (value as { campos?: unknown }).campos;
  if (!Array.isArray(fields)) return [];
  return fields.filter((field): field is { key: string; label: string; value: string; confidence?: number } => Boolean(
    field && typeof field === 'object' &&
    typeof (field as Record<string, unknown>).key === 'string' &&
    typeof (field as Record<string, unknown>).label === 'string' &&
    typeof (field as Record<string, unknown>).value === 'string',
  ));
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string | null): string {
  if (!value) return 'Sin vencimiento informado';
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value));
}

export default function ActorDocumentPanelV2({ actorType, actorId }: { actorType: ActorType; actorId: string }) {
  const { currentUser, isAnyAdmin } = useAuth();
  const [documents, setDocuments] = useState<RegulatoryDocument[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ocrId, setOcrId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [showAtm, setShowAtm] = useState(false);
  const [atm, setAtm] = useState({ emisor: 'ATM', referencia: '', importe: '', periodo: '', cuit: '', fechaPago: '' });
  const [uploadKind, setUploadKind] = useState<DocumentKind>('CONSTANCIA_AFIP');
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadModeRef = useRef<UploadMode>('document');
  const actorEndpoint = `/actores/${actorType}/${actorId}`;

  const refreshPendingCount = useCallback(async () => {
    const queue = await getSyncQueue().catch(() => []);
    setPendingUploads(queue.filter((action) => String(action.userId) === String(currentUser?.id) && action.endpoint.startsWith(actorEndpoint)).length);
  }, [actorEndpoint, currentUser?.id]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`${actorEndpoint}/documentos-regulatorios`);
      setDocuments(data.data?.documentos || []);
      setRequirements(data.data?.requisitos || []);
      setCredentials(data.data?.credenciales || []);
    } catch (error: unknown) {
      toast.error('Expediente no disponible', getApiErrorMessage(error, 'No se pudo cargar el expediente documental'));
    } finally {
      setLoading(false);
    }
  }, [actorEndpoint]);

  useEffect(() => {
    setLoading(true);
    void Promise.all([load(), refreshPendingCount()]);
  }, [load, refreshPendingCount]);

  const requiredOk = useMemo(() => requirements.filter((requirement) => requirement.completo).length, [requirements]);
  const requirementsReady = requirements.length > 0 && requiredOk === requirements.length;

  const enqueueableUpload = async (endpoint: string, fields: Record<string, string>, file: File) => {
    if (!currentUser?.id) throw new Error('La sesión no permite guardar cargas pendientes');
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    form.append('file', file);
    return offlineSafeMultipartMutation(() => api.post(endpoint, form), { endpoint, fields, file, userId: currentUser.id });
  };

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const result = await enqueueableUpload(`${actorEndpoint}/documentos-regulatorios`, { tipo: uploadKind }, file);
      if (result === 'QUEUED') {
        toast.info('Carga guardada sin conexión', 'El archivo está cifrado y se enviará al recuperar la API');
        await refreshPendingCount();
      } else {
        toast.success('Documento cargado', 'Quedó pendiente de revisión');
        await load();
      }
    } catch (error: unknown) {
      toast.error('Carga rechazada', getApiErrorMessage(error, 'No se pudo cargar el documento'));
    } finally { setBusy(false); }
  };

  const uploadAtm = async (file: File) => {
    if (!atm.referencia.trim()) {
      toast.error('Referencia ATM obligatoria', 'Complete la referencia antes de adjuntar el archivo');
      return;
    }
    if (atm.importe && (!Number.isFinite(Number(atm.importe)) || Number(atm.importe) <= 0)) {
      toast.error('Importe inválido', 'Ingrese un importe mayor a cero');
      return;
    }
    setBusy(true);
    try {
      const result = await enqueueableUpload(`${actorEndpoint}/comprobantes-atm`, atm, file);
      if (result === 'QUEUED') {
        toast.info('Comprobante guardado sin conexión', 'Está cifrado y se validará al recuperar la API');
        await refreshPendingCount();
      } else {
        toast.success('Comprobante ATM cargado', 'Quedó pendiente de revisión y control de duplicados');
        await load();
      }
      setShowAtm(false);
    } catch (error: unknown) {
      toast.error('ATM rechazado', getApiErrorMessage(error, 'No se pudo registrar el comprobante'));
    } finally { setBusy(false); }
  };

  const chooseFile = (mode: UploadMode) => {
    uploadModeRef.current = mode;
    fileRef.current?.click();
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void (uploadModeRef.current === 'atm' ? uploadAtm(file) : upload(file));
  };

  const runOcr = async (id: string) => {
    setOcrId(id);
    try {
      await api.post(`/documentos/${id}/ocr`);
      toast.success('OCR completado', 'Revise y confirme los valores sugeridos');
      await load();
    } catch (error: unknown) {
      toast.error('OCR no disponible', getApiErrorMessage(error, 'No se pudo ejecutar OCR'));
    } finally { setOcrId(null); }
  };

  const confirmOcr = async (doc: RegulatoryDocument) => {
    try {
      await api.patch(`/documentos/${doc.id}/confirmar`, { datosOcr: doc.datosOcr });
      toast.success('OCR confirmado', 'Los valores sugeridos quedaron confirmados');
      await load();
    } catch (error: unknown) {
      toast.error('No se pudo confirmar OCR', getApiErrorMessage(error, 'Revise el documento e intente nuevamente'));
    }
  };

  const review = async (id: string, estado: 'APROBADO' | 'RECHAZADO') => {
    setReviewId(id);
    try {
      await api.patch(`/admin/documentos-regulatorios/${id}/revisar`, { estado, motivoRechazo: estado === 'RECHAZADO' ? 'Requiere corrección' : undefined });
      toast.success(estado === 'APROBADO' ? 'Documento aprobado' : 'Documento observado');
      await load();
    } catch (error: unknown) {
      toast.error('Revisión rechazada', getApiErrorMessage(error, 'No se pudo revisar'));
    } finally { setReviewId(null); }
  };

  const download = async (id: string, name: string, certificate = false) => {
    try {
      const response = await api.get(certificate ? `/certificados/${id}/download` : `/documentos/${id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name || (certificate ? 'certificado.pdf' : 'documento');
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast.error('Descarga no disponible', getApiErrorMessage(error, 'No se pudo descargar el archivo'));
    }
  };

  const createCredential = async () => {
    try {
      await api.post(`/admin/actores/${actorType}/${actorId}/credenciales`, { tipo: `HABILITACION_${actorType.toUpperCase()}`, alcance: 'Registro SITREP' });
      toast.success('Credencial creada', 'Ya puede emitir el certificado');
      await load();
    } catch (error: unknown) {
      toast.error('No se pudo crear', getApiErrorMessage(error, 'La documentación aún no está completa'));
    }
  };

  const issueCertificate = async (id: string) => {
    try {
      const { data } = await api.post(`/admin/credenciales/${id}/emitir-certificado`);
      const emission = data.data?.emision;
      if (emission?.id) await download(emission.id, `${emission.serial}.pdf`, true);
      toast.success('Certificado emitido', 'El PDF y su QR firmado quedaron registrados');
      await load();
    } catch (error: unknown) {
      toast.error('Certificado no emitido', getApiErrorMessage(error, 'La credencial no está lista'));
    }
  };

  return <Card>
    <CardHeader title="Expediente documental y certificados" icon={<FileText size={20} />}>
      <Badge variant="soft" color={requirementsReady ? 'success' : 'warning'}>{requiredOk}/{requirements.length || 0} requisitos</Badge>
    </CardHeader>
    <CardContent>
      {pendingUploads > 0 && <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
        <WifiOff size={18} className="mt-0.5 shrink-0" />
        <div><p className="text-sm font-semibold">{pendingUploads} carga{pendingUploads === 1 ? '' : 's'} pendiente{pendingUploads === 1 ? '' : 's'}</p><p className="text-xs">Los archivos permanecen cifrados y se enviarán cuando la API responda.</p></div>
      </div>}

      <section aria-labelledby="document-upload-title" className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <h3 id="document-upload-title" className="mb-3 text-sm font-semibold text-neutral-900">Agregar documentación</h3>
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_auto_auto] sm:items-end">
          <label className="block text-sm font-medium text-neutral-700">Tipo de documento
            <select value={uploadKind} onChange={(event) => setUploadKind(event.target.value as DocumentKind)} className="mt-1 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200">
              {Object.entries(LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <Button fullWidth leftIcon={busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />} disabled={busy} onClick={() => chooseFile('document')}>Elegir archivo o foto</Button>
          <Button fullWidth variant="outline" onClick={() => setShowAtm((visible) => !visible)}>{showAtm ? 'Cerrar ATM' : 'Cargar ATM'}</Button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">PDF, JPG o PNG. Máximo 10 MB. Cada archivo se valida antes de quedar disponible.</p>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={handleFile} />
      </section>

      {showAtm && <section aria-labelledby="atm-upload-title" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h3 id="atm-upload-title" className="font-semibold text-amber-950">Comprobante de sellado ATM</h3>
        <p className="mb-3 text-xs text-amber-800">La referencia y la huella impiden reutilizar el comprobante en otro actor.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium text-amber-950">Emisor<input value={atm.emisor} onChange={(e) => setAtm((p) => ({ ...p, emisor: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-amber-300 bg-white px-3" /></label>
          <label className="text-sm font-medium text-amber-950">Referencia ATM *<input required value={atm.referencia} onChange={(e) => setAtm((p) => ({ ...p, referencia: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-amber-300 bg-white px-3" /></label>
          <label className="text-sm font-medium text-amber-950">Importe<input inputMode="decimal" value={atm.importe} onChange={(e) => setAtm((p) => ({ ...p, importe: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-amber-300 bg-white px-3" /></label>
          <label className="text-sm font-medium text-amber-950">Período<input placeholder="AAAA-MM" value={atm.periodo} onChange={(e) => setAtm((p) => ({ ...p, periodo: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-amber-300 bg-white px-3" /></label>
          <label className="text-sm font-medium text-amber-950">CUIT<input inputMode="numeric" value={atm.cuit} onChange={(e) => setAtm((p) => ({ ...p, cuit: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-amber-300 bg-white px-3" /></label>
          <label className="text-sm font-medium text-amber-950">Fecha de pago<input type="date" value={atm.fechaPago} onChange={(e) => setAtm((p) => ({ ...p, fechaPago: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-amber-300 bg-white px-3" /></label>
        </div>
        <Button className="mt-4" disabled={busy || !atm.referencia.trim()} onClick={() => chooseFile('atm')}>Adjuntar comprobante ATM</Button>
      </section>}

      {requirements.length > 0 && <section aria-labelledby="requirements-title" className="mt-6">
        <h3 id="requirements-title" className="mb-3 text-sm font-semibold text-neutral-900">Requisitos del expediente</h3>
        <div className="grid gap-2 sm:grid-cols-2">{requirements.map((requirement) => <div key={requirement.tipo} className="flex items-start gap-2 rounded-xl border border-neutral-200 p-3">
          {requirement.completo ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success-600" /> : <Clock3 size={18} className="mt-0.5 shrink-0 text-warning-600" />}
          <div><p className="text-sm font-medium text-neutral-900">{requirement.nombre}</p><p className="text-xs text-neutral-500">{requirement.completo ? 'Completo' : 'Pendiente'}{requirement.requiereVigencia ? ' · requiere vigencia' : ''}</p></div>
        </div>)}</div>
      </section>}

      <section aria-labelledby="documents-title" className="mt-6">
        <h3 id="documents-title" className="mb-3 text-sm font-semibold text-neutral-900">Documentos cargados</h3>
        {loading ? <div className="flex items-center gap-2 py-6 text-sm text-neutral-500"><Loader2 size={18} className="animate-spin" /> Cargando expediente…</div> : documents.length === 0 ? <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">Todavía no hay documentos cargados.</div> : <div className="space-y-3">{documents.map((doc) => {
          const fields = ocrFields(doc.datosOcr);
          return <article key={doc.id} className="rounded-xl border border-neutral-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start"><div className="flex min-w-0 flex-1 items-start gap-3"><div className="rounded-lg bg-neutral-100 p-2"><FileText size={18} className="text-neutral-600" /></div><div className="min-w-0"><p className="font-medium text-neutral-900">{LABELS[doc.tipo] || doc.tipo}</p><p className="truncate text-xs text-neutral-500">{doc.archivo?.nombreOriginal || 'Archivo documental'}{doc.archivo?.bytes ? ` · ${formatBytes(doc.archivo.bytes)}` : ''}</p><p className="mt-1 text-xs text-neutral-500">Vigencia: {formatDate(doc.vigenteHasta)}</p></div></div><div className="flex flex-wrap items-center gap-2"><Badge variant="soft" color={STATUS_COLOR[doc.estado] || 'neutral'}>{doc.estado}</Badge>{doc.confianzaOcr != null && <Badge variant="soft" color="neutral">OCR {Math.round(doc.confianzaOcr)}%</Badge>}</div></div>
            {doc.motivoRechazo && <p className="mt-3 rounded-lg bg-error-50 p-2 text-sm text-error-700">{doc.motivoRechazo}</p>}
            {fields.length > 0 && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950"><p className="font-semibold">Campos reconocidos — confirme antes de aprobar</p><dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">{fields.map((field) => <div key={field.key} className="flex gap-1"><dt className="font-semibold">{field.label}:</dt><dd>{field.value}{field.confidence != null ? ` (${field.confidence}%)` : ''}</dd></div>)}</dl></div>}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
              <Button size="sm" variant="outline" leftIcon={ocrId === doc.id ? <Loader2 className="animate-spin" size={15} /> : <ScanLine size={15} />} onClick={() => void runOcr(doc.id)} disabled={ocrId !== null}>Ejecutar OCR</Button>
              {doc.datosOcr != null && <Button size="sm" variant="outline" leftIcon={<Check size={15} />} onClick={() => void confirmOcr(doc)}>Confirmar OCR</Button>}
              <Button size="sm" variant="outline" leftIcon={<Download size={15} />} onClick={() => void download(doc.id, doc.archivo?.nombreOriginal || 'documento')}>Descargar</Button>
              {isAnyAdmin && doc.estado === 'PENDIENTE' && <><Button size="sm" leftIcon={reviewId === doc.id ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />} disabled={reviewId !== null} onClick={() => void review(doc.id, 'APROBADO')}>Aprobar</Button><Button size="sm" variant="outline" leftIcon={<XCircle size={15} />} disabled={reviewId !== null} onClick={() => void review(doc.id, 'RECHAZADO')}>Observar</Button></>}
            </div>
          </article>;
        })}</div>}
      </section>

      <section aria-labelledby="credentials-title" className="mt-6 border-t border-neutral-200 pt-5">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 id="credentials-title" className="flex items-center gap-2 font-semibold text-neutral-900"><Award size={18} /> Credenciales y certificados</h3><p className="mt-1 text-xs text-neutral-500">Sólo se emiten con el expediente completo, vigente y aprobado.</p></div>{isAnyAdmin && <Button size="sm" variant="outline" leftIcon={<ShieldCheck size={15} />} disabled={!requirementsReady} onClick={() => void createCredential()}>Crear credencial</Button>}</div>
        {credentials.length === 0 ? <p className="rounded-xl border border-dashed border-neutral-300 p-5 text-center text-sm text-neutral-500">Sin credenciales emitidas.</p> : <div className="space-y-2">{credentials.map((credential) => <div key={credential.id} className="rounded-xl border border-neutral-200 p-3"><div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 text-sm font-medium text-neutral-900">{credential.tipo}</span><Badge variant="soft" color={STATUS_COLOR[credential.estado] || 'warning'}>{credential.estado}</Badge></div><p className="mt-1 text-xs text-neutral-500">Vigencia: {formatDate(credential.vigenteDesde)} — {formatDate(credential.vigenteHasta)}</p><div className="mt-3 flex flex-wrap gap-2">{isAnyAdmin && credential.estado === 'ACTIVA' && <Button size="sm" onClick={() => void issueCertificate(credential.id)}>Emitir PDF firmado</Button>}{credential.emisiones?.map((emission) => <Button key={emission.id} size="sm" variant="outline" leftIcon={<Download size={15} />} onClick={() => void download(emission.id, `${emission.serial}.pdf`, true)}>{emission.serial}</Button>)}</div></div>)}</div>}
      </section>
    </CardContent>
  </Card>;
}

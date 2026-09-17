import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, CheckCircle2, Download, FileText, Loader2, ScanLine, Upload, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/CardV2';
import { Button } from './ui/ButtonV2';
import { Badge } from './ui/BadgeV2';
import { toast } from './ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

type ActorType = 'generador' | 'transportista' | 'operador';
type DocumentKind = 'CONSTANCIA_AFIP' | 'MEMORIA_TECNICA' | 'CERTIFICADO_HABILITACION' | 'RESOLUCION_DPA' | 'SEGURO_AMBIENTAL' | 'HABILITACION_ACTOR' | 'TARJETA_IDENTIFICACION_VEHICULO' | 'AUTORIZACION_USO_VEHICULO' | 'LICENCIA_CONDUCIR' | 'OTRO';
interface RegulatoryDocument { id: string; tipo: DocumentKind; estado: string; vigenteHasta?: string | null; confianzaOcr?: number | null; datosOcr?: unknown; archivo?: { nombreOriginal?: string; bytes?: number; mimeDetectado?: string }; motivoRechazo?: string | null }
interface Credential { id: string; tipo: string; estado: string; vigenteDesde: string; vigenteHasta: string; emisiones?: Array<{ id: string; serial: string; pdfSha256: string }> }

const LABELS: Record<string, string> = { CONSTANCIA_AFIP: 'Constancia AFIP', MEMORIA_TECNICA: 'Memoria técnica', CERTIFICADO_HABILITACION: 'Certificado de habilitación', RESOLUCION_DPA: 'Resolución DPA', SEGURO_AMBIENTAL: 'Seguro ambiental', HABILITACION_ACTOR: 'Habilitación del actor', TARJETA_IDENTIFICACION_VEHICULO: 'Cédula azul / identificación de vehículo', AUTORIZACION_USO_VEHICULO: 'Autorización de uso de vehículo', LICENCIA_CONDUCIR: 'Licencia de conducir', OTRO: 'Otro' };

function ocrFields(value: unknown): Array<{ key: string; label: string; value: string; confidence?: number }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const fields = (value as { campos?: unknown }).campos;
  if (!Array.isArray(fields)) return [];
  return fields.filter((field): field is { key: string; label: string; value: string; confidence?: number } => (
    Boolean(field && typeof field === 'object' && typeof (field as any).key === 'string' && typeof (field as any).label === 'string' && typeof (field as any).value === 'string')
  ));
}

export default function ActorDocumentPanel({ actorType, actorId }: { actorType: ActorType; actorId: string }) {
  const { isAnyAdmin } = useAuth();
  const [documents, setDocuments] = useState<RegulatoryDocument[]>([]);
  const [requirements, setRequirements] = useState<Array<{ tipo: string; nombre: string; requiereVigencia: boolean; completo?: boolean }>>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [busy, setBusy] = useState(false);
  const [ocrId, setOcrId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [showAtm, setShowAtm] = useState(false);
  const [atm, setAtm] = useState({ emisor: 'ATM', referencia: '', importe: '', periodo: '', cuit: '', fechaPago: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<DocumentKind>('CONSTANCIA_AFIP');

  const load = async () => {
    try {
      const { data } = await api.get(`/actores/${actorType}/${actorId}/documentos-regulatorios`);
      setDocuments(data.data?.documentos || []); setRequirements(data.data?.requisitos || []); setCredentials(data.data?.credenciales || []);
    } catch (error: any) {
      toast.error('Expediente no disponible', error?.response?.data?.message || 'No se pudo cargar el expediente documental');
    }
  };
  useEffect(() => { void load(); }, [actorType, actorId]);
  const requiredOk = useMemo(() => requirements.filter(r => r.completo).length, [requirements]);
  const upload = async (file: File) => {
    setShowAtm(false); setBusy(true);
    try { const form = new FormData(); form.append('file', file); form.append('tipo', uploadKind); await api.post(`/actores/${actorType}/${actorId}/documentos-regulatorios`, form, { headers: { 'Content-Type': 'multipart/form-data' } }); toast.success('Documento cargado', 'Quedó pendiente de revisión'); await load(); }
    catch (error: any) { toast.error('Carga rechazada', error?.response?.data?.message || 'No se pudo cargar el documento'); }
    finally { setBusy(false); }
  };
  const uploadAtm = async (file: File) => {
    if (!atm.referencia.trim()) { toast.error('Referencia ATM obligatoria', 'Complete la referencia antes de adjuntar el archivo'); return; }
    setBusy(true);
    try { const form = new FormData(); form.append('file', file); Object.entries(atm).forEach(([key, value]) => form.append(key, value)); await api.post(`/actores/${actorType}/${actorId}/comprobantes-atm`, form, { headers: { 'Content-Type': 'multipart/form-data' } }); toast.success('Comprobante ATM cargado', 'Quedó pendiente de revisión'); setShowAtm(false); await load(); }
    catch (error: any) { toast.error('ATM rechazado', error?.response?.data?.message || 'No se pudo registrar el comprobante'); }
    finally { setBusy(false); }
  };
  const runOcr = async (id: string) => { setOcrId(id); try { await api.post(`/documentos/${id}/ocr`); toast.success('OCR completado', 'Revise y confirme los valores sugeridos'); await load(); } catch (error: any) { toast.error('OCR no disponible', error?.response?.data?.message || 'No se pudo ejecutar OCR'); } finally { setOcrId(null); } };
  const confirmOcr = async (doc: RegulatoryDocument) => {
    try {
      await api.patch(`/documentos/${doc.id}/confirmar`, { datosOcr: doc.datosOcr });
      toast.success('OCR confirmado', 'Los valores sugeridos quedaron confirmados');
      await load();
    } catch (error: any) {
      toast.error('No se pudo confirmar OCR', error?.response?.data?.message || 'Revise el documento e intente nuevamente');
    }
  };
  const review = async (id: string, estado: 'APROBADO' | 'RECHAZADO') => { setReviewId(id); try { await api.patch(`/admin/documentos-regulatorios/${id}/revisar`, { estado, motivoRechazo: estado === 'RECHAZADO' ? 'Requiere corrección' : undefined }); await load(); } catch (error: any) { toast.error('Revisión rechazada', error?.response?.data?.message || 'No se pudo revisar'); } finally { setReviewId(null); } };
  const download = async (id: string, name: string) => { const response = await api.get(`/documentos/${id}/download`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const a = document.createElement('a'); a.href = url; a.download = name || 'documento'; a.click(); URL.revokeObjectURL(url); };
  const createCredential = async () => { try { await api.post(`/admin/actores/${actorType}/${actorId}/credenciales`, { tipo: `HABILITACION_${actorType.toUpperCase()}`, alcance: 'Registro SITREP' }); toast.success('Credencial creada', 'Ya puede emitir el certificado'); await load(); } catch (error: any) { toast.error('No se pudo crear', error?.response?.data?.message || 'La documentación aún no está completa'); } };
  const issueCertificate = async (id: string) => { try { const { data } = await api.post(`/admin/credenciales/${id}/emitir-certificado`); const emission = data.data?.emision; if (emission?.id) { const response = await api.get(`/certificados/${emission.id}/download`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const a = document.createElement('a'); a.href = url; a.download = `${emission.serial}.pdf`; a.click(); URL.revokeObjectURL(url); } await load(); } catch (error: any) { toast.error('Certificado no emitido', error?.response?.data?.message || 'La credencial no está lista'); } };

  return <Card><CardHeader title="Expediente documental y certificados" icon={<FileText size={20} />}><Badge variant="soft" color={requiredOk === requirements.length && requirements.length > 0 ? 'success' : 'warning'}>{requiredOk}/{requirements.length || 0} requisitos</Badge></CardHeader><CardContent>
    <div className="flex flex-wrap items-end gap-2 mb-5"><div><label className="block text-xs text-neutral-500 mb-1">Tipo</label><select value={uploadKind} onChange={e => setUploadKind(e.target.value as DocumentKind)} className="h-10 rounded-xl border border-neutral-200 px-3 text-sm">{Object.entries(LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><Button size="sm" leftIcon={busy ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />} disabled={busy} onClick={() => { setShowAtm(false); fileRef.current?.click(); }}>Subir documento</Button><Button size="sm" variant="outline" onClick={() => setShowAtm(v => !v)}>Cargar ATM</Button><input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void (showAtm ? uploadAtm(file) : upload(file)); }} /></div>
    {showAtm && <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-5 rounded-xl bg-amber-50 p-3">{Object.entries(atm).map(([key, value]) => <input key={key} placeholder={key === 'referencia' ? 'Referencia ATM *' : key} value={value} onChange={e => setAtm(prev => ({ ...prev, [key]: e.target.value }))} className="h-9 rounded-lg border border-amber-200 px-2 text-sm" />)}<div className="col-span-full flex items-center gap-2"><Button size="sm" disabled={busy || !atm.referencia.trim()} onClick={() => fileRef.current?.click()}>Adjuntar comprobante ATM</Button><span className="text-xs text-amber-700">La referencia se normaliza y se bloquean duplicados.</span></div></div>}
    <div className="space-y-2">{documents.map(doc => { const fields = ocrFields(doc.datosOcr); return <div key={doc.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-100 p-3"><FileText size={16} className="text-neutral-400" /><span className="text-sm font-medium flex-1">{LABELS[doc.tipo] || doc.tipo}</span><Badge variant="soft" color={doc.estado === 'APROBADO' ? 'success' : doc.estado === 'RECHAZADO' ? 'error' : 'warning'}>{doc.estado}</Badge>{doc.confianzaOcr != null && <span className="text-xs text-neutral-500">OCR {Math.round(doc.confianzaOcr)}%</span>}<button aria-label="Ejecutar OCR" className="text-neutral-500" onClick={() => void runOcr(doc.id)} disabled={ocrId !== null}>{ocrId === doc.id ? <Loader2 className="animate-spin" size={15} /> : <ScanLine size={15} />}</button>{doc.datosOcr != null && <button aria-label="Confirmar OCR" className="text-success-600" onClick={() => void confirmOcr(doc)}>Confirmar OCR</button>}<button aria-label="Descargar documento" className="text-neutral-500" onClick={() => void download(doc.id, doc.archivo?.nombreOriginal || 'documento')}><Download size={15} /></button>{isAnyAdmin && doc.estado === 'PENDIENTE' && <><button aria-label="Aprobar documento" className="text-success-600" disabled={reviewId !== null} onClick={() => void review(doc.id, 'APROBADO')}>{reviewId === doc.id ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}</button><button aria-label="Rechazar documento" className="text-error-600" disabled={reviewId !== null} onClick={() => void review(doc.id, 'RECHAZADO')}><XCircle size={15} /></button></>}{fields.length > 0 && <div className="basis-full rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900"><p className="font-semibold">Campos reconocidos — confirmar antes de aprobar</p><div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">{fields.map(field => <span key={field.key}><strong>{field.label}:</strong> {field.value}{field.confidence != null ? ` (${field.confidence}%)` : ''}</span>)}</div></div>}</div>; })}</div>
    <div className="mt-6 border-t border-neutral-100 pt-4"><div className="flex items-center justify-between mb-2"><h4 className="font-semibold text-sm flex items-center gap-2"><Award size={16} /> Certificados</h4>{isAnyAdmin && <Button size="sm" variant="outline" onClick={() => void createCredential()}>Crear credencial</Button>}</div>{credentials.length === 0 ? <p className="text-sm text-neutral-400">Sin credenciales emitidas.</p> : credentials.map(c => <div key={c.id} className="flex flex-wrap items-center gap-2 py-2"><span className="text-sm flex-1">{c.tipo}</span><Badge variant="soft" color={c.estado === 'ACTIVA' ? 'success' : 'warning'}>{c.estado}</Badge>{isAnyAdmin && c.estado === 'ACTIVA' && <Button size="sm" onClick={() => void issueCertificate(c.id)}>Emitir PDF firmado</Button>}{c.emisiones?.[0] && <span className="text-xs text-neutral-500">{c.emisiones[0].serial}</span>}</div>)}</div>
  </CardContent></Card>;
}

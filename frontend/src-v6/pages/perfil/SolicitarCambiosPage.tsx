/**
 * SITREP v6 - Solicitar Cambios Page
 * ====================================
 * Permite a GENERADOR/OPERADOR solicitar modificaciones de datos de su establecimiento.
 * Los cambios quedan como solicitud de renovacion CON_CAMBIOS para revision del ADMIN.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Building2,
  MapPin,
  Phone,
  Mail,
  Briefcase,
  Award,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { renovacionService, type RenovacionReceipt } from '../../services/renovacion.service';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/api-error';
import { useAdmissionContext } from '../../hooks/useAdmissionContext';
import { useRecoverableForm } from '../../hooks/useRecoverableForm';
import { DraftConflictNotice } from '../../components/DraftConflictNotice';
import { BrandSpinner } from '../../components/ui/LoadingState';
import type { Renovacion } from '../../types/api';

// Field definitions per actor type
interface FieldDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  type?: 'text' | 'email' | 'tel';
}

const GENERADOR_FIELDS: FieldDef[] = [
  { key: 'razonSocial', label: 'Razón social', icon: <Building2 size={14} /> },
  { key: 'domicilio', label: 'Domicilio', icon: <MapPin size={14} /> },
  { key: 'telefono', label: 'Teléfono', icon: <Phone size={14} />, type: 'tel' },
  { key: 'email', label: 'Correo electrónico', icon: <Mail size={14} />, type: 'email' },
  { key: 'actividad', label: 'Actividad', icon: <Briefcase size={14} /> },
  { key: 'rubro', label: 'Rubro', icon: <Briefcase size={14} /> },
  { key: 'corrientesControl', label: 'Corrientes de control', icon: <AlertTriangle size={14} /> },
  { key: 'categoria', label: 'Categoría', icon: <Award size={14} /> },
  { key: 'numeroInscripcion', label: 'Número de inscripción', icon: <Award size={14} /> },
];

const OPERADOR_FIELDS: FieldDef[] = [
  { key: 'razonSocial', label: 'Razón social', icon: <Building2 size={14} /> },
  { key: 'domicilio', label: 'Domicilio', icon: <MapPin size={14} /> },
  { key: 'telefono', label: 'Teléfono', icon: <Phone size={14} />, type: 'tel' },
  { key: 'email', label: 'Correo electrónico', icon: <Mail size={14} />, type: 'email' },
  { key: 'tipoOperador', label: 'Tipo de operador', icon: <Briefcase size={14} /> },
  { key: 'tecnologia', label: 'Tecnología', icon: <Briefcase size={14} /> },
  { key: 'corrientesY', label: 'Corrientes Y', icon: <AlertTriangle size={14} /> },
  { key: 'categoria', label: 'Categoría', icon: <Award size={14} /> },
  { key: 'numeroHabilitacion', label: 'Número de habilitación', icon: <Award size={14} /> },
];

type ChangeDraft = { year: number; base: Record<string, string>; values: Record<string, string> };
const normalize = (actor: Record<string, unknown>, fields: FieldDef[]) => Object.fromEntries(fields.map(field => [field.key, actor[field.key] == null ? '' : String(actor[field.key])]));
const validDraft = (fields: FieldDef[]) => (value: unknown): value is ChangeDraft => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const d = value as ChangeDraft;
  const record = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === fields.length && fields.every(f => typeof (v as Record<string, unknown>)[f.key] === 'string' && String((v as Record<string, unknown>)[f.key]).length <= 2000);
  return Number.isInteger(d.year) && d.year >= 2020 && d.year <= 2100 && record(d.base) && record(d.values);
};

const SolicitarCambiosPage: React.FC = () => {
  const { currentUser, isGenerador, isOperador } = useAuth();
  const { owner } = useAdmissionContext();
  const navigate = useNavigate();
  if (!currentUser?.id || (!isGenerador && !isOperador) || !currentUser.actorId) return <div role="alert" className="space-y-3 rounded-xl border border-warning-200 bg-warning-50 p-4"><h2 className="font-semibold">No hay una ficha disponible para solicitar cambios</h2><p>Esta acción requiere una actividad de generador u operador vinculada a tu cuenta.</p><Button variant="outline" onClick={() => navigate('/mi-perfil')}>Volver a mi perfil</Button></div>;
  return <ChangeRequestLoader key={owner} owner={owner} actorId={currentUser.actorId} role={isGenerador ? 'GENERADOR' : 'OPERADOR'} />;
};

function ChangeRequestLoader({ owner, actorId, role }: { owner: string; actorId: string; role: 'GENERADOR' | 'OPERADOR' }) {
  const navigate = useNavigate();
  const [actor, setActor] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true; setLoading(true); setLoadError(false);
    api.get(`/actores/${role === 'GENERADOR' ? 'generadores' : 'operadores'}/${actorId}`).then(res => {
      if (!current) return;
      const data = res.data.data[role === 'GENERADOR' ? 'generador' : 'operador'] || res.data.data;
      if (!data || data.id !== actorId) throw new Error('La ficha no coincide con tu cuenta');
      setActor(data);
    }).catch(() => { if (current) setLoadError(true); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [actorId, role, attempt]);
  if (loading) return <div role="status" className="flex items-center gap-3 p-4"><BrandSpinner />Cargando datos de tu ficha…</div>;
  if (loadError || !actor) return <div role="alert" className="space-y-3 rounded-xl border border-error-200 bg-error-50 p-4 text-error-800"><p>No se pudieron recuperar los datos del padrón. Tu borrador se conserva; reintentá antes de enviar.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setAttempt(a => a + 1)}>Reintentar precarga</Button><Button variant="outline" onClick={() => navigate('/mi-perfil')}>Volver a mi perfil</Button></div></div>;
  return <ChangeRequestEditor owner={owner} actorId={actorId} role={role} actor={actor} refresh={() => setAttempt(a => a + 1)} />;
}

function ChangeRequestEditor({ owner, actorId, role, actor, refresh }: { owner: string; actorId: string; role: 'GENERADOR' | 'OPERADOR'; actor: Record<string, unknown>; refresh: () => void }) {
  const navigate = useNavigate();
  const fields = role === 'GENERADOR' ? GENERADOR_FIELDS : OPERADOR_FIELDS;
  const currentValues = useMemo(() => normalize(actor, fields), [actor, fields]);
  const draft = useRecoverableForm<ChangeDraft>('sitrep:profile-change:v1:' + owner, { year: new Date().getFullYear(), base: currentValues, values: currentValues }, validDraft(fields));
  const { values, base, year } = draft.value;
  const changedKeys = fields.map(f => f.key).filter(key => values[key] !== base[key]);
  const registryChanged = fields.some(f => currentValues[f.key] !== base[f.key]);
  const [submitting, setSubmitting] = useState(false), [submitted, setSubmitted] = useState<Renovacion | null>(null);
  const [sendError, setSendError] = useState<string | null>(null), [confirmedCount, setConfirmedCount] = useState(0);
  const inFlight = useRef(false), active = useRef(true), feedback = useRef<HTMLDivElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (submitted || sendError) feedback.current?.focus(); }, [submitted, sendError]);
  const [receipt, setReceipt] = useState<RenovacionReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(true), [receiptError, setReceiptError] = useState(false), [receiptAttempt, setReceiptAttempt] = useState(0);
  useEffect(() => {
    let current = true; setReceiptLoading(true); setReceiptError(false);
    renovacionService.getOwn(year).then(result => {
      if (!current) return;
      if (result !== null && (!result?.id || result.anio !== year || result.tipoActor !== role || !['PENDIENTE', 'APROBADA', 'RECHAZADA'].includes(result.estado))) throw new Error('La solicitud no corresponde al contexto consultado');
      setReceipt(result);
    }).catch(() => { if (current) setReceiptError(true); }).finally(() => { if (current) setReceiptLoading(false); });
    return () => { current = false; };
  }, [year, role, receiptAttempt]);
  useEffect(() => { if (receipt && !receiptLoading) feedback.current?.focus(); }, [receipt, receiptLoading]);
  const rebase = (keep: boolean) => draft.update({ year, base: currentValues, values: keep ? { ...currentValues, ...Object.fromEntries(changedKeys.map(key => [key, values[key]])) } : currentValues });
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (receiptLoading || receiptError || receipt || inFlight.current || !changedKeys.length || registryChanged || draft.conflict || draft.error) return;
    const written = draft.update(draft.value);
    if (!written.saved || written.conflict) return;
    inFlight.current = true; setSubmitting(true); setSendError(null);
    const datosNuevos = Object.fromEntries(changedKeys.map(key => [key, values[key]]));
    try {
      const result = await renovacionService.create({ anio: year, tipoActor: role, generadorId: role === 'GENERADOR' ? actorId : undefined, operadorId: role === 'OPERADOR' ? actorId : undefined, modalidad: 'CON_CAMBIOS', datosNuevos, camposModificados: Object.keys(datosNuevos) });
      if (!active.current) return;
      if (!result?.id || !['PENDIENTE', 'APROBADA', 'RECHAZADA'].includes(result.estado)) throw new Error('No recibimos una confirmación válida');
      setConfirmedCount(changedKeys.length); setSubmitted(result); draft.acknowledge();
    } catch (error) {
      if (!active.current) return;
      const status = (error as { response?: { status?: number } })?.response?.status;
      const rejected = !!status && status >= 400 && status < 500;
      const message = rejected ? getApiErrorMessage(error, 'No se pudo aceptar la solicitud. Revisá tu propuesta antes de enviarla.') : 'No pudimos confirmar el envío. Conservamos tu propuesta; reintentar la misma recupera la solicitud si ya fue recibida, sin duplicarla.';
      setSendError(message);
      toast.error(rejected ? 'No se envió la solicitud' : 'Envío sin confirmar', message);
    } finally {
      inFlight.current = false; if (active.current) setSubmitting(false);
    }
  };
  if (submitted) return <div ref={feedback} tabIndex={-1} role="status" className="mx-auto max-w-[960px] space-y-4 rounded-xl border border-primary-200 bg-primary-50 p-6 text-primary-950">
    <CheckCircle size={32} aria-hidden="true" /><h2 className="text-xl font-semibold">Solicitud registrada</h2>
    <p>{submitted.estado === 'PENDIENTE' ? 'Administración debe revisar tu propuesta. Los datos de la ficha todavía no cambiaron.' : submitted.estado === 'APROBADA' ? 'Esta solicitud ya fue aprobada. Consultá los datos actualizados de tu ficha.' : 'Esta solicitud ya fue rechazada. Consultá el resultado recibido antes de presentar otros cambios.'}</p>
    <p className="text-sm [overflow-wrap:anywhere]">Referencia {submitted.id} · Período {submitted.anio} · {confirmedCount} {confirmedCount === 1 ? 'campo propuesto' : 'campos propuestos'}</p>
    {submitted.motivoRechazo && <p>Motivo: {submitted.motivoRechazo}</p>}
    {(draft.error || draft.conflict) && <div role="alert" className="space-y-2"><p>El servidor confirmó la solicitud, pero no pudimos limpiar la copia local. No hace falta enviarla de nuevo.</p><Button variant="outline" onClick={() => draft.acknowledge()}>Reintentar limpieza local</Button></div>}
    <Button onClick={() => navigate('/mi-perfil')}>Volver a mi perfil</Button>
  </div>;
  if (receiptLoading) return <div role="status" className="flex items-center gap-3 p-4"><BrandSpinner />Consultando la solicitud de este período…</div>;
  if (receiptError) return <div role="alert" className="mx-auto max-w-[960px] space-y-3 rounded-xl border border-warning-200 bg-warning-50 p-4"><p>No pudimos consultar si ya hay una solicitud presentada. Tu borrador se conserva; reintentá antes de enviar.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setReceiptAttempt(a => a + 1)}>Reintentar consulta</Button><Button variant="outline" onClick={() => navigate('/mi-perfil')}>Volver a mi perfil</Button></div></div>;
  if (receipt) {
    let registered: Record<string, unknown> | null = null;
    try { const data = JSON.parse(receipt.datosNuevos || '{}'); if (data && typeof data === 'object' && !Array.isArray(data)) registered = data; } catch { /* Display the receipt even if a historical proposal cannot be parsed. */ }
    const proposed = Object.fromEntries(changedKeys.map(key => [key, values[key].trim()]));
    const canonical = (data: Record<string, unknown>) => JSON.stringify(Object.keys(data).sort().map(key => [key, data[key]]));
    const sameDraft = !!changedKeys.length && !!registered && canonical(proposed) === canonical(registered);
    const title = receipt.estado === 'APROBADA' ? 'Solicitud aprobada' : receipt.estado === 'RECHAZADA' ? 'Solicitud rechazada' : 'Solicitud en revisión';
    return <div ref={feedback} tabIndex={-1} aria-label={title} className="mx-auto w-full max-w-[960px] space-y-4">
      <Card><CardHeader title={title} icon={receipt.estado === 'APROBADA' ? <CheckCircle size={20} /> : receipt.estado === 'RECHAZADA' ? <AlertTriangle size={20} /> : <Clock size={20} />} /><CardContent className="space-y-4">
        <p>{role === 'GENERADOR' ? 'Generador' : 'Operador'} · {String(actor.razonSocial || 'Tu ficha')} · Período {receipt.anio}</p>
        <p>{receipt.estado === 'APROBADA' ? 'Administración aprobó la solicitud. Consultá los datos actualizados en tu perfil.' : receipt.estado === 'RECHAZADA' ? 'Administración rechazó la solicitud. Revisá el motivo y consultá a Administración para presentar una corrección.' : 'Administración debe revisar la solicitud. Los cambios propuestos todavía no se aplicaron.'}</p>
        {receipt.motivoRechazo && <p className="[overflow-wrap:anywhere]">Motivo: {receipt.motivoRechazo}</p>}
        <p className="text-sm text-neutral-600 [overflow-wrap:anywhere]">Referencia {receipt.id}</p>
        <details><summary className="flex min-h-11 cursor-pointer items-center font-medium text-primary-800">Ver cambios presentados</summary>{registered ? <dl className="space-y-2 py-2">{fields.filter(f => Object.hasOwn(registered!, f.key)).map(f => <div key={f.key}><dt className="text-sm font-medium">{f.label}</dt><dd className="[overflow-wrap:anywhere]">{String(registered![f.key] ?? 'Sin declarar')}</dd></div>)}{!Object.keys(registered).length && <p>Solicitud sin cambios de datos.</p>}</dl> : <p>No se pudieron mostrar los datos históricos. El estado de la solicitud sí fue confirmado.</p>}</details>
        <p className="text-sm text-neutral-600">Ya hay una solicitud de este período. No se envía otra al volver a esta pantalla.</p>
        <div className="flex flex-wrap gap-3"><Button onClick={() => navigate('/mi-perfil')}>Volver a mi perfil</Button><Button variant="outline" onClick={() => setReceiptAttempt(a => a + 1)}>Actualizar resultado</Button></div>
      </CardContent></Card>
      {(changedKeys.length > 0 || draft.conflict) && <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4" aria-label="Borrador local conservado"><h3 className="font-semibold">Borrador local conservado</h3><p>{sameDraft ? 'Tu borrador coincide con la solicitud registrada. No hace falta volver a enviarlo.' : 'Tu borrador local es diferente de la solicitud presentada. Lo conservamos en este dispositivo sin enviarlo ni reemplazar la solicitud.'}</p>{changedKeys.map(key => <div key={key}><p className="text-sm font-medium">{fields.find(f => f.key === key)?.label}</p><p className="[overflow-wrap:anywhere]">{values[key]}</p></div>)}{draft.conflict && <p>También hay versiones guardadas de otras pestañas; esta consulta no las modifica.</p>}</section>}
    </div>;
  }
  return <div className="mx-auto w-full max-w-[960px] space-y-6">
    <div className="flex items-start gap-3"><Button variant="ghost" aria-label="Volver a mi perfil" onClick={() => navigate('/mi-perfil')}><ArrowLeft size={18} /></Button><div><h2 className="text-xl font-semibold">Solicitar cambios de tu ficha</h2><p className="text-sm text-neutral-600">{role === 'GENERADOR' ? 'Generador' : 'Operador'} · Período {year}. Administración revisa antes de aplicar los cambios.</p></div></div>
    {draft.conflict && <DraftConflictNotice durable={draft.conflictSaved} count={draft.conflictCount} onReload={draft.reload} onKeep={draft.overwrite} />}
    {draft.error && <div role="alert" className="space-y-2 rounded-lg bg-warning-50 p-3 text-warning-900"><p>No pudimos guardar el borrador en este dispositivo. Mantené esta pantalla abierta y reintentá antes de enviar.</p><Button variant="outline" onClick={() => draft.update(draft.value)}>Reintentar guardado</Button></div>}
    {registryChanged && <div role="alert" className="space-y-3 rounded-lg border border-warning-300 bg-warning-50 p-4"><h3 className="font-semibold">La ficha cambió desde que preparaste esta propuesta</h3><p>Compará los valores actuales y elegí cómo continuar. No se envía nada al elegir.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => rebase(true)} disabled={draft.conflict}>Conservar mis cambios</Button><Button variant="outline" onClick={() => rebase(false)} disabled={draft.conflict}>Usar datos actuales</Button></div></div>}
    {sendError && <div ref={feedback} tabIndex={-1} role="alert" className="rounded-lg bg-error-50 p-3 text-error-900">{sendError}</div>}
    <Card><CardHeader title={String(actor.razonSocial || 'Datos de la ficha')} icon={<Building2 size={18} />} /><CardContent>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p role="status" className="text-sm text-neutral-600">{draft.saved && !draft.conflict && !draft.error ? 'Borrador guardado en este dispositivo.' : 'Los cambios se envían sólo al confirmar.'}</p>
        {draft.restored && <p className="text-sm text-primary-800">Recuperamos tu propuesta. Revisá los valores antes de enviarla.</p>}
        {fields.map(field => <div key={field.key}>
          <div className="mb-1.5 flex items-center gap-2"><span aria-hidden="true" className="text-neutral-500">{field.icon}</span><label htmlFor={`profile-change-${field.key}`} className="text-sm font-medium text-neutral-700">{field.label}</label>{changedKeys.includes(field.key) && <Badge variant="soft" color="warning" size="sm">Modificado</Badge>}</div>
          <Input id={`profile-change-${field.key}`} type={field.type || 'text'} maxLength={2000} value={values[field.key] || ''} disabled={submitting} onChange={event => { setSendError(null); draft.update(d => ({ ...d, values: { ...d.values, [field.key]: event.target.value } })); }} aria-describedby={changedKeys.includes(field.key) || registryChanged ? `profile-current-${field.key}` : undefined} />
          {(changedKeys.includes(field.key) || registryChanged) && <p id={`profile-current-${field.key}`} className="mt-1 text-sm text-neutral-600 [overflow-wrap:anywhere]">Valor actual: {currentValues[field.key] || 'Sin declarar'}</p>}
        </div>)}
        <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:flex-wrap sm:justify-end"><Button type="button" variant="outline" disabled={submitting} onClick={refresh}>Actualizar ficha</Button><Button type="button" variant="outline" onClick={() => navigate('/mi-perfil')}>Volver a mi perfil</Button><Button type="submit" isLoading={submitting} disabled={!changedKeys.length || registryChanged || draft.conflict || draft.error} leftIcon={<Save size={16} />}>Enviar solicitud ({changedKeys.length} {changedKeys.length === 1 ? 'cambio' : 'cambios'})</Button></div>
      </form>
    </CardContent></Card>
  </div>;
}

export default SolicitarCambiosPage;

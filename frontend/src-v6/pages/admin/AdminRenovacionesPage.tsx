import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Badge } from '../../components/ui/BadgeV2';
import { Button } from '../../components/ui/ButtonV2';
import { Modal } from '../../components/ui/Modal';
import { NativeSelect } from '../../components/ui/NativeSelect';
import { QueryContent } from '../../components/ui/QueryContent';
import { ReviewPagination } from '../../components/registration/ReviewPagination';
import { AdmissionTabs } from '../../components/registration/AdmissionTabs';
import { DraftConflictNotice } from '../../components/DraftConflictNotice';
import { useRenovaciones, useRenovacion, useAprobarRenovacion, useRechazarRenovacion } from '../../hooks/useRenovaciones';
import { useAdmissionContext } from '../../hooks/useAdmissionContext';
import { useScopedSearchParams } from '../../hooks/useScopedSearchParams';
import { useRecoverableForm } from '../../hooks/useRecoverableForm';
import { ACTOR_NAMES, RENEWAL_STATES, renewalActor, renewalChanges } from '../../utils/admissionReview';
import { getApiErrorMessage } from '../../utils/api-error';
import type { Renovacion } from '../../types/api';

export default function AdminRenovacionesPage() {
  const context = useAdmissionContext();
  return <RenewalList key={context.owner} {...context} />;
}
function RenewalList({ owner, actorType, role }: { owner: string; actorType: string; role: string }) {
  const [params, setParams] = useScopedSearchParams('admin-renewals', ['anio', 'tipoActor', 'estado', 'page', 'revision'], owner);
  const anio = params.get('anio') ?? String(new Date().getFullYear()), tipoActor = actorType || params.get('tipoActor') || '', estado = params.get('estado') || '';
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1), selected = params.get('revision') || '';
  const query = useRenovaciones({ anio: anio ? Number(anio) : undefined, tipoActor: tipoActor || undefined, estado: estado || undefined, page, limit: 20 });
  const change = (key: string, value: string) => setParams(next => { value || key === 'anio' ? next.set(key, value) : next.delete(key); if (key !== 'page' && key !== 'revision') next.delete('page'); return next; });
  const years = Array.from(new Set([new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2, ...(anio ? [Number(anio)] : [])])).sort((a,b) => b-a);
  return <div className="space-y-4">
    <AdmissionTabs active="renovaciones" />
    <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-3">
      <NativeSelect label="Año" value={anio} onChange={v => change('anio', v)}><option value="">Todos los años</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</NativeSelect>
      {!actorType ? <NativeSelect label="Actividad" value={tipoActor} onChange={v => change('tipoActor', v)}><option value="">Todas las actividades</option><option value="GENERADOR">Generador</option><option value="OPERADOR">Operador</option></NativeSelect> : <p className="self-end py-3 text-sm text-neutral-600">{ACTOR_NAMES[actorType]} · tu área de revisión</p>}
      <NativeSelect label="Estado" value={estado} onChange={v => change('estado', v)}><option value="">Todos los estados</option>{Object.entries(RENEWAL_STATES).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}</NativeSelect>
    </div>
    <QueryContent query={query} loading="Cargando renovaciones" error="No pudimos consultar las renovaciones. Tus filtros se conservan." retryLabel="Reintentar renovaciones">
      {!query.data?.items.length && <p className="rounded-xl border border-neutral-200 bg-white p-4">No hay renovaciones con estos filtros.</p>}
      {!!query.data?.items.length && <div className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">{query.data.items.map(r => {
        const status = RENEWAL_STATES[r.estado];
        return <button key={r.id} onClick={() => change('revision', r.id)} aria-label={`Revisar ${renewalActor(r)}, ${r.anio}`} className="grid min-h-11 w-full gap-2 p-4 text-left hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-700 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-center">
          <span className="min-w-0"><span className="block font-semibold text-neutral-900 [overflow-wrap:anywhere]">{renewalActor(r)}</span><span className="block text-sm text-neutral-600">{ACTOR_NAMES[r.tipoActor]} · {r.anio} · {r.modalidad === 'SIN_CAMBIOS' ? 'Sin cambios' : r.modalidad === 'CON_CAMBIOS' ? 'Con cambios' : 'Modalidad sin identificar'}</span></span>
          <span className="space-y-1"><Badge variant="soft" color={status?.color || 'neutral'}>{status?.label || 'Estado no disponible'}</Badge><span className="block text-sm text-neutral-600">{status?.next || 'Consultar el detalle'}</span></span>
          <span className="flex items-center justify-end gap-2 text-sm text-primary-800">Revisar<ArrowRight size={18} aria-hidden="true" /></span>
        </button>;
      })}</div>}
      <ReviewPagination page={page} pages={query.data?.totalPages || 1} total={query.data?.total || 0} onPage={p => change('page', String(p))} />
    </QueryContent>
    {selected && <RenewalReview key={owner + selected} id={selected} owner={owner} role={role} close={() => change('revision', '')} />}
  </div>;
}
export function RenewalReview({ id, owner, role, close }: { id: string; owner: string; role: string; close: () => void }) {
  const query = useRenovacion(id), approve = useAprobarRenovacion(), reject = useRechazarRenovacion();
  const running = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error || success) feedback.current?.focus(); }, [error, success]);
  const act = async (decision: 'approve' | 'reject', reason: string, confirmed: () => void) => {
    const r = query.data;
    if (running.current || query.isFetching || query.isError || !r || r.estado !== 'PENDIENTE' || !(role === 'ADMIN' || role === 'ADMIN_' + r.tipoActor)) return;
    if (decision === 'approve' && !renewalChanges(r).valid) return;
    if (decision === 'reject' && reason.trim().length < 3) return;
    running.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      if (decision === 'approve') await approve.mutateAsync({ id }); else await reject.mutateAsync({ id, motivoRechazo: reason.trim() });
      confirmed();
      setSuccess(decision === 'approve' ? 'Renovación aprobada. La decisión quedó registrada.' : 'Renovación rechazada. El motivo quedó registrado.');
    } catch (e) { setError(getApiErrorMessage(e, 'No pudimos confirmar la decisión. Consultá el estado actualizado antes de reintentar.')); }
    finally { await query.refetch(); running.current = false; setBusy(false); }
  };
  return <Modal isOpen onClose={close} isBusy={busy} title="Revisar renovación" size="lg">
    <div className="space-y-4">
      {error && <p ref={feedback} tabIndex={-1} role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-900">{error}</p>}
      {success && <p ref={feedback} tabIndex={-1} role="status" className="rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900">{success}</p>}
      <QueryContent query={query} loading="Consultando la renovación" error="No pudimos verificar la renovación. La decisión está bloqueada hasta actualizarla." retryLabel="Actualizar renovación">
        {query.data && <RenewalDecision key={owner + id} renewal={query.data} owner={owner} role={role} busy={busy || query.isFetching} act={act} />}
      </QueryContent>
    </div>
  </Modal>;
}
function RenewalDecision({ renewal: r, owner, role, busy, act }: { renewal: Renovacion; owner: string; role: string; busy: boolean; act: (decision: 'approve' | 'reject', reason: string, confirmed: () => void) => Promise<void> }) {
  const draft = useRecoverableForm('sitrep:renewal-review:v1:' + owner + ':' + r.id, '', (v): v is string => typeof v === 'string' && v.length <= 2000);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(draft.value ? 'reject' : null);
  const actionPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (decision) actionPanel.current?.querySelector<HTMLElement>(decision === 'reject' ? 'textarea' : 'button')?.focus();
  }, [decision]);
  const status = RENEWAL_STATES[r.estado], changes = renewalChanges(r);
  const canDecide = r.estado === 'PENDIENTE' && (role === 'ADMIN' || role === 'ADMIN_' + r.tipoActor);
  return <div className="space-y-4">
    <div><h2 className="font-semibold text-lg [overflow-wrap:anywhere]">{renewalActor(r)}</h2><p className="text-sm text-neutral-600">{ACTOR_NAMES[r.tipoActor]} · {r.anio} · CUIT {r.generador?.cuit || r.operador?.cuit || 'no disponible'}</p><Badge variant="soft" color={status?.color || 'neutral'}>{status?.label || 'Estado no disponible'}</Badge></div>
    <section aria-label="Cambios propuestos" className="space-y-3">
      <h3 className="font-semibold">Datos de la renovación</h3>
      {r.modalidad === 'SIN_CAMBIOS' && <p className="text-sm">El actor declara que sus datos no cambiaron.</p>}
      {!changes.valid && <p role="alert" className="rounded-lg bg-warning-50 p-3 text-sm text-warning-900">No podemos interpretar los cambios de esta solicitud. No se puede aprobar hasta revisar sus datos.</p>}
      {changes.rows.length > 0 && <><p className="text-sm text-neutral-600">Comparación con los datos al presentar la renovación.</p><dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">{changes.rows.map(row => <div key={row.key} className="space-y-2 p-3"><dt className="font-medium">{row.label}</dt><dd className="grid gap-3 sm:grid-cols-2"><div className="min-w-0 text-sm [overflow-wrap:anywhere]"><span className="block text-neutral-600">Al presentar</span>{row.before}</div><div className="min-w-0 rounded-lg bg-primary-50 p-2 text-sm text-primary-900 [overflow-wrap:anywhere]"><span className="block font-medium">Propuesto</span>{row.after}</div></dd></div>)}</dl></>}
    </section>
    {(r.tefAnterior != null || r.tefNuevo != null) && <p className="text-sm">TEF declarada: anterior {r.tefAnterior ?? 'sin declarar'} · nueva {r.tefNuevo ?? 'sin declarar'}</p>}
    {r.observaciones && <div><h3 className="font-medium">Observaciones</h3><p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{r.observaciones}</p></div>}
    {r.motivoRechazo && <div className="rounded-lg bg-error-50 p-3"><h3 className="font-medium text-error-900">Motivo del rechazo</h3><p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{r.motivoRechazo}</p></div>}
    {canDecide && <section ref={actionPanel} className="space-y-3 border-t border-neutral-200 pt-4" aria-label="Decisión de administración">
      <p className="text-sm text-neutral-600">Te corresponde revisar y decidir esta renovación.</p>
      {draft.conflict && <DraftConflictNotice durable={draft.conflictSaved} count={draft.conflictCount} onReload={draft.reload} onKeep={draft.overwrite} />}
      {!decision && <div className="flex flex-wrap gap-2"><Button disabled={busy || !changes.valid || draft.conflict} onClick={() => setDecision('approve')}>Aprobar renovación</Button><Button variant="outline" disabled={busy} onClick={() => setDecision('reject')}>Rechazar con motivo</Button></div>}
      {decision === 'approve' && <div className="space-y-3 rounded-lg border border-primary-200 bg-primary-50 p-3"><p className="text-sm">Al confirmar, se aprobará la renovación de {renewalActor(r)} para {r.anio}{r.modalidad === 'CON_CAMBIOS' ? ' y se aplicarán los cambios propuestos' : ''}.</p><div className="flex flex-wrap gap-2"><Button disabled={busy || !changes.valid || draft.conflict} onClick={() => void act('approve', '', () => { draft.clear(); setDecision(null); })}>Confirmar aprobación</Button><Button variant="outline" disabled={busy} onClick={() => setDecision(null)}>Volver a revisar</Button></div></div>}
      {decision === 'reject' && <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (!draft.conflict) void act('reject', draft.value, () => { draft.clear(); setDecision(null); }); }}>
        <div><label htmlFor="renewal-reason" className="block text-sm font-medium">Motivo del rechazo</label><textarea id="renewal-reason" required minLength={3} maxLength={2000} disabled={busy} rows={4} value={draft.value} onChange={e => draft.update(e.target.value)} aria-describedby="renewal-reason-help" className="mt-1 w-full rounded-lg border border-neutral-300 p-3" /><p id="renewal-reason-help" className="text-sm text-neutral-600">Indicá qué debe corregir el actor. Mínimo 3 caracteres.</p></div>
        <p role="status" className="text-sm text-neutral-600">{draft.error ? 'No pudimos guardar el motivo en este dispositivo. Mantené la pantalla abierta.' : draft.saved ? 'Borrador guardado en este dispositivo. Todavía no enviado.' : 'El motivo se enviará al confirmar.'}</p>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || draft.value.trim().length < 3 || draft.conflict}>Confirmar rechazo</Button><Button variant="outline" disabled={busy} onClick={() => setDecision(null)}>Volver a revisar</Button></div>
      </form>}
    </section>}
  </div>;
}

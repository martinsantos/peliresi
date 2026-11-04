import { useState } from 'react';
import { AlertTriangle, Archive, FileText, Scale } from 'lucide-react';
import { useInspectionMutation } from '../../hooks/useInspecciones';
import { inspeccionService } from '../../services/inspeccion.service';
import { Button } from '../../components/ui/ButtonV2';
import { Card } from '../../components/ui/CardV2';
import { toast } from '../../components/ui/Toast';
import type { InspectionState } from '../../types/inspection';
import { inspectionErrorMessage } from './inspectionPresentation';
import { inspectionLegalFollowUp } from './inspectionProcess';

/** Record an existing administrative transition; never infer receipt or a ruling. */
export function InspectionLegalProgress({ id, state, version, canManage, online, onRecorded }: {
  id: string; state: InspectionState; version: number; canManage: boolean; online: boolean;
  onRecorded?: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [base, setBase] = useState({ state, version });
  const [detail, setDetail] = useState('');
  const progress = inspectionLegalFollowUp(state);
  const mutation = useInspectionMutation(async ({ next, text, expectedVersion }: { next: InspectionState; text: string; expectedVersion: number }) =>
    inspeccionService.transition(id, expectedVersion, next, { detalle: text }), id);
  if (!progress) return null;
  const stale = editing && (base.state !== state || base.version !== version);
  const submit = async () => {
    if (!canManage || !online || stale || !progress.next || mutation.isPending || !detail.trim()) return;
    try {
      await mutation.mutateAsync({ next: progress.next, text: detail.trim(), expectedVersion: base.version });
      await onRecorded?.();
      setDetail(''); setEditing(false);
      toast.success('Seguimiento registrado', 'El estado y la constancia quedaron en el historial del expediente. No se envió una comunicación externa.');
    } catch (error) {
      toast.error('No se pudo registrar', inspectionErrorMessage(error, 'Actualizá el expediente antes de reintentar. El texto se conserva.'));
    }
  };
  return <Card data-testid="inspection-legal-progress" className="space-y-4">
    <h3 className="flex items-center gap-3 text-lg font-bold text-neutral-900"><span className="rounded-lg bg-primary-50 p-2 text-primary-800"><Scale size={21} aria-hidden="true" /></span>Seguimiento administrativo</h3>
    {progress.legacyAtm ? <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950"><AlertTriangle size={18} aria-hidden="true" className="mt-1 shrink-0" />{progress.detail}</p> : <>
      <ol aria-label="Seguimiento de Legales" className="grid grid-cols-3 gap-2">
        {[{ label: 'Derivación', icon: Scale }, { label: 'Trámite legal', icon: FileText }, { label: 'Finalización', icon: Archive }].map(({ label, icon: Icon }, index) =>
          <li key={label} aria-current={index === progress.step ? 'step' : undefined} className={`flex min-w-0 flex-col items-center gap-2 rounded-lg border p-2 text-center text-xs font-semibold ${index <= progress.step! ? 'border-primary-200 bg-primary-50 text-primary-900' : 'border-neutral-200 bg-neutral-50 text-neutral-600'}`}><Icon size={22} aria-hidden="true" /><span>{label}</span></li>)}
      </ol>
      <p className="text-sm leading-6 text-neutral-600">El inspeccionado puede consultar el estado y las actuaciones de su intercambio. No tiene un requerimiento abierto por esta derivación.</p>
      {canManage && !editing && <Button disabled={!online || mutation.isPending} onClick={() => { setBase({ state, version }); setEditing(true); }}>{progress.action}</Button>}
      {canManage && editing && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label className="block text-sm font-semibold text-neutral-800">{state === 'DERIVADA_LEGALES' ? 'Referencia y constancia del avance (registro interno)' : 'Resumen de la finalización'}<textarea value={detail} onChange={event => setDetail(event.target.value)} maxLength={5000} rows={4} className="mt-2 w-full rounded-lg border border-neutral-300 p-3 text-base font-normal leading-6" placeholder="Registrá lo efectivamente documentado y su referencia; no presumas recepción, resolución ni firmeza." /></label>
        <p className="text-xs leading-5 text-neutral-600">{state === 'DERIVADA_LEGALES' ? 'La constancia se registra en el historial interno. El nuevo estado se puede consultar desde el aviso del requerimiento.' : 'Este resumen queda visible al inspeccionado. Finalizar no acredita por sí solo una sanción ni su firmeza.'}</p>
        {stale && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">El expediente cambió mientras escribías. El texto se conserva. Cancelá y revisá el estado actual antes de preparar otro registro.</p>}
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!online || stale || !detail.trim() || mutation.isPending} isLoading={mutation.isPending}>Confirmar registro</Button><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => { setEditing(false); setDetail(''); }}>Cancelar</Button></div>
      </form>}
    </>}
  </Card>;
}

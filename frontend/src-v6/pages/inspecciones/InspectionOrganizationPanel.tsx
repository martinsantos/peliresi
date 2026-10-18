import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspectionMutation } from '../../hooks/useInspecciones';
import { useCatalogoGeneradores, useCatalogoOperadores, useCatalogoTransportistas } from '../../hooks/useCatalogos';
import { inspectionOperationsService, type InspectionCandidate } from '../../services/inspectionOperations.service';
import type { Inspection, InspectionActorType } from '../../types/inspection';
import { InspectorSelect } from './InspectorSelect';
import { inspectionErrorMessage } from './inspectionPresentation';
import { Button } from '../../components/ui/ButtonV2';

export function InspectionOrganizationPanel({ inspection, admin, disabled, backPath, onPendingChange }: { inspection: Inspection; admin: boolean; disabled: boolean; backPath: string; onPendingChange?: (pending: boolean) => void }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [inspectorId, setInspectorId] = useState('');
  const [date, setDate] = useState('');
  const [changeDate, setChangeDate] = useState(false);
  const [type, setType] = useState<InspectionActorType>('GENERADOR');
  const [actorId, setActorId] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [candidates, setCandidates] = useState<InspectionCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const pending = Boolean(inspectorId || changeDate || actorId || reason);
  useEffect(() => { onPendingChange?.(pending); return () => onPendingChange?.(false); }, [pending, onPendingChange]);
  const discard = () => { setInspectorId(''); setChangeDate(false); setDate(''); setActorId(''); setReason(''); setMessage(''); };
  const findNearby = async () => {
    setSearching(true);
    try {
      const result = await inspectionOperationsService.candidates(inspection.id);
      setCandidates(result.items);
      setMessage(result.limitada ? 'Mostrando una selección de coincidencias cercanas; la búsqueda no es exhaustiva.' : result.items.length ? 'La cercanía no prueba responsabilidad. Seleccioná y confirmá solo si verificaste el vínculo.' : 'No hay coincidencias georreferenciadas en 2 km. Podés buscar en el catálogo.');
    } catch (error) { setMessage(inspectionErrorMessage(error, 'No se pudo buscar. Podés continuar sin identificar.')); }
    finally { setSearching(false); }
  };
  const gen = useCatalogoGeneradores(open && !inspection.tipoActor && type === 'GENERADOR');
  const tra = useCatalogoTransportistas(open && !inspection.tipoActor && type === 'TRANSPORTISTA');
  const ope = useCatalogoOperadores(open && !inspection.tipoActor && type === 'OPERADOR');
  const actors = (type === 'GENERADOR' ? gen.data : type === 'TRANSPORTISTA' ? tra.data : ope.data) || [];
  const mutation = useInspectionMutation(async () => inspectionOperationsService.organize(inspection.id, {
    version: inspection.version, inspectorId: inspectorId || undefined,
    ...(changeDate ? { fechaProgramada: date ? new Date(date).toISOString() : null } : {}),
    ...(actorId && !inspection.tipoActor ? { tipoActor: type, actorId } : {}), motivo: reason,
  }), inspection.id);
  if (!['BORRADOR', 'PLANIFICADA', 'EN_CAMPO'].includes(inspection.estado) || (!admin && inspection.tipoActor)) return null;
  const save = async () => {
    if (reason.trim().length < 3) { setMessage('Indicá el motivo del cambio.'); return; }
    if (!inspectorId && !changeDate && !actorId) { setMessage('Seleccioná la asignación, fecha o sujeto a vincular.'); return; }
    try {
      await mutation.mutateAsync(undefined); discard(); setOpen(false); setMessage('Cambio registrado en la trazabilidad.');
      if (inspectorId && inspectorId !== inspection.inspectorId) navigate(backPath);
    } catch (error) { setMessage(inspectionErrorMessage(error, 'No se confirmó el cambio. Actualizá y reintentá.')); }
  };
  const control = 'mt-2 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm';
  return <section className="border-b border-neutral-200 pb-3">
    <button type="button" aria-expanded={open} className="min-h-11 text-left font-semibold text-primary-800" onClick={() => { setOpen(!open); setMessage(''); }}>{admin ? 'Organizar visita y asignación' : 'Vincular sujeto identificado'}</button>
    {message && <p role="status" className="mt-2 text-sm">{message}</p>}
    {open && <fieldset disabled={disabled || mutation.isPending} className="mt-3 space-y-4">
      {disabled && <p className="text-sm text-amber-900">Guardá los cambios y sincronizá las capturas antes de cambiar la organización.</p>}
      {!inspection.tipoActor && inspection.latitud != null && inspection.longitud != null && <div className="space-y-2"><Button variant="outline" isLoading={searching} onClick={() => void findNearby()}>Buscar coincidencias territoriales · C3</Button><p className="text-xs text-neutral-600">Registro de establecimientos y sedes en 2 km, aun sin manifiestos recientes. No determina propiedad ni responsabilidad.</p>{candidates.map((candidate, index) => <button type="button" key={`${candidate.tipoActor}:${candidate.id}:${index}`} className="block min-h-14 w-full rounded-lg border border-neutral-200 p-3 text-left text-sm" onClick={() => { setType(candidate.tipoActor); setActorId(candidate.id); setMessage(`Seleccionaste ${candidate.razonSocial}. Explicá cómo verificaste el vínculo antes de confirmarlo.`); }}><strong>{candidate.razonSocial}</strong> · {candidate.distanciaMetros} m{!candidate.activo && ' · Registro inactivo'}<span className="block text-xs">{candidate.fuente} · {candidate.domicilio}</span></button>)}</div>}
      {admin && <><InspectorSelect value={inspectorId} onChange={setInspectorId} type={inspection.tipoActor || (actorId ? type : null)} /><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={changeDate} onChange={(e) => setChangeDate(e.target.checked)} />Cambiar fecha programada</label>{changeDate && <label className="block text-sm">Nueva fecha (vacía: dejar sin programar)<input aria-label="Nueva fecha de inspección" className={control} type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></label>}</>}
      {!inspection.tipoActor && <div className="space-y-3"><p className="text-sm text-neutral-600">Podés continuar sin responsable. Si lo identificaste, vinculalo expresamente: el legajo conserva su número y los hechos anteriores.</p><label className="block text-sm">Tipo de sujeto<select className={control} value={type} onChange={(e) => { setType(e.target.value as InspectionActorType); setActorId(''); }}><option value="GENERADOR">Generador</option><option value="TRANSPORTISTA">Transportista</option><option value="OPERADOR">Operador</option></select></label><label className="block text-sm">Sujeto identificado<select className={control} value={actorId} onChange={(e) => setActorId(e.target.value)}><option value="">Continuar sin identificar</option>{actorId && !actors.some((actor) => String(actor.id) === actorId) && <option value={actorId}>{candidates.find((candidate) => candidate.id === actorId && candidate.tipoActor === type)?.razonSocial || "Sujeto seleccionado"}</option>}{actors.map((actor) => <option key={String(actor.id)} value={String(actor.id)}>{String(actor.razonSocial || actor.nombre)}</option>)}</select></label></div>}
      <label className="block text-sm">Motivo del cambio<textarea className="mt-2 w-full rounded-lg border border-neutral-300 p-3" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} /></label>
      {pending && <p role="status" className="text-sm text-amber-900">Estos cambios de organización todavía no están guardados. Confirmalos con conexión; el guardado de campo no los incluye.</p>}
      <div className="flex flex-wrap gap-2"><Button onClick={() => void save()} isLoading={mutation.isPending}>Confirmar organización</Button>{pending && <Button variant="outline" onClick={discard}>Descartar cambios de organización</Button>}</div>
    </fieldset>}
  </section>;
}

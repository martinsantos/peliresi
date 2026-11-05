import { openingValues } from './inspectionOpeningValues';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Pencil, Plus, RotateCw } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { useCatalogoGeneradores, useCatalogoOperadores, useCatalogoTransportistas } from '../../hooks/useCatalogos';
import { useInspectionDraftOwnership } from '../../hooks/useInspectionDraftOwnership';
import { inspeccionService } from '../../services/inspeccion.service';
import { inspectionOpeningKey, readInspectionOpening, writeInspectionOpening, type InspectionOpeningDraft, type InspectionOpeningInput, type InspectionOpeningValues } from '../../services/inspectionOpeningDraft';
import { INSPECTION_TYPES, inspectionNumberExample, type InspectionActorType, type InspectionType } from '../../types/inspection';
import type { InspectionIntake } from '../../types/inspectionIntake';
import { supportRequestContext, supportSessionMatches } from '../../utils/supportSession';
import { InspectionLocationField } from './InspectionLocationField';
import { inspectionLocationSuggestions } from './inspectionLocations';
import { INSPECTION_ACTOR_LABELS, INSPECTION_STATE_LABELS, inspectionErrorMessage } from './inspectionPresentation';
import { InspectorSelect } from './InspectorSelect';

type Props = {
  userId: string; owner: string; role: string; isAdmin: boolean; mobile: boolean; online: boolean;
  initialType: InspectionActorType | ''; initialActor: string; returnState: unknown;
  open: boolean; source: InspectionIntake | null; onOpen: () => void; onClose: () => void;
  /** `banner: false` deja el aviso de apertura guardada a cargo del padre, que lo recibe por `onStateChange`. */
  banner?: boolean; onStateChange?: (state: { available: InspectionOpeningDraft | null; error: string }) => void;
};
const actorType = (value: string): value is InspectionActorType => ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(value);


/** The server remains authoritative. An uncertain opening is replayed with the
 * original bytes and key; no background send or silent replacement is allowed. */
export function InspectionOpening({ userId, owner, role, isAdmin, mobile, online, initialType, initialActor, returnState, open, source, onOpen, onClose, banner = true, onStateChange }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<InspectionOpeningDraft | null>(null);
  const current = useRef<InspectionOpeningDraft | null>(null);
  const [available, setAvailable] = useState<InspectionOpeningDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [actorError, setActorError] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const saved = useRef(true), busy = useRef(false), alive = useRef(true);
  const actorRef = useRef<HTMLSelectElement>(null);
  const context = useRef(supportRequestContext());
  const active = useCallback(() => alive.current && supportSessionMatches(userId) && Boolean(context.current) && context.current === supportRequestContext(), [userId]);
  const seed = () => ({ version: 1 as const, owner, values: openingValues(role, initialType, initialActor, source) });
  const acquire = () => {
    setReady(false); setError(''); setStorageError(''); setConfirmDiscard(false); setActorError(false);
    try {
      if (!active()) throw Error('La sesión cambió. Volvé a abrir Inspecciones desde tu cuenta.');
      const restored = readInspectionOpening(owner);
      const next = restored || seed();
      current.current = next; setDraft(next); setAvailable(restored); saved.current = true;
      // Opening from an antecedent or actor ficha already carries meaningful
      // context, even if the user has not edited another field yet.
      if (!restored && (source || initialActor)) {
        try { writeInspectionOpening(owner, next); setAvailable(next); }
        catch { saved.current = false; setStorageError('No se guardó en este dispositivo. Conservá esta pantalla abierta y reintentá guardar antes de continuar.'); }
      }
      setReady(true);
    } catch (failure) { current.current = null; setDraft(null); setError(failure instanceof Error ? failure.message : 'No pudimos leer la apertura guardada.'); }
  };
  const ownership = useInspectionDraftOwnership(inspectionOpeningKey(owner), open && Boolean(owner), acquire);
  const canWrite = () => active() && ownership.canWrite() && ready;
  const mutation = useMutation({ networkMode: 'always', mutationFn: (input: InspectionOpeningInput) => {
    // React Query may schedule this callback after a role or account change.
    // Check again immediately before the API client binds its credential.
    if (!active() || !ownership.canWrite()) throw Error('La sesión cambió. Reabrí la apertura desde la cuenta correspondiente.');
    return inspeccionService.create(input);
  }, onSuccess: () => {
    // A failed list refresh must not turn a confirmed POST into a rejection.
    void Promise.resolve().then(() => {
      if (!active() || !ownership.canWrite()) return;
      return Promise.allSettled([queryClient.invalidateQueries({ queryKey: ['inspecciones', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['inspecciones', 'operaciones'] })]);
    }).catch(() => undefined);
  } });
  const type = draft?.values.type || initialType || 'GENERADOR';
  const generators = useCatalogoGeneradores(open && type === 'GENERADOR');
  const carriers = useCatalogoTransportistas(open && type === 'TRANSPORTISTA');
  const operators = useCatalogoOperadores(open && type === 'OPERADOR');
  const catalogue = type === 'GENERADOR' ? generators : type === 'TRANSPORTISTA' ? carriers : operators;
  const actorOptions = catalogue.data || [];

  useEffect(() => {
    alive.current = true;
    const refresh = () => {
      if (open || !active()) return;
      try { setAvailable(readInspectionOpening(owner)); setError(''); }
      catch (failure) { setAvailable(null); setError(failure instanceof Error ? failure.message : 'No pudimos leer la apertura guardada.'); }
    };
    refresh();
    window.addEventListener('focus', refresh); window.addEventListener('storage', refresh);
    return () => { alive.current = false; window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, [owner, open, active]);
  useEffect(() => { onStateChange?.({ available, error }); }, [available, error, onStateChange]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!saved.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  const persist = (next: InspectionOpeningDraft | null) => {
    if (!canWrite()) return false;
    current.current = next; setDraft(next); saved.current = false;
    try {
      writeInspectionOpening(owner, next);
      saved.current = true; setAvailable(next); setStorageError('');
      return true;
    } catch {
      setStorageError('No se guardó en este dispositivo. Conservá esta pantalla abierta y reintentá guardar antes de continuar.');
      return false;
    }
  };
  const update = (patch: Partial<InspectionOpeningValues>) => {
    const previous = current.current;
    if (!canWrite() || !previous || previous.command || busy.current) return;
    persist({ ...previous, values: { ...previous.values, ...patch } });
  };
  const close = () => {
    if (busy.current) return;
    if (!saved.current) { setStorageError('No se guardó en este dispositivo. Conservá esta pantalla abierta y reintentá guardar antes de salir.'); return; }
    setReady(false); onClose();
  };
  const openReceipt = (id: string) => navigate(`${mobile ? '/mobile' : ''}/inspecciones/${encodeURIComponent(id)}`, { state: returnState });
  const newOpening = () => {
    if (!canWrite() || !saved.current || !current.current || (current.current.command && current.current.command.status !== 'confirmed' && current.current.command.status !== 'rejected')) return;
    if (!persist(null)) return;
    const next = seed(); current.current = next; setDraft(next); setConfirmDiscard(false); setError(''); setActorError(false);
  };
  const send = async () => {
    const previous = current.current;
    if (!canWrite() || !previous || busy.current || !saved.current) return;
    if (!online || !navigator.onLine) { setError('Sin conexión. No se hizo un nuevo intento; reintentá cuando vuelva la conexión.'); return; }
    let next = previous;
    if (!previous.command) {
      const v = previous.values;
      if (!v.withoutActor && !v.actorId) { setActorError(true); actorRef.current?.focus(); return; }
      let date: string | undefined;
      if (v.fechaProgramada) {
        const parsed = new Date(v.fechaProgramada);
        if (!Number.isFinite(parsed.valueOf())) { setError('Revisá la fecha programada.'); return; }
        date = parsed.toISOString();
      }
      const input: InspectionOpeningInput = { clienteId: crypto.randomUUID(), ...(v.source ? { antecedenteId: v.source.id } : {}),
        tipoInspeccion: v.inspectionType, observaciones: v.description || undefined, tipoActor: v.withoutActor ? null : v.type,
        actorId: v.withoutActor ? null : v.actorId, inspectorId: v.assignedInspector || undefined, numeroActa: v.numeroActa || undefined,
        ubicacion: v.ubicacion || undefined, fechaProgramada: date };
      next = { ...previous, command: { input, attempts: 0, status: 'pending' } };
      if (!persist(next)) return;
    }
    if (!next.command || next.command.status !== 'pending') return;
    const attempt = { ...next, command: { ...next.command, attempts: next.command.attempts + 1 } };
    if (!persist(attempt)) return;
    busy.current = true; setError('');
    try {
      const created = await mutation.mutateAsync(attempt.command.input);
      if (!canWrite()) return;
      if (typeof created?.id !== 'string' || !created.id || typeof created.numero !== 'string' || !created.numero) throw Error('El servidor no confirmó el número del expediente.');
      const confirmed: InspectionOpeningDraft = { ...attempt, command: { ...attempt.command, status: 'confirmed', receipt: { id: created.id, numero: created.numero } } };
      if (!persist(confirmed)) return;
      toast.success('Inspección creada', `${created.numero} · ${INSPECTION_STATE_LABELS[created.estado] || 'Revisá su estado'}.`);
      openReceipt(created.id);
    } catch (failure) {
      if (!canWrite()) return;
      const code = (failure as { response?: { status?: number } })?.response?.status;
      // Only the first explicit validation/authorization response proves that
      // this command has never had an earlier, possibly committed attempt.
      // A 404 can also come from reading the created record after the transaction
      // committed; it never proves that this opening was not applied.
      if (attempt.command.attempts === 1 && code !== undefined && [400, 401, 403, 422].includes(code)) {
        const rejection = inspectionErrorMessage(failure, 'Revisá los datos e intentá nuevamente.');
        persist({ ...attempt, command: { ...attempt.command, status: 'rejected', rejection } });
      } else setError('No pudimos confirmar si se creó. Comprobá el mismo envío; no abras otro expediente para este caso. Si el problema continúa, contactá a soporte.');
    } finally { busy.current = false; }
  };

  const v = draft?.values;
  const command = draft?.command;
  const actorInspection = v ? actorType(v.inspectionType) : true;
  const actorMissing = Boolean(v && !v.withoutActor && v.actorId && !catalogue.isLoading && !catalogue.isError && !actorOptions.some(item => String(item.id) === v.actorId));
  const actorUnavailable = Boolean(v && !v.withoutActor && (catalogue.isLoading || catalogue.isError || actorMissing));
  const availableTypes = (Object.keys(INSPECTION_TYPES) as InspectionType[]).filter(key => isAdmin || !role.startsWith('ADMIN_') || role === `ADMIN_${key}`);
  const stateMessage = command?.status === 'confirmed' ? `Apertura confirmada · ${command.receipt?.numero}` : command?.status === 'rejected' ? 'La apertura no se registró' : command ? 'Envío sin confirmar' : 'Borrador de apertura';
  const primary = command?.status === 'confirmed' ? 'Abrir expediente' : command?.status === 'rejected' ? 'Corregir datos' : command ? 'Comprobar envío' : 'Crear expediente';
  const primaryIcon = command?.status === 'confirmed' ? <ArrowRight size={17} aria-hidden="true" /> : command?.status === 'rejected' ? <Pencil size={17} aria-hidden="true" /> : command ? <RotateCw size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />;
  const primaryAction = () => {
    if (command?.status === 'confirmed' && command.receipt) { openReceipt(command.receipt.id); return; }
    if (command?.status === 'rejected' && draft) { persist({ ...draft, command: undefined }); setError(''); return; }
    void send();
  };

  return <>
    {banner && !open && (available || error) && <div role={error ? 'alert' : 'status'} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-950">
      <p>{error || (available?.command?.status === 'confirmed' ? `Apertura confirmada: ${available.command.receipt?.numero}.` : available?.command ? 'Hay una apertura que necesita confirmación.' : 'Hay una apertura guardada en este dispositivo.')}</p>
      {!error && <Button size="sm" variant="outline" onClick={onOpen}>Continuar apertura</Button>}
    </div>}
    <Modal isOpen={open} onClose={close} title="Nueva inspección" size="lg" closeOnOverlayClick={false} isBusy={mutation.isPending}
      footer={<><Button className="w-full sm:w-auto" variant="outline" disabled={mutation.isPending} onClick={close}>Volver</Button><Button className="w-full sm:w-auto" isLoading={mutation.isPending} leftIcon={primaryIcon} disabled={!canWrite() || !draft || Boolean(storageError) || (!command && actorUnavailable) || (!online && (!command || command.status === 'pending'))} onClick={primaryAction}>{primary}</Button></>}>
      {ownership.status !== 'owned' && <div role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{ownership.status === 'blocked' ? 'Otra pestaña está editando esta apertura. Cerrala y reintentá.' : ownership.status === 'checking' ? 'Comprobando la copia del formulario…' : 'Este navegador no puede proteger la edición entre pestañas. Usá uno compatible.'}{ownership.status === 'blocked' && <Button variant="outline" size="sm" onClick={ownership.retry}>Reintentar</Button>}</div>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-900">{error}</p>}
      {storageError && <div role="alert" className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-900"><p>{storageError}</p><Button variant="outline" size="sm" onClick={() => persist(current.current)}>Reintentar guardado</Button></div>}
      {!online && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Sin conexión. El formulario no se enviará automáticamente; reintentá cuando vuelva la conexión.</p>}
      {draft && (available || command || storageError) ? <div role="status" className="mb-4 rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-950"><p className="font-semibold">{stateMessage}</p><p className="mt-1">{command?.status === 'confirmed' ? storageError ? 'El expediente quedó creado. Guardá la confirmación en este dispositivo para continuar.' : 'El expediente quedó creado. Podés abrirlo o iniciar otro.' : storageError ? 'Los datos siguen en pantalla, pero la copia local no se confirmó.' : command?.status === 'rejected' ? command.rejection : command ? 'Conservamos los datos originales. Comprobá este envío antes de crear otro.' : 'Lo que completes se guarda en este dispositivo.'}</p>
        {command?.status === 'confirmed' && <Button size="sm" variant="outline" className="mt-2" disabled={Boolean(storageError)} onClick={newOpening}>Crear otra inspección</Button>}
        {!command && available && <>{!confirmDiscard ? <button type="button" className="mt-2 min-h-11 font-semibold underline" onClick={() => setConfirmDiscard(true)}>Descartar borrador</button> : <div className="mt-2 flex flex-wrap items-center gap-2"><span>¿Descartar lo cargado?</span><Button variant="outline" size="sm" onClick={() => setConfirmDiscard(false)}>Conservar</Button><Button variant="outline" size="sm" onClick={newOpening}>Sí, descartar</Button></div>}</>}
      </div> : draft && <p className="mb-4 text-sm text-neutral-600">Lo que completes se guarda en este dispositivo.</p>}
      {source && v && v.source?.id !== source.id && <p role="status" className="mb-4 text-sm text-neutral-700">Hay otra apertura guardada. Completala o descartá su borrador antes de usar este antecedente.</p>}
      {v && !v.withoutActor && catalogue.isError && <div role="alert" className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-900"><p>No pudimos consultar los actores. Reintentá para elegir uno.</p><Button variant="outline" size="sm" onClick={() => void catalogue.refetch()}>Reintentar actores</Button></div>}
      {v && !v.withoutActor && catalogue.isLoading && <p role="status" className="mb-4 text-sm text-neutral-600">Consultando actores…</p>}
      {actorMissing && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">El actor guardado no figura en el catálogo actual. Seleccioná otro o actualizá la consulta antes de continuar. <button type="button" className="min-h-11 font-semibold underline" onClick={() => void catalogue.refetch()}>Actualizar actores</button></p>}
      {v && <fieldset disabled={!canWrite() || mutation.isPending || Boolean(command)} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        {v.source && <p className="rounded-lg bg-primary-50 p-3 text-sm text-primary-950 sm:col-span-2">Origen: {v.source.referencia} · {v.source.actorNombre}. El antecedente se vincula al crear el expediente, sin alterar su evidencia.{!v.source.actorId && <span className="mt-2 block">{INSPECTION_ACTOR_LABELS[v.source.tipoActor]} sin alta vinculada · identidad por verificar{v.source.identificacion && <span className="block">Identificación declarada: {v.source.identificacion}</span>}{v.source.domicilio && <span className="block">Domicilio declarado: {v.source.domicilio}</span>}</span>}</p>}
        <label className="text-sm font-semibold text-neutral-800 sm:col-span-2">Tipo de inspección<select disabled={Boolean(v.source)} value={v.inspectionType} onChange={event => { const selected = event.target.value as InspectionType; update({ inspectionType: selected, actorId: '', assignedInspector: '', withoutActor: !actorType(selected), ...(actorType(selected) ? { type: selected } : {}) }); setActorError(false); }} className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal">{availableTypes.map(key => <option key={key} value={key}>{INSPECTION_TYPES[key].label} · {INSPECTION_TYPES[key].serie}</option>)}<option disabled value="D">D · Reservada, pendiente de definición</option></select></label>
        <div className="border-l-2 border-primary-600 pl-3 text-sm sm:col-span-2"><span className="font-semibold text-neutral-800">Legajo automático: </span><code className="text-primary-900">{inspectionNumberExample(v.inspectionType)}</code><p className="mt-1 text-xs text-neutral-600">Ejemplo de formato. Al crear se asigna el siguiente correlativo de este tipo y año.</p></div>
        {(isAdmin || !role.startsWith('ADMIN_')) && <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input disabled={Boolean(v.source)} type="checkbox" checked={v.withoutActor} onChange={event => { update({ withoutActor: event.target.checked, assignedInspector: '' }); setActorError(false); }} />Responsable todavía sin identificar</label>}
        {!v.withoutActor && !actorInspection && <label className="text-sm font-semibold text-neutral-800">Tipo de actor<select value={v.type} onChange={event => update({ type: event.target.value as InspectionActorType, actorId: '' })} className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal">{Object.entries(INSPECTION_ACTOR_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        {!v.withoutActor && <label className={`text-sm font-semibold text-neutral-800 ${actorInspection ? 'sm:col-span-2' : ''}`}>Actor inspeccionado<select ref={actorRef} aria-label="Actor inspeccionado" disabled={Boolean(v.source) || catalogue.isLoading || catalogue.isError} aria-invalid={actorError || undefined} aria-describedby={actorError ? 'inspection-opening-actor-error' : undefined} value={v.actorId} onChange={event => { update({ actorId: event.target.value }); setActorError(false); }} className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal disabled:bg-neutral-50"><option value="">Seleccionar actor…</option>{v.actorId && !actorOptions.some(item => String(item.id) === v.actorId) && <option value={v.actorId}>Actor guardado · datos no disponibles</option>}{actorOptions.map(item => <option key={String(item.id)} value={String(item.id)}>{String(item.razonSocial || item.nombre || item.id)}</option>)}</select>{actorError && <span id="inspection-opening-actor-error" className="mt-1 block text-sm text-error-800">Seleccioná el actor inspeccionado o indicá que aún no está identificado.</span>}</label>}
        {(isAdmin || role.startsWith('ADMIN_')) && <div className="sm:col-span-2"><InspectorSelect creating value={v.assignedInspector} onChange={value => update({ assignedInspector: value })} type={v.withoutActor || !actorInspection ? null : v.type} /></div>}
        {!actorInspection && <label className="text-sm font-semibold text-neutral-800 sm:col-span-2">Descripción inicial<textarea value={v.description} onChange={event => update({ description: event.target.value })} rows={3} maxLength={10000} placeholder="Qué se va a inspeccionar o qué ocurrió. Se puede completar en campo." className="mt-2 w-full rounded-lg border border-neutral-300 p-3 text-base font-normal" /></label>}
        <label className="min-w-0 text-sm font-semibold text-neutral-800">Fecha programada<input type="datetime-local" value={v.fechaProgramada} onChange={event => update({ fechaProgramada: event.target.value })} className="mt-2 h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 font-normal" /></label>
        <label className="text-sm font-semibold text-neutral-800">Número de acta<input maxLength={80} value={v.numeroActa} onChange={event => update({ numeroActa: event.target.value })} placeholder="Opcional · distinto del legajo" className="mt-2 h-11 w-full rounded-lg border border-neutral-300 px-3 font-normal" /></label>
        <InspectionLocationField label="Ubicación prevista" value={v.ubicacion} onChange={value => update({ ubicacion: value })} disabled={mutation.isPending || Boolean(command)} placeholder="Domicilio o referencia" className="sm:col-span-2" options={inspectionLocationSuggestions(v.withoutActor ? undefined : actorOptions.find(item => String(item.id) === v.actorId))} />
      </fieldset>}
    </Modal>
  </>;
}

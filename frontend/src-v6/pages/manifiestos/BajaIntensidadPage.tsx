import { manifestFeatureVisible } from '../../utils/manifestFeatures';
import { inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api, getAccessToken } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { useRecoverableForm } from '../../hooks/useRecoverableForm';
import { useInspectionDraftOwnership, type InspectionDraftOwnershipStatus } from '../../hooks/useInspectionDraftOwnership';
import { DraftConflictNotice } from '../../components/DraftConflictNotice';
import { clearEventualSubmission, emptyEventualDraft, emptyEventualWaste, eventualDraftScope, eventualSubmissionKey, mayReplaceEventualDraft,
  readEventualSubmission, retainEventualDraft, validEventualDraft, writeEventualSubmission,
  type EventualParticipant as Participant, type EventualSlot as Slot, type EventualWaste as Waste, type EventualPayload, type PendingEventualCreate } from '../../services/eventualDraft';
import { clearEventualActionSubmission, emptyEventualActionDraft, eventualActionSubmissionKey, mayReplaceEventualActionDraft, readEventualActionSubmission,
  validEventualActionDraft, writeEventualActionSubmission, type EventualActionBody, type PendingEventualAction } from '../../services/eventualActionDraft';
import { Button } from '../../components/ui/ButtonV2';
import { Card } from '../../components/ui/CardV2';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import SeguimientoExterno from './SeguimientoExterno';
import { Factory, Truck, FlaskConical, Shield, ClipboardList, ClipboardCheck, ChevronRight, RefreshCw } from 'lucide-react';

type Approval = { estado: 'NO_REQUIERE' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'; partes: { parte: string; rol: string; estado: string }[] };
type Entry = {
  id: string; referencia: string; version: number; etapa: string; puedeRegistrar: boolean; puedeResolver: boolean;
  puedeAprobar?: string[]; aprobacion?: Approval;
  datos: { generador: Participant; transportista: Participant; operador?: Participant; patente: string; motivo: string; residuos: Waste[] };
  revisiones: { objetivo: string; estado: string; solicitada: boolean }[];
  eventos: { id: string; tipo: string; nota: string; fecha: string; autorId: string; etapa?: string; parte?: string; residuos?: Waste[]; decision?: string }[];
};
const endpoint = '/manifiestos/baja-intensidad';
const stageLabels: Record<string, string> = { REGISTRADO: 'Registrado', RETIRADO: 'Retirado', RECIBIDO: 'Recibido', TRATADO: 'Tratado' };
const nextStages: Record<string, string> = { REGISTRADO: 'RETIRADO', RETIRADO: 'RECIBIDO', RECIBIDO: 'TRATADO' };
const labels: Record<string, string> = { AVANCE: 'Movimiento registrado', DIFERENCIA: 'Diferencia registrada', SOLICITAR_REVISION: 'Revisión solicitada', RESOLVER: 'Resolución posterior',
  APROBAR_PARTE: 'Aprobación de parte', RECHAZAR_PARTE: 'Rechazo de parte' };
const slotTitles: Record<Slot, string> = { generador: 'Generador', transportista: 'Transportista', operador: 'Operador' };
// Spec v2 §1: the server injects the creator's own slot; an administrator declares all three.
const ownSlot: Record<string, Slot> = { GENERADOR: 'generador', TRANSPORTISTA: 'transportista', OPERADOR: 'operador' };
const creators = ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'ADMIN'];
const approvalLabels: Record<string, string> = { PENDIENTE: 'pendiente', APROBADO: 'aprobado', RECHAZADO: 'rechazado' };
const partLabels: Record<string, string> = { creador: 'Quien lo creó', generador: 'Generador', transportista: 'Transportista', operador: 'Operador' };
const approvalRoles: Record<string, { title: string; Icon: typeof Factory }> = { GENERADOR: { title: 'Generador', Icon: Factory }, TRANSPORTISTA: { title: 'Transporte', Icon: Truck }, OPERADOR: { title: 'Operador', Icon: FlaskConical }, ADMIN: { title: 'Administración', Icon: Shield } };
const decisionLabels: Record<string, string> = { PENDIENTE: 'Pendiente', APROBADA: 'Aprobada', RECHAZADA: 'Rechazada' };

function ParticipantFields({ title, value, external, onChange, onExternalChange }: { title: string; value: Participant; external: Participant; onChange: (v: Participant) => void; onExternalChange: (v: Participant) => void }) {
  const { currentUser } = useAuth();
  const [lookup, setLookup] = useState(!!value.padronId);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const query = useQuery({ queryKey: ['baja-intensidad-participantes', currentUser?.id, inspectionWorkspaceOwner(currentUser), title, submittedSearch], enabled: lookup,
    queryFn: async () => (await api.get(endpoint + '/participantes', { params: { tipo: title.toLowerCase(), q: submittedSearch } })).data.data.participantes as Participant[],
    retry: false, staleTime: 60000 });
  const participants = query.data || [];
  const choices = participants.some(p => p.padronId === value.padronId) || !value.padronId ? participants : [value, ...participants];
  return <fieldset className="space-y-3 min-w-0"><legend className="font-semibold mb-2">{title} · {value.padronId ? 'Del padrón' : 'Sin alta'}</legend>
    <Button type="button" variant="outline" size="sm" onClick={() => {
      if (!lookup) { if (!value.padronId) onExternalChange(value); setLookup(true); }
      else { onChange(external); setLookup(false); }
    }}>{lookup ? title + ' · Usar datos declarados' : title + ' · Buscar en padrón'}</Button>
    {lookup && <div className="space-y-2">
      <Input label={title + ' · Buscar por nombre o CUIT'} value={search} onChange={e => setSearch(e.target.value)} />
      <Button type="button" variant="outline" size="sm" onClick={() => setSubmittedSearch(search)}>Buscar {title.toLowerCase()}</Button>
      <Select label={title + ' del padrón'} value={value.padronId || ''} options={choices.map(p => ({ value: p.padronId!, label: p.nombre + ' · ' + p.identificacion }))}
        onChange={id => { const actor = choices.find(p => p.padronId === id); if (actor) onChange(actor); }}
        placeholder={query.isFetching ? 'Buscando…' : 'Elegir participante'} />
      {query.isError && <p role="alert">No se pudo consultar el padrón. Conservamos los datos declarados.</p>}
    </div>}
    <Input label={title + ' · Nombre o razón social'} readOnly={!!value.padronId} maxLength={500} value={value.nombre} onChange={e => onChange({ ...value, nombre: e.target.value })} />
    <Input label={title + ' · Identificación declarada'} readOnly={!!value.padronId} maxLength={500} placeholder="CUIT o referencia disponible" value={value.identificacion} onChange={e => onChange({ ...value, identificacion: e.target.value })} />
    <Input label={title + ' · Domicilio'} readOnly={!!value.padronId} maxLength={500} value={value.domicilio} onChange={e => onChange({ ...value, domicilio: e.target.value })} />
    {!value.padronId && <><Input label={title + ' · Nombre de fantasía'} maxLength={500} value={value.nombreFantasia || ''} onChange={e => onChange({ ...value, nombreFantasia: e.target.value })} />
      <Input label={title + ' · Teléfono'} type="tel" maxLength={100} value={value.telefono || ''} onChange={e => onChange({ ...value, telefono: e.target.value })} />
      {(!value.nombre.trim() || !value.identificacion.trim() || !value.domicilio.trim() || !value.telefono?.trim()) && <p role="status" className="text-sm text-amber-900">Faltan datos de contacto o identificación. Podés registrar la operación igualmente.</p>}
    </>}
  </fieldset>;
}
function WasteFields({ value, onChange }: { value: Waste; onChange: (v: Waste) => void }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <Input label="Corriente" required pattern="Y[0-9]{1,3}" placeholder="Y1" value={value.corriente} onChange={e => onChange({ ...value, corriente: e.target.value.toUpperCase() })} />
    <Input label="Cantidad" required type="number" min="0.001" step="any" inputMode="decimal" value={value.cantidad || ''} onChange={e => onChange({ ...value, cantidad: Number(e.target.value) })} />
    <label className="text-sm font-medium">Unidad<select className="mt-1 block w-full h-11 border border-neutral-300 rounded-lg px-3 bg-white text-base" value={value.unidad} onChange={e => onChange({ ...value, unidad: e.target.value })}>
      {['kg', 'l', 't', 'm3'].map(unit => <option key={unit}>{unit}</option>)}
    </select></label>
  </div>;
}
function EventualEditingNotice({ status, retry }: { status: InspectionDraftOwnershipStatus; retry: () => void }) {
  if (status === 'owned') return null;
  if (status === 'checking') return <p role="status" className="text-sm text-neutral-600">Preparando la edición segura…</p>;
  return <div role="alert" className="space-y-2 rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-neutral-900">
    {status === 'blocked' ? <>
      <p>Este borrador está abierto en otra pestaña. Cerrala y volvé a comprobar para editar aquí.</p>
      <Button type="button" variant="outline" onClick={retry}>Volver a comprobar</Button>
    </> : <>
      <p>Este navegador no permite proteger la edición entre pestañas. Abrí SITREP en un navegador compatible para continuar.</p>
      <p>Los borradores de este dispositivo no se trasladan automáticamente. Si hay un envío sin confirmar, no lo repitas: conservá este dispositivo y consultá a soporte.</p>
      <Button type="button" variant="outline" onClick={retry}>Volver a comprobar</Button>
    </>}
  </div>;
}
export default function BajaIntensidadPage() {
  const { currentUser } = useAuth();
  const [params] = useSearchParams();
  const owner = currentUser ? eventualDraftScope(inspectionWorkspaceOwner(currentUser), currentUser.id, getAccessToken()) : '';
  const shared = useRef({ owner, cleanupWarning:false, confirmedCreate:null as string | null });
  if (shared.current.owner !== owner) shared.current = { owner, cleanupWarning:false, confirmedCreate:null };
  if (!owner) return <p role="status" className="p-4">Ingresá nuevamente para recuperar tu actividad y sus borradores.</p>;
  return <BajaIntensidadWorkspace key={JSON.stringify([owner,params.get('registro')])} shared={shared.current} />;
}
function BajaIntensidadWorkspace({ shared }: { shared:{ cleanupWarning:boolean; confirmedCreate:string | null } }) {
  const { currentUser } = useAuth();
  const mp = useMobilePrefix();
  const [params, setParams] = useSearchParams();
  const id = params.get('registro');
  const tracking = !id && params.get('vista') === 'seguimiento';
  const search = params.get('buscar') || '', stage = params.get('etapa') || '';
  function changeParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    setParams(next, { replace: !('registro' in changes) && !('vista' in changes) });
  }
  const listPage = Math.max(1, Math.floor(Number(params.get('pagina')) || 1));
  const enabled = manifestFeatureVisible(import.meta.env.VITE_MANIFEST_EXCEPTIONAL_ENABLED, currentUser);
  const owner = inspectionWorkspaceOwner(currentUser);
  const siteLimited = !!currentUser?.empresaContexto && !currentUser.empresaContexto.todasSedes;
  const qc = useQueryClient();
  const queryKey = id ? ['baja-intensidad', currentUser?.id, owner, id] : ['baja-intensidad', currentUser?.id, owner, null, listPage, search, stage];
  const query = useQuery({ queryKey, enabled: enabled && !!currentUser && !tracking && !siteLimited,
    queryFn: async () => (await api.get(id ? endpoint + '/' + id : endpoint, id ? undefined : { params: { page: listPage, search, etapa: stage } })).data.data as { registro?: Entry; registros?: Entry[]; total?: number; page?: number; pageSize?: number },
    retry: false, staleTime: 0, refetchInterval: 5000, refetchIntervalInBackground: false });
  const [creating, setCreating] = useState(false);
  const draftKey = 'sitrep:eventual-form:v1:' + eventualDraftScope(owner, currentUser!.id, getAccessToken());
  const createSync = useRef<() => void>(() => {});
  const createOwnership = useInspectionDraftOwnership('eventual:' + draftKey, enabled && !siteLimited && creating && !id, () => createSync.current());
  const draft = useRecoverableForm(draftKey, emptyEventualDraft(), validEventualDraft,
    { retainExpired: retainEventualDraft, rejectUnreadable: true, canWrite: createOwnership.canWrite });
  createSync.current = draft.synchronize;
  const readSubmission = () => { try { return { pending: readEventualSubmission(draftKey), error: false }; } catch { return { pending: null, error: true }; } };
  const [submission, setSubmission] = useState(readSubmission);
  useEffect(() => {
    const refresh = () => setSubmission(readSubmission());
    const receive = (event: StorageEvent) => { if (event.key === eventualSubmissionKey(draftKey)) refresh(); };
    window.addEventListener('storage', receive); window.addEventListener('focus', refresh);
    return () => { window.removeEventListener('storage', receive); window.removeEventListener('focus', refresh); };
  }, [draftKey]);
  const [discardDraft, setDiscardDraft] = useState(false);
  const [discardAction, setDiscardAction] = useState(false);
  const actionKey = 'sitrep:eventual-action:v1:' + eventualDraftScope(owner, currentUser!.id, getAccessToken()) + ':' + (id || 'lista');
  const actionSync = useRef<() => void>(() => {});
  const actionOwnership = useInspectionDraftOwnership('eventual:' + actionKey, enabled && !siteLimited && !!id, () => actionSync.current());
  const actionDraft = useRecoverableForm(actionKey, emptyEventualActionDraft(), validEventualActionDraft,
    { retainExpired: () => true, rejectUnreadable:true, canWrite: actionOwnership.canWrite });
  actionSync.current = actionDraft.synchronize;
  const readAction = () => { try { return { pending:readEventualActionSubmission(actionKey), error:false }; } catch { return { pending:null, error:true }; } };
  const [actionSubmission, setActionSubmission] = useState(readAction);
  const [autoCheckFailed, setAutoCheckFailed] = useState(false);
  const [confirmedAction, setConfirmedAction] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => setActionSubmission(readAction());
    const receive = (event:StorageEvent) => { if (event.key === eventualActionSubmissionKey(actionKey)) refresh(); };
    window.addEventListener('storage',receive); window.addEventListener('focus',refresh);
    return () => { window.removeEventListener('storage',receive); window.removeEventListener('focus',refresh); };
  },[actionKey]);
  const { nota, residuos:wastes, diferencia:difference } = actionDraft.value;
  const draftVersion = actionDraft.value.version ?? undefined;
  const setNota = (change:React.SetStateAction<string>) => actionDraft.update(v => ({ ...v, nota:typeof change === 'function' ? change(v.nota) : change }));
  const setWastes: React.Dispatch<React.SetStateAction<Waste[]>> = change => { actionDraft.update(v => ({ ...v, residuos:typeof change === 'function' ? change(v.residuos) : change })); };
  const setDifference = (change:React.SetStateAction<boolean>) => actionDraft.update(v => ({ ...v, diferencia:typeof change === 'function' ? change(v.diferencia) : change }));
  const setDraftVersion = (change:React.SetStateAction<number | undefined>) => actionDraft.update(v => {
    const next = typeof change === 'function' ? change(v.version ?? undefined) : change;
    return { ...v, version: next ?? null };
  });
  const [error, setError] = useState('');
  const [recovered, setRecovered] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    setRecovered(shared.cleanupWarning ? 'La operación se guardó. Conservamos las copias locales que no pudimos limpiar; revisalas antes de enviar otra operación.' : '');
    shared.cleanupWarning = false;
  }, []);
  const finishAction = (sent:PendingEventualAction, recoveredFromHistory = false) => {
    setConfirmedAction(sent.id);
    const saved=actionDraft.update(current => {
      if (current.pending?.id !== sent.id) return current;
      const next={ ...current }; delete next.pending;
      if (next.nota === sent.body.nota) next.nota='';
      if (sent.body.tipo === 'DIFERENCIA' && JSON.stringify(next.residuos) === JSON.stringify(sent.body.residuos)) {
        next.diferencia=false; next.residuos=[emptyEventualWaste()];
      }
      if (!next.nota && !next.diferencia) next.version=null;
      return next;
    });
    if (!saved.saved || saved.conflict) setAutoCheckFailed(true);
    try {
      const stored=readEventualActionSubmission(actionKey);
      if (stored?.id === sent.id) clearEventualActionSubmission(actionKey,sent.id);
      setActionSubmission(readAction());
    }
    catch { setAutoCheckFailed(true); setActionSubmission(readAction()); }
    setError('');
    setRecovered(saved.saved && !saved.conflict
      ? recoveredFromHistory ? 'La acción ya estaba guardada. Recuperamos la confirmación sin duplicarla.' : 'La acción quedó registrada.'
      : 'La acción se guardó. Revisá las copias locales antes de continuar.');
  };
  async function send(path: string, body: Record<string, unknown>, created = false, checking = false) {
    const ownership = created ? createOwnership : actionOwnership;
    if (!ownership.canWrite()) return;
    if (lock.current || (created && (draft.error || submission.error || (draft.conflict && !submission.pending)))
      || (!created && (actionDraft.error || actionSubmission.error || (actionDraft.conflict && !actionSubmission.pending)))) return;
    if (!created) setAutoCheckFailed(false);
    lock.current = true; setBusy(true); setError(''); setRecovered('');
    const perform = async () => {
      let pending: PendingEventualCreate | undefined, fresh = false, ownsDraft = false;
      let action: PendingEventualAction | undefined, actionFresh = false;
      if (created) {
        let stored: PendingEventualCreate | null;
        try { stored = readEventualSubmission(draftKey); }
        catch { setSubmission({ pending: null, error: true }); setError('No pudimos leer la referencia del envío. No se envió otra operación.'); return; }
        if (stored && !checking) {
          setSubmission({ pending: stored, error: false });
          setError('Hay un envío sin confirmar. Comprobalo antes de registrar otra operación.'); return;
        }
        if (stored) { pending = stored; ownsDraft = draft.value.pendingCreate?.id === stored.id; }
        else {
        // Build the immutable payload from the latest in-memory draft while
        // holding the cross-tab lock, not from an earlier rendered closure.
        const saved = draft.update(current => {
          pending = current.pendingCreate;
          if (!pending) {
            fresh = true;
            const slots = (['generador', 'transportista', 'operador'] as Slot[]).filter(slot => slot !== ownSlot[currentUser?.rol || '']);
            pending = { id: crypto.randomUUID(), body: structuredClone({ ...Object.fromEntries(slots.map(slot => [slot, current.declared[slot]])),
              patente: current.patente, motivo: current.motivo, residuos: current.residuos }) as EventualPayload };
          }
          return { ...current, pendingCreate: pending };
        });
        if (!saved.saved || saved.conflict || !pending) {
          // An unsent candidate must not be mistaken for a pending request.
          if (fresh) draft.update(current => { const next = { ...current }; if (next.pendingCreate?.id === pending?.id) delete next.pendingCreate; return next; });
          setError('Todavía no se envió. Revisá el borrador y su almacenamiento antes de reintentar.'); return;
        }
        ownsDraft = true;
        try {
          writeEventualSubmission(draftKey, pending);
          setSubmission({ pending, error: false });
        } catch {
          setSubmission(readSubmission());
          setError('No pudimos guardar la referencia del envío. No se envió otra operación.'); return;
        }
        }
      }
      else {
        let stored: PendingEventualAction | null;
        try { stored = readEventualActionSubmission(actionKey); }
        catch { setActionSubmission({ pending:null,error:true }); setError('No pudimos leer la referencia de la acción. No se envió otra.'); return; }
        if (stored && !checking) { setActionSubmission({ pending:stored,error:false }); setError('Hay una acción sin confirmar. Comprobala antes de continuar.'); return; }
        if (stored) action=stored;
        else {
          const saved=actionDraft.update(current => {
            action=current.pending;
            if (!action) { actionFresh=true; action={ id:crypto.randomUUID(), body:structuredClone(body) as EventualActionBody }; }
            return { ...current, version:current.version ?? action.body.version, pending:action };
          });
          if (!saved.saved || saved.conflict || !action) {
            if (actionFresh) actionDraft.update(current => { const next={...current}; if (next.pending?.id === action?.id) delete next.pending; return next; });
            setError('Todavía no se envió. Revisá el borrador y su almacenamiento antes de reintentar.'); return;
          }
          try { writeEventualActionSubmission(actionKey,action); setActionSubmission({ pending:action,error:false }); }
          catch { setActionSubmission(readAction()); setError('No pudimos guardar la referencia de la acción. No se envió otra.'); return; }
        }
      }
      try {
        const result: Entry = (await api.post(path, created ? { ...pending!.body, id: pending!.id } : { ...action!.body, id:action!.id })).data.data.registro;
        if (!alive.current || !ownership.canWrite()) return;
        await qc.cancelQueries({ queryKey: ['baja-intensidad', currentUser?.id, owner] });
        if (!alive.current || !ownership.canWrite()) return;
        // Lists must not retain the shared 60-second cache after an operation or resolution.
        void qc.invalidateQueries({ queryKey: ['baja-intensidad', currentUser?.id, owner], refetchType: 'none' });
        qc.setQueryData(['baja-intensidad', currentUser?.id, owner, result.id], { registro: result });
        if (created) {
          shared.confirmedCreate = pending!.id;
          if (!ownsDraft || !draft.clear()) shared.cleanupWarning = true;
          try { clearEventualSubmission(draftKey, pending!.id); setSubmission({ pending: null, error: false }); }
          catch { shared.cleanupWarning = true; setSubmission(readSubmission()); }
          changeParams({ registro: result.id }); setCreating(false);
        } else {
          finishAction(action!);
        }
      } catch (caught) {
        if (!alive.current || !ownership.canWrite()) return;
        const failure = caught as { response?: { status?: number; data?: { message?: string } } };
        // A later rejection cannot establish whether an earlier attempt committed.
        // Only a validation rejection on the very first attempt permits editing.
        if (created && fresh && [400, 422].includes(failure.response?.status || 0)) {
          try {
            clearEventualSubmission(draftKey, pending!.id); setSubmission({ pending: null, error: false });
            draft.update(current => { const next = { ...current }; delete next.pendingCreate; return next; });
          } catch { setSubmission(readSubmission()); }
        }
        if (!created && actionFresh && [400,409,422].includes(failure.response?.status || 0)) {
          try {
            clearEventualActionSubmission(actionKey,action!.id); setActionSubmission({ pending:null,error:false });
            actionDraft.update(current => { const next={...current}; delete next.pending; return next; });
          } catch { setActionSubmission(readAction()); }
        }
        setError(failure.response?.data?.message || 'No se pudo confirmar. Tus datos siguen aquí; podés reintentar.');
      }
    };
    try {
      if (!navigator.locks?.request) setError('Este navegador no puede proteger el envío entre pestañas. Usá un navegador compatible para continuar; el borrador queda guardado aquí.');
      else await navigator.locks.request('sitrep:eventual-submit:' + (created ? draftKey : actionKey), { mode: 'exclusive', ifAvailable: true }, async grant => {
        if (!alive.current || !ownership.canWrite()) return;
        if (!grant) { setError('Otra pestaña está enviando este borrador. Esperá a que termine y volvé a comprobarlo.'); return; }
        await perform();
      });
    } catch {
      if (alive.current) setError('No pudimos proteger el envío en este navegador. El borrador sigue guardado; reintentá.');
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const entry = query.isError ? undefined : query.data?.registro;
  useEffect(() => {
    const sent=actionSubmission.pending || actionDraft.value.pending;
    if (busy || autoCheckFailed || !entry || !sent || !entry.eventos.some(event => event.id === sent.id) || !navigator.locks?.request || !actionOwnership.canWrite()) return;
    let cancelled=false;
    void navigator.locks.request('sitrep:eventual-submit:' + actionKey,{mode:'exclusive',ifAvailable:true},async grant => {
      if (!grant || cancelled || !alive.current || !actionOwnership.canWrite()) return;
      try {
        const stored=readEventualActionSubmission(actionKey);
        if ((!stored && actionDraft.value.pending?.id === sent.id) || stored?.id === sent.id) finishAction(sent,true);
      }
      catch { if (alive.current) setActionSubmission(readAction()); }
    }).catch(() => { if (alive.current) { setAutoCheckFailed(true); setError('No pudimos comprobar la acción en este navegador.'); } });
    return () => { cancelled=true; };
  },[entry,busy,autoCheckFailed,actionSubmission.pending,actionDraft.value.pending,actionKey,actionOwnership.status]);
  const staleDraft = draftVersion !== undefined && !!entry && draftVersion !== entry.version;
  const beginEdit = () => setDraftVersion(previous => previous ?? entry?.version);
  const actualPage = query.data?.page ?? listPage;
  const formSlots = (['generador', 'transportista', 'operador'] as Slot[]).filter(slot => slot !== ownSlot[currentUser?.rol || '']);
  const creationWastes: React.Dispatch<React.SetStateAction<Waste[]>> = change => draft.update(current => {
    if (current.pendingCreate) return current;
    return { ...current, residuos: typeof change === 'function' ? change(current.residuos) : change };
  });
  const pendingCreate = submission.pending || draft.value.pendingCreate;
  const pendingAction = actionSubmission.pending || actionDraft.value.pending;
  const actionBlocked = actionOwnership.status !== 'owned' || busy || actionDraft.error || actionSubmission.error || actionDraft.conflict || !!pendingAction;
  const hasDraft = draft.saved || draft.restored || draft.conflict || !!pendingCreate || submission.error;
  const approval = entry?.aprobacion && entry.aprobacion.estado !== 'NO_REQUIERE' ? entry.aprobacion : undefined;
  const factsBlocked = approval?.estado === 'PENDIENTE' || approval?.estado === 'RECHAZADO';
  const event = (body: Record<string, unknown>) => {
    if (!entry || staleDraft || actionBlocked) return;
    return send(endpoint + '/' + entry.id + '/eventos', { ...body, version: draftVersion ?? entry.version });
  };
  const wasteInputs = (rows: Waste[], update: React.Dispatch<React.SetStateAction<Waste[]>>) => <div className="space-y-3">{rows.map((waste, index) => <fieldset key={index} className="space-y-2">
    <legend className="text-sm font-semibold mb-2">Residuo {index + 1}</legend>
    <WasteFields value={waste} onChange={value => update(previous => previous.map((row, i) => i === index ? value : row))} />
    {rows.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => update(previous => previous.filter((_, i) => i !== index))}>Quitar residuo {index + 1}</Button>}
  </fieldset>)}
    <Button type="button" variant="outline" disabled={rows.length >= 50} onClick={() => update(previous => [...previous, emptyEventualWaste()])}>Agregar residuo</Button>
  </div>;
  if (!enabled) return <p className="p-6">Circuito no habilitado.</p>;
  if (siteLimited) return <div className="mx-auto max-w-4xl space-y-4 p-4">
    <Link className="inline-flex min-h-11 items-center text-primary-700 underline" to={mp('/manifiestos')}>Volver a Manifiestos</Link>
    <div role="alert" className="rounded-lg border border-warning-200 bg-warning-50 p-4 text-neutral-900">Los eventuales no identifican un establecimiento. Para consultarlos necesitás autorización para todos los establecimientos de la empresa. Pedí a una persona responsable que revise tu acceso.</div>
  </div>;
  if (query.isError && (query.error as { response?: { status?: number } } | null)?.response?.status === 403) return <div className="mx-auto max-w-4xl space-y-4 p-4">
    <Link className="inline-flex min-h-11 items-center text-primary-700 underline" to={mp('/manifiestos')}>Volver a Manifiestos</Link>
    <div role="alert" className="space-y-3 rounded-lg border border-warning-200 bg-warning-50 p-4 text-neutral-900"><p>No podés consultar los eventuales con el contexto actual. Revisá tus permisos o cambiá de empresa.</p><Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div>
  </div>;
  if (id && query.isError && (query.error as { response?: { status?: number } } | null)?.response?.status === 404) return <div className="mx-auto max-w-4xl space-y-4 p-4">
    <div role="alert" className="rounded-lg border border-warning-200 bg-warning-50 p-4 text-neutral-900">El eventual no está disponible para esta actividad. Revisá el contexto actual o volvé a la lista.</div>
    <Button variant="outline" onClick={() => changeParams({ registro: null })}>Volver a Eventuales</Button>
  </div>;
  return <div className="max-w-4xl mx-auto py-5 space-y-4 pb-24">
    <Link className="text-primary-700 underline text-sm" to={mp('/manifiestos')}>Manifiestos</Link>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold text-neutral-900">{id ? 'Detalle del eventual' : creating ? 'Registrar operación' : tracking ? 'Seguimiento de participantes' : 'Registros'}</h2>
      {!id && !tracking && creators.includes(currentUser?.rol || '') && <Button onClick={() => setCreating(v => !v)} variant="outline">{creating ? 'Volver a registros' : hasDraft ? 'Continuar borrador' : 'Registrar operación'}</Button>}
      {id && <Button variant="outline" onClick={() => changeParams({ registro: null })}>Ver registros</Button>}
    </div>
    {!id && !creating && creators.includes(currentUser?.rol || '') && <Button variant="outline" onClick={() => changeParams({ vista: tracking ? null : 'seguimiento' })}>{tracking ? 'Volver a registros' : 'Seguimiento de participantes'}</Button>}
    {tracking && <SeguimientoExterno />}
    <p className="text-sm text-neutral-600">Referencia interna · Sin número oficial. Registrar no implica aprobación ni habilitación.</p>
    {recovered && <p role="status" className="rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900">{recovered}</p>}
    {error && !(pendingAction && error === 'No se pudo confirmar. Tus datos siguen aquí; podés reintentar.') && <div role="alert" className="p-3 bg-error-50 text-error-800 rounded-lg">{error} <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Recargar registro</Button></div>}
    {!tracking && query.isError && <div role="alert">No se pudo cargar el registro. <Button onClick={() => void query.refetch()}>Reintentar</Button></div>}
    {!tracking && query.isLoading && <p role="status">Cargando registros…</p>}
    {creating && !id && <Card><form className="space-y-5" onSubmit={e => { e.preventDefault(); void send(endpoint, {}, true); }}>
      <EventualEditingNotice status={createOwnership.status} retry={createOwnership.retry} />
      {draft.conflict && <DraftConflictNotice durable={draft.conflictSaved} count={draft.conflictCount} onReload={draft.reload}
        canReload={createOwnership.status === 'owned' && (!draft.value.pendingCreate || draft.value.pendingCreate.id === shared.confirmedCreate)}
        canKeep={createOwnership.status === 'owned' && !submission.pending && mayReplaceEventualDraft(draftKey, draft.value.pendingCreate?.id)} onKeep={() => {
          if (!submission.pending && mayReplaceEventualDraft(draftKey, draft.value.pendingCreate?.id)) draft.overwrite();
          else setError('Hay un envío sin confirmar en otra versión. Cargá esa versión antes de continuar.');
        }} />}
      {(draft.error || submission.error) && <div role="alert" className="rounded-lg bg-warning-50 p-3 text-sm text-warning-900 space-y-2"><p>No pudimos leer o guardar el borrador o la referencia del envío en este dispositivo. Conservá esta pantalla abierta y reintentá antes de enviar.</p>
        <Button type="button" variant="outline" disabled={createOwnership.status !== 'owned'} onClick={() => { draft.update(draft.value); setSubmission(readSubmission()); }}>Reintentar guardado</Button></div>}
      {pendingCreate && <div role="status" className="rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900 space-y-2">
        <p>{pendingCreate.id === shared.confirmedCreate
          ? 'La operación ya fue confirmada. Revisá las copias locales antes de continuar.'
          : 'La operación podría haberse guardado. Comprobá el mismo envío antes de modificar los datos; no se creará otra.'}</p>
        {submission.pending && submission.pending.id !== draft.value.pendingCreate?.id && <p className="break-words">Motivo del envío a comprobar: {submission.pending.body.motivo}</p>}
        <Button type="button" disabled={createOwnership.status !== 'owned' || busy || (draft.conflict && !submission.pending) || draft.error || submission.error} onClick={() => void send(endpoint, {}, true, true)}>Comprobar envío</Button>
      </div>}
      {!pendingCreate && (draft.saved || draft.restored) && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-50 px-3 text-sm text-primary-900">
        <p role="status" className="py-2">{draft.restored ? 'Borrador recuperado' : 'Borrador guardado'} · En este dispositivo; todavía no se envió.</p>
        {!discardDraft ? <button type="button" disabled={createOwnership.status !== 'owned'} className="min-h-11 font-semibold underline disabled:opacity-50" onClick={() => setDiscardDraft(true)}>Descartar</button>
          : <div className="flex flex-wrap items-center gap-2 pb-2" role="group" aria-label="Confirmar descarte"><span>¿Borrar lo cargado?</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setDiscardDraft(false)}>Conservar</Button>
            <Button type="button" size="sm" variant="outline" disabled={createOwnership.status !== 'owned'} onClick={() => { if (draft.clear()) setDiscardDraft(false); }}>Sí, descartar</Button></div>}
      </div>}
      {(!submission.pending || submission.pending.id === draft.value.pendingCreate?.id) && <fieldset className="space-y-5 min-w-0" disabled={createOwnership.status !== 'owned' || busy || !!pendingCreate || draft.conflict}>
        <div className="grid sm:grid-cols-2 gap-5">{formSlots.map(slot => <ParticipantFields key={slot} title={slotTitles[slot]} value={draft.value.declared[slot]} external={draft.value.external[slot]}
          onChange={value => draft.update(current => ({ ...current, declared: { ...current.declared, [slot]: value } }))}
          onExternalChange={value => draft.update(current => ({ ...current, external: { ...current.external, [slot]: value } }))} />)}</div>
        <Input label="Patente declarada" maxLength={20} value={draft.value.patente} onChange={e => draft.update(current => ({ ...current, patente: e.target.value }))} />
        {wasteInputs(draft.value.residuos, creationWastes)}
        <Input label="Motivo del registro excepcional" required maxLength={500} value={draft.value.motivo} onChange={e => draft.update(current => ({ ...current, motivo: e.target.value }))} />
        <Button type="submit" disabled={busy || draft.error || submission.error}>Guardar operación</Button>
      </fieldset>}
    </form></Card>}
    {!id && !creating && !tracking && <Card padding="none" className="overflow-hidden">
      <div className="space-y-3 p-4 border-b border-neutral-200">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Buscar eventual" type="search" maxLength={100} placeholder="Referencia, participante, CUIT o patente" value={search} onChange={e => changeParams({ buscar: e.target.value, pagina: null })} />
          <label className="text-sm font-medium">Etapa del eventual<select className="mt-1 block h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base" value={stage} onChange={e => changeParams({ etapa: e.target.value, pagina: null })}>
            <option value="">Todas las etapas</option>{Object.entries(stageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2"><span role="status" className="text-sm text-neutral-600">{query.data?.total ?? '—'} registros · Página {actualPage}</span>
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={16} aria-hidden="true" />} disabled={query.isFetching} onClick={() => void query.refetch()}>Actualizar</Button></div>
      </div>
      <ul className="divide-y divide-neutral-200">{!query.isError && query.data?.registros?.map(row => {
        const pending = row.revisiones.filter(r => r.estado !== 'APROBADA').length;
        const task = row.aprobacion?.estado === 'RECHAZADO' ? 'Operación detenida' : row.puedeAprobar?.length ? 'Te toca aprobar'
          : row.aprobacion?.estado === 'PENDIENTE' ? 'En espera de las partes'
          : row.etapa === 'REGISTRADO' ? 'Listo para registrar el retiro' : stageLabels[row.etapa];
        return <li key={row.id} className="agenda-row-enter"><button aria-label={'Abrir eventual ' + row.referencia} className="flex items-center gap-3 text-left w-full min-h-11 px-4 py-3 hover:bg-primary-50" onClick={() => changeParams({ registro: row.id })}>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold" title={row.datos.generador.nombre}>{row.datos.generador.nombre || 'Generador por identificar'}</span>
            <span className={`block text-sm ${row.puedeAprobar?.length ? 'font-semibold text-primary-800' : 'text-neutral-700'}`}>{task}</span>
            <span className="block text-xs text-neutral-600">{pending} {pending === 1 ? 'revisión posterior pendiente' : 'revisiones posteriores pendientes'}</span>
            <span className="block truncate text-xs text-neutral-600" title={row.referencia}>{row.referencia}</span></span>
          {row.aprobacion && row.aprobacion.estado !== 'NO_REQUIERE' && <span role="group" aria-label="Aprobaciones del eventual" className="flex shrink-0 gap-1">{row.aprobacion.partes.map(part => {
            const { title, Icon } = approvalRoles[part.rol] || { title: partLabels[part.parte], Icon: Shield };
            const text = title + ' · ' + (decisionLabels[part.estado] || part.estado);
            return <span key={part.parte} aria-label={text} title={text} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${part.estado === 'APROBADA' ? 'bg-primary-50 border-primary-200 text-primary-800' : part.estado === 'RECHAZADA' ? 'bg-error-50 border-error-200 text-error-800' : 'bg-neutral-100 border-neutral-200 text-neutral-500'}`}><Icon size={18} aria-hidden="true" /></span>;
          })}</span>}<ChevronRight size={16} aria-hidden="true" className="shrink-0 text-primary-700" />
        </button></li>;
      })}</ul>
      {!query.isError && !query.isLoading && query.data?.total === 0 && <p className="p-4 text-sm text-neutral-600">No hay eventuales para estos filtros.</p>}
      <div className="flex flex-wrap justify-between gap-3 border-t border-neutral-200 p-3">
        <Button variant="outline" disabled={actualPage <= 1 || query.isFetching} onClick={() => changeParams({ pagina: String(actualPage - 1) })}>Anterior</Button>
        <Button variant="outline" disabled={actualPage * 20 >= (query.data?.total ?? 0) || query.isFetching} onClick={() => changeParams({ pagina: String(actualPage + 1) })}>Siguiente</Button>
      </div>
    </Card>}
    {entry && <div className="space-y-4">
      {(entry.puedeRegistrar || entry.puedeResolver || !!entry.puedeAprobar?.length || !!pendingAction) && <EventualEditingNotice status={actionOwnership.status} retry={actionOwnership.retry} />}
      {actionDraft.conflict && <DraftConflictNotice durable={actionDraft.conflictSaved} count={actionDraft.conflictCount} onReload={actionDraft.reload}
        canReload={actionOwnership.status === 'owned' && (!actionDraft.value.pending || actionDraft.value.pending.id === confirmedAction)}
        canKeep={actionOwnership.status === 'owned' && !actionSubmission.pending && mayReplaceEventualActionDraft(actionKey,actionDraft.value.pending?.id)}
        onKeep={() => { if (!actionSubmission.pending && mayReplaceEventualActionDraft(actionKey,actionDraft.value.pending?.id)) actionDraft.overwrite(); }} />}
      {(actionDraft.error || actionSubmission.error) && <div role="alert" className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm">
        No pudimos leer o guardar el borrador o la referencia de la acción. Conservá esta pantalla abierta y reintentá.
        <Button type="button" variant="outline" disabled={actionOwnership.status !== 'owned'} onClick={() => { actionDraft.update(actionDraft.value); setActionSubmission(readAction()); }}>Reintentar guardado</Button>
      </div>}
      {pendingAction && <div role="status" className="rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900 space-y-2">
        <p>{pendingAction.id === confirmedAction ? 'La acción ya fue confirmada. Revisá las copias locales antes de continuar.'
          : 'La acción podría haberse registrado. Comprobá el mismo envío antes de continuar.'}</p>
        {actionSubmission.pending && actionSubmission.pending.id !== actionDraft.value.pending?.id && <p className="break-words">Nota de la acción a comprobar: {actionSubmission.pending.body.nota}</p>}
        <Button type="button" disabled={actionOwnership.status !== 'owned' || busy || actionDraft.error || actionSubmission.error || (actionDraft.conflict && !actionSubmission.pending)}
          onClick={() => void send(endpoint + '/' + entry.id + '/eventos',{},false,true)}>Comprobar acción</Button>
      </div>}
      {!pendingAction && (actionDraft.saved || actionDraft.restored) && (!!nota || difference) && <div role="status" className="rounded-lg bg-primary-50 p-3 text-sm text-primary-900">
        Borrador de acción guardado en este dispositivo; todavía no enviado.
        {!discardAction ? <Button variant="ghost" size="sm" disabled={actionOwnership.status !== 'owned' || actionDraft.conflict || actionDraft.error} onClick={() => setDiscardAction(true)}>Descartar borrador</Button>
          : <span>¿Borrar lo cargado? <Button size="sm" variant="outline" disabled={actionOwnership.status !== 'owned'} onClick={() => { if (actionDraft.clear()) setDiscardAction(false); }}>Sí, descartar</Button>
            <Button size="sm" variant="outline" onClick={() => setDiscardAction(false)}>Conservar</Button></span>}
      </div>}
      {staleDraft && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">El registro cambió mientras escribías. Revisá las novedades; conservamos tu nota y la carga observada. <Button variant="outline" disabled={actionBlocked} onClick={() => { setDraftVersion(entry.version); setError(''); }}>Usar versión actual</Button></div>}
      <Card><p className="text-xs break-all text-neutral-600">{entry.referencia}</p><h2 className="font-bold text-lg mt-2">{entry.datos.generador.nombre || 'Generador por identificar'}</h2>
        <p>{entry.datos.transportista.nombre || 'Transportista por identificar'} · {entry.datos.patente || 'Patente pendiente'}</p>
        {entry.datos.operador && <p>{entry.datos.operador.nombre || 'Operador por identificar'}</p>}
        <p className="font-semibold mt-3" role="status" aria-label="Estado operativo">Operación: {stageLabels[entry.etapa]}</p>
        <p className="text-sm text-amber-900 mt-1">Regularización pendiente · Compatibilidad de corrientes sin verificar</p>
        <h3 className="font-semibold mt-4">Declaración original</h3>
        {entry.datos.residuos.map((r, i) => <p key={i}>{r.corriente} · {r.cantidad} {r.unidad}</p>)}
        <details className="mt-3 text-sm"><summary className="cursor-pointer py-2">Identidades declaradas</summary>
          {[entry.datos.generador, entry.datos.transportista, ...(entry.datos.operador ? [entry.datos.operador] : [])].map((p, i) => <p key={i} className="break-words">{p.nombre} · {p.identificacion} · {p.domicilio} · {p.padronId ? 'Vinculado al padrón' : 'Sin alta'}</p>)}
          <p>{entry.datos.motivo}</p>
        </details>
      </Card>
      {approval && <Card><h2 className="flex items-center gap-2 text-base font-semibold" role="status"><ClipboardList size={20} aria-hidden="true" className="shrink-0 text-primary-700" />Aprobación de las partes: {approvalLabels[approval.estado]}</h2>
        <ul aria-label="Participantes que deben aprobar" className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">{approval.partes.map(p => {
          const { title, Icon } = approvalRoles[p.rol] || { title: partLabels[p.parte], Icon: Shield };
          const own = entry.puedeAprobar?.includes(p.parte);
          return <li key={p.parte} aria-label={`${title} · ${decisionLabels[p.estado]}${own ? ' · Te toca' : ''}`} className={`flex items-center gap-2 rounded-lg border p-2 ${p.estado === 'APROBADA' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : p.estado === 'RECHAZADA' ? 'bg-error-50 border-error-200 text-error-800' : 'bg-neutral-100 border-neutral-200 text-neutral-700'}`}>
            <Icon size={22} aria-hidden="true" className="shrink-0" /><div className="min-w-0 text-xs"><p className="font-semibold">{title}{p.parte === 'creador' ? ' · creador' : ''}</p><p>{decisionLabels[p.estado]}{own ? ' · Te toca' : ''}</p></div>
          </li>;
        })}</ul>
        {approval.estado === 'PENDIENTE' && <div className="text-sm text-amber-900 mt-3"><p className="font-semibold">{entry.puedeAprobar?.length ? 'Te toca aprobar' : 'Esperando aprobaciones'}</p><p>Faltan aprobaciones de las partes para avanzar.</p></div>}
        {approval.estado === 'APROBADO' && entry.etapa === 'REGISTRADO' && entry.puedeRegistrar && <p className="text-sm font-semibold text-primary-800 mt-3">Listo para registrar el retiro</p>}
        {approval.estado === 'RECHAZADO' && <div className="text-sm text-error-800 mt-3"><p className="font-semibold">Operación detenida</p><p>Rechazado por una parte: se conserva como antecedente y no avanza.</p></div>}
        {approval.estado === 'PENDIENTE' && !!entry.puedeAprobar?.length && <div className="flex flex-wrap gap-2 mt-3">{entry.puedeAprobar.map(parte => <React.Fragment key={parte}>
          <Button disabled={actionBlocked || staleDraft} onClick={() => void event({ tipo: 'APROBAR_PARTE', parte, nota })}>Aprobar como {partLabels[parte].toLowerCase()}</Button>
          <Button variant="outline" disabled={actionBlocked || staleDraft || !nota.trim()} onClick={() => void event({ tipo: 'RECHAZAR_PARTE', parte, nota })}>Rechazar como {partLabels[parte].toLowerCase()}</Button>
        </React.Fragment>)}</div>}
      </Card>}
      {(entry.puedeRegistrar || entry.puedeResolver || !!entry.puedeAprobar?.length) && <Input label="Nota de la acción" helperText="Opcional para movimientos; requerida para diferencias y revisiones." maxLength={500} disabled={actionBlocked} value={nota} onChange={e => { beginEdit(); setNota(e.target.value); }} />}
      {entry.puedeRegistrar && <Card><div className="flex flex-wrap gap-3">
        {nextStages[entry.etapa] && <Button disabled={actionBlocked || staleDraft || factsBlocked} onClick={() => void event({ tipo: 'AVANCE', etapa: nextStages[entry.etapa], nota })}>Registrar {stageLabels[nextStages[entry.etapa]].toLowerCase()}</Button>}
        <Button variant="outline" disabled={actionBlocked || factsBlocked} onClick={() => { beginEdit(); setDifference(v => !v); }}>{difference ? 'Cerrar diferencia' : 'Registrar diferencia'}</Button>
      </div>
      {difference && <form className="space-y-3 mt-4" onSubmit={e => { e.preventDefault(); void event({ tipo: 'DIFERENCIA', nota, residuos: wastes }); }}>
        <p className="text-sm">Carga observada completa; no se suma automáticamente al original.</p>
        <fieldset disabled={actionBlocked}>{wasteInputs(wastes, setWastes)}</fieldset><Button type="submit" disabled={actionBlocked || staleDraft || !nota.trim()}>Guardar diferencia</Button>
      </form>}</Card>}
      <Card><h2 className="flex items-center gap-2 text-base font-semibold mb-3"><ClipboardCheck size={20} aria-hidden="true" className="shrink-0 text-primary-700" />Revisión posterior</h2><div className="space-y-4">
        {entry.revisiones.map((review, i) => <section key={review.objetivo} aria-label={i === 0 ? 'Revisión original' : 'Revisión diferencia ' + i} className="border-b border-neutral-200 pb-3 last:border-0">
          <h3 className="font-medium">{i === 0 ? 'Registro original' : 'Diferencia ' + i}</h3>
          <p className="text-sm mb-2">{review.estado === 'APROBADA' ? 'Conformidad aprobada' : review.estado === 'OBSERVADA' ? 'Observada · requiere atención' : review.estado === 'RECHAZADA' ? 'Conformidad rechazada · hechos conservados' : 'Pendiente de conformidad'}{review.solicitada ? ' · Revisión solicitada' : ''}</p>
          <div className="flex flex-wrap gap-2">
            {entry.puedeRegistrar && !factsBlocked && <Button variant="outline" disabled={actionBlocked || staleDraft || !nota.trim()} onClick={() => void event({ tipo: 'SOLICITAR_REVISION', objetivo: review.objetivo, nota })}>Solicitar revisión</Button>}
            {entry.puedeResolver && review.solicitada && <>
              <Button disabled={actionBlocked || staleDraft || !nota.trim()} onClick={() => void event({ tipo: 'RESOLVER', objetivo: review.objetivo, decision: 'APROBADA', nota })}>Aprobar post facto</Button>
              <Button variant="outline" disabled={actionBlocked || staleDraft || !nota.trim()} onClick={() => void event({ tipo: 'RESOLVER', objetivo: review.objetivo, decision: 'OBSERVADA', nota })}>Observar</Button>
              <Button variant="outline" disabled={actionBlocked || staleDraft || !nota.trim()} onClick={() => void event({ tipo: 'RESOLVER', objetivo: review.objetivo, decision: 'RECHAZADA', nota })}>Rechazar conformidad</Button>
            </>}
          </div>
        </section>)}
      </div></Card>
      <Card><h2 className="font-semibold mb-3">Historial</h2><ol className="space-y-3">
        {entry.eventos.map(e => <li key={e.id} className="border-l-2 border-primary-200 pl-3 text-sm">
          <p className="font-medium">{labels[e.tipo]}{e.parte ? ' · ' + partLabels[e.parte] : ''}{e.etapa ? ' · ' + stageLabels[e.etapa] : ''}{e.decision ? ' · ' + e.decision : ''}</p><p className="break-words">{e.nota}</p>
          {e.residuos?.map((r, i) => <p key={i}>{r.corriente} · {r.cantidad} {r.unidad}</p>)}
          <time className="text-neutral-600">{new Date(e.fecha).toLocaleString('es-AR')}</time>
        </li>)}
      </ol></Card>
    </div>}
  </div>;
}

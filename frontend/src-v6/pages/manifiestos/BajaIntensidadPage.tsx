import { manifestFeatureVisible } from '../../utils/manifestFeatures';
import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { Button } from '../../components/ui/ButtonV2';
import { Card } from '../../components/ui/CardV2';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import SeguimientoExterno from './SeguimientoExterno';
import { Factory, Truck, FlaskConical, Shield, ClipboardList, ClipboardCheck, ChevronRight, RefreshCw } from 'lucide-react';

type Waste = { corriente: string; cantidad: number; unidad: string };
type Participant = { nombre: string; identificacion: string; domicilio: string; nombreFantasia?: string; telefono?: string; padronId?: string };
type Slot = 'generador' | 'transportista' | 'operador';
type Approval = { estado: 'NO_REQUIERE' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'; partes: { parte: string; rol: string; estado: string }[] };
type Entry = {
  id: string; referencia: string; version: number; etapa: string; puedeRegistrar: boolean; puedeResolver: boolean;
  puedeAprobar?: string[]; aprobacion?: Approval;
  datos: { generador: Participant; transportista: Participant; operador?: Participant; patente: string; motivo: string; residuos: Waste[] };
  revisiones: { objetivo: string; estado: string; solicitada: boolean }[];
  eventos: { id: string; tipo: string; nota: string; fecha: string; autorId: string; etapa?: string; parte?: string; residuos?: Waste[]; decision?: string }[];
};
const endpoint = '/manifiestos/baja-intensidad';
const emptyActor = (): Participant => ({ nombre: '', identificacion: '', domicilio: '' });
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

function ParticipantFields({ title, value, onChange }: { title: string; value: Participant; onChange: (v: Participant) => void }) {
  const { currentUser } = useAuth();
  const [lookup, setLookup] = useState(false);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const externalDraft = useRef(value);
  const query = useQuery({ queryKey: ['baja-intensidad-participantes', currentUser?.id, title, submittedSearch], enabled: lookup,
    queryFn: async () => (await api.get(endpoint + '/participantes', { params: { tipo: title.toLowerCase(), q: submittedSearch } })).data.data.participantes as Participant[],
    retry: false, staleTime: 60000 });
  const participants = query.data || [];
  const choices = participants.some(p => p.padronId === value.padronId) || !value.padronId ? participants : [value, ...participants];
  return <fieldset className="space-y-3 min-w-0"><legend className="font-semibold mb-2">{title} · {value.padronId ? 'Del padrón' : 'Sin alta'}</legend>
    <Button type="button" variant="outline" size="sm" onClick={() => {
      if (!lookup) { if (!value.padronId) externalDraft.current = value; setLookup(true); }
      else { onChange(externalDraft.current); setLookup(false); }
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
export default function BajaIntensidadPage() {
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
  const qc = useQueryClient();
  const queryKey = id ? ['baja-intensidad', currentUser?.id, id] : ['baja-intensidad', currentUser?.id, null, listPage, search, stage];
  const query = useQuery({ queryKey, enabled: enabled && !!currentUser && !tracking,
    queryFn: async () => (await api.get(id ? endpoint + '/' + id : endpoint, id ? undefined : { params: { page: listPage, search, etapa: stage } })).data.data as { registro?: Entry; registros?: Entry[]; total?: number; page?: number; pageSize?: number },
    retry: false, staleTime: 0, refetchInterval: 5000, refetchIntervalInBackground: false });
  const [creating, setCreating] = useState(false);
  const [declared, setDeclared] = useState<Record<Slot, Participant>>(() => ({ generador: emptyActor(), transportista: emptyActor(), operador: emptyActor() }));
  const [patente, setPatente] = useState('');
  const [motivo, setMotivo] = useState('');
  const [wastes, setWastes] = useState<Waste[]>([{ corriente: '', cantidad: 0, unidad: 'kg' }]);
  const [nota, setNota] = useState('');
  const [draftVersion, setDraftVersion] = useState<number | undefined>();
  const [difference, setDifference] = useState(false);
  const [error, setError] = useState('');
  const [recovered, setRecovered] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => { setNota(''); setDraftVersion(undefined); setDifference(false); setError(''); setRecovered(''); }, [id]);
  // Retained on failed requests. Repeating the same command cannot duplicate facts.
  const request = useRef<{ signature: string; id: string } | undefined>(undefined);
  const creationId = useRef(crypto.randomUUID());
  async function send(path: string, body: Record<string, unknown>, created = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setRecovered('');
    const signature = JSON.stringify({ path, body });
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try {
      const result: Entry = (await api.post(path, { ...body, id: created ? creationId.current : request.current.id })).data.data.registro;
      await qc.cancelQueries({ queryKey: ['baja-intensidad', currentUser?.id] });
      // Lists must not retain the shared 60-second cache after an operation or resolution.
      void qc.invalidateQueries({ queryKey: ['baja-intensidad', currentUser?.id], refetchType: 'none' });
      qc.setQueryData(['baja-intensidad', currentUser?.id, result.id], { registro: result });
      changeParams({ registro: result.id }); setCreating(false); setDifference(false); setNota(''); setDraftVersion(undefined);
      if (created) creationId.current = crypto.randomUUID();
      request.current = undefined;
    } catch (caught) {
      const failure = caught as { response?: { data?: { message?: string } } };
      setError(failure.response?.data?.message || 'No se pudo confirmar. Tus datos siguen aquí; podés reintentar.');
    } finally { lock.current = false; setBusy(false); }
  }
  const entry = query.data?.registro;
  useEffect(() => {
    const sent = request.current;
    if (busy || !sent || !entry?.eventos.some(item => item.id === sent.id)) return;
    // A lost HTTP response is not a failed transaction. Match the exact command ID
    // before acknowledging it; preserve any edits made after the failed response.
    const command = JSON.parse(sent.signature).body as { nota?: string; tipo?: string; residuos?: Waste[] };
    const changedNote = nota !== (command.nota || '');
    const changedLoad = command.tipo === 'DIFERENCIA' && JSON.stringify(wastes) !== JSON.stringify(command.residuos);
    if (!changedNote) setNota('');
    if (command.tipo === 'DIFERENCIA' && !changedLoad) setDifference(false);
    if (!changedNote && !changedLoad) setDraftVersion(undefined); request.current = undefined; setError('');
    setRecovered('La acción ya estaba guardada. Recuperamos la confirmación sin duplicarla.');
  }, [entry, busy, nota, wastes]);
  const staleDraft = draftVersion !== undefined && !!entry && draftVersion !== entry.version;
  const beginEdit = () => setDraftVersion(previous => previous ?? entry?.version);
  const actualPage = query.data?.page ?? listPage;
  const formSlots = (['generador', 'transportista', 'operador'] as Slot[]).filter(slot => slot !== ownSlot[currentUser?.rol || '']);
  const approval = entry?.aprobacion && entry.aprobacion.estado !== 'NO_REQUIERE' ? entry.aprobacion : undefined;
  const factsBlocked = approval?.estado === 'PENDIENTE' || approval?.estado === 'RECHAZADO';
  const event = (body: Record<string, unknown>) => {
    if (!entry || staleDraft) return;
    return send(endpoint + '/' + entry.id + '/eventos', { ...body, version: draftVersion ?? entry.version });
  };
  const wasteInputs = <div className="space-y-3">{wastes.map((waste, index) => <fieldset key={index} className="space-y-2">
    <legend className="text-sm font-semibold mb-2">Residuo {index + 1}</legend>
    <WasteFields value={waste} onChange={value => setWastes(rows => rows.map((row, i) => i === index ? value : row))} />
    {wastes.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => setWastes(rows => rows.filter((_, i) => i !== index))}>Quitar residuo {index + 1}</Button>}
  </fieldset>)}
    <Button type="button" variant="outline" disabled={wastes.length >= 50} onClick={() => setWastes(rows => [...rows, { corriente: '', cantidad: 0, unidad: 'kg' }])}>Agregar residuo</Button>
  </div>;
  if (!enabled) return <p className="p-6">Circuito no habilitado.</p>;
  return <div className="max-w-4xl mx-auto py-5 space-y-4 pb-24">
    <Link className="text-primary-700 underline text-sm" to={mp('/manifiestos')}>Manifiestos</Link>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-bold text-neutral-900">Manifiestos eventuales</h1>
      {!id && !tracking && creators.includes(currentUser?.rol || '') && <Button onClick={() => setCreating(v => !v)} variant="outline">{creating ? 'Volver a registros' : 'Registrar operación'}</Button>}
      {id && <Button variant="outline" onClick={() => changeParams({ registro: null })}>Ver registros</Button>}
    </div>
    {!id && !creating && creators.includes(currentUser?.rol || '') && <Button variant="outline" onClick={() => changeParams({ vista: tracking ? null : 'seguimiento' })}>{tracking ? 'Volver a registros' : 'Seguimiento de participantes'}</Button>}
    {tracking && <SeguimientoExterno />}
    <p className="text-sm text-neutral-600">Referencia interna · Sin número oficial. Registrar no implica aprobación ni habilitación.</p>
    {recovered && <p role="status" className="rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900">{recovered}</p>}
    {error && <div role="alert" className="p-3 bg-error-50 text-error-800 rounded-lg">{error} <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Recargar registro</Button></div>}
    {!tracking && query.isError && <div role="alert">No se pudo cargar el registro. <Button onClick={() => void query.refetch()}>Reintentar</Button></div>}
    {!tracking && query.isLoading && <p role="status">Cargando registros…</p>}
    {creating && !id && <Card><form className="space-y-5" onSubmit={e => { e.preventDefault(); void send(endpoint, { ...Object.fromEntries(formSlots.map(slot => [slot, declared[slot]])), patente, motivo, residuos: wastes }, true); }}>
      <div className="grid sm:grid-cols-2 gap-5">{formSlots.map(slot => <ParticipantFields key={slot} title={slotTitles[slot]} value={declared[slot]}
        onChange={value => setDeclared(current => ({ ...current, [slot]: value }))} />)}</div>
      <Input label="Patente declarada" maxLength={20} value={patente} onChange={e => setPatente(e.target.value)} />
      {wasteInputs}
      <Input label="Motivo del registro excepcional" required maxLength={500} value={motivo} onChange={e => setMotivo(e.target.value)} />
      <Button type="submit" disabled={busy}>Guardar operación</Button>
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
      <ul className="divide-y divide-neutral-200">{query.data?.registros?.map(row => {
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
      {staleDraft && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">El registro cambió mientras escribías. Revisá las novedades; conservamos tu nota y la carga observada. <Button variant="outline" disabled={busy} onClick={() => { setDraftVersion(entry.version); request.current = undefined; setError(''); }}>Usar versión actual</Button></div>}
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
          <Button disabled={busy || staleDraft} onClick={() => void event({ tipo: 'APROBAR_PARTE', parte, nota })}>Aprobar como {partLabels[parte].toLowerCase()}</Button>
          <Button variant="outline" disabled={busy || staleDraft || !nota.trim()} onClick={() => void event({ tipo: 'RECHAZAR_PARTE', parte, nota })}>Rechazar como {partLabels[parte].toLowerCase()}</Button>
        </React.Fragment>)}</div>}
      </Card>}
      {(entry.puedeRegistrar || entry.puedeResolver || !!entry.puedeAprobar?.length) && <Input label="Nota de la acción" helperText="Opcional para movimientos; requerida para diferencias y revisiones." maxLength={500} value={nota} onChange={e => { beginEdit(); setNota(e.target.value); }} />}
      {entry.puedeRegistrar && <Card><div className="flex flex-wrap gap-3">
        {nextStages[entry.etapa] && <Button disabled={busy || staleDraft || factsBlocked} onClick={() => void event({ tipo: 'AVANCE', etapa: nextStages[entry.etapa], nota })}>Registrar {stageLabels[nextStages[entry.etapa]].toLowerCase()}</Button>}
        <Button variant="outline" disabled={factsBlocked} onClick={() => { beginEdit(); setDifference(v => !v); }}>{difference ? 'Cerrar diferencia' : 'Registrar diferencia'}</Button>
      </div>
      {difference && <form className="space-y-3 mt-4" onSubmit={e => { e.preventDefault(); void event({ tipo: 'DIFERENCIA', nota, residuos: wastes }); }}>
        <p className="text-sm">Carga observada completa; no se suma automáticamente al original.</p>
        {wasteInputs}<Button type="submit" disabled={busy || staleDraft || !nota.trim()}>Guardar diferencia</Button>
      </form>}</Card>}
      <Card><h2 className="flex items-center gap-2 text-base font-semibold mb-3"><ClipboardCheck size={20} aria-hidden="true" className="shrink-0 text-primary-700" />Revisión posterior</h2><div className="space-y-4">
        {entry.revisiones.map((review, i) => <section key={review.objetivo} aria-label={i === 0 ? 'Revisión original' : 'Revisión diferencia ' + i} className="border-b border-neutral-200 pb-3 last:border-0">
          <h3 className="font-medium">{i === 0 ? 'Registro original' : 'Diferencia ' + i}</h3>
          <p className="text-sm mb-2">{review.estado === 'APROBADA' ? 'Conformidad aprobada' : review.estado === 'OBSERVADA' ? 'Observada · requiere atención' : review.estado === 'RECHAZADA' ? 'Conformidad rechazada · hechos conservados' : 'Pendiente de conformidad'}{review.solicitada ? ' · Revisión solicitada' : ''}</p>
          <div className="flex flex-wrap gap-2">
            {entry.puedeRegistrar && !factsBlocked && <Button variant="outline" disabled={busy || staleDraft || !nota.trim()} onClick={() => void event({ tipo: 'SOLICITAR_REVISION', objetivo: review.objetivo, nota })}>Solicitar revisión</Button>}
            {entry.puedeResolver && review.solicitada && <>
              <Button disabled={busy || staleDraft || !nota.trim()} onClick={() => void event({ tipo: 'RESOLVER', objetivo: review.objetivo, decision: 'APROBADA', nota })}>Aprobar post facto</Button>
              <Button variant="outline" disabled={busy || staleDraft || !nota.trim()} onClick={() => void event({ tipo: 'RESOLVER', objetivo: review.objetivo, decision: 'OBSERVADA', nota })}>Observar</Button>
              <Button variant="outline" disabled={busy || staleDraft || !nota.trim()} onClick={() => void event({ tipo: 'RESOLVER', objetivo: review.objetivo, decision: 'RECHAZADA', nota })}>Rechazar conformidad</Button>
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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LifeBuoy, Download, UserRoundCheck, LockKeyhole, Search, MessageSquare, ArrowRightLeft, MessageCircleQuestion, CircleCheck, RotateCcw, Tags, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SupportEntry } from '../../components/SupportReportDialog';
import { supportService, supportError } from '../../services/support.service';
import { supportStates, supportCategories, supportTypes, supportPriorities, supportFileAccept, type SupportAction, type SupportTicket, type SupportType, type SupportPriority, type SupportCategory } from '../../types/support';
import { assertSupportSession, supportRequestContext, SupportSessionChangedError, supportSessionMatches } from '../../utils/supportSession';
import { SupportAudioInput } from '../../components/SupportAudioInput';
import { SupportAudioPlayer } from '../../components/SupportAudioPlayer';
import { useSupportCommand } from '../../hooks/useSupportCommand';
import { useSupportActionDraft } from '../../hooks/useSupportActionDraft';
import { emptySupportActionDraft, type SupportActionDraft } from '../../services/supportActionDraft';
import { inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';

const name = (user: { nombre: string; apellido?: string | null }) => [user.nombre, user.apellido].filter(Boolean).join(' ');
const date = (value: string) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Mendoza' }).format(new Date(value));
const actionLabels: Record<SupportAction, string> = { RESPONDER: 'Responder', NOTA: 'Nota interna', DERIVAR: 'Derivar', ESPERAR: 'Pedir respuesta', CERRAR: 'Cerrar', REABRIR: 'Reabrir', TOMAR: 'Tomar ticket', CLASIFICAR: 'Clasificar' };
const submitLabels: Record<SupportAction, string> = { RESPONDER: 'Enviar respuesta', NOTA: 'Guardar nota interna', DERIVAR: 'Confirmar derivación', ESPERAR: 'Solicitar respuesta', CERRAR: 'Cerrar con resolución', REABRIR: 'Reabrir ticket', TOMAR: 'Tomar ticket', CLASIFICAR: 'Guardar clasificación' };
const actionIcons = { RESPONDER: MessageSquare, NOTA: LockKeyhole, DERIVAR: ArrowRightLeft, ESPERAR: MessageCircleQuestion, CERRAR: CircleCheck, REABRIR: RotateCcw, TOMAR: UserRoundCheck, CLASIFICAR: Tags };
function State({ ticket }: { ticket: SupportTicket }) {
  const colors = ticket.estado === 'CERRADO' ? 'bg-neutral-100 text-neutral-700' : ticket.estado === 'ESPERANDO_USUARIO' ? 'bg-warning-50 text-warning-800' : 'bg-primary-50 text-primary-800';
  return <span className={'inline-flex items-center rounded-md px-2 py-1 text-sm font-semibold ' + colors}>{supportStates[ticket.estado]}</span>;
}
export default function SoportePage() {
  const { currentUser } = useAuth();
  const { id } = useParams();
  // A session change must not reuse another user's ticket query or draft.
  const context = inspectionWorkspaceOwner(currentUser);
  return currentUser ? <SupportWorkspace key={context} owner={String(currentUser.id)} context={context} id={id} /> : null;
}
function SupportWorkspace({ owner, context, id }: { owner: string; context: string; id?: string }) {
  const mp = useMobilePrefix();
  const [scope, setScope] = useState<string | null>(null);
  const [state, setState] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [triageFilters, setTriageFilters] = useState({ categoria: '', tipo: '', prioridad: '', clasificado: '' });
  const access = useQuery({ queryKey: ['soporte', owner, context, 'acceso'], queryFn: supportService.access, retry: false });
  const selectedScope = scope || (access.data?.puedeGestionar ? 'mesa' : 'mis');
  const list = useQuery({ queryKey: ['soporte', owner, context, 'lista', selectedScope, state, appliedSearch, page, triageFilters], enabled: !id && access.isSuccess,
    queryFn: () => supportService.list({ scope: selectedScope, estado: state || undefined, search: appliedSearch, page, ...triageFilters }), retry: false, refetchInterval: 30000 });
  const detail = useQuery({ queryKey: ['soporte', owner, context, 'ticket', id], enabled: !!id, queryFn: () => supportService.get(id!), retry: false, refetchInterval: 30000 });
  const [teamOpen, setTeamOpen] = useState(false);
  const detailStatus = (detail.error as { response?: { status?: number } } | null)?.response?.status;
  const accessLost = [401, 403, 404].includes(detailStatus ?? 0);
  return <section aria-label="Soporte de SITREP" className="min-w-0 space-y-5 pb-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="flex items-center gap-2 text-2xl font-bold text-neutral-900"><LifeBuoy size={24} className="shrink-0 text-primary-800" />Soporte</h2>
        {!id && <p className="mt-1 text-sm text-neutral-600">Reportes, respuestas y seguimiento dentro de SITREP. Las respuestas llegan a tu campana de avisos y quedan en el ticket.</p>}</div>
      {!id && <SupportEntry />}
    </div>
    {access.isError && <p role="alert" className="text-error-700">{supportError(access.error)} <Button variant="outline" onClick={() => void access.refetch()}>Reintentar acceso</Button></p>}
    {id ? <>
      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-primary-800 hover:bg-primary-50 focus-visible:outline-primary-700" to={mp('/soporte')}><ArrowLeft size={18} />Volver a tickets</Link>
      {detail.isPending && !detail.data ? <p role="status">Cargando ticket…</p> : detail.isError && (!detail.data || accessLost) ? <div role="alert" className="space-y-3 text-error-700"><p>{supportError(detail.error)}</p><Button variant="outline" onClick={() => void detail.refetch()}>Reintentar ticket</Button></div>
        : detail.data ? <>{detail.isError && <p role="alert" className="text-warning-800">La lectura más reciente falló. Se muestra la última consulta disponible.</p>}
          <TicketDetail key={detail.data.id} ticket={detail.data} owner={owner} context={context} refresh={detail.refetch} /></> : null}
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Vistas de soporte" className="flex flex-wrap gap-1">
          {[['mis', 'Mis tickets'], ...(access.data?.puedeGestionar ? [['mesa', 'Mesa de soporte'], ['asignados', 'A mi cargo']] : [])].map(([value, label]) =>
            <Button key={value} variant={selectedScope === value ? 'primary' : 'outline'} aria-pressed={selectedScope === value} onClick={() => { setScope(value); setPage(1); }}>{label}</Button>)}
        </div>
        {access.data?.puedeConfigurar && <Button variant="outline" aria-expanded={teamOpen} onClick={() => setTeamOpen(value => !value)}>Equipo de soporte</Button>}
      </div>
      {teamOpen && access.data?.puedeConfigurar && <TeamSettings owner={owner} context={context} />}
      <form onSubmit={event => { event.preventDefault(); setAppliedSearch(search); setPage(1); }} className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end">
        <Input label="Buscar por número o asunto" maxLength={180} value={search} onChange={event => setSearch(event.target.value)} />
        <Select label="Estado del ticket" value={state} onChange={value => { setState(value); setPage(1); }} options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(supportStates).map(([value, label]) => ({ value, label }))]} />
        <Button type="submit" variant="outline" leftIcon={<Search size={18} />}>Buscar</Button>
      </form>
      <details className="rounded-lg border border-neutral-200 bg-white p-3"><summary className="min-h-11 cursor-pointer font-medium text-neutral-900">Filtrar triaje</summary>
        <div className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          {([{ key: 'categoria', label: 'Área', values: supportCategories }, { key: 'tipo', label: 'Tipo', values: supportTypes }, { key: 'prioridad', label: 'Prioridad', values: supportPriorities }, { key: 'clasificado', label: 'Clasificación', values: { no: 'Sin clasificar', si: 'Clasificados' } }] as const).map(filter =>
            <Select key={filter.key} label={filter.label} value={triageFilters[filter.key]} onChange={value => { setTriageFilters(previous => ({ ...previous, [filter.key]: value })); setPage(1); }}
              options={[{ value: '', label: 'Todos' }, ...Object.entries(filter.values).map(([value, label]) => ({ value, label }))]} />)}
        </div>
      </details>
      {list.isPending ? <p role="status">Cargando tickets…</p> : list.isError ? <div role="alert" className="space-y-2 text-error-700"><p>{supportError(list.error)}</p><Button variant="outline" onClick={() => void list.refetch()}>Reintentar lista</Button></div> : <>
        <p className="text-sm text-neutral-600" role="status">{list.data.total} {list.data.total === 1 ? 'ticket' : 'tickets'} en esta vista</p>
        {!list.data.items.length ? <p className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-700">No hay tickets que coincidan. Podés reportar un problema desde el botón superior.</p>
          : <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {list.data.items.map(ticket => <li key={ticket.id}><Link to={mp('/soporte/' + ticket.id)} className="grid min-w-0 gap-2 p-4 text-neutral-900 hover:bg-primary-50 active:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-700 md:grid-cols-[8rem_minmax(0,1fr)_12rem]">
              <span className="font-mono text-sm font-semibold text-primary-800">{ticket.referencia}</span>
              <div className="min-w-0"><p className="break-words font-semibold">{ticket.asunto}</p><p className="mt-1 text-sm text-neutral-600">{supportCategories[ticket.categoria]} · {ticket.responsable ? name(ticket.responsable) : 'Sin asignar'}</p>
                <p className="mt-1 text-sm text-neutral-700">{ticket.tipo ? `${supportTypes[ticket.tipo]} · Prioridad ${supportPriorities[ticket.prioridad]}` : 'Sin clasificar'}</p></div>
              <div className="space-y-1"><State ticket={ticket} /><p className="text-sm text-neutral-600">{date(ticket.updatedAt)}</p></div>
            </Link></li>)}
          </ul>}
        {list.data.totalPages > 1 && <nav aria-label="Páginas de tickets" className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</Button><span className="text-sm">Página {page} de {list.data.totalPages}</span>
          <Button variant="outline" disabled={page >= list.data.totalPages} onClick={() => setPage(value => value + 1)}>Siguiente</Button></nav>}
      </>}
    </>}
  </section>;
}
type SupportRefresh = () => Promise<{ data: SupportTicket | undefined; isError: boolean }>;
function TicketDetail({ ticket, owner, context, refresh }: { ticket: SupportTicket; owner: string; context: string; refresh: SupportRefresh }) {
  const mp = useMobilePrefix();
  const query = useQueryClient();
  const [error, setError] = useState('');
  const journal = useSupportCommand({ userId: owner, context, ticketId: ticket.id });
  const [automaticRefresh, setAutomaticRefresh] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');
  const changed = useCallback(async (minimumVersion?: number) => {
    assertSupportSession(owner);
    const requestContext = supportRequestContext();
    if (!requestContext) throw new SupportSessionChangedError();
    await query.invalidateQueries({ queryKey: ['soporte', owner, context], refetchType: 'none' });
    if (!supportSessionMatches(owner) || requestContext !== supportRequestContext()) throw new SupportSessionChangedError();
    const result = await refresh();
    if (!supportSessionMatches(owner) || requestContext !== supportRequestContext()) throw new SupportSessionChangedError();
    if (result.isError || !result.data || result.data.id !== ticket.id) throw new Error('No pudimos actualizar el ticket. Conservamos el resultado; reintentá.');
    if (minimumVersion !== undefined && result.data.version < minimumVersion) throw new Error('El ticket todavía no refleja la acción confirmada. Conservamos el resultado; reintentá.');
  }, [context, owner, query, refresh, ticket.id]);
  const confirmation = journal.command?.status === 'confirmed' ? journal.command : null;
  const confirmedKey = confirmation?.key;
  const confirmedVersion = confirmation?.receipt?.version;
  const unverified = !!confirmation && (!confirmation.receipt || confirmation.receipt.id !== ticket.id
    || !Number.isSafeInteger(confirmedVersion) || ticket.version < confirmation.receipt.version);
  useEffect(() => {
    if (!confirmedKey || journal.busy) return;
    let live = true;
    setAutomaticRefresh('loading');
    const operation = Number.isSafeInteger(confirmedVersion) ? changed(confirmedVersion) : Promise.reject(new Error('Confirmación incompleta'));
    void operation.then(() => { if (live) setAutomaticRefresh('done'); }, () => { if (live) setAutomaticRefresh('failed'); });
    return () => { live = false; };
  }, [changed, confirmedKey, confirmedVersion, journal.busy]);
  const download = async (file: { id: string; nombre: string }) => {
    try {
      assertSupportSession(owner);
      const blob = await supportService.download(ticket.id, file.id);
      assertSupportSession(owner);
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = file.nombre; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (failure) { setError(supportError(failure)); }
  };
  return <article className="space-y-5">
    {unverified && <p role={automaticRefresh === 'failed' ? 'alert' : 'status'} className="rounded-lg bg-warning-50 p-3 text-sm text-warning-900">{automaticRefresh === 'failed' ? 'No pudimos actualizar el ticket. La acción sigue confirmada; reintentá para ver sus datos actuales.' : 'Acción confirmada. Actualizando el ticket…'}</p>}
    <header className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold text-primary-800">{ticket.referencia}</span>{unverified ? <span className="text-sm text-neutral-700">Pendiente de actualización</span> : <State ticket={ticket} />}</div>
      <h3 className="break-words text-xl font-bold text-neutral-900">{ticket.asunto}</h3>
      <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-neutral-600">Reportado por</dt><dd className="font-medium text-neutral-900">{name(ticket.autor)}</dd></div>
        <div><dt className="text-neutral-600">Responsable</dt><dd className="font-medium text-neutral-900">{unverified ? 'Pendiente de actualización' : ticket.responsable ? name(ticket.responsable) : 'Pendiente de asignación'}</dd></div></dl>
      {ticket.registradoPor && <p className="text-sm text-neutral-700">Registrado por {name(ticket.registradoPor)} en nombre de {name(ticket.autor)}.</p>}
      <p className="flex flex-wrap items-center gap-2 text-sm text-neutral-700"><Tags size={16} className="shrink-0" />{ticket.tipo ? `${supportCategories[ticket.categoria]} · ${supportTypes[ticket.tipo]} · Prioridad ${supportPriorities[ticket.prioridad]}` : 'Pendiente de triaje'}</p>
      {ticket.esAutor && <Link to={mp('/notificaciones')} className="inline-flex min-h-11 items-center gap-2 text-sm text-primary-800 hover:underline"><Bell size={16} />Las respuestas llegan a tus avisos</Link>}
      {ticket.contexto.ruta && <p className="text-sm text-neutral-600">Pantalla del reporte: <code className="[overflow-wrap:anywhere]">{ticket.contexto.ruta}</code>{ticket.contexto.ancho ? <> · <span className="whitespace-nowrap">{ticket.contexto.ancho} × {ticket.contexto.alto}</span></> : null}</p>}
    </header>
    {(!ticket.esAutor || ticket.puedeAtender) && <TicketActions ticket={ticket} owner={owner} context={context} journal={journal} changed={changed} refreshing={automaticRefresh === 'loading'} />}
    <section aria-label="Conversación" className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <h4 className="border-b border-neutral-200 px-4 py-3 font-semibold text-neutral-900">Conversación</h4>
      <ol className="divide-y divide-neutral-200">{ticket.mensajes.map(message => <li key={message.id} className={'p-4 ' + (message.interno ? 'border-l-4 border-warning-600 bg-warning-50' : '')}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold text-neutral-900">{name(message.autor)}</span><time dateTime={message.createdAt} className="text-neutral-600">{date(message.createdAt)}</time></div>
        {message.interno && <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning-800"><LockKeyhole size={16} />Nota interna · sólo soporte</p>}
        <p className="whitespace-pre-wrap break-words text-base text-neutral-800">{message.cuerpo}</p>
        {!!message.adjuntos.length && <ul className="mt-3 space-y-3">{message.adjuntos.map(file => <li key={file.id} className="min-w-0 space-y-2">
          {file.mime.startsWith('audio/') && <SupportAudioPlayer key={owner + file.id} ticketId={ticket.id} owner={owner} file={file} />}
          <Button variant="outline" className="max-w-full [overflow-wrap:anywhere]" onClick={() => void download(file)} leftIcon={<Download size={16} />}>{file.nombre} · {(file.bytes / 1024).toFixed(0)} KB</Button></li>)}</ul>}
      </li>)}</ol>
    </section>
    {ticket.esAutor && !ticket.puedeAtender && <TicketActions ticket={ticket} owner={owner} context={context} journal={journal} changed={changed} refreshing={automaticRefresh === 'loading'} />}
    {error && <p role="alert" className="text-error-700">{error}</p>}
    <details className="rounded-xl border border-neutral-200 bg-white p-4"><summary className="min-h-11 cursor-pointer font-semibold text-neutral-900">Historial del ticket</summary>
      <ol className="mt-3 space-y-3 text-sm text-neutral-700"><li>Creado · {date(ticket.createdAt)}</li>{ticket.eventos.map(event => <li key={event.id}>
        <p>{event.accion.replaceAll('_', ' ')} · {supportStates[event.estadoNuevo]} · {date(event.createdAt)}{event.usuario ? ` · ${name(event.usuario)}` : ''}</p>
        {event.detalle?.hacia && <p className="mt-1">{event.detalle.desde} → {event.detalle.hacia}</p>}
        {event.detalle?.despues && <p className="mt-1">{supportCategories[event.detalle.despues.categoria]} · {supportTypes[event.detalle.despues.tipo]} · Prioridad {supportPriorities[event.detalle.despues.prioridad]}</p>}
      </li>)}</ol>
    </details>
  </article>;
}
function ticketActions(ticket: SupportTicket) {
  const actions: Array<{ value: SupportAction; label: string }> = [];
  if (ticket.esAutor || (ticket.puedeAtender && ticket.estado !== 'CERRADO')) actions.push({ value: 'RESPONDER', label: ticket.estado === 'CERRADO' ? 'Responder y reabrir' : 'Respuesta visible al usuario' });
  if (ticket.puedeAtender) actions.push({ value: 'NOTA', label: 'Nota interna de soporte' });
  if (ticket.puedeAtender) actions.push({ value: 'CLASIFICAR', label: 'Clasificar ticket' });
  if ((ticket.puedeAtender || (ticket.puedeGestionar && !ticket.responsableId)) && ticket.estado !== 'CERRADO') {
    actions.push({ value: 'DERIVAR', label: 'Derivar a otro responsable' });
    if (ticket.puedeAtender && !ticket.esAutor) actions.push({ value: 'ESPERAR', label: 'Solicitar respuesta al usuario' });
  }
  if (ticket.esAutor || ticket.puedeAtender) actions.push(ticket.estado === 'CERRADO' ? { value: 'REABRIR', label: 'Reabrir ticket' } : { value: 'CERRAR', label: 'Cerrar con una resolución' });
  return actions;
}
function TicketActions({ ticket, owner, context, journal, changed, refreshing }: { ticket: SupportTicket; owner: string; context: string; journal: ReturnType<typeof useSupportCommand>; changed: (minimumVersion?: number) => Promise<void>; refreshing: boolean }) {
  const scope = { userId: owner, context, ticketId: ticket.id };
  const recovery = useSupportActionDraft(scope);
  const pending = journal.command;
  const query = useQueryClient();
  useEffect(() => {
    if (pending?.status === 'confirmed' && supportSessionMatches(owner)) {
      void query.invalidateQueries({ queryKey: ['attention'] });
    }
  }, [pending?.status, pending?.key, owner, query]);
  const action = recovery.workspace.action;
  const actions = ticketActions(ticket);
  const selected = pending && pending.input.accion !== 'TOMAR' ? pending.input.accion : actions.some(option => option.value === action) ? action : actions[0]?.value;
  const draftAction = selected || 'TOMAR';
  const draft = recovery.workspace.drafts[draftAction] || emptySupportActionDraft(ticket.version);
  const { body, files, audio } = pending ? { body: pending.input.cuerpo, files: pending.files, audio: null } : draft;
  const updateDraft = (patch: Partial<SupportActionDraft>) => recovery.update(draftAction, ticket.version, patch);
  const setBody = (body: string) => updateDraft({ body });
  const setFiles = (files: File[]) => updateDraft({ files });
  const setAudio = (audio: File | null) => { if (audio && files.length >= 3) { setError('Hasta 3 archivos, incluido el audio. Quitá un adjunto antes de grabar.'); return; } updateDraft({ audio }); };
  const target = draft.target || '', category = draft.category || ticket.categoria;
  const type = draft.type || ticket.tipo || 'PROBLEMA', priority = draft.priority || ticket.prioridad;
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const submitting = useRef(false);
  const busy = journal.busy || preparing;
  const canEdit = journal.ready && recovery.ready && recovery.ownership.status === 'owned';
  const staleDraft = !!recovery.workspace.drafts[draftAction] && draft.version !== ticket.version;
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  const team = useQuery({ queryKey: ['soporte', owner, context, 'equipo'], queryFn: supportService.team, enabled: ticket.puedeGestionar, retry: false });
  const displayedTarget = pending?.input.responsableId ?? target;
  const recipient = team.data?.find(user => user.id === displayedTarget);
  const send = async (chosen = selected) => {
    if (submitting.current || busy || recording || !canEdit || !recovery.canWrite() || !chosen) return;
    if (pending) { await journal.retry(); return; }
    if (chosen !== 'TOMAR' && staleDraft) { setError('El ticket cambió. Revisá la conversación antes de confirmar.'); return; }
    if (!['TOMAR', 'DERIVAR', 'CLASIFICAR'].includes(chosen) && !body.trim()) { setError('Escribí un mensaje o una resolución.'); bodyInput.current?.focus(); return; }
    if (chosen === 'DERIVAR' && !target) { setError('Elegí el nuevo responsable antes de confirmar la derivación.'); return; }
    const outgoingFiles = chosen === 'RESPONDER' || chosen === 'NOTA' ? [...files, ...(audio ? [audio] : [])] : [];
    if (outgoingFiles.length > 3) { setError('Hasta 3 archivos, incluido el audio.'); return; }
    submitting.current = true; setPreparing(true); setError('');
    try {
      if (!await recovery.flush() || !recovery.canWrite()) return;
      await journal.submit({ key: crypto.randomUUID(), input: { accion: chosen, cuerpo: chosen === 'TOMAR' ? '' : body,
        version: ticket.version, ...(chosen === 'DERIVAR' ? { responsableId: target } : {}), ...(chosen === 'CLASIFICAR' ? { categoria: category, tipo: type, prioridad: priority } : {}) }, files: outgoingFiles });
    } finally { submitting.current = false; setPreparing(false); }
  };
  const finishConfirmed = () => {
    if (!recovery.canWrite()) return;
    return journal.release(async saved => {
      if (saved.status === 'confirmed' && (!saved.receipt || saved.receipt.id !== ticket.id || !Number.isSafeInteger(saved.receipt.version))) throw new Error('No pudimos verificar la confirmación. Conservamos el envío.');
      await changed(saved.status === 'confirmed' ? saved.receipt?.version : undefined);
      await recovery.finish(saved);
      if (fileInput.current) fileInput.current.value = '';
    });
  };
  const canTake = ticket.puedeGestionar && ticket.responsableId !== owner && (!ticket.responsableId || ticket.puedeAtender) && ticket.estado !== 'CERRADO';
  const optionalBody = selected === 'DERIVAR' || selected === 'CLASIFICAR';
  const recipients = (team.data || []).filter(user => user.id !== ticket.responsableId);
  const privateAction = selected === 'NOTA' || selected === 'DERIVAR' || selected === 'CLASIFICAR';
  return <section aria-label="Atender ticket" className="min-w-0 space-y-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 [overflow-wrap:anywhere]">
    <h4 className="font-semibold text-neutral-900">Atender ticket</h4>
    {recovery.ownership.status === 'blocked' && <div role="status" className="space-y-2 rounded-lg bg-warning-50 p-3 text-warning-900"><p>Este ticket se está editando en otra pestaña. Cerrala para continuar aquí sin reemplazar su borrador.</p><Button variant="outline" onClick={recovery.ownership.retry}>Retomar edición aquí</Button></div>}
    {recovery.ownership.status === 'unavailable' && <div role="alert" className="space-y-2"><p>Este navegador no pudo proteger la edición del borrador. Reintentá o abrí SITREP en un navegador actualizado.</p><Button variant="outline" onClick={recovery.ownership.retry}>Reintentar protección</Button></div>}
    {recovery.ownership.status === 'owned' && !recovery.ready && <p role="status">Comprobando borradores… <Button variant="outline" onClick={() => void recovery.reload()}>Reintentar borrador</Button></p>}
    {recovery.error && <div role="alert" className="space-y-2 text-error-700"><p>{recovery.error}</p>{recovery.ready && <Button variant="outline" disabled={!canEdit || recovery.saving} onClick={() => void recovery.flush()}>Reintentar guardado local</Button>}</div>}
    {canEdit && !pending && Object.keys(recovery.workspace.drafts).length > 0 && !recovery.error && <p role="status" className="text-sm text-neutral-600">{recovery.saving ? 'Guardando borrador…' : recovery.restored ? 'Borrador recuperado en este dispositivo. Todavía no se envió.' : 'Borrador guardado en este dispositivo. Todavía no se envió.'}</p>}
    {canEdit && !pending && staleDraft && <div role="status" className="space-y-2 rounded-lg bg-warning-50 p-3 text-warning-900"><p>El ticket cambió desde que preparaste este borrador. Revisá la conversación y el estado antes de confirmar.</p><Button variant="outline" onClick={() => { setError(''); updateDraft({ version: ticket.version }); }}>Revisé la conversación</Button></div>}
    {canTake && <Button disabled={!canEdit || busy || !!pending || recording} leftIcon={<UserRoundCheck size={18} />} onClick={() => void send('TOMAR')}>Asignarme</Button>}
    {!journal.ready && <p role="status">Comprobando envíos guardados… <Button variant="outline" onClick={() => void journal.reload()}>Reintentar lectura</Button></p>}
    {pending?.status === 'confirmed' && <div role="status" className="space-y-2 rounded-lg bg-primary-50 p-3 text-primary-900"><p>Acción confirmada. No hace falta enviarla otra vez.</p><Button isLoading={busy || refreshing} disabled={!canEdit || refreshing} onClick={() => void finishConfirmed()}>Actualizar conversación y continuar</Button></div>}
    {pending?.status === 'rejected' && <div role="alert" className="space-y-2 rounded-lg bg-warning-50 p-3 text-warning-900"><p>La acción no se registró: {pending.rejection}</p><Button isLoading={busy} disabled={!canEdit} onClick={() => void finishConfirmed()}>Actualizar ticket y recuperar contenido</Button></div>}
    {pending?.status === 'pending' && <div role="status" className="space-y-2 rounded-lg bg-warning-50 p-3 text-warning-900"><p>Envío sin confirmar. Conservamos el contenido y los archivos en este dispositivo.</p><div className="flex flex-wrap gap-2"><Button isLoading={busy} disabled={!canEdit} onClick={() => recovery.canWrite() && void journal.retry()}>Reintentar mismo envío</Button><Button variant="outline" disabled={!canEdit || busy} onClick={() => recovery.canWrite() && void journal.recover()}>Comprobar y corregir envío</Button></div><p className="text-sm">Para corregir, primero comprobamos si ya se registró. Si no se registró, retiramos ese envío y recuperamos el contenido.</p></div>}
    {!actions.length ? <p className="text-neutral-600">{ticket.responsable ? 'La respuesta está a cargo del responsable asignado.' : 'Tomá el ticket para responder o derivarlo.'}</p> : !recovery.ready || recovery.ownership.status !== 'owned' ? null : <form noValidate className="space-y-4" onSubmit={event => { event.preventDefault(); void send(selected); }}>
      <div role="group" aria-label="Acciones del ticket" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {actions.map(option => {
          const Icon = actionIcons[option.value];
          return <Button key={option.value} type="button" variant={selected === option.value ? 'primary' : 'outline'}
            aria-pressed={selected === option.value} disabled={!canEdit || busy || !!pending || recording} leftIcon={<Icon size={18} />}
            onClick={() => recovery.select(option.value)}>{option.value === 'RESPONDER' && ticket.estado === 'CERRADO' ? 'Responder y reabrir' : actionLabels[option.value]}</Button>;
        })}
      </div>
      <p id="support-action-audience" className={'flex items-start gap-2 text-sm ' + (privateAction ? 'text-warning-800' : 'text-neutral-700')}>
        {privateAction ? <LockKeyhole size={18} className="shrink-0" /> : <MessageSquare size={18} className="shrink-0" />}
        {selected === 'NOTA' ? 'Sólo el equipo de soporte puede leer esta nota.' : selected === 'CLASIFICAR' ? 'El motivo es interno. Clasificar no cierra el ticket.' : selected === 'DERIVAR' ? 'El motivo es interno. El nuevo responsable recibirá un aviso dentro de SITREP.'
          : selected === 'CERRAR' ? 'La resolución queda visible para el usuario y cierra el ticket.' : 'Este mensaje queda visible en la conversación del ticket.'}
      </p>
      {selected === 'CLASIFICAR' && <div className="grid gap-3 sm:grid-cols-3">
        <Select label="Área del problema" value={pending?.input.categoria ?? category} onChange={value => updateDraft({ category: value as SupportCategory })} disabled={!canEdit || busy || !!pending} options={Object.entries(supportCategories).map(([value, label]) => ({ value, label }))} />
        <Select label="Tipo de ticket" value={pending?.input.tipo ?? type} onChange={value => updateDraft({ type: value as SupportType })} disabled={!canEdit || busy || !!pending} options={Object.entries(supportTypes).map(([value, label]) => ({ value, label }))} />
        <Select label="Prioridad" value={pending?.input.prioridad ?? priority} onChange={value => updateDraft({ priority: value as SupportPriority })} disabled={!canEdit || busy || !!pending} options={Object.entries(supportPriorities).map(([value, label]) => ({ value, label }))} />
      </div>}
      {selected === 'DERIVAR' && <>{team.isError ? <p role="alert" className="text-error-700">{supportError(team.error)} <Button variant="outline" onClick={() => void team.refetch()}>Reintentar equipo</Button></p> :
        <Select label="Nuevo responsable" value={displayedTarget} onChange={target => updateDraft({ target })} disabled={!canEdit || busy || !!pending || team.isPending} searchable
          helperText={recipient ? 'Responsable seleccionado: ' + recipient.email : undefined}
          renderOption={option => <span className="block [overflow-wrap:anywhere]">{option.label}</span>}
          options={recipients.map(user => ({ value: user.id, label: name(user) + ' · ' + user.email }))} />}
        {team.isSuccess && !recipients.length && <p role="status" className="text-sm text-neutral-700">No hay otro responsable activo. Un administrador puede configurar el Equipo de soporte desde la mesa.</p>}</>}
      <label className="block text-sm font-medium text-neutral-700" htmlFor="support-reply">{privateAction ? `Nota interna / motivo${optionalBody ? ' (opcional)' : ''}` : 'Mensaje o resolución'}</label>
      <textarea ref={bodyInput} id="support-reply" aria-label={privateAction ? 'Nota interna / motivo' : 'Mensaje o resolución'} aria-describedby="support-action-audience support-reply-help" value={body} maxLength={8000} required={!optionalBody} disabled={!canEdit || busy || !!pending} onChange={event => setBody(event.target.value)} rows={optionalBody ? 2 : 4}
        className="w-full rounded-lg border border-neutral-400 p-3 text-base text-neutral-900 focus-visible:outline-primary-700" />
      <p id="support-reply-help" className="text-sm text-neutral-600">{optionalBody ? 'Podés confirmar sin escribir un motivo. La acción y el responsable quedan en el historial.' : 'El audio puede acompañar tu mensaje.'}</p>
      <div hidden={selected !== 'RESPONDER' && selected !== 'NOTA'} className="space-y-2"><label htmlFor="support-reply-files" className="block text-sm font-medium text-neutral-700">Adjuntar captura o documento</label>
        <p className="text-sm text-neutral-600">Opcional · podés enviar sólo texto.</p>
        <SupportAudioInput key={'audio:' + draftAction} value={audio} onChange={setAudio} recoveryEnabled onBusyChange={setRecording} disabled={!canEdit || busy || !!pending} />
        <input key={'files:' + draftAction} ref={fileInput} id="support-reply-files" type="file" multiple accept={supportFileAccept} disabled={!canEdit || busy || !!pending}
          className="block min-h-11 w-full text-sm text-neutral-700 file:mr-2 file:min-h-11 file:rounded-lg file:border file:border-neutral-400 file:bg-white file:px-3 file:text-neutral-900" onChange={event => {
            const chosen = Array.from(event.target.files || []); if (chosen.length + (audio ? 1 : 0) > 3 || chosen.some(file => file.size > 5 * 1024 * 1024)) { setError('Hasta 3 archivos de 5 MB cada uno.'); event.target.value = ''; } else setFiles(chosen);
          }} />
        {!!files.length && <ul aria-label="Archivos de esta acción" className="space-y-2">{files.map((file, index) => <li key={index + ':' + file.name} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-1">
          <span className="min-w-0 break-all text-sm text-neutral-800">{file.name}</span><Button type="button" variant="ghost" className="shrink-0" aria-label={'Quitar ' + file.name} disabled={!canEdit || busy || !!pending} onClick={() => { setFiles(files.filter((_, position) => position !== index)); if (fileInput.current) fileInput.current.value = ''; }}>Quitar</Button>
        </li>)}</ul>}
      </div>
      {!pending && <Button type="submit" isLoading={busy} disabled={!canEdit || staleDraft || recording || (selected === 'DERIVAR' && (team.isPending || team.isError || !recipients.length))}>{selected ? submitLabels[selected] : 'Confirmar acción'}</Button>}
    </form>}
    {(error || journal.error) && <p role="alert" className="text-error-700">{error || journal.error}</p>}
  </section>;
}
function TeamSettings({ owner, context }: { owner: string; context: string }) {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const results = useQuery({ queryKey: ['soporte', owner, context, 'candidatos', applied], enabled: applied.length >= 2, queryFn: () => supportService.candidates(applied), retry: false });
  const change = async (id: string, enabled: boolean) => {
    if (busy) return; setBusy(true); setError('');
    try { await supportService.agent(id, enabled); await results.refetch(); } catch (failure) { setError(supportError(failure)); } finally { setBusy(false); }
  };
  return <section aria-label="Configurar equipo de soporte" className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
    <h3 className="font-semibold text-neutral-900">Equipo propio de SITREP</h3>
    <p className="text-sm text-neutral-600">Habilitar soporte permite atender tickets, no administrar manifiestos ni expedientes. Los administradores generales ya tienen acceso.</p>
    <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); setApplied(search.trim()); }}>
      <Input label="Buscar usuario para soporte" isFullWidth={false} value={search} onChange={event => setSearch(event.target.value)} maxLength={100} containerClassName="min-w-0 flex-1" />
      <Button variant="outline" type="submit" disabled={search.trim().length < 2}>Buscar usuario</Button>
    </form>
    {results.isFetching && <p role="status">Buscando usuarios…</p>}
    {results.isError && <p role="alert" className="text-error-700">{supportError(results.error)}</p>}
    {results.data && <ul className="divide-y divide-neutral-200">{results.data.map(user => <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0"><p className="break-words text-neutral-900">{name(user)} <span className="text-sm text-neutral-600">· {user.rol}</span></p>
        <p className="break-all text-sm text-neutral-600">{user.email}</p></div>
      {user.rol === 'ADMIN' ? <span className="text-sm text-primary-800">Administrador</span> : <Button variant="outline" disabled={busy} onClick={() => void change(user.id, !user.agenteSoporte?.habilitado)}>{user.agenteSoporte?.habilitado ? 'Deshabilitar soporte' : 'Habilitar soporte'}</Button>}
    </li>)}{!results.data.length && <li className="py-3 text-neutral-600">No hay usuarios que coincidan.</li>}</ul>}
    {error && <p role="alert" className="text-error-700">{error}</p>}
  </section>;
}

import React, { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LifeBuoy, Download, UserRoundCheck, LockKeyhole, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SupportEntry } from '../../components/SupportReportDialog';
import { supportService, supportError } from '../../services/support.service';
import { supportStates, supportCategories, type SupportAction, type SupportMutation, type SupportTicket } from '../../types/support';

const name = (user: { nombre: string; apellido?: string | null }) => [user.nombre, user.apellido].filter(Boolean).join(' ');
const date = (value: string) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Mendoza' }).format(new Date(value));
function State({ ticket }: { ticket: SupportTicket }) {
  const colors = ticket.estado === 'CERRADO' ? 'bg-neutral-100 text-neutral-700' : ticket.estado === 'ESPERANDO_USUARIO' ? 'bg-warning-50 text-warning-800' : 'bg-primary-50 text-primary-800';
  return <span className={'inline-flex items-center rounded-md px-2 py-1 text-sm font-semibold ' + colors}>{supportStates[ticket.estado]}</span>;
}
export default function SoportePage() {
  const { currentUser } = useAuth();
  const { id } = useParams();
  // A session change must not reuse another user's ticket query or draft.
  return currentUser ? <SupportWorkspace key={String(currentUser.id)} owner={String(currentUser.id)} id={id} /> : null;
}
function SupportWorkspace({ owner, id }: { owner: string; id?: string }) {
  const mp = useMobilePrefix();
  const [scope, setScope] = useState('mis');
  const [state, setState] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const access = useQuery({ queryKey: ['soporte', owner, 'acceso'], queryFn: supportService.access, retry: false });
  const list = useQuery({ queryKey: ['soporte', owner, 'lista', scope, state, appliedSearch, page], enabled: !id,
    queryFn: () => supportService.list({ scope, estado: state || undefined, search: appliedSearch, page }), retry: false });
  const detail = useQuery({ queryKey: ['soporte', owner, 'ticket', id], enabled: !!id, queryFn: () => supportService.get(id!), retry: false });
  const [teamOpen, setTeamOpen] = useState(false);
  return <section aria-label="Soporte de SITREP" className="min-w-0 space-y-5 pb-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="flex items-center gap-2 text-2xl font-bold text-neutral-900"><LifeBuoy size={24} className="shrink-0 text-primary-800" />Soporte</h2>
        <p className="mt-1 text-sm text-neutral-600">Reportes, respuestas y seguimiento dentro de SITREP.</p></div>
      <SupportEntry />
    </div>
    {access.isError && <p role="alert" className="text-error-700">{supportError(access.error)} <Button variant="outline" onClick={() => void access.refetch()}>Reintentar acceso</Button></p>}
    {id ? <>
      <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-primary-800 hover:bg-primary-50 focus-visible:outline-primary-700" to={mp('/soporte')}><ArrowLeft size={18} />Volver a tickets</Link>
      {detail.isPending ? <p role="status">Cargando ticket…</p> : detail.isError ? <div role="alert" className="space-y-3 text-error-700"><p>{supportError(detail.error)}</p><Button variant="outline" onClick={() => void detail.refetch()}>Reintentar ticket</Button></div>
        : <TicketDetail key={detail.data.id} ticket={detail.data} owner={owner} refresh={() => detail.refetch()} />}
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Vistas de soporte" className="flex flex-wrap gap-1">
          {[['mis', 'Mis tickets'], ...(access.data?.puedeGestionar ? [['mesa', 'Mesa de soporte'], ['asignados', 'A mi cargo']] : [])].map(([value, label]) =>
            <Button key={value} variant={scope === value ? 'primary' : 'outline'} aria-pressed={scope === value} onClick={() => { setScope(value); setPage(1); }}>{label}</Button>)}
        </div>
        {access.data?.puedeConfigurar && <Button variant="outline" aria-expanded={teamOpen} onClick={() => setTeamOpen(value => !value)}>Equipo de soporte</Button>}
      </div>
      {teamOpen && access.data?.puedeConfigurar && <TeamSettings owner={owner} />}
      <form onSubmit={event => { event.preventDefault(); setAppliedSearch(search); setPage(1); }} className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end">
        <Input label="Buscar por asunto" maxLength={180} value={search} onChange={event => setSearch(event.target.value)} />
        <Select label="Estado del ticket" value={state} onChange={value => { setState(value); setPage(1); }} options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(supportStates).map(([value, label]) => ({ value, label }))]} />
        <Button type="submit" variant="outline" leftIcon={<Search size={18} />}>Buscar</Button>
      </form>
      {list.isPending ? <p role="status">Cargando tickets…</p> : list.isError ? <div role="alert" className="space-y-2 text-error-700"><p>{supportError(list.error)}</p><Button variant="outline" onClick={() => void list.refetch()}>Reintentar lista</Button></div> : <>
        <p className="text-sm text-neutral-600" role="status">{list.data.total} {list.data.total === 1 ? 'ticket' : 'tickets'} en esta vista</p>
        {!list.data.items.length ? <p className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-700">No hay tickets que coincidan. Podés reportar un problema desde el botón superior.</p>
          : <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {list.data.items.map(ticket => <li key={ticket.id}><Link to={mp('/soporte/' + ticket.id)} className="grid min-w-0 gap-2 p-4 text-neutral-900 hover:bg-primary-50 active:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-700 md:grid-cols-[8rem_minmax(0,1fr)_12rem]">
              <span className="font-mono text-sm font-semibold text-primary-800">{ticket.referencia}</span>
              <div className="min-w-0"><p className="break-words font-semibold">{ticket.asunto}</p><p className="mt-1 text-sm text-neutral-600">{supportCategories[ticket.categoria]} · {ticket.responsable ? name(ticket.responsable) : 'Sin asignar'}</p></div>
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
function TicketDetail({ ticket, owner, refresh }: { ticket: SupportTicket; owner: string; refresh: () => Promise<unknown> }) {
  const query = useQueryClient();
  const [error, setError] = useState('');
  const changed = async () => { await query.invalidateQueries({ queryKey: ['soporte', owner] }); await refresh(); };
  const download = async (file: { id: string; nombre: string }) => {
    try {
      const blob = await supportService.download(ticket.id, file.id);
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = file.nombre; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (failure) { setError(supportError(failure)); }
  };
  return <article className="space-y-5">
    <header className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold text-primary-800">{ticket.referencia}</span><State ticket={ticket} /></div>
      <h3 className="break-words text-xl font-bold text-neutral-900">{ticket.asunto}</h3>
      <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-neutral-600">Reportado por</dt><dd className="font-medium text-neutral-900">{name(ticket.autor)}</dd></div>
        <div><dt className="text-neutral-600">Responsable</dt><dd className="font-medium text-neutral-900">{ticket.responsable ? name(ticket.responsable) : 'Pendiente de asignación'}</dd></div></dl>
      {ticket.contexto.ruta && <p className="text-sm text-neutral-600">Pantalla del reporte: <code className="[overflow-wrap:anywhere]">{ticket.contexto.ruta}</code>{ticket.contexto.ancho ? <> · <span className="whitespace-nowrap">{ticket.contexto.ancho} × {ticket.contexto.alto}</span></> : null}</p>}
    </header>
    <section aria-label="Conversación" className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <h4 className="border-b border-neutral-200 px-4 py-3 font-semibold text-neutral-900">Conversación</h4>
      <ol className="divide-y divide-neutral-200">{ticket.mensajes.map(message => <li key={message.id} className={'p-4 ' + (message.interno ? 'border-l-4 border-warning-600 bg-warning-50' : '')}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold text-neutral-900">{name(message.autor)}</span><time dateTime={message.createdAt} className="text-neutral-600">{date(message.createdAt)}</time></div>
        {message.interno && <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning-800"><LockKeyhole size={16} />Nota interna · sólo soporte</p>}
        <p className="whitespace-pre-wrap break-words text-base text-neutral-800">{message.cuerpo}</p>
        {!!message.adjuntos.length && <ul className="mt-3 space-y-2">{message.adjuntos.map(file => <li key={file.id}><Button variant="outline" className="max-w-full [overflow-wrap:anywhere]" onClick={() => void download(file)} leftIcon={<Download size={16} />}>{file.nombre} · {(file.bytes / 1024).toFixed(0)} KB</Button></li>)}</ul>}
      </li>)}</ol>
    </section>
    {error && <p role="alert" className="text-error-700">{error}</p>}
    <TicketActions ticket={ticket} owner={owner} changed={changed} />
    <details className="rounded-xl border border-neutral-200 bg-white p-4"><summary className="min-h-11 cursor-pointer font-semibold text-neutral-900">Historial del ticket</summary>
      <ol className="mt-3 space-y-2 text-sm text-neutral-700"><li>Creado · {date(ticket.createdAt)}</li>{ticket.eventos.map(event => <li key={event.id}>{event.accion.replaceAll('_', ' ')} · {supportStates[event.estadoNuevo]} · {date(event.createdAt)}</li>)}</ol>
    </details>
  </article>;
}
function TicketActions({ ticket, owner, changed }: { ticket: SupportTicket; owner: string; changed: () => Promise<void> }) {
  const [action, setAction] = useState<SupportAction>('RESPONDER');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ input: SupportMutation; key: string; files: File[] } | null>(null);
  const inFlight = useRef(false);
  const team = useQuery({ queryKey: ['soporte', owner, 'equipo'], queryFn: supportService.team, enabled: ticket.puedeGestionar, retry: false });
  const recipient = team.data?.find(user => user.id === target);
  const send = async (chosen = action) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const frozen = pending || { key: crypto.randomUUID(), input: { accion: chosen, cuerpo: chosen === 'TOMAR' ? '' : body,
        version: ticket.version, ...(chosen === 'DERIVAR' ? { responsableId: target } : {}) }, files };
      setPending(frozen);
      await supportService.act(ticket.id, frozen.input, frozen.files, frozen.key);
      setPending(null); setBody(''); setFiles([]); setTarget(''); setAction('RESPONDER'); await changed();
    } catch (failure) {
      setError(supportError(failure));
      const status = (failure as { response?: { status?: number } }).response?.status;
      if ([400, 403, 409, 413, 422].includes(status || 0)) { setPending(null); if (status === 409) await changed(); }
    } finally { inFlight.current = false; setBusy(false); }
  };
  const actions: Array<{ value: SupportAction; label: string }> = [];
  if (ticket.esAutor || (ticket.puedeAtender && ticket.estado !== 'CERRADO')) actions.push({ value: 'RESPONDER', label: ticket.estado === 'CERRADO' ? 'Responder y reabrir' : 'Respuesta visible al usuario' });
  if (ticket.puedeAtender) actions.push({ value: 'NOTA', label: 'Nota interna de soporte' });
  if (ticket.puedeAtender && ticket.estado !== 'CERRADO') {
    actions.push({ value: 'DERIVAR', label: 'Derivar a otro responsable' });
    if (!ticket.esAutor) actions.push({ value: 'ESPERAR', label: 'Solicitar respuesta al usuario' });
  }
  if (ticket.esAutor || ticket.puedeAtender) actions.push(ticket.estado === 'CERRADO' ? { value: 'REABRIR', label: 'Reabrir ticket' } : { value: 'CERRAR', label: 'Cerrar con una resolución' });
  const selected = actions.some(option => option.value === action) ? action : actions[0]?.value;
  const canTake = ticket.puedeGestionar && !ticket.responsableId && ticket.estado !== 'CERRADO';
  return <section aria-label="Atender ticket" className="min-w-0 space-y-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 [overflow-wrap:anywhere]">
    {canTake && <Button disabled={busy || !!pending} leftIcon={<UserRoundCheck size={18} />} onClick={() => void send('TOMAR')}>Tomar ticket</Button>}
    {pending?.input.accion === 'TOMAR' && <Button isLoading={busy} onClick={() => void send('TOMAR')}>Reintentar toma del ticket</Button>}
    {!actions.length ? <p className="text-neutral-600">{ticket.responsable ? 'La respuesta está a cargo del responsable asignado.' : 'Tomá el ticket para responder o derivarlo.'}</p> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); void send(selected); }}>
      <Select label="Acción de soporte" value={selected} onChange={value => setAction(value as SupportAction)} options={actions} disabled={busy || !!pending} />
      {selected === 'DERIVAR' && <>{team.isError ? <p role="alert" className="text-error-700">{supportError(team.error)} <Button variant="outline" onClick={() => void team.refetch()}>Reintentar equipo</Button></p> :
        <Select label="Nuevo responsable" value={target} onChange={setTarget} disabled={busy || !!pending || team.isPending} searchable
          helperText={recipient ? 'Responsable seleccionado: ' + recipient.email : undefined}
          renderOption={option => <span className="block [overflow-wrap:anywhere]">{option.label}</span>}
          options={(team.data || []).filter(user => user.id !== ticket.responsableId).map(user => ({ value: user.id, label: name(user) + ' · ' + user.email }))} />}</>}
      <label className="block text-sm font-medium text-neutral-700" htmlFor="support-reply">{selected === 'NOTA' || selected === 'DERIVAR' ? 'Nota interna / motivo' : 'Mensaje o resolución'}</label>
      <textarea id="support-reply" value={body} maxLength={8000} minLength={5} required disabled={busy || !!pending} onChange={event => setBody(event.target.value)} rows={4}
        className="w-full rounded-lg border border-neutral-400 p-3 text-base text-neutral-900 focus-visible:outline-primary-700" />
      {(selected === 'RESPONDER' || selected === 'NOTA') && <><label htmlFor="support-reply-files" className="block text-sm font-medium text-neutral-700">Adjuntar captura o documento</label>
        <input id="support-reply-files" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy || !!pending}
          className="block min-h-11 w-full text-sm text-neutral-700 file:mr-2 file:min-h-11 file:rounded-lg file:border file:border-neutral-400 file:bg-white file:px-3 file:text-neutral-900" onChange={event => {
            const chosen = Array.from(event.target.files || []); if (chosen.length > 3 || chosen.some(file => file.size > 5 * 1024 * 1024)) { setError('Hasta 3 archivos de 5 MB cada uno.'); event.target.value = ''; setFiles([]); } else setFiles(chosen);
          }} /></>}
      {pending && <p className="text-sm text-neutral-700">Envío sin confirmar. El reintento conservará el contenido y la misma clave.</p>}
      <Button type="submit" isLoading={busy} disabled={body.trim().length < 5 || (selected === 'DERIVAR' && !target)}>{pending ? 'Reintentar mismo envío' : 'Confirmar acción'}</Button>
    </form>}
    {error && <p role="alert" className="text-error-700">{error}</p>}
  </section>;
}
function TeamSettings({ owner }: { owner: string }) {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const results = useQuery({ queryKey: ['soporte', owner, 'candidatos', applied], enabled: applied.length >= 2, queryFn: () => supportService.candidates(applied), retry: false });
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

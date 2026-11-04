import React, { useState } from 'react';
import api from '../../services/api';
import { inspectionErrorMessage } from './inspectionPresentation';
/** `embedded`: sin el desplegable propio (por ejemplo dentro de un modal abierto desde el menú de la lista). */
export function InspectionManagementPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const [users, setUsers] = useState<Array<{ id: string; nombre: string; apellido?: string; esJefeInspecciones: boolean }>>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false);
  async function load() { setBusy(true); setError(''); try { const { data } = await api.get('/inspecciones/jefatura'); setUsers(data.data); setLoaded(true); } catch(e) { setError(inspectionErrorMessage(e, 'No se pudo consultar el equipo.')); } finally { setBusy(false); } }
  async function change(id: string, activo: boolean) { if (busy) return; setBusy(true); setError(''); try { await api.put('/inspecciones/jefatura', { usuarioId: id, activo }); setUsers(rows => rows.map(u => u.id === id ? { ...u, esJefeInspecciones: activo } : u)); } catch(e) { setError(inspectionErrorMessage(e, 'No se guardó la designación.')); } finally { setBusy(false); } }
  const body = <><p className="mb-3 text-sm text-neutral-600">La jefatura puede asignar visitas, revisar expedientes, responder presentaciones y tomar decisiones. Esta designación no cambia el rol de la cuenta ni habilita otros módulos.</p><button type="button" onClick={() => void load()} disabled={busy} className="min-h-11 rounded-lg border px-4">{busy ? 'Procesando…' : loaded ? 'Actualizar equipo' : 'Consultar equipo'}</button>{error && <p role="alert" className="my-3 text-sm text-red-800">{error}</p>}<ul className="my-3 divide-y">{users.map(u => <li key={u.id} className="flex min-h-14 items-center justify-between gap-3 py-2"><span>{u.nombre} {u.apellido}</span><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={u.esJefeInspecciones} disabled={busy} onChange={e => void change(u.id, e.target.checked)} />Jefatura</label></li>)}</ul></>;
  if (embedded) return <div>{body}</div>;
  return <details className="rounded-xl border bg-white px-4"><summary className="min-h-12 cursor-pointer py-3 font-semibold">Administración de inspectores</summary>{body}</details>;
}

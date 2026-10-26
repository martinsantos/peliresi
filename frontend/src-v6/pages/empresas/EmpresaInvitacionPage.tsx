import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import api from '../../services/api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/ButtonV2';
import { Card } from '../../components/ui/CardV2';

type Invitation = { empresa: string; email: string; rol: string; venceAt: string };
type ReadState = 'loading' | 'ready' | 'unavailable' | 'failed';
const roles: Record<string, string> = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador' };
const request = async (method: string, route: string, data?: unknown, signal?: AbortSignal) =>
  (await axios.request({ baseURL: api.defaults.baseURL, timeout: 15000, method, url: route, data, signal })).data;

// A new capability must never inherit the previous recipient, password or outcome.
export default function EmpresaInvitacionPage() {
  const { token = '' } = useParams();
  return <InvitationEntry key={token} token={token} />;
}

// Public one-time capability. Never attach, replace or clear a different session.
function InvitationEntry({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<Invitation>();
  const [readState, setReadState] = useState<ReadState>('loading');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const [password, setPassword] = useState(''), [name, setName] = useState('');
  const [register, setRegister] = useState(false), [created, setCreated] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setReadState('loading'); setError('');
    if (import.meta.env.VITE_ENTERPRISE_ENABLED !== 'true') {
      setReadState('unavailable'); setError('Funcionalidad no disponible.');
      return;
    }
    void request('GET', '/empresas/invitaciones/' + token, undefined, controller.signal).then(result => {
      if (!active) return;
      const data = result?.data;
      if (!data || typeof data.empresa !== 'string' || typeof data.email !== 'string' || !roles[data.rol]) {
        setReadState('failed'); setError('No pudimos comprobar la invitación. Reintentá la consulta.'); return;
      }
      setInvitation(data); setReadState('ready');
    }).catch((cause: unknown) => {
      if (!active) return;
      const unavailable = [403, 404, 410].includes((cause as { response?: { status?: number } })?.response?.status || 0);
      setReadState(unavailable ? 'unavailable' : 'failed');
      setError(unavailable
        ? 'Esta invitación venció, fue utilizada o ya no está disponible. Pedí al responsable de la empresa que revise tu acceso.'
        : 'No pudimos consultar la invitación. Revisá tu conexión y reintentá; todavía no se confirmó si está vigente.');
    });
    return () => { active = false; controller.abort(); };
  }, [token, attempt]);

  async function submit() {
    if (lock.current || readState !== 'ready' || !invitation) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (register) {
        await request('POST', '/auth/register', { email: invitation.email, password, nombre: name, rol: invitation.rol });
        setCreated(true); setRegister(false); setPassword('');
      } else {
        await request('POST', '/empresas/invitaciones/' + token + '/aceptar', { email: invitation.email, password });
        setDone(true); setPassword('');
      }
    } catch (cause: unknown) {
      setError((cause as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudo completar. Podés volver a intentarlo.');
    } finally { setBusy(false); lock.current = false; }
  }

  return <div className="mx-auto w-full max-w-lg p-4"><Card>
    <h1 className="text-2xl font-bold text-neutral-900">Acceso a empresa</h1>
    {error && <p role="alert" className="my-3 text-error-800">{error}</p>}
    {readState === 'failed' && <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Reintentar consulta</Button>}
    {readState === 'loading' && <p role="status" className="mt-4">Consultando invitación…</p>}
    {done ? <>
      <p role="status" className="my-4">Acceso autorizado. Tu sesión anterior no se modificó.</p>
      <div className="flex flex-wrap gap-4"><Link className="inline-flex min-h-11 items-center text-primary-800 underline" to="/empresas">Elegir empresa</Link><Link className="inline-flex min-h-11 items-center text-primary-800 underline" to="/login">Iniciar sesión</Link></div>
    </> : readState === 'ready' && invitation && <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <p className="break-words font-semibold">{invitation.empresa}</p>
      <p className="break-words">{roles[invitation.rol]} · {invitation.email}</p>
      {created && <p role="status">Cuenta creada. Verificá tu correo y volvé a este enlace para aceptar.</p>}
      {register && <Input label="Tu nombre" required disabled={busy} value={name} autoComplete="name" onChange={event => setName(event.target.value)} />}
      <Input label={register ? 'Crear contraseña' : 'Contraseña de tu cuenta'} type="password" autoComplete={register ? 'new-password' : 'current-password'} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} />
      <div className="grid gap-3"><Button type="submit" disabled={busy}>{busy ? 'Confirmando…' : register ? 'Crear cuenta personal' : 'Aceptar acceso a empresa'}</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => { setRegister(!register); setPassword(''); setError(''); }}>{register ? 'Ya tengo cuenta' : 'No tengo cuenta'}</Button></div>
      <p className="text-sm text-neutral-600">La autorización no modifica tu cuenta ni aprueba actividades regulatorias nuevas.</p>
    </form>}
    {!done && <div className="mt-3"><Link className="inline-flex min-h-11 items-center text-primary-800 underline" to="/login">Volver al acceso</Link></div>}
  </Card></div>;
}

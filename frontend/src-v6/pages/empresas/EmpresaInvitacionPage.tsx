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
  const [busy, setBusy] = useState(false), [done, setDone] = useState<false | 'new' | 'recovered'>(false);
  const [uncertain, setUncertain] = useState(false), [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState(''), [checkedPending, setCheckedPending] = useState(false);
  const [registrationUncertain, setRegistrationUncertain] = useState(false);
  const resultRef = useRef<HTMLParagraphElement>(null), titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (done || checkedPending) resultRef.current?.focus(); }, [done, checkedPending]);
  useEffect(() => { if (attempt > 0 && readState === 'ready') titleRef.current?.focus(); }, [attempt, readState]);
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
    if (import.meta.env.VITE_ENTERPRISE_ENABLED !== 'true' || lock.current || (!recoveryMode && (readState !== 'ready' || !invitation)) || registrationUncertain) return;
    const email = recoveryMode ? recoveryEmail.trim().toLowerCase() : invitation!.email;
    lock.current = true; setBusy(true); setError('');
    try {
      if (register && !recoveryMode) {
        await request('POST', '/auth/register', { email, password, nombre: name, rol: invitation!.rol });
        setCreated(true); setRegister(false); setPassword('');
      } else {
        const checkOnly = uncertain || recoveryMode;
        const response = await request('POST', '/empresas/invitaciones/' + token + '/aceptar', { email, password, ...(checkOnly ? { soloConsultar: true } : {}) });
        if (response?.data?.aceptada === true) { setDone(response.data.recuperada ? 'recovered' : 'new'); setPassword(''); }
        else if (checkOnly && response?.data?.aceptada === false) { setCheckedPending(true); setUncertain(false); }
        else throw new Error('Respuesta de aceptación incompleta');
      }
    } catch (cause: unknown) {
      const failure = cause as { response?: { status?: number; data?: { message?: string } } };
      const ambiguous = !failure.response || (failure.response.status || 0) >= 500 || failure.response.status === 409;
      if (ambiguous && register) { setRegistrationUncertain(true); setError('No recibimos la confirmación de creación. La cuenta puede haberse registrado: elegí Ya tengo cuenta para continuar o recuperá el acceso.'); }
      else if (ambiguous) { setUncertain(true); setError('No recibimos la confirmación. Comprobá la aceptación con tu contraseña; esta consulta no autoriza ni duplica accesos.'); }
      else setError(failure.response?.data?.message || 'No se pudo completar. Revisá los datos antes de continuar.');
    } finally { setBusy(false); lock.current = false; }
  }

  return <div className="mx-auto w-full max-w-lg p-4"><Card>
    <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-bold text-neutral-900 focus:outline-none">Acceso a empresa</h1>
    {error && <p role="alert" className="my-3 text-error-800">{error}</p>}
    {readState === 'failed' && <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Reintentar consulta</Button>}
    {readState === 'loading' && <p role="status" className="mt-4">Consultando invitación…</p>}
    {done ? <>
      <p ref={resultRef} tabIndex={-1} role="status" className="my-4 focus:outline-none">{done === 'recovered' ? 'Esta invitación ya fue aceptada. Consultá tus accesos actuales en Empresas; esta comprobación no reactiva permisos revocados.' : 'Acceso autorizado. Tu sesión anterior no se modificó.'}</p>
      <div className="flex flex-wrap gap-4"><Link className="inline-flex min-h-11 items-center text-primary-800 underline" to="/empresas">Elegir empresa</Link><Link className="inline-flex min-h-11 items-center text-primary-800 underline" to="/login">Iniciar sesión</Link></div>
    </> : (recoveryMode || readState === 'ready' && invitation) && <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
      {!recoveryMode && invitation && <><p className="break-words font-semibold">{invitation.empresa}</p><p className="break-words">{roles[invitation.rol]} · {invitation.email}</p></>}
      {recoveryMode && <><p>Comprobá si tu cuenta ya aceptó este enlace. No se otorgarán permisos.</p><Input label="Correo de la cuenta invitada" type="email" required disabled={busy} value={recoveryEmail} autoComplete="email" onChange={event => { setRecoveryEmail(event.target.value); setCheckedPending(false); }} /></>}
      {checkedPending && <p ref={resultRef} tabIndex={-1} role="status" className="text-neutral-700 focus:outline-none">No hay una aceptación registrada. {recoveryMode ? 'Volvé a consultar la invitación para revisar sus datos antes de aceptar.' : 'Revisá la empresa y la actividad antes de aceptar el acceso.'}</p>}
      {registrationUncertain && <Link className="inline-flex min-h-11 items-center text-primary-800 underline" to="/recuperar">Recuperar acceso a mi cuenta</Link>}
      {created && <p role="status">Cuenta creada. Verificá tu correo y volvé a este enlace para aceptar.</p>}
      {register && !recoveryMode && <Input label="Tu nombre" required disabled={busy} value={name} autoComplete="name" onChange={event => setName(event.target.value)} />}
      <Input label={register && !recoveryMode ? 'Crear contraseña' : 'Contraseña de tu cuenta'} type="password" autoComplete={register && !recoveryMode ? 'new-password' : 'current-password'} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} />
      <div className="grid gap-3"><Button type="submit" disabled={busy || registrationUncertain}>{busy ? 'Confirmando…' : uncertain || recoveryMode ? 'Comprobar aceptación' : register ? 'Crear cuenta personal' : 'Aceptar acceso a empresa'}</Button>
      {!recoveryMode && <Button type="button" variant="outline" disabled={busy} onClick={() => { setRegister(!register); setPassword(''); setError(''); setUncertain(false); setCheckedPending(false); setRegistrationUncertain(false); }}>{register ? 'Ya tengo cuenta' : 'No tengo cuenta'}</Button>}
      {recoveryMode && <Button type="button" variant="outline" disabled={busy} onClick={() => { setRecoveryMode(false); setCheckedPending(false); setPassword(''); setAttempt(value => value + 1); }}>Volver a consultar invitación</Button>}</div>
      <p className="text-sm text-neutral-600">La autorización no modifica tu cuenta ni aprueba actividades regulatorias nuevas.</p>
    </form>}
    {import.meta.env.VITE_ENTERPRISE_ENABLED === 'true' && readState === 'unavailable' && !recoveryMode && !done && <Button className="mt-3" variant="outline" onClick={() => { setRecoveryMode(true); setRegister(false); setError(''); }}>Comprobar una aceptación anterior</Button>}
    {!done && <div className="mt-3"><Link className="inline-flex min-h-11 items-center text-primary-800 underline" to="/login">Volver al acceso</Link></div>}
  </Card></div>;
}

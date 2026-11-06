import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { getAccessToken } from '../../services/api';
import { registrationSessionOwner } from '../../services/registrationSession';
import { safeLocalRedirect } from '../../utils/authRedirect';

const VerificarEmailPage: React.FC = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [verified, setVerified] = useState<{ verifiedUserId?: string; nextPath?: string }>({});
  const request = useRef<{ token: string; promise: ReturnType<typeof authService.verifyEmail> } | null>(null);
  const token = params.get('token');
  const [confirmed, setConfirmed] = useState('');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [result, setResult] = useState('');
  const requiresClick = Boolean(token?.startsWith('m.') && confirmed !== token);
  const owner = registrationSessionOwner(getAccessToken());
  const differentAccount = Boolean(owner && verified.verifiedUserId && owner !== verified.verifiedUserId);
  const nextPath = safeLocalRedirect(verified.nextPath, '/mi-solicitud');

  useEffect(() => {
    if (requiresClick) return;
    if (!token) { setStatus('error'); setMessage('Ingresá el correo de tu inscripción para solicitar un enlace.'); return; }
    let cancelled = false;
    setStatus('loading');
    // React StrictMode must not consume a one-time token twice.
    if (request.current?.token !== token) request.current = { token, promise: authService.verifyEmail(token) };
    request.current.promise
      .then(r => { if (!cancelled) { setStatus('ok'); setMessage(r.message); setVerified(r); } })
      .catch(err => { if (!cancelled) { setStatus('error'); setMessage(err?.response?.data?.message || 'No pudimos verificar el enlace. Revisá la conexión o si ya fue utilizado.'); } });
    return () => { cancelled = true; };
  }, [token, requiresClick]);

  if (requiresClick) return <section className="w-full max-w-sm text-center"><h1 className="text-xl font-bold">Confirmar mi correo</h1><p className="my-4">Confirmá que querés usar esta dirección para tu cuenta de SITREP.</p><button type="button" className="rounded-lg bg-[#1B5E3C] px-6 py-3 text-white" onClick={() => setConfirmed(token!)}>Confirmar correo</button></section>;

  return (
    <div className="w-full max-w-sm text-center animate-fade-in-up">
      {status === 'loading' && (
        <>
          <Loader2 size={40} className="text-[#1B5E3C] animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-neutral-900 mb-2">Verificar email</h1>
          <p role="status" className="text-neutral-600">Verificando tu email…</p>
        </>
      )}
      {status === 'ok' && (
        <>
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 mb-2">Email verificado</h1>
          <p className="text-neutral-600 mb-6">{message}</p>
          {differentAccount && <p role="status" className="mb-4 text-neutral-700">La sesión abierta pertenece a otra cuenta. No la cambiamos. Para retomar esta inscripción, ingresá luego con la cuenta correspondiente.</p>}
          <Link to={differentAccount ? '/dashboard' : owner && owner === verified.verifiedUserId ? nextPath : '/login'} state={differentAccount ? undefined : { from: nextPath }} className="inline-flex items-center gap-2 bg-[#1B5E3C] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#164D32] transition-colors">
            {differentAccount ? 'Volver a mi sesión' : 'Continuar en SITREP'}
          </Link>
          <p className="mt-4 text-sm text-neutral-600">La verificación no borra tu borrador. Si abriste el correo en otro navegador, ingresá con la cuenta de la inscripción para recuperar lo guardado en SITREP.</p>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 mb-2">{token ? 'Enlace de verificación' : 'Verificar mi correo'}</h1>
          <p className="text-neutral-600 mb-6">{message} {token && 'Tu borrador se conserva.'}</p>
          {token?.startsWith('m.') && <p className="mb-4">Si estabas cambiando el correo de una cuenta ya verificada, pedí a Administración que renueve el enlace de cambio.</p>}
          <form className="mb-6 space-y-3" onSubmit={async event => {
            event.preventDefault();
            if (resending) return;
            setResending(true);
            try { setResult(await authService.resendVerification(email.trim())); }
            catch { setResult('No pudimos procesar el pedido. Intentá de nuevo en un minuto.'); }
            finally { setResending(false); }
          }}>
            <label className="block text-left">Correo de la inscripción<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="block w-full rounded border p-3" /></label>
            <button disabled={resending} className="min-h-11 underline">Solicitar otro enlace de inscripción</button>
            <p role="status">{result}</p>
          </form>
          <Link to="/login" state={{ from: '/mi-solicitud' }} className="inline-flex items-center gap-2 bg-[#1B5E3C] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#164D32] transition-colors">
            Ingresar a mi cuenta
          </Link>
        </>
      )}
    </div>
  );
};

export default VerificarEmailPage;

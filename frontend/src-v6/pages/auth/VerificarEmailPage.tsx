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
  const owner = registrationSessionOwner(getAccessToken());
  const differentAccount = Boolean(owner && verified.verifiedUserId && owner !== verified.verifiedUserId);
  const nextPath = safeLocalRedirect(verified.nextPath, '/mi-solicitud');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Token inválido o faltante.'); return; }
    let cancelled = false;
    setStatus('loading');
    // React StrictMode must not consume a one-time token twice.
    if (request.current?.token !== token) request.current = { token, promise: authService.verifyEmail(token) };
    request.current.promise
      .then(r => { if (!cancelled) { setStatus('ok'); setMessage(r.message); setVerified(r); } })
      .catch(err => { if (!cancelled) { setStatus('error'); setMessage(err?.response?.data?.message || 'No pudimos verificar el enlace. Revisá la conexión o si ya fue utilizado.'); } });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="w-full max-w-sm text-center animate-fade-in-up">
      {status === 'loading' && (
        <>
          <Loader2 size={40} className="text-[#1B5E3C] animate-spin mx-auto mb-4" />
          <p className="text-neutral-600">Verificando tu email...</p>
        </>
      )}
      {status === 'ok' && (
        <>
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Email verificado</h2>
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
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Error de verificación</h2>
          <p className="text-neutral-600 mb-6">{message} Tu borrador no fue eliminado.</p>
          <Link to="/login" state={{ from: '/mi-solicitud' }} className="inline-flex items-center gap-2 bg-[#1B5E3C] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#164D32] transition-colors">
            Ingresar a mi cuenta
          </Link>
        </>
      )}
    </div>
  );
};

export default VerificarEmailPage;

import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { authService } from '../../services/auth.service';

const VerificarEmailPage: React.FC = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('error'); setMessage('Token inválido o faltante.'); return; }
    authService.verifyEmail(token)
      .then(r => { setStatus('ok'); setMessage(r.message); })
      .catch(err => { setStatus('error'); setMessage(err?.response?.data?.message || 'Link inválido o expirado.'); });
  }, []);

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
          <Link to="/login" className="inline-flex items-center gap-2 bg-[#1B5E3C] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#164D32] transition-colors">
            Ir al login
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Error de verificación</h2>
          <p className="text-neutral-600 mb-6">{message} Contactá al administrador.</p>
          <Link to="/login" className="inline-flex items-center gap-2 bg-[#1B5E3C] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#164D32] transition-colors">
            Ir al login
          </Link>
        </>
      )}
    </div>
  );
};

export default VerificarEmailPage;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Hash, CheckCircle2, AlertCircle } from 'lucide-react';
import { authService } from '../../services/auth.service';

const ForgotPasswordPage: React.FC = () => {
  const [mode, setMode] = useState<'email' | 'cuit'>('email');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.forgotPassword(mode === 'email' ? { email: value } : { cuit: value });
      setDone(true);
    } catch {
      setError('Ocurrió un error. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm animate-fade-in-up">
      <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 mb-6">
        <ArrowLeft size={16} /> Volver al login
      </Link>

      {done ? (
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Revisá tu email</h2>
          <p className="text-neutral-600">Si el {mode === 'email' ? 'email' : 'CUIT'} existe en el sistema, recibirás un enlace para restablecer tu contraseña.</p>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Recuperar contraseña</h2>
          <p className="text-sm text-neutral-500 mb-6">Ingresá tu email o CUIT y te enviaremos un enlace</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <button onClick={() => setMode('email')} className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${mode === 'email' ? 'bg-[#1B5E3C] text-white border-[#1B5E3C]' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'}`}>
              Email
            </button>
            <button onClick={() => setMode('cuit')} className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${mode === 'cuit' ? 'bg-[#1B5E3C] text-white border-[#1B5E3C]' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'}`}>
              CUIT
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              {mode === 'email' ? <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" /> : <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />}
              <input
                required
                type={mode === 'email' ? 'email' : 'text'}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={mode === 'email' ? 'tu@email.com' : '20-12345678-9'}
                className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full h-11 bg-[#1B5E3C] hover:bg-[#164D32] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Enviar enlace'}
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default ForgotPasswordPage;

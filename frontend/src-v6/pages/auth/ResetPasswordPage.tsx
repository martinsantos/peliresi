import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { authService } from '../../services/auth.service';

const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    navigate('/recuperar', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    setError(null);
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'El enlace es inválido o expiró.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm animate-fade-in-up">
      {done ? (
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Contraseña restablecida</h2>
          <p className="text-neutral-600 mb-6">Tu contraseña fue actualizada correctamente.</p>
          <Link to="/login" className="inline-flex items-center gap-2 bg-[#1B5E3C] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#164D32] transition-colors">
            Ir al login
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Nueva contraseña</h2>
          <p className="text-sm text-neutral-500 mb-6">Ingresá tu nueva contraseña</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Nueva contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input required type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número" className="w-full h-11 pl-9 pr-10 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Confirmar contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input required type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repetí la contraseña" className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full h-11 bg-[#1B5E3C] hover:bg-[#164D32] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Restablecer contraseña'}
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default ResetPasswordPage;

/**
 * SITREP v6 - Reclamar Cuenta Page
 * =================================
 * Permite a usuarios con email placeholder reclamar su cuenta
 * verificando CUIT + Razon Social y estableciendo email real + password
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Hash, Building2, Mail, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Leaf } from 'lucide-react';
import { authService } from '../../services/auth.service';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { ok: password.length >= 8, label: 'Al menos 8 caracteres' },
    { ok: /[A-Z]/.test(password), label: 'Una mayuscula' },
    { ok: /[0-9]/.test(password), label: 'Un numero' },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['bg-neutral-200', 'bg-red-400', 'bg-yellow-400', 'bg-green-500'];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1 h-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className={`flex-1 rounded-full transition-colors ${i < score ? colors[score] : 'bg-neutral-200'}`} />
        ))}
      </div>
      <div className="flex gap-4">
        {checks.map(({ ok, label }) => (
          <span key={label} className={`text-xs flex items-center gap-1 ${ok ? 'text-green-600' : 'text-neutral-400'}`}>
            <CheckCircle2 size={10} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

const ReclamarCuentaPage: React.FC = () => {
  const [form, setForm] = useState({ cuit: '', razonSocial: '', nuevoEmail: '', password: '', confirmPassword: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const validate = (): string | null => {
    if (form.cuit.replace(/[^0-9]/g, '').length < 8) return 'CUIT debe tener al menos 8 digitos';
    if (form.razonSocial.trim().length < 2) return 'Razon Social es requerida';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.nuevoEmail)) return 'Email invalido';
    if (form.password.length < 8) return 'La contrasena debe tener al menos 8 caracteres';
    if (!/[A-Z]/.test(form.password)) return 'La contrasena debe contener al menos una mayuscula';
    if (!/[0-9]/.test(form.password)) return 'La contrasena debe contener al menos un numero';
    if (form.password !== form.confirmPassword) return 'Las contrasenas no coinciden';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);
    try {
      await authService.claimAccount({
        cuit: form.cuit,
        razonSocial: form.razonSocial,
        nuevoEmail: form.nuevoEmail,
        password: form.password,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al procesar la solicitud. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-md text-center animate-fade-in-up">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-3">Solicitud procesada</h2>
        <p className="text-neutral-600 mb-6">
          Si los datos coinciden con un registro existente, recibiras un email de verificacion.
          Despues de verificar, un administrador aprobara tu acceso.
        </p>
        <Link to="/login" className="inline-flex items-center gap-2 bg-[#1B5E3C] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#164D32] transition-colors">
          Ir al login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md animate-fade-in-up">
      <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 mb-6">
        <ArrowLeft size={16} /> Volver al login
      </Link>

      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-[#1B5E3C] rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Leaf size={26} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900">Reclamar tu cuenta</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Si tu empresa ya esta registrada en SITREP pero no tenes acceso, verifica tu identidad con CUIT y Razon Social
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">CUIT *</label>
          <div className="relative">
            <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              required
              value={form.cuit}
              onChange={set('cuit')}
              placeholder="Ingresa tu CUIT con o sin guiones"
              className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Razon Social *</label>
          <div className="relative">
            <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              required
              value={form.razonSocial}
              onChange={set('razonSocial')}
              placeholder="Nombre de tu empresa"
              className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Nuevo Email *</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              required
              type="email"
              value={form.nuevoEmail}
              onChange={set('nuevoEmail')}
              placeholder="Email donde recibiras el acceso"
              className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Contrasena *</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              required
              type={showPwd ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              placeholder="Min. 8 caracteres"
              className="w-full h-11 pl-9 pr-10 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none"
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {form.password && <PasswordStrength password={form.password} />}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Confirmar Contrasena *</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              required
              type={showPwd ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              placeholder="Repeti la contrasena"
              className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none"
            />
          </div>
          {form.confirmPassword && form.password !== form.confirmPassword && (
            <p className="text-xs text-red-500 mt-1">Las contrasenas no coinciden</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-[#1B5E3C] hover:bg-[#164D32] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Reclamar cuenta'}
        </button>

        <p className="text-center text-sm text-neutral-600">
          ¿Ya tenes acceso?{' '}
          <Link to="/login" className="text-[#1B5E3C] font-semibold hover:underline">Ingresar</Link>
          {' · '}
          <Link to="/registro" className="text-[#1B5E3C] font-semibold hover:underline">Registrate</Link>
        </p>
      </form>
    </div>
  );
};

export default ReclamarCuentaPage;

/**
 * SITREP v6 - Login Page
 * ======================
 * Pagina de inicio de sesion - Real API + Demo fallback
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Leaf, AlertCircle } from 'lucide-react';
import { useAuth, DEMO_CREDENTIALS } from '../../contexts/AuthContext';

const DEMO_USERS = [
  { label: 'Administrador', sublabel: 'DGFA', userId: 1, color: 'bg-primary-500' },
  { label: 'Generador', sublabel: 'Química Mendoza', userId: 5, color: 'bg-purple-500' },
  { label: 'Transportista', sublabel: 'Transportes Andes', userId: 13, color: 'bg-orange-500' },
  { label: 'Operador', sublabel: 'Tratamiento Residuos', userId: 19, color: 'bg-blue-500' },
];

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Ingresa email y contrasena');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(authError || err?.response?.data?.message || 'Error al iniciar sesion. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoUser = async (userId: number) => {
    const creds = DEMO_CREDENTIALS[userId];
    if (!creds) return;
    setLoading(true);
    setError(null);
    try {
      await login(creds.email, creds.password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(authError || err?.response?.data?.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md animate-fade-in-up">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[#1B5E3C] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-scale-in-bounce hover-glow">
          <Leaf size={32} className="text-white" />
        </div>
        <h2 className="text-3xl font-bold text-neutral-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", letterSpacing: '-0.03em' }}>
          SITREP v6
        </h2>
        <p className="text-neutral-600">
          Sistema de Trazabilidad de Residuos Peligrosos
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-3 bg-error-50 border border-error-200 rounded-xl flex items-center gap-2 text-sm text-error-700 animate-fade-in">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Demo users - PRINCIPAL */}
      <div className="mb-8">
        <p className="text-sm text-neutral-500 text-center mb-4 font-medium">
          Selecciona un perfil para ingresar
        </p>
        <div className="grid grid-cols-2 gap-3 stagger-children">
          {DEMO_USERS.map((user) => (
            <button
              key={user.userId}
              onClick={() => handleDemoUser(user.userId)}
              disabled={loading}
              className="p-4 text-left rounded-xl border-2 border-neutral-200 hover:border-primary-500 hover:bg-primary-50 transition-all active:scale-[0.97] disabled:opacity-50 hover-lift"
            >
              <div className={`w-8 h-8 ${user.color} rounded-lg flex items-center justify-center text-white text-xs font-bold mb-2`}>
                {user.label[0]}
              </div>
              <p className="font-semibold text-sm text-neutral-900">{user.label}</p>
              <p className="text-xs text-neutral-500">{user.sublabel}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-neutral-200" />
        <span className="text-xs text-neutral-400 font-medium">o ingresa con credenciales</span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email o CUIT</label>
          <div className="relative">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="tu@email.com o 20-12345678-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 pl-10 pr-4 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Contrasena</label>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 pl-10 pr-10 border border-neutral-200 rounded-xl text-sm focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link to="/recuperar" className="text-sm text-[#1B5E3C] hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-[#1B5E3C] hover:bg-[#164D32] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] btn-glow disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Ingresar
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-600">
        ¿No tenés cuenta?{' '}
        <Link to="/registro" className="text-[#1B5E3C] font-semibold hover:underline">
          Registrate
        </Link>
      </p>
    </div>
  );
};

export default LoginPage;

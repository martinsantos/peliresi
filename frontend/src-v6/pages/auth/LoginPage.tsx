/**
 * SITREP v6 - Login Page
 * ======================
 * Pagina de inicio de sesion - autenticacion contra la API real
 */

import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Leaf, AlertCircle, Factory, Truck, FlaskConical, PlayCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getApiErrorMessage } from '../../utils/api-error';
import { MendozaBrand } from '../../components/MendozaBrand';
import { postLoginDestination } from '../../utils/authRedirect';
import './institutional.css';

const LoginPage: React.FC = () => {
  const isPwaBuild = window.location.pathname.startsWith('/app/');
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Ingresá tu correo electrónico o CUIT y tu contraseña');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const authenticatedUser = await login(email, password);
      const requestedPath = (location.state as { from?: unknown } | null)?.from;
      navigate(postLoginDestination(requestedPath, authenticatedUser?.rol), { replace: true });
    } catch (err: unknown) {
      setError(authError || getApiErrorMessage(err, 'Error al iniciar sesión. Verificá tus credenciales.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`institutional institutional-login ${isPwaBuild ? 'is-pwa' : ''}`}>
    <div className="w-full max-w-md animate-fade-in-up">
      {/* Header — Gobierno de Mendoza + SITREP */}
      <div className="text-center mb-4 md:mb-6">
        <div className="login-brand-lockup">
          <MendozaBrand />
          <div className="sitrep-wordmark">
            <div className="brand-icon w-9 h-9 rounded-xl flex items-center justify-center">
              <Leaf size={20} className="text-white" />
            </div>
            <span style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>SITREP</span>
          </div>
        </div>
        <p className="text-xs md:text-sm text-neutral-600">
          Sistema de Trazabilidad de Residuos Peligrosos
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div data-testid="auth-error" role="alert" className="mb-6 p-3 bg-error-50 border border-error-200 rounded-xl flex items-center gap-2 text-sm text-error-700 animate-fade-in">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4 bg-white rounded-2xl p-4 md:p-0 md:bg-transparent border border-neutral-100 md:border-0 shadow-sm md:shadow-none">
        <div>
          <label htmlFor="login-identifier" className="block text-xs md:text-sm font-medium text-neutral-700 mb-1 md:mb-1.5">Correo electrónico o CUIT</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              id="login-identifier"
              type="text"
              autoComplete="username"
              placeholder="tu@email.com o 20-12345678-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 md:h-11 pl-10 pr-4 border border-neutral-200 rounded-xl text-sm bg-neutral-50 md:bg-white focus:bg-white focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label htmlFor="login-password" className="block text-xs md:text-sm font-medium text-neutral-700 mb-1 md:mb-1.5">Contraseña</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 md:h-11 pl-10 pr-10 border border-neutral-200 rounded-xl text-sm bg-neutral-50 md:bg-white focus:bg-white focus:border-[#1B5E3C] focus:ring-4 focus:ring-[#1B5E3C]/15 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link to="/recuperar" className="brand-link text-xs md:text-sm hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="brand-action w-full h-10 md:h-11 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Ingresar
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Inscripcion de Actores — destacado */}
      <div className="institutional-registration mt-6 md:mt-8 p-3 md:p-4 rounded-2xl">
        <h3 className="text-center text-xs md:text-sm font-bold text-emerald-800 mb-0.5 md:mb-1">
          Inscripción Provincial de Actores
        </h3>
        <p className="text-center text-[10px] md:text-xs text-emerald-600 mb-3 md:mb-4">
          Registrá tu empresa en el sistema de trazabilidad
        </p>
        <div className="grid grid-cols-3 gap-1.5 md:gap-2">
          {[
            { tipo: 'generador', label: 'Generador', Icon: Factory, iconBox: 'bg-purple-100 group-hover:bg-purple-500', iconColor: 'text-purple-600' },
            { tipo: 'transportista', label: 'Transportista', Icon: Truck, iconBox: 'bg-orange-100 group-hover:bg-orange-500', iconColor: 'text-orange-600' },
            { tipo: 'operador', label: 'Operador', Icon: FlaskConical, iconBox: 'bg-blue-100 group-hover:bg-blue-500', iconColor: 'text-blue-600' },
          ].map(({ tipo, label, Icon, iconBox, iconColor }) => (
            <div key={tipo} className="flex flex-col overflow-hidden rounded-xl border border-emerald-200 bg-white transition-all hover:shadow-md">
              <Link
                to={`/inscripcion/${tipo}`}
                aria-label={`Iniciar alta de ${label}`}
                className="group flex flex-col items-center gap-1.5 p-2 md:gap-2 md:p-3"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors md:h-10 md:w-10 ${iconBox}`}>
                  <Icon size={18} className={`${iconColor} transition-colors group-hover:text-white`} />
                </div>
                <span className="text-center text-[10px] font-semibold leading-tight text-neutral-700 md:text-xs">{label}</span>
              </Link>
              <Link
                to={`/inscripcion/${tipo}?modo=revision`}
                aria-label={`Probar formulario de ${label} sin completar datos`}
                className="flex min-h-9 items-center justify-center gap-1 border-t border-emerald-100 bg-emerald-50 px-1.5 py-1.5 text-[9px] font-semibold text-emerald-800 transition hover:bg-emerald-100 md:text-[10px]"
              >
                <PlayCircle size={12} aria-hidden="true" />
                Probar
              </Link>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-neutral-600">
        ¿Ya tenés cuenta?{' '}
        <Link to="/reclamar" className="brand-link font-semibold hover:underline">
          Reclamá tu cuenta
        </Link>
      </p>

      {/* Gobierno de Mendoza — pie */}
      <footer className="login-institutional-footer">
        <MendozaBrand />
        <p className="text-center text-xs text-neutral-500">Provincia de Mendoza · Fiscalización Ambiental</p>
      </footer>
    </div>
    </div>
  );
};

export default LoginPage;
